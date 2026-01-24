 // --- AUDIO SYSTEM ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(freq, type, duration, vol = 0.1) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

const sfx = {
    start: () => {
        [440, 554, 659, 880].forEach((f, i) => {
            setTimeout(() => playSound(f, 'sine', 0.2, 0.1), i * 80);
        });
    },
    move: () => playSound(150, 'sine', 0.05, 0.05),
    rotate: () => playSound(300, 'triangle', 0.05, 0.05),
    clear: () => {
        [600, 800, 1000].forEach((f, i) => {
            setTimeout(() => playSound(f, 'square', 0.3, 0.08), i * 50);
        });
    },
    gameOver: () => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.frequency.setValueAtTime(200, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 1);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 1);
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.start(); osc.stop(audioCtx.currentTime + 1);
    },
    highScore: () => {
        const notes = [523, 523, 659, 783, 659, 783, 1046];
        notes.forEach((f, i) => {
            setTimeout(() => playSound(f, 'square', 0.4, 0.08), i * 120);
        });
    }
};

// --- GAME LOGIC ---
const canvas = document.getElementById('tetris');
const context = canvas.getContext('2d');
const nextCanvas = document.getElementById('nextPiece');
const nextContext = nextCanvas.getContext('2d');

context.scale(20, 20);
nextContext.scale(25, 25);

const colors = [null, '#FF0D72', '#0DC2FF', '#0DFF72', '#F538FF', '#FF8E0D', '#FFE138', '#3877FF'];
let paused = false;
let gameRunning = false;
let highScore = localStorage.getItem('tetrisHighScore') || 0;

document.getElementById('highScore').innerText = highScore;
document.getElementById('menu-high-score').innerText = highScore;

function createPiece(type) {
    if (type === 'T') return [[0, 1, 0], [1, 1, 1], [0, 0, 0]];
    if (type === 'O') return [[2, 2], [2, 2]];
    if (type === 'L') return [[0, 3, 0], [0, 3, 0], [0, 3, 3]];
    if (type === 'J') return [[0, 4, 0], [0, 4, 0], [4, 4, 0]];
    if (type === 'I') return [[0, 5, 0, 0], [0, 5, 0, 0], [0, 5, 0, 0], [0, 5, 0, 0]];
    if (type === 'S') return [[0, 6, 6], [6, 6, 0], [0, 0, 0]];
    if (type === 'Z') return [[7, 7, 0], [0, 7, 7], [0, 0, 0]];
}

function startGame() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    sfx.start();
    
    arena.forEach(row => row.fill(0));
    player.score = 0;
    player.level = 1;
    player.next = null;
    gameRunning = true;
    paused = false;
    
    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('game-over-screen').style.display = 'none';
    document.getElementById('pause-overlay').style.display = 'none';
    
    playerReset();
    updateStats();
    update();
}

function gameOver() {
    gameRunning = false;
    sfx.gameOver();
    let isNewRecord = false;
    if (player.score > highScore) {
        highScore = player.score;
        localStorage.setItem('tetrisHighScore', highScore);
        document.getElementById('highScore').innerText = highScore;
        document.getElementById('menu-high-score').innerText = highScore;
        isNewRecord = true;
        setTimeout(() => sfx.highScore(), 1000);
    }
    document.getElementById('final-score').innerText = player.score;
    document.getElementById('new-best-msg').style.display = isNewRecord ? 'block' : 'none';
    document.getElementById('game-over-screen').style.display = 'flex';
}

function draw() {
    context.fillStyle = '#000';
    context.fillRect(0, 0, canvas.width, canvas.height);
    drawMatrix(arena, {x: 0, y: 0}, context);
    if (gameRunning) drawMatrix(player.matrix, player.pos, context);

    nextContext.fillStyle = '#333';
    nextContext.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
    if (player.next) drawMatrix(player.next, {x: 0.5, y: 0.5}, nextContext);
}

function drawMatrix(matrix, offset, ctx) {
    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                ctx.fillStyle = colors[value];
                ctx.fillRect(x + offset.x, y + offset.y, 1, 1);
                ctx.lineWidth = 0.05;
                ctx.strokeStyle = 'rgba(255,255,255,0.3)';
                ctx.strokeRect(x + offset.x, y + offset.y, 1, 1);
            }
        });
    });
}

