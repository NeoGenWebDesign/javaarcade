const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- AUDIO ENGINE ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(freq, type, duration, vol = 0.1, ramp = true) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    if (ramp) osc.frequency.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

const sfx = {
    start: () => {
        playSound(200, 'square', 0.3);
        setTimeout(() => playSound(400, 'square', 0.3), 100);
        setTimeout(() => playSound(600, 'square', 0.4), 200);
    },
    collision: () => {
        playSound(150, 'sawtooth', 0.2, 0.2); // "Asteroid/Vehicle hit"
    },
    death: () => {
        playSound(100, 'sawtooth', 0.5, 0.3);
        playSound(60, 'square', 0.8, 0.2);
    },
    laser: () => {
        playSound(800 + Math.random() * 400, 'sine', 0.1, 0.05);
    },
    victory: () => {
        const notes = [523, 659, 783, 1046];
        notes.forEach((n, i) => setTimeout(() => playSound(n, 'triangle', 0.4, 0.1, false), i * 150));
    },
    highScore: () => {
        const notes = [1046, 1318, 1567, 2093];
        notes.forEach((n, i) => setTimeout(() => playSound(n, 'square', 0.2, 0.1, false), i * 100));
    },
    gameOver: () => {
        playSound(300, 'sawtooth', 1, 0.2);
        playSound(150, 'sawtooth', 1.5, 0.2);
    }
};

// --- SETTINGS & STATE ---
const GRID = 50;
let score = 0;
let level = 1;
let lives = 3;
let gameState = 'START'; 
let particles = [];
let highScores = JSON.parse(localStorage.getItem('roboFroggerHighScores')) || { score: 0, name: '---' };
let gameFrame = 0;

document.getElementById('high-score').innerText = highScores.score;
document.getElementById('high-name').innerText = highScores.name;

// --- CLASSES ---

class Particle {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.size = Math.random() * 5 + 2;
        
        if (type === 'splat') {
            this.speedX = (Math.random() - 0.5) * 10;
            this.speedY = (Math.random() - 0.5) * 10;
            this.color = `rgba(255, 50, 50, 1)`;
            this.decay = 0.03;
        } else {
            this.speedX = (Math.random() - 0.5) * 15;
            this.speedY = (Math.random() * -15) - 5;
            const colors = ['#00ffff', '#ff00ff', '#ffff00', '#ffffff'];
            this.colorStr = colors[Math.floor(Math.random() * colors.length)];
            this.decay = 0.015;
        }
        this.life = 1.0;
    }
    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        if (this.type === 'firework') this.speedY += 0.4;
        this.life -= this.decay;
    }
    draw() {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.type === 'splat' ? this.color : this.colorStr;
        if(this.type === 'firework') {
             ctx.shadowBlur = 10;
             ctx.shadowColor = this.colorStr;
        }
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class RoboPlayer {
    constructor() {
        this.width = GRID - 12;
        this.height = GRID - 12;
        this.reset();
    }
    reset() {
        this.x = canvas.width / 2 - GRID / 2;
        this.y = canvas.height - GRID;
    }
    draw() {
        ctx.save();
        ctx.fillStyle = '#444';
        ctx.fillRect(this.x + 6, this.y + 6, this.width, this.height);
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#00ffff';
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 3;
        ctx.strokeRect(this.x + 8, this.y + 8, this.width - 4, this.height - 4);
        ctx.fillStyle = '#ccffff';
        let bob = Math.sin(gameFrame / 5) * 2;
        ctx.fillRect(this.x + 15, this.y + 15 + bob, 8, 8);
        ctx.fillRect(this.x + this.width - 7, this.y + 15 + bob, 8, 8);
        ctx.restore();
    }
    move(dir) {
        if (gameState !== 'PLAYING') return;
        if (dir === 'up' && this.y > 0) this.y -= GRID;
        if (dir === 'down' && this.y < canvas.height - GRID) this.y += GRID;
        if (dir === 'left' && this.x > 0) this.x -= GRID;
        if (dir === 'right' && this.x < canvas.width - GRID) this.x += GRID;
        if (this.y < 50) startLevelTransition();
    }
    splat() {
        sfx.collision();
        for (let i = 0; i < 30; i++) {
            particles.push(new Particle(this.x + GRID/2, this.y + GRID/2, 'splat'));
        }
    }
}

class RoboVehicle {
    constructor(y, speed, type) {
        this.x = Math.random() * canvas.width;
        this.y = y;
        this.speed = speed;
        this.type = type;
        this.width = type === 'truck' ? GRID * 2.2 : (type === 'car' ? GRID * 1.5 : GRID);
        this.height = GRID - 20;
        if (this.type === 'bike') this.color = '#ffff00';
        else if (this.type === 'car') this.color = '#ff00ff';
        else this.color = '#ff3333';
    }
    update() {
        if (gameState === 'LEVEL_TRANSITION') return;
        this.x += this.speed;
        if (this.speed > 0 && this.x > canvas.width) this.x = -this.width;
        if (this.speed < 0 && this.x < -this.width) this.x = canvas.width;
    }
    draw() {
        ctx.save();
        ctx.shadowBlur = 20;
        ctx.shadowColor = this.color;
        ctx.fillStyle = this.color;
        if (this.speed > 0) ctx.fillRect(this.x - 10, this.y + 10, 20, this.height);
        else ctx.fillRect(this.x + this.width - 10, this.y + 10, 20, this.height);
        ctx.shadowBlur = 0;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 4;
        ctx.strokeRect(this.x, this.y + 10, this.width, this.height);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y + this.height / 2 + 10);
        ctx.lineTo(this.x + this.width, this.y + this.height / 2 + 10);
        ctx.stroke();
        ctx.restore();
    }
}

