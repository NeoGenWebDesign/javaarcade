const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- AUDIO SYNTHESIZER ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(freq, type, duration, vol = 0.1) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + duration);
}

const sfx = {
    shoot: () => playSound(600, 'sine', 0.1, 0.05),
    hit: () => playSound(150, 'sawtooth', 0.1, 0.05),
    spawn: () => [200, 300, 400].forEach((f, i) => setTimeout(() => playSound(f, 'square', 0.2), i*100)),
    death: () => {
        const osc = audioCtx.createOscillator();
        osc.frequency.exponentialRampToValueAtTime(10, audioCtx.currentTime + 1);
        playSound(100, 'sawtooth', 1, 0.2);
    },
    hiScore: () => [523, 659, 783].forEach((f, i) => setTimeout(() => playSound(f, 'triangle', 0.4), i*150))
};

const GRID = 20;
let score = 0, level = 1, lives = 3, gameState = 'START';
let screenShake = 0, hiScore = localStorage.getItem('roboHi') || 0;
document.getElementById('hi-score').innerText = hiScore;

let player = null;
let centipedes = [], bullets = [], mushrooms = [], powerUps = [], particles = [];

class Particle {
    constructor(x, y, color) {
        this.x = x; this.y = y;
        this.vx = (Math.random() - 0.5) * 10;
        this.vy = (Math.random() - 0.5) * 10;
        this.life = 1.0; this.color = color;
    }
    update() { this.x += this.vx; this.y += this.vy; this.life -= 0.03; }
    draw() {
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, 3, 3);
        ctx.globalAlpha = 1;
    }
}

class RoboPlayer {
    constructor() {
        this.x = 400; this.y = 550;
        this.fireMode = 'NORMAL'; this.timer = 0; this.speedMult = 1;
    }
    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.fillStyle = '#444'; ctx.fillRect(-13, -10, 26, 20);
        ctx.strokeStyle = '#00ffff'; ctx.strokeRect(-13, -10, 26, 20);
        let c = this.fireMode === 'NORMAL' ? '#00ffff' : '#ff00ff';
        ctx.shadowBlur = 10; ctx.shadowColor = c;
        ctx.fillStyle = c; ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI*2); ctx.fill();
        ctx.restore();
    }
}

class Segment {
    constructor(x, y, isHead, dx = 1) {
        this.x = x; this.y = y; this.dx = dx; this.isHead = isHead;
        this.speed = 2.5 + (level * 0.4);
    }
    update() {
        this.x += this.dx * this.speed;
        let hitM = mushrooms.some(m => Math.hypot(this.x - m.x, this.y - m.y) < 18);
        if (this.x > 790 || this.x < 10 || hitM) {
            this.dx *= -1; this.y += GRID;
            this.x += this.dx * 8;
        }
        // GAME OVER CHECK: REACHED BOTTOM
        if (this.y >= 600) loseLife();
    }
    draw() {
        ctx.fillStyle = this.isHead ? '#ff00ff' : '#00ff00';
        ctx.shadowBlur = 10; ctx.shadowColor = ctx.fillStyle;
        ctx.beginPath(); ctx.arc(this.x, this.y, 9, 0, Math.PI*2); ctx.fill();
    }
}

class Mushroom {
    constructor(x, y) { this.x = x; this.y = y; this.hp = 4; }
    draw() {
        let a = this.hp / 4;
        ctx.fillStyle = `rgba(255, 0, 255, ${a})`;
        ctx.beginPath(); ctx.arc(this.x, this.y - 4, 10, Math.PI, 0); ctx.fill();
        ctx.fillStyle = `rgba(200, 200, 255, ${a})`;
        ctx.fillRect(this.x - 3, this.y - 4, 6, 10);
    }
}

function initLevel() {
    mushrooms = [];
    for(let i=0; i<40; i++) {
        mushrooms.push(new Mushroom(Math.floor(Math.random()*38+1)*20, Math.floor(Math.random()*22+2)*20));
    }
}