function arenaSweep() {
    let rowCount = 1;
    let rowsCleared = 0;
    outer: for (let y = arena.length - 1; y > 0; --y) {
        for (let x = 0; x < arena[y].length; ++x) {
            if (arena[y][x] === 0) continue outer;
        }
        const row = arena.splice(y, 1)[0].fill(0);
        arena.unshift(row);
        ++y;
        player.score += rowCount * 10;
        rowCount *= 2;
        rowsCleared++;
    }
    if (rowsCleared > 0) sfx.clear();
    updateStats();
}

function collide(arena, player) {
    const [m, o] = [player.matrix, player.pos];
    for (let y = 0; y < m.length; ++y) {
        for (let x = 0; x < m[y].length; ++x) {
            if (m[y][x] !== 0 && (arena[y + o.y] && arena[y + o.y][x + o.x]) !== 0) return true;
        }
    }
    return false;
}

function createMatrix(w, h) {
    const matrix = [];
    while (h--) matrix.push(new Array(w).fill(0));
    return matrix;
}

function merge(arena, player) {
    player.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) arena[y + player.pos.y][x + player.pos.x] = value;
        });
    });
}

function playerDrop() {
    if (!gameRunning || paused) return;
    player.pos.y++;
    if (collide(arena, player)) {
        player.pos.y--;
        merge(arena, player);
        playerReset();
        arenaSweep();
    }
    dropCounter = 0;
}

function playerHardDrop() {
    if (!gameRunning || paused) return;
    while (!collide(arena, player)) {
        player.pos.y++;
    }
    player.pos.y--;
    merge(arena, player);
    sfx.move();
    playerReset();
    arenaSweep();
    dropCounter = 0;
}

function playerMove(dir) {
    if (!gameRunning || paused) return;
    player.pos.x += dir;
    if (collide(arena, player)) {
        player.pos.x -= dir;
    } else {
        sfx.move();
    }
}

function playerReset() {
    const pieces = 'ILJOTSZ';
    if (!player.next) player.next = createPiece(pieces[pieces.length * Math.random() | 0]);
    player.matrix = player.next;
    player.next = createPiece(pieces[pieces.length * Math.random() | 0]);
    player.pos.y = 0;
    player.pos.x = (arena[0].length / 2 | 0) - (player.matrix[0].length / 2 | 0);
    if (collide(arena, player)) gameOver();
}

function playerRotate(dir) {
    if (!gameRunning || paused) return;
    const pos = player.pos.x;
    let offset = 1;
    rotate(player.matrix, dir);
    while (collide(arena, player)) {
        player.pos.x += offset;
        offset = -(offset + (offset > 0 ? 1 : -1));
        if (offset > player.matrix[0].length) {
            rotate(player.matrix, -dir);
            player.pos.x = pos;
            return;
        }
    }
    sfx.rotate();
}

function rotate(matrix, dir) {
    for (let y = 0; y < matrix.length; ++y) {
        for (let x = 0; x < y; ++x) {
            [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
        }
    }
    if (dir > 0) matrix.forEach(row => row.reverse());
    else matrix.reverse();
}

function togglePause() {
    if (!gameRunning) return;
    paused = !paused;
    document.getElementById('pause-overlay').style.display = paused ? 'flex' : 'none';
}

let dropCounter = 0;
let lastTime = 0;

function update(time = 0) {
    if (!gameRunning) return;
    const deltaTime = time - lastTime;
    lastTime = time;

    let dropInterval = 1000 * Math.pow(0.99, player.level - 1);

    if (!paused) {
        dropCounter += deltaTime;
        if (dropCounter > dropInterval) playerDrop();
    }

    draw();
    requestAnimationFrame(update);
}

function updateStats() {
    player.level = Math.floor(player.score / 100) + 1;
    document.getElementById('score').innerText = player.score;
    document.getElementById('level').innerText = player.level;
}

const arena = createMatrix(12, 20);
const player = { pos: {x: 0, y: 0}, matrix: null, next: null, score: 0, level: 1 };

document.addEventListener('keydown', event => {
    if (event.keyCode === 37) playerMove(-1); // Left
    else if (event.keyCode === 39) playerMove(1);  // Right
    else if (event.keyCode === 40) { playerDrop(); sfx.move(); } // Down
    else if (event.keyCode === 32) playerHardDrop(); // Space
    else if (event.keyCode === 81) playerRotate(-1); // Q
    else if (event.keyCode === 87) playerRotate(1);  // W
    else if (event.keyCode === 80 || event.keyCode === 27) togglePause(); // P or ESC
});

draw();