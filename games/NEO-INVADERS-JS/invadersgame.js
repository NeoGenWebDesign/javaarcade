// --- AUDIO SYSTEM ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(freq, type, duration, vol = 0.1) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

const sfx = {
    fire: () => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.frequency.setValueAtTime(800, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.start(); osc.stop(audioCtx.currentTime + 0.1);
    },
    explode: () => {
        const bufferSize = audioCtx.sampleRate * 0.1;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1000, audioCtx.currentTime);
        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        noise.connect(filter); filter.connect(gain); gain.connect(audioCtx.destination);
        noise.start();
    },
    hit: () => playSound(100, 'square', 0.2, 0.2),
    start: () => {
        playSound(261, 'sine', 0.1);
        setTimeout(() => playSound(329, 'sine', 0.1), 100);
        setTimeout(() => playSound(392, 'sine', 0.2), 200);
    },
    gameOver: () => {
        const osc = audioCtx.createOscillator();
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(40, audioCtx.currentTime + 0.8);
        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.8);
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.start(); osc.stop(audioCtx.currentTime + 0.8);
    },
    victory: () => {
        [523, 659, 783, 1046].forEach((f, i) => {
            setTimeout(() => playSound(f, 'square', 0.15, 0.05), i * 150);
        });
    }
};

// --- GAME LOGIC ---
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

let state = "START", score = 0, lives = 3, level = 1;
let highScore = localStorage.getItem("robo_score") || 0;
let highScoreName = localStorage.getItem("robo_name") || "CPU";

const player = { x: 400, y: 540, w: 44, h: 44, pu: null, puTime: 0, shielded: false };
let enemies = [], bullets = [], particles = [], powerups = [];
let enemyDir = 1;

document.addEventListener("mousemove", e => {
    if(state === "PLAYING") {
        player.x += e.movementX * (player.pu === "boosters" ? 2.5 : 1.2);
        player.x = Math.max(30, Math.min(770, player.x));
    }
});
document.addEventListener("mousedown", () => { if(state === "PLAYING") fire(); });
document.addEventListener("keydown", e => { if(e.key.toLowerCase()==='p') state = (state==="PLAYING")?"PAUSED":"PLAYING"; });

function fire() {
    sfx.fire();
    const laserCount = 1 + (Math.floor((level - 1) / 10) * 2);
    const color = (player.pu === "plasma") ? "#00f2ff" : "#bc13fe";
    const type = (player.pu === "plasma") ? "lance" : "laser";
    
    if(player.pu === "missiles") {
        for(let i=-2; i<=2; i++) bullets.push({x:player.x, y:player.y, dx:i*2, dy:-8, type:"laser", color});
    } else {
        const spacing = 12;
        const startX = player.x - ((laserCount - 1) * spacing) / 2;
        for(let i=0; i < laserCount; i++) {
            bullets.push({x: startX + (i * spacing), y: player.y - 10, dx: 0, dy: -10, type, color});
        }
    }
}

function spawnLevel() {
    enemies = [];
    const rows = 4, cols = 10;
    for(let r=0; r<rows; r++) {
        for(let c=0; c<cols; c++) {
            enemies.push({ x: 100 + c*60, y: 60 + r*50, type: r % 5, hp: 1 + Math.floor(level/10), w: 22, h: 22 });
        }
    }
}

function initGame() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    sfx.start();
    score = 0; lives = 3; level = 1;
    player.pu = null; bullets = []; powerups = []; enemies = [];
    state = "PLAYING";
    spawnLevel();
    updateHUD();
    document.querySelectorAll('.overlay').forEach(e => e.classList.add('hidden'));
    canvas.requestPointerLock();
}

function update() {
    if(state !== "PLAYING") return;

    if(player.puTime > 0) {
        player.puTime--;
        if(player.puTime <= 0) { player.pu = null; player.shielded = false; }
    }

    bullets.forEach((b, i) => {
        b.x += b.dx || 0; b.y += b.dy;
        if(b.y < 0 || b.y > 600) bullets.splice(i, 1);
    });

    let edge = false;
    enemies.forEach(en => {
        en.x += enemyDir * (1 + level * 0.15);
        if(en.x > 775 || en.x < 25) edge = true;
        if(Math.abs(en.x - player.x) < 30 && Math.abs(en.y - player.y) < 30) triggerGameOver("CONTACT BREACH");
        if(en.y + en.h >= canvas.height - 20) triggerGameOver("PERIMETER BREACH");
        if(Math.random() < 0.0008 * Math.pow(1.1, level-1)) {
            bullets.push({x: en.x, y: en.y, dy: 5, type: "enemy", color: "#ff2d55"});
        }
    });

    if(edge) { enemyDir *= -1; enemies.forEach(en => en.y += 25); }

    bullets.forEach((b, bi) => {
        if(b.type !== "enemy") {
            enemies.forEach((en, ei) => {
                if(Math.abs(b.x - en.x) < 20 && Math.abs(b.y - en.y) < 20) {
                    sfx.explode();
                    createParticles(en.x, en.y, "#ffcc00", 8);
                    if(b.type !== "lance") bullets.splice(bi, 1);
                    en.hp--;
                    if(en.hp <= 0) {
                        enemies.splice(ei, 1); score += 100;
                        const rand = Math.random();
                        if(rand < 0.01) powerups.push({x: en.x, y: en.y, type: "1up"});
                        else if (rand < 0.046) {
                            const types = ["missiles", "plasma", "boosters", "shield"];
                            powerups.push({x: en.x, y: en.y, type: types[Math.floor(Math.random()*4)]});
                        }
                    }
                }
            });
        } else {
            if(Math.abs(b.x - player.x) < 20 && Math.abs(b.y - player.y) < 20) {
                bullets.splice(bi, 1); hit();
            }
        }
    });

    powerups.forEach((p, i) => {
        p.y += 2.5;
        if(Math.abs(p.x - player.x) < 30 && Math.abs(p.y - player.y) < 30) {
            playSound(600, 'sine', 0.1);
            if(p.type === "1up") { lives++; updateHUD(); }
            else { player.pu = p.type; player.puTime = 600; if(p.type === "shield") player.shielded = true; }
            powerups.splice(i, 1);
        }
    });

    if(enemies.length === 0) { level++; spawnLevel(); updateHUD(); playSound(800, 'sine', 0.3); }
    particles.forEach((p, i) => { p.x += p.dx; p.y += p.dy; p.life -= 0.02; if(p.life <= 0) particles.splice(i, 1); });
}