function spawnCentipede() {
    initLevel(); // REGENERATE MUSHROOMS ON EVERY CENTIPEDE SPAWN
    sfx.spawn();
    let segs = [];
    for(let i=0; i < 8 + level; i++) segs.push(new Segment(400 - (i*22), 40, i === 0));
    centipedes.push(segs);
}

function startGame() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    player = new RoboPlayer();
    spawnCentipede();
    gameState = 'PLAYING';
    document.getElementById('start-screen').classList.add('hidden');
    canvas.requestPointerLock();
}

document.getElementById('startBtn').addEventListener('click', startGame);

function update() {
    if (gameState !== 'PLAYING') return;
    if (screenShake > 0) screenShake--;

    bullets.forEach((b, bi) => {
        b.y -= 10;
        if (b.y < 0) bullets.splice(bi, 1);
        mushrooms.forEach((m, mi) => {
            if (Math.hypot(b.x - m.x, b.y - m.y) < 15) {
                m.hp--; bullets.splice(bi, 1); sfx.hit();
                if (m.hp <= 0) mushrooms.splice(mi, 1);
            }
        });
        centipedes.forEach((chain, ci) => {
            chain.forEach((seg, si) => {
                if (Math.hypot(b.x - seg.x, b.y - seg.y) < 15) {
                    sfx.hit();
                    for(let i=0; i<8; i++) particles.push(new Particle(seg.x, seg.y, '#0f0'));
                    bullets.splice(bi, 1);
                    score += 10; document.getElementById('score').innerText = score;
                    let behind = chain.splice(si + 1);
                    if (behind.length > 0) { behind[0].isHead = true; centipedes.push(behind); }
                    chain.splice(si, 1);
                }
            });
            if (chain.length === 0) centipedes.splice(ci, 1);
        });
    });

    centipedes.forEach(chain => chain.forEach(seg => {
        seg.update();
        if (Math.hypot(seg.x - player.x, seg.y - player.y) < 20) loseLife();
    }));

    particles.forEach((p, i) => { p.update(); if (p.life <= 0) particles.splice(i, 1); });
    if (centipedes.length === 0) { 
        level++; 
        document.getElementById('level').innerText = level;
        spawnCentipede(); 
    }
}

function loseLife() {
    lives--; 
    sfx.death();
    document.getElementById('lives').innerText = lives;
    screenShake = 15;
    for(let i=0; i<30; i++) particles.push(new Particle(player.x, player.y, '#f00'));
    if (lives <= 0) {
        gameState = 'GAMEOVER';
        if (score > hiScore) { localStorage.setItem('roboHi', score); sfx.hiScore(); }
        document.getElementById('game-over-screen').classList.remove('hidden');
    } else {
        player.x = 400; player.y = 550;
        centipedes = []; // Clear current enemy
        spawnCentipede(); // Respawn enemy and mushrooms
    }
}

function draw() {
    ctx.save();
    if (screenShake > 0) ctx.translate((Math.random()-0.5)*10, (Math.random()-0.5)*10);
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(0, 0, 800, 600);
    mushrooms.forEach(m => m.draw());
    bullets.forEach(b => { ctx.fillStyle = '#f0f'; ctx.fillRect(b.x-2, b.y-10, 4, 10); });
    centipedes.forEach(chain => chain.forEach(seg => seg.draw()));
    particles.forEach(p => p.draw());
    if (player) player.draw();
    ctx.restore();
    requestAnimationFrame(draw);
}

window.addEventListener('mousemove', e => {
    if (gameState === 'PLAYING' && player) {
        player.x += e.movementX; player.y += e.movementY;
        player.x = Math.max(15, Math.min(785, player.x));
        player.y = Math.max(450, Math.min(585, player.y));
    }
});

window.addEventListener('mousedown', () => {
    if (gameState === 'PLAYING') { bullets.push({x:player.x, y:player.y}); sfx.shoot(); }
});

setInterval(update, 1000/60);
draw();