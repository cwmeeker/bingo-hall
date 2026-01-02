// ------------------------------------------------------------
// Imports & Setup
// ------------------------------------------------------------
import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// ------------------------------------------------------------
// Static Files & Routes
// ------------------------------------------------------------
app.use(express.static(path.join(__dirname, "public")));

app.get("/caller", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "caller.html"));
});

app.get("/player", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "player.html"));
});

// ------------------------------------------------------------
// Game State
// ------------------------------------------------------------
const allNumbers = Array.from({ length: 75 }, (_, i) => i + 1);

let calledNumbers = [];
const playerCards = {}; // keyed by playerId

const playerStates = {};

let autoCallerEnabled = true;
let autoCallerInterval = null;
let autoGameInterval = null;
let gracePeriodInterval = null;

let timeBetweenNumbers = 5000; // ms
let timeBetweenGames = 30000;  // ms

let bingoActive = false;
let nextGameCountdown = 0;

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------
function generateCard() {
    const ranges = [
        [1, 15], [16, 30], [31, 45], [46, 60], [61, 75]
    ];

    const card = [];

    for (let c = 0; c < 5; c++) {
        const [min, max] = ranges[c];
        const nums = [];

        while (nums.length < 5) {
            const n = Math.floor(Math.random() * (max - min + 1)) + min;
            if (!nums.includes(n)) nums.push(n);
        }

        card[c] = nums;
    }

    card[2][2] = "FREE";
    return card;
}

function getLetterForNumber(num) {
    if (num <= 15) return "B";
    if (num <= 30) return "I";
    if (num <= 45) return "N";
    if (num <= 60) return "G";
    if (num <= 75) return "O";
    return "";
}

function drawNewNumber() {
    const available = allNumbers.filter(n => !calledNumbers.includes(n));
    if (available.length === 0) return null;

    const num = available[Math.floor(Math.random() * available.length)];
    return { num, letter: getLetterForNumber(num) };
}

// ------------------------------------------------------------
// Game Flow
// ------------------------------------------------------------
function startNewGame() {
    console.log("Starting new game");

    bingoActive = true;
    calledNumbers = [];

    io.emit("startGame", { calledNumbers: [] });
    nextGameCountdown = 0;
}

function startAutoCaller() {
    stopAutoCaller();
    bingoActive = true;

    autoCallerInterval = setInterval(() => {
        const next = drawNewNumber();
        if (!next) {
            startNextGameCountdown();
            return;
        }

        const { num, letter } = next;
        calledNumbers.push(num);

        console.log("AUTO DRAW:", letter + num, "calledNumbers:", calledNumbers);

        io.emit("numberCalled", { num, letter, calledNumbers });
    }, timeBetweenNumbers);
}

function stopAutoCaller() {
    clearInterval(autoCallerInterval);
    autoCallerInterval = null;

    clearInterval(autoGameInterval);
    autoGameInterval = null;
}

function pauseAutoCaller() {
    clearInterval(autoCallerInterval);
    autoCallerInterval = null;
}

function startNextGameCountdown() {
    pauseAutoCaller();

    clearInterval(gracePeriodInterval);
    let remaining = 10;

    io.emit("nextGameCountdown", { remaining, bingoActive });

    gracePeriodInterval = setInterval(() => {
        remaining--;
        io.emit("nextGameCountdown", { remaining, bingoActive });

        if (remaining <= 0) {
            clearInterval(gracePeriodInterval);
            gracePeriodInterval = null;

            bingoActive = false;
            scheduleNextGame();
        }
    }, 1000);
}

function scheduleNextGame() {
    clearInterval(autoCallerInterval);

    let remaining = timeBetweenGames / 1000;

    autoGameInterval = setInterval(() => {
        remaining--;
        io.emit("nextGameCountdown", { remaining, bingoActive });

        if (remaining <= 0) {
            startNewGame();
            if (autoCallerEnabled) startAutoCaller();
        }
    }, 1000);
}