let player = new RoboPlayer();
let vehicles = [];

function drawCyberRoad() {
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(0, 0, canvas.width, 50);
    ctx.fillRect(0, 550, canvas.width, 50);
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 12; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * GRID);
        ctx.lineTo(canvas.width, i * GRID);
        ctx.stroke();
    }
    for (let i = 0; i < canvas.width; i+=GRID) {
        ctx.beginPath();
        ctx.moveTo(i, 50);
        ctx.lineTo(i, 550);
        ctx.stroke();
    }
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#00ffff';
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, 50); ctx.lineTo(canvas.width, 50); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 550); ctx.lineTo(canvas.width, 550); ctx.stroke();
    ctx.shadowBlur = 0;
}

function drawLasers() {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for(let i = 0; i < 5; i++) {
        let xPos = (canvas.width / 5) * i + (Math.random() * 50);
        ctx.beginPath();
        ctx.strokeStyle = ['#00ffff','#ff00ff','#ffff00'][Math.floor(Math.random()*3)];
        ctx.lineWidth = Math.random() * 5 + 2;
        ctx.shadowBlur = 30;
        ctx.shadowColor = ctx.strokeStyle;
        ctx.moveTo(xPos, canvas.height);
        ctx.lineTo(xPos, Math.random() * 100);
        ctx.stroke();
    }
    ctx.restore();
    if (gameFrame % 5 === 0) sfx.laser(); // VICTORY LASER SOUNDS
}

function initLevel() {
    vehicles = [];
    const lanes = 9;
    for (let i = 1; i <= lanes; i++) {
        let laneSpeed = (Math.random() * 2 + 2.5) * (i % 2 === 0 ? 1 : -1) * (1 + level * 0.1);
        let type = 'bike';
        if (level > 1) type = Math.random() > 0.6 ? 'car' : 'bike';
        if (level > 3) type = Math.random() > 0.7 ? 'truck' : (Math.random() > 0.4 ? 'car' : 'bike');
        let count = Math.floor(Math.random() * 2) + 2;
        for (let j = 0; j < count; j++) {
            vehicles.push(new RoboVehicle(i * GRID + 50, laneSpeed, type));
        }
    }
}

