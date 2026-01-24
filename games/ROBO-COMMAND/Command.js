const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// --- STATE ---
let score = 0, bombs = 1, gameState = 'START';
let enemies = [], missiles = [], explosions = [], cities = [], powerups = [];
let cursor = { x: 400, y: 300 };
let activePower = null, powerTimer = 0;
let highScores = JSON.parse(localStorage.getItem('cyberScores')) || [];
document.getElementById('hi-score-val').innerText = highScores[0] ? highScores[0].score : 0;

function playSound(freq, type, duration, vol) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(10, audioCtx.currentTime + duration);
    gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + duration);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + duration);
}

// --- CLASSES ---
class City {
    constructor(x) { this.x = x; this.y = 550; this.alive = true; this.pulse = 0; }
    draw() {
        if (!this.alive) return;
        this.pulse += 0.05;
        let glow = Math.sin(this.pulse) * 5 + 5;
        ctx.fillStyle = '#111'; ctx.fillRect(this.x - 30, 560, 60, 40);
        ctx.strokeStyle = '#00ffff'; ctx.shadowBlur = glow; ctx.shadowColor = '#00ffff';
        ctx.strokeRect(this.x - 30, 560, 60, 40);
        ctx.fillStyle = '#00ffff';
        for(let i=0; i<3; i++) for(let j=0; j<2; j++) ctx.fillRect(this.x - 20 + (i*15), 570 + (j*15), 8, 8);
        ctx.shadowBlur = 0;
    }
}

