// ------------------------------------------------------------
// Player Identity
// ------------------------------------------------------------
function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();

    return ([1e7] + -1e3 + -4e3 + -8e3 + -1e3).replace(/[018]/g, c =>
        (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
}

let playerId = sessionStorage.getItem("playerId");
if (!playerId) {
    playerId = uuid();
    sessionStorage.setItem("playerId", playerId);
}

// ------------------------------------------------------------
// DOM Elements
// ------------------------------------------------------------
const callerBoardEl = document.getElementById("caller-board");
const tableEl = document.getElementById("cardContainer");
const lastNumberEl = document.getElementById("last-number");
const bingoButton = document.getElementById("bingo-button");
const cardCountSelect = document.getElementById("cardCount");
const soundBtn = document.getElementById("enable-sound");

// ------------------------------------------------------------
// Socket.IO
// ------------------------------------------------------------
const socket = io({ query: { playerId } });

let card = null;
let cardReady = false;
let pendingCalls = [];
let soundEnabled = false;

// ------------------------------------------------------------
// Caller Board Rendering
// ------------------------------------------------------------
function updateCallerBoard(calledNumbers) {
    document.querySelectorAll("#caller-board td").forEach(td => {
        td.classList.remove("called", "recent");
    });

    calledNumbers.forEach(num => {
        const cell = document.querySelector(`#caller-board td[data-num="${num}"]`);
        if (cell) cell.classList.add("called");
    });

    const last = calledNumbers[calledNumbers.length - 1];
    const lastCell = document.querySelector(`#caller-board td[data-num="${last}"]`);
    if (lastCell) lastCell.classList.add("recent");
}

function updateCalledCount(calledNumbers) {
    const el = document.getElementById("called-count");
    if (el) el.textContent = `Numbers Called: ${calledNumbers.length} / 75`;
}

// ------------------------------------------------------------
// Card Rendering
// ------------------------------------------------------------
function renderCards(cardsArray) {
    const wrapper = document.getElementById("cardsContainer");
    wrapper.innerHTML = "";

    cardsArray.forEach((cardData, index) => {
        const table = document.createElement("table");
        table.classList.add("bingo-card");
        table.dataset.cardIndex = index;

        // Header row
        const headerRow = document.createElement("tr");
        ["B", "I", "N", "G", "O"].forEach(letter => {
            const th = document.createElement("th");
            th.textContent = letter;
            th.classList.add("card-header");
            headerRow.appendChild(th);
        });
        table.appendChild(headerRow);

        // 5×5 grid
        for (let r = 0; r < 5; r++) {
            const row = document.createElement("tr");

            for (let c = 0; c < 5; c++) {
                const cell = document.createElement("td");
                const value = cardData[c][r];

                cell.textContent = value === "FREE" ? "FREE" : value;
                cell.dataset.row = r;
                cell.dataset.col = c;
                cell.dataset.cardIndex = index;

            // 🔥 Add this line — this is your cellIndex
                cell.dataset.index = index * 25 + (r * 5 + c);

                if (value !== "FREE") cell.dataset.num = value;

                cell.classList.add("cell");

                if (r === 2 && c === 2) {
                cell.classList.add("free", "marked");
                } else {
                    cell.addEventListener("click", () => {
                        const isNowMarked = cell.classList.toggle("marked");
                        const cellIndex = Number(cell.dataset.index);

                        socket.emit("markSquare", {
                            index: cellIndex,
                            marked: isNowMarked
                        });
                    });
                }

                row.appendChild(cell);
            }

            table.appendChild(row);
        }

        wrapper.appendChild(table);
    });
}

// ------------------------------------------------------------
// Highlighting
// ------------------------------------------------------------
function highlight(num) {
    document.querySelectorAll(`.cell[data-num="${num}"]`)
        .forEach(cell => cell.classList.add("called"));
}

function applySyncState(calledNumbers) {
    calledNumbers.forEach(num => highlight(num));
}

// ------------------------------------------------------------
// Sound
// ------------------------------------------------------------
function speak(text) {
    if (!soundEnabled) return;

    speechSynthesis.cancel();

    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1;
    utter.pitch = 1;
    utter.volume = 1;

    speechSynthesis.speak(utter);
}

soundBtn.addEventListener("click", () => {
    soundEnabled = !soundEnabled;

    if (soundEnabled) {
        speak("Sound enabled");
        soundBtn.textContent = "Sound: ON";
    } else {
        speechSynthesis.cancel();
        soundBtn.textContent = "Sound: OFF";
    }
});

// ------------------------------------------------------------
// Card Count Dropdown
// ------------------------------------------------------------
cardCountSelect.addEventListener("change", () => {
    const count = Number(cardCountSelect.value);
    socket.emit("getCard", count);
});

// ------------------------------------------------------------
// Socket Events
// ------------------------------------------------------------
socket.on("connect", () => {
    const count = Number(cardCountSelect.value);
    socket.emit("getCard", count);
});

socket.on("cardAndState", ({ cards, marked }) => {
    console.log("Received cards:", cards, "with marked cells:", marked });
    card = cards;
    renderCards(cards);
    cardReady = true;

    // Restore marks immediately on the freshly rendered DOM
    if (Array.isArray(marked)) {
        marked.forEach(index => {
            const cell = document.querySelector(`[data-index="${index}"]`);
            if (cell) cell.classList.add("marked");
        });
    }

    pendingCalls.forEach(num => highlight(num));
    pendingCalls = [];
});

socket.on("syncState", ({ calledNumbers }) => {
    if (Array.isArray(calledNumbers)) {
        updateCallerBoard(calledNumbers);
        updateCalledCount(calledNumbers);
    }

    if (cardReady) applySyncState(calledNumbers);
    else pendingCalls.push(...calledNumbers);
});

socket.on("numberCalled", ({ num, letter, calledNumbers }) => {
    lastNumberEl.textContent = `${letter}${num}`;
    speak(`${letter} ${num}`);

    if (Array.isArray(calledNumbers)) {
        updateCallerBoard(calledNumbers);
        updateCalledCount(calledNumbers);
    }

    if (!cardReady) {
        pendingCalls.push(num);
        return;
    }

    highlight(num);
});

socket.on("startGame", () => {
    updateCallerBoard([]);
    updateCalledCount([]);
    lastNumberEl.textContent = "None";

    if (cardReady) {
        document.querySelectorAll(".cell").forEach(cell => {
            cell.classList.remove("called", "marked");
            if (cell.classList.contains("free")) cell.classList.add("marked");
        });
    }

    pendingCalls = [];
});

socket.on("winner", () => {
    speak("BINGO has been called");
});

socket.on("invalidBingo", () => {
    alert("Not a valid Bingo yet.");
});

socket.on("nextGameCountdown", ({ remaining, bingoActive }) => {
    const countDiv = document.getElementById("called-count");

    if (bingoActive) {
        countDiv.textContent = `BINGO! waiting ${remaining} seconds for other players to call`;
    } else {
        countDiv.textContent = `Next Game will start in ${remaining} seconds`;
    }
});

// ------------------------------------------------------------
// Claim Bingo
// ------------------------------------------------------------
bingoButton.addEventListener("click", () => {
    if (!card) return;

    const markedCells = [];

    document.querySelectorAll(".bingo-card").forEach((table, cardIndex) => {
        const positions = [];

        table.querySelectorAll(".cell.marked").forEach(cell => {
            positions.push({
                row: parseInt(cell.dataset.row, 10),
                col: parseInt(cell.dataset.col, 10)
            });
        });

        markedCells.push({ cardIndex, positions });
    });

    socket.emit("claimBingo", markedCells);
});