function startGame() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    sfx.start(); // START SOUND
    score = 0; level = 1; lives = 3;
    gameState = 'PLAYING';
    updateUI();
    player.reset();
    initLevel();
    hideOverlays();
}

function startLevelTransition() {
    sfx.victory(); // VICTORY SOUND
    gameState = 'LEVEL_TRANSITION';
    score += 1000;
    updateUI();
    document.getElementById('level-transition-screen').classList.remove('hidden');
    for (let i = 0; i < 150; i++) {
        particles.push(new Particle(Math.random() * canvas.width, 50 + Math.random()*50, 'firework'));
    }
    setTimeout(() => {
        nextLevel();
    }, 3000);
}

function nextLevel() {
    level++;
    updateUI();
    player.reset();
    initLevel();
    document.getElementById('level-transition-screen').classList.add('hidden');
    gameState = 'PLAYING';
}

function updateUI() {
    document.getElementById('score').innerText = score;
    document.getElementById('level').innerText = level;
    document.getElementById('lives').innerText = lives;
}

function hideOverlays() {
    document.querySelectorAll('.overlay').forEach(el => el.classList.add('hidden'));
}

function gameOver() {
    sfx.gameOver(); // GAME OVER SOUND
    gameState = 'GAMEOVER';
    document.getElementById('game-over-screen').classList.remove('hidden');
    if (score > highScores.score) {
        document.getElementById('new-high-score-ui').classList.remove('hidden');
    }
}

function saveHighScore() {
    sfx.highScore(); // HIGH SCORE SAVE SOUND
    const name = document.getElementById('playerName').value.toUpperCase() || 'AAA';
    highScores = { score: score, name: name };
    localStorage.setItem('roboFroggerHighScores', JSON.stringify(highScores));
    document.getElementById('high-score').innerText = score;
    document.getElementById('high-name').innerText = name;
    document.getElementById('new-high-score-ui').classList.add('hidden');
}

function update() {
    if (gameState === 'PLAYING' || gameState === 'LEVEL_TRANSITION') {
        gameFrame++;
        vehicles.forEach(v => {
            v.update();
            if (gameState === 'PLAYING' && 
                player.x < v.x + v.width && player.x + player.width > v.x &&
                player.y < v.y + v.height && player.y + player.height > v.y) {
                
                player.splat();
                lives--;
                updateUI();
                player.reset();
                if (lives <= 0) gameOver();
                else sfx.death(); // PLAYER DEATH SOUND
            }
        });
    }
    particles.forEach((p, i) => {
        p.update();
        if (p.life <= 0) particles.splice(i, 1);
    });
}

function draw() {
    ctx.fillStyle = 'rgba(2, 2, 7, 0.8)';
    ctx.fillRect(0,0, canvas.width, canvas.height);
    drawCyberRoad();
    if (gameState === 'LEVEL_TRANSITION') drawLasers();
    vehicles.forEach(v => v.draw());
    particles.forEach(p => p.draw());
    if(gameState !== 'GAMEOVER') player.draw();
    requestAnimationFrame(() => {
        update();
        draw();
    });
}

window.addEventListener('keydown', e => {
    if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].indexOf(e.code) > -1) e.preventDefault();
    if (e.key === 'ArrowUp') player.move('up');
    if (e.key === 'ArrowDown') player.move('down');
    if (e.key === 'ArrowLeft') player.move('left');
    if (e.key === 'ArrowRight') player.move('right');
    if (e.key.toLowerCase() === 'p') {
        if (gameState === 'PLAYING') {
            gameState = 'PAUSED';
            document.getElementById('pause-screen').classList.remove('hidden');
        } else if (gameState === 'PAUSED') {
            gameState = 'PLAYING';
            document.getElementById('pause-screen').classList.add('hidden');
        }
    }
});

draw();