class PowerUp {
    constructor(x, y) {
        this.x = x; this.y = y;
        const types = ['TRIPLE', 'FAST', 'REBUILD', 'BOMB'];
        this.type = types[Math.floor(Math.random() * types.length)];
    }
    update() { this.y += 1.2; }
    draw() {
        const colors = {TRIPLE:'#ff0', FAST:'#0ff', REBUILD:'#f00', BOMB:'#0f0'};
        ctx.fillStyle = colors[this.type]; ctx.beginPath(); ctx.arc(this.x, this.y, 12, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#000'; ctx.font = 'bold 10px Arial'; ctx.fillText(this.type[0], this.x-4, this.y+4);
    }
}

class RoboEnemy {
    constructor() {
        this.x = Math.random() * 800; this.y = -20;
        const liveCities = cities.filter(c => c.alive);
        const target = liveCities[Math.floor(Math.random() * liveCities.length)] || {x: 400};
        this.speed = Math.min(2.5, 0.7 + (score / 25000));
        this.angle = Math.atan2(580 - this.y, target.x - this.x);
    }
    update() { this.x += Math.cos(this.angle) * this.speed; this.y += Math.sin(this.angle) * this.speed; }
    draw() { ctx.strokeStyle = '#ff0055'; ctx.lineWidth = 2; ctx.strokeRect(this.x-8, this.y-8, 16, 16); }
}

// --- ENGINE ---
function togglePause() {
    if (gameState === 'PLAYING') {
        gameState = 'PAUSED';
        document.getElementById('pause-screen').classList.remove('hidden');
        document.exitPointerLock();
    } else if (gameState === 'PAUSED') {
        gameState = 'PLAYING';
        document.getElementById('pause-screen').classList.add('hidden');
        canvas.requestPointerLock();
    }
}

function update() {
    if (gameState !== 'PLAYING') return; // The core pause logic: skip calculations

    if (Math.random() < 0.007 + (score/200000)) enemies.push(new RoboEnemy());
    if (powerTimer > 0) { powerTimer--; if (powerTimer <= 0) activePower = null; }

    enemies.forEach((e, i) => {
        e.update();
        if (e.y > 560) {
            enemies.splice(i, 1); playSound(50, 'sawtooth', 0.5, 0.3);
            let targetCity = cities.find(c => Math.abs(c.x - e.x) < 50 && c.alive);
            if (targetCity) targetCity.alive = false;
            if (cities.every(c => !c.alive)) checkHighScores();
        }
    });

    missiles.forEach((m, i) => {
        m.x += m.vx; m.y += m.vy;
        if (m.y <= m.ty) {
            explosions.push({x: m.tx, y: m.ty, r: 0, active: true});
            playSound(120, 'square', 0.1, 0.05);
            missiles.splice(i, 1);
        }
    });

    powerups.forEach((p, i) => {
        p.update();
        if (Math.hypot(p.x - cursor.x, p.y - cursor.y) < 25) {
            playSound(800, 'sine', 0.2, 0.1);
            if (p.type === 'REBUILD') { let dead = cities.find(c => !c.alive); if(dead) dead.alive = true; }
            else if (p.type === 'BOMB') bombs++;
            else { activePower = p.type; powerTimer = 600; }
            powerups.splice(i, 1);
        }
    });

    explosions.forEach((ex, i) => {
        ex.r += 2.5; if (ex.r > 60) ex.active = false;
        enemies.forEach((e, ei) => {
            if (Math.hypot(e.x - ex.x, e.y - ex.y) < ex.r + 10) {
                if (Math.random() < 0.1) powerups.push(new PowerUp(e.x, e.y));
                enemies.splice(ei, 1); score += 100;
            }
        });
    });
    explosions = explosions.filter(ex => ex.active);
    document.getElementById('score').innerText = score;
    document.getElementById('bombs').innerText = bombs;
}

function draw() {
    ctx.fillStyle = 'rgba(2, 2, 8, 0.3)'; ctx.fillRect(0, 0, 800, 600);
    cities.forEach(c => c.draw());
    enemies.forEach(e => e.draw());
    powerups.forEach(p => p.draw());
    missiles.forEach(m => { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(m.x, m.y, 3, 0, Math.PI*2); ctx.fill(); });
    explosions.forEach(ex => {
        let grad = ctx.createRadialGradient(ex.x, ex.y, 0, ex.x, ex.y, ex.r);
        grad.addColorStop(0, '#fff'); grad.addColorStop(1, 'rgba(0,255,255,0)');
        ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(ex.x, ex.y, ex.r, 0, Math.PI*2); ctx.fill();
    });
    if (gameState === 'PLAYING') {
        ctx.strokeStyle = activePower ? '#ffff00' : '#fff'; 
        ctx.strokeRect(cursor.x-10, cursor.y-10, 20, 20);
    }
    requestAnimationFrame(draw);
}

// --- UTILS ---
function checkHighScores() {
    gameState = 'GAMEOVER'; document.exitPointerLock();
    if (highScores.length < 5 || score > highScores[highScores.length - 1].score) {
        document.getElementById('name-entry').classList.remove('hidden');
    } else showGameOver();
}

function saveScore() {
    let name = document.getElementById('playerName').value.toUpperCase() || 'AAA';
    highScores.push({name, score});
    highScores.sort((a, b) => b.score - a.score);
    highScores = highScores.slice(0, 5);
    localStorage.setItem('cyberScores', JSON.stringify(highScores));
    document.getElementById('name-entry').classList.add('hidden');
    showGameOver();
}

function showGameOver() {
    document.getElementById('game-over-screen').classList.remove('hidden');
    document.getElementById('high-score-list').innerHTML = '<h3>LEADERBOARD</h3>' + 
        highScores.map((s, i) => `<div>${i+1}. ${s.name} - ${s.score}</div>`).join('');
}

// --- INPUTS ---
document.getElementById('startBtn').onclick = () => {
    gameState = 'PLAYING'; score = 0; bombs = 1; powerups = []; 
    cities = [new City(100), new City(250), new City(400), new City(550), new City(700)];
    document.getElementById('start-screen').classList.add('hidden');
    canvas.requestPointerLock();
};

window.addEventListener('mousemove', e => {
    if (gameState === 'PLAYING') {
        cursor.x = Math.max(0, Math.min(800, cursor.x + e.movementX));
        cursor.y = Math.max(0, Math.min(550, cursor.y + e.movementY));
    }
});

window.addEventListener('mousedown', () => {
    if (gameState !== 'PLAYING') return;
    const s = activePower === 'FAST' ? 18 : 10;
    const fire = (ox) => {
        let angle = Math.atan2(cursor.y - 600, cursor.x - ox);
        missiles.push({x: ox, y: 600, tx: cursor.x, ty: cursor.y, vx: Math.cos(angle)*s, vy: Math.sin(angle)*s});
    };
    if (activePower === 'TRIPLE') { fire(200); fire(400); fire(600); } else fire(400);
});

window.addEventListener('keydown', e => {
    if (e.key.toLowerCase() === 'p') togglePause();
    if (e.code === 'Space' && bombs > 0 && gameState === 'PLAYING') {
        bombs--; playSound(80, 'sawtooth', 1, 0.5);
        enemies.forEach(e => explosions.push({x: e.x, y: e.y, r: 0, active: true}));
        enemies = [];
    }
});

setInterval(update, 1000/60); draw();