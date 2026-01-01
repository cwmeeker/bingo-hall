// ------------------------------------------------------------
// Socket.IO
// ------------------------------------------------------------
const socket = io();

// ------------------------------------------------------------
// DOM Elements
// ------------------------------------------------------------
const lastNumberEl = document.getElementById("last-number");
const drawButton = document.getElementById("draw-button");
const newGameButton = document.getElementById("new-game-button");
const boardEl = document.getElementById("caller-board");

const autoToggle = document.getElementById("autoCallerToggle");
const numDelayInput = document.getElementById("numDelay");
const gameDelayInput = document.getElementById("gameDelay");

// ------------------------------------------------------------
// Auto Caller Settings
// ------------------------------------------------------------
autoToggle.addEventListener("change", sendAutoCallerSettings);
numDelayInput.addEventListener("input", sendAutoCallerSettings);
gameDelayInput.addEventListener("input", sendAutoCallerSettings);

function sendAutoCallerSettings() {
    const enabled = autoToggle.checked;
    const numberDelay = Number(numDelayInput.value) * 1000;
    const gameDelay = Number(gameDelayInput.value) * 1000;

    console.log("Sending auto-caller settings", { enabled, numberDelay, gameDelay });

    socket.emit("updateAutoCallerSettings", {
        enabled,
        numberDelay,
        gameDelay
    });
}

// ------------------------------------------------------------
// Caller Board Rendering
// ------------------------------------------------------------
function buildCallerBoard() {
    boardEl.innerHTML = "";
    let n = 1;

    for (let r = 0; r < 5; r++) {
        const row = document.createElement("tr");

        for (let c = 0; c < 15; c++) {
            const cell = document.createElement("td");
            cell.textContent = n;
            cell.dataset.num = n;
            cell.classList.add("cell");
            row.appendChild(cell);
            n++;
        }

        boardEl.appendChild(row);
    }
}

function highlight(num) {
    const cell = document.querySelector(`#caller-board .cell[data-num="${num}"]`);
    if (cell) cell.classList.add("called");
}

function resetBoard() {
    document.querySelectorAll("#caller-board .cell.called")
        .forEach(cell => cell.classList.remove("called"));

    lastNumberEl.textContent = "None";
}

function updateCalledCount(calledNumbers) {
    const el = document.getElementById("called-count");
    if (el) el.textContent = `Numbers Called: ${calledNumbers.length} / 75`;
}

// Build board immediately
buildCallerBoard();

// ------------------------------------------------------------
// Button Events
// ------------------------------------------------------------
drawButton.addEventListener("click", () => {
    socket.emit("drawNumber");
});

newGameButton.addEventListener("click", () => {
    socket.emit("startGame");
});

// ------------------------------------------------------------
// Socket Events
// ------------------------------------------------------------
socket.on("syncState", ({ calledNumbers }) => {
    resetBoard();
    updateCalledCount(calledNumbers);

    if (!calledNumbers || calledNumbers.length === 0) return;

    calledNumbers.forEach(num => highlight(num));

    const last = calledNumbers[calledNumbers.length - 1];
    if (last) lastNumberEl.textContent = last;
});

socket.on("numberCalled", ({ num, letter, calledNumbers }) => {
    lastNumberEl.textContent = `${letter}${num}`;
    highlight(num);
    updateCalledCount(calledNumbers);

    console.log("caller client received calledNumbers", calledNumbers);
});

socket.on("startGame", () => {
    resetBoard();
    updateCalledCount([]);
});

socket.on("nextGameCountdown", ({ remaining, bingoActive }) => {
    const countDiv = document.getElementById("called-count");

    console.log("Received countdown info:", { remaining, bingoActive });

    if (bingoActive) {
        countDiv.textContent = `Waiting for ${remaining} seconds for other players to call BINGO`;
    } else {
        countDiv.textContent = `Next Game will start in ${remaining} seconds`;
    }
});
