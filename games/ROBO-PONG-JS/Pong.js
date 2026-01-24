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
        [261, 329, 392, 523].forEach((f, i) => {
            setTimeout(() => playSound(f, 'sine', 0.2, 0.1), i * 100);
        });
    },
    bounce: () => playSound(150, 'triangle', 0.05, 0.05),
    hitPlayer: () => playSound(440, 'square', 0.1, 0.05),
    hitAI: () => playSound(660, 'square', 0.1, 0.05),
    pointLost: () => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.frequency.setValueAtTime(200, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(50, audioCtx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.start(); osc.stop(audioCtx.currentTime + 0.3);
    },
    gameOver: () => {
        const osc = audioCtx.createOscillator();
        osc.frequency.setValueAtTime(100, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1);
        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 1);
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.start(); osc.stop(audioCtx.currentTime + 1);
    },
    highScore: () => {
        const notes = [523, 659, 783, 1046, 783, 1046];
        notes.forEach((f, i) => {
            setTimeout(() => playSound(f, 'triangle', 0.3, 0.07), i * 150);
        });
    }
};

// --- GAME LOGIC ---
const canvas = document.getElementById("pongCanvas");
const ctx = canvas.getContext("2d");

let gameState = "START"; 
let score = 0, lives = 3;
let highScore = localStorage.getItem("rp_score") || 0;
let highScoreName = localStorage.getItem("rp_name") || "CPU";

const player = { x: 20, y: 250, w: 15, h: 90, color: "#00d4ff", hitAnim: 0 };
const ai = { x: 765, y: 250, w: 15, h: 90, color: "#ff2d55", hitAnim: 0 };
const ball = { x: 400, y: 300, dx: 0, dy: 0, r: 7, trail: [] };
let particles = [];

document.addEventListener("mousemove", (e) => {
    if (gameState === "PLAYING") {
        player.y += e.movementY;
        player.y = Math.max(0, Math.min(canvas.height - player.h, player.y));
    }
});

document.addEventListener("keydown", (e) => {
    if (e.key.toLowerCase() === "p") {
        if (gameState === "PLAYING") gameState = "PAUSED";
        else if (gameState === "PAUSED") gameState = "PLAYING";
    }
});

function createParticles(x, y, color, count = 10, speed = 5) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x, y,
            dx: (Math.random() - 0.5) * speed,
            dy: (Math.random() - 0.5) * speed,
            life: 1.0, color
        });
    }
}

function startGame() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    sfx.start();
    score = 0; lives = 3;
    gameState = "PLAYING";
    updateHUD();
    resetBall();
    particles = [];
    document.querySelectorAll('.overlay').forEach(el => el.classList.add('hidden'));
    canvas.requestPointerLock();
}

function resetBall() {
    ball.x = 400; ball.y = 300;
    ball.dx = (Math.random() > 0.5 ? 5 : -5);
    ball.dy = (Math.random() * 6 - 3);
    ball.trail = [];
}

function updateHUD() {
    document.getElementById("lives-val").innerText = "❤".repeat(Math.max(0, lives));
    document.getElementById("score-val").innerText = score.toString().padStart(4, '0');
    document.getElementById("high-val").innerText = `${highScore.toString().padStart(4, '0')} (${highScoreName})`;
}

function update() {
    if (gameState === "PLAYING") {
        ball.x += ball.dx; ball.y += ball.dy;
        ball.trail.push({x: ball.x, y: ball.y});
        if (ball.trail.length > 12) ball.trail.shift();

        if (ball.y <= 0 || ball.y >= canvas.height) {
            ball.dy *= -1;
            sfx.bounce();
            createParticles(ball.x, ball.y, "#fff", 3);
        }

        let aiTarget = ball.y - ai.h / 2;
        ai.y += (aiTarget - ai.y) * 0.12;

        checkCollision(ball, player, true);
        checkCollision(ball, ai, false);

        if (ball.x < 0) {
            lives--;
            sfx.pointLost();
            createParticles(player.x + player.w, player.y + player.h/2, "#ff2d55", 20, 10);
            if (lives <= 0) explodePaddle(); else resetBall();
            updateHUD();
        }
        if (ball.x > canvas.width) {
            score += 10;
            sfx.hitAI(); // Sound for hitting/scoring on AI
            createParticles(ai.x, ai.y + ai.h/2, "#00d4ff", 20, 10);
            resetBall();
            updateHUD();
        }
    }

    particles.forEach((p, i) => {
        p.x += p.dx; p.y += p.dy; p.life -= 0.02;
        if (p.life <= 0) particles.splice(i, 1);
    });

    player.hitAnim *= 0.9;
    ai.hitAnim *= 0.9;

    draw();
    requestAnimationFrame(update);
}

function checkCollision(b, p, isPlayer) {
    if (b.x - b.r < p.x + p.w && b.x + b.r > p.x && b.y > p.y && b.y < p.y + p.h) {
        if (isPlayer) sfx.hitPlayer(); else sfx.hitAI();
        b.dx *= -1.05;
        p.hitAnim = 10;
        createParticles(b.x, b.y, p.color, 8);
        let deltaY = b.y - (p.y + p.h/2);
        b.dy = deltaY * 0.35;
    }
}

function explodePaddle() {
    gameState = "GAMEOVER";
    sfx.gameOver();
    document.exitPointerLock();
    createParticles(player.x, player.y + player.h/2, player.color, 100, 15);
    
    setTimeout(() => {
        document.getElementById("game-over-screen").classList.remove("hidden");
        if (score > highScore) {
            sfx.highScore();
            document.getElementById("high-score-entry").classList.remove("hidden");
            document.getElementById("restart-btn").classList.add("hidden");
        }
    }, 1000);
}

function drawRobotPaddle(p) {
    ctx.save();
    ctx.shadowBlur = 15 + p.hitAnim;
    ctx.shadowColor = p.color;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - (p.hitAnim/2), p.y, p.w + p.hitAnim, p.h);
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.fillRect(p.x + 2, p.y + 10, p.w - 4, 2);
    ctx.fillRect(p.x + 2, p.y + p.h - 12, p.w - 4, 2);
    ctx.fillRect(p.x + 5, p.y + 20, 5, p.h - 40);
    ctx.restore();
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 3, 3);
    });
    ctx.globalAlpha = 1.0;

    ball.trail.forEach((pos, i) => {
        ctx.fillStyle = `rgba(152, 155, 1, ${i / 15})`;
        ctx.beginPath(); ctx.arc(pos.x, pos.y, ball.r * (i/12), 0, Math.PI*2); ctx.fill();
    });

    ctx.shadowBlur = 20; ctx.shadowColor = "#989b01";
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;

    if (lives > 0 || gameState !== "GAMEOVER") drawRobotPaddle(player);
    drawRobotPaddle(ai);

    if (gameState === "PAUSED") {
        ctx.fillStyle = "white"; ctx.font = "30px Arial";
        ctx.textAlign = "center"; ctx.fillText("SYSTEM PAUSED", 400, 300);
    }
}

function saveScore() {
    const name = document.getElementById("playerName").value.toUpperCase() || "AAA";
    localStorage.setItem("rp_score", score);
    localStorage.setItem("rp_name", name);
    highScore = score; highScoreName = name;
    updateHUD();
    document.getElementById("high-score-entry").classList.add("hidden");
    document.getElementById("restart-btn").classList.remove("hidden");
}

updateHUD();
requestAnimationFrame(update);