function hit() {
    if(player.shielded) return;
    sfx.hit();
    lives--; updateHUD();
    createParticles(player.x, player.y, "#f00", 20);
    if(lives <= 0) triggerGameOver("SYSTEM COLLAPSE");
}

function triggerGameOver(msg) {
    sfx.gameOver();
    state = "GAMEOVER";
    createParticles(player.x, player.y, "#fff", 100, 12);
    document.exitPointerLock();
    setTimeout(() => {
        document.getElementById("game-over-screen").classList.remove("hidden");
        document.getElementById("status-msg").innerText = msg;
        const entryDiv = document.getElementById("high-score-entry");
        if(score > highScore) {
            entryDiv.classList.remove("hidden");
            entryDiv.style.display = "flex";
            sfx.victory(); // Play fanfare for high score
        } else {
            entryDiv.classList.add("hidden");
            entryDiv.style.display = "none";
        }
    }, 1000);
}

function draw() {
    ctx.clearRect(0, 0, 800, 600);
    particles.forEach(p => { ctx.fillStyle = p.color; ctx.globalAlpha = p.life; ctx.fillRect(p.x, p.y, 2, 2); });
    ctx.globalAlpha = 1;
    powerups.forEach(p => drawPowerUp(p));
    bullets.forEach(b => {
        ctx.fillStyle = b.color; ctx.shadowBlur = 8; ctx.shadowColor = b.color;
        ctx.fillRect(b.x-2, b.y, (b.type==="lance"?6:4), (b.type==="lance"?30:12));
        ctx.shadowBlur = 0;
    });
    enemies.forEach(en => drawRoboEnemy(en));
    drawRoboPlayer(player);
}

function drawRoboPlayer(p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.strokeStyle = "#00f2ff"; ctx.lineWidth = 2;
    ctx.strokeRect(-15, -5, 30, 15);
    ctx.strokeRect(-5, -15, 10, 10);
    ctx.beginPath(); ctx.moveTo(-15, 0); ctx.lineTo(-25, 15); ctx.lineTo(-15, 15); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(25, 15); ctx.lineTo(15, 15); ctx.stroke();
    ctx.fillStyle = "#f0f"; ctx.fillRect(-8, 10, 4, 4); ctx.fillRect(4, 10, 4, 4);
    if(player.shielded) {
        ctx.strokeStyle = "#0f0"; ctx.setLineDash([5, 5]);
        ctx.beginPath(); ctx.arc(0, 0, 40, 0, Math.PI*2); ctx.stroke();
    }
    ctx.restore();
}

function drawRoboEnemy(en) {
    ctx.save();
    ctx.translate(en.x, en.y);
    ctx.strokeStyle = `hsl(${en.type * 60}, 100%, 50%)`;
    ctx.strokeRect(-10, -10, 20, 15);
    ctx.beginPath(); ctx.moveTo(-10, 5); ctx.lineTo(-14, 12); ctx.moveTo(10, 5); ctx.lineTo(14, 12); ctx.stroke();
    ctx.fillStyle = "white"; ctx.fillRect(-4, -4, 2, 2); ctx.fillRect(2, -4, 2, 2);
    ctx.restore();
}

function drawPowerUp(p) {
    const colors = { missiles: "#f0f", plasma: "#0ff", boosters: "#ff0", shield: "#0f0", "1up": "#ff2d55" };
    ctx.strokeStyle = colors[p.type];
    ctx.lineWidth = 2;
    ctx.strokeRect(p.x-10, p.y-10, 20, 20);
    ctx.fillStyle = colors[p.type];
    ctx.font = "bold 12px Arial";
    ctx.fillText(p.type === "1up" ? "U" : p.type[0].toUpperCase(), p.x-4, p.y+5);
}

function createParticles(x, y, color, count, speed=5) {
    for(let i=0; i<count; i++) particles.push({ x, y, color, life: 1, dx: (Math.random()-0.5)*speed, dy: (Math.random()-0.5)*speed });
}

function updateHUD() {
    document.getElementById("lives-val").innerText = "❤".repeat(Math.max(0, lives));
    document.getElementById("score-val").innerText = score;
    document.getElementById("level-val").innerText = level;
    document.getElementById("high-val").innerText = highScore;
}

function saveHighScore() {
    const name = document.getElementById("playerName").value.toUpperCase() || "AAA";
    localStorage.setItem("robo_score", score);
    localStorage.setItem("robo_name", name);
    highScore = score; updateHUD();
    document.getElementById("high-score-entry").classList.add("hidden");
    document.getElementById("high-score-entry").style.display = "none";
}

function loop() { update(); draw(); requestAnimationFrame(loop); }
updateHUD(); loop();