// ------------------------------------------------------------
// Bingo Validation
// ------------------------------------------------------------
function validateBingo(card, markedCells, called) {
    const isMarked = (r, c) =>
        (r === 2 && c === 2) || markedCells.some(m => m.row === r && m.col === c);

    const isCalled = (r, c) => {
        if (r === 2 && c === 2) return true;
        const value = card[c][r];
        return value === "FREE" || called.includes(value);
    };

    // Rows
    for (let r = 0; r < 5; r++) {
        if ([0, 1, 2, 3, 4].every(c => isMarked(r, c) && isCalled(r, c))) return true;
    }

    // Columns
    for (let c = 0; c < 5; c++) {
        if ([0, 1, 2, 3, 4].every(r => isMarked(r, c) && isCalled(r, c))) return true;
    }

    // Diagonals
    if ([0, 1, 2, 3, 4].every(i => isMarked(i, i) && isCalled(i, i))) return true;
    if ([0, 1, 2, 3, 4].every(i => isMarked(i, 4 - i) && isCalled(i, 4 - i))) return true;

    return false;
}

// ------------------------------------------------------------
// Socket.IO
// ------------------------------------------------------------
io.on("connection", socket => {
    const playerId = socket.handshake.query.playerId || null;

    if (playerId && !playerStates[playerId]) {
        playerStates[playerId] = {
            card: [],
            marked: new Set()
        };
    }

    socket.on("markSquare", ({ index, marked }) => {
        if (!playerId) return;
        const state = playerStates[playerId];
        if (!state) return;

        if (marked) {
            state.marked.add(index);
        } else {
            state.marked.delete(index);
        }
    });

    console.log("Socket connected:", socket.id, "playerId:", playerId);

    // Sync current state
    socket.emit("syncState", { calledNumbers });

    // Player requests cards
    socket.on("getCard", (count = 1) => {
        if (!playerId) return;

        if (!playerCards[playerId] || playerCards[playerId].length !== count) {
            playerCards[playerId] = Array.from({ length: count }, () => generateCard());
        }

        socket.emit("cardData", playerCards[playerId]);

        if (playerId && playerStates[playerId]) {
            socket.emit("restoreState", {
                marked: Array.from(playerStates[playerId].marked)
            });
        }

    });

    // Caller draws a number
    socket.on("drawNumber", () => {
        const result = drawNewNumber();
        if (!result) return;

        const { num, letter } = result;
        calledNumbers.push(num);

        io.emit("numberCalled", { num, letter, calledNumbers });
    });

    // Caller starts a new game
    socket.on("startGame", () => {
        calledNumbers = [];
        io.emit("startGame", { calledNumbers });
    });

    // Player claims Bingo
    socket.on("claimBingo", markedCards => {
        if (!playerId || !playerCards[playerId]) {
            socket.emit("invalidBingo");
            return;
        }

        const cards = playerCards[playerId];
        let valid = false;

        for (const { cardIndex, positions } of markedCards) {
            if (validateBingo(cards[cardIndex], positions, calledNumbers)) {
                valid = true;
                break;
            }
        }

        if (valid && bingoActive) {
            io.emit("winner", { playerId });
            pauseAutoCaller();
            startNextGameCountdown();
        } else {
            socket.emit("invalidBingo");
        }
    });

    // Auto-caller settings
    socket.on("updateAutoCallerSettings", ({ enabled, numberDelay, gameDelay }) => {
        autoCallerEnabled = enabled;
        timeBetweenNumbers = numberDelay;
        timeBetweenGames = gameDelay;

        if (enabled) startAutoCaller();
        else stopAutoCaller();
    });

    socket.on("disconnect", () => {

        console.log("Socket disconnected:", socket.id, "playerId:", playerId);

        // delete playerStates[socket.id];
    });
});

// ------------------------------------------------------------
// Start Server
// ------------------------------------------------------------
server.listen(8080, () => {
    console.log("Server listening on port 8080");
});

startAutoCaller();
