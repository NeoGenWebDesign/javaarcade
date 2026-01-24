const canvas = document.getElementById("gameCanvas");
    const ctx = canvas.getContext("2d");
    const scoreEl = document.getElementById("score");
    const highScoreEl = document.getElementById("highScore");
    const msgEl = document.getElementById("msg");

    // Audio Context (must be started on user interaction)
    let audioCtx;

    // --- SOUND EFFECTS ENGINE ---
    function initAudio() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    function playLaserSound() {
        if (!audioCtx) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(110, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    }

    function playExplosionSound() {
        if (!audioCtx) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(100, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.2);
    }

    function playDeathSound() {
        if (!audioCtx) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(200, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(50, audioCtx.currentTime + 0.5);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.5);
    }

    // Game Constants
    const FPS = 60;
    const FRICTION = 0.7;
    const SHIP_SIZE = 20;
    const SHIP_THRUST = 5;
    const SHIP_TURN_SPD = 360;
    const LASER_MAX = 10;
    const LASER_SPD = 500;
    const ASTEROIDS_NUM = 5;
    const ASTEROIDS_SIZE = 100;
    const ASTEROIDS_SPD = 50;

    // Game Variables
    let score, level, ship, asteroids, lasers, particles, gameActive = false;
    let highScore = localStorage.getItem("asteroidHighScore") || 0;
    highScoreEl.innerText = "BEST: " + highScore;

    function resize() {
        canvas.width = 800;
        canvas.height = 600;
    }
    window.addEventListener('resize', resize);
    resize();

    const keys = {};
    window.addEventListener('keydown', e => {
        initAudio(); // Initialize audio context on first key press
        if (!gameActive && e.code !== 'F12') startGame();
        keys[e.code] = true;
    });
    window.addEventListener('keyup', e => keys[e.code] = false);

    function startGame() {
        score = 0;
        level = 0;
        particles = [];
        gameActive = true;
        msgEl.style.display = "none";
        scoreEl.innerText = "SCORE: 0";
        newLevel();
        loop();
    }

    function newLevel() {
        lasers = [];
        createShip();
        createAsteroids();
    }

    function createShip() {
        ship = {
            x: canvas.width / 2, y: canvas.height / 2,
            r: SHIP_SIZE / 2, a: 90 / 180 * Math.PI,
            thrust: { x: 0, y: 0 }
        };
    }

    function createAsteroids() {
        asteroids = [];
        for (let i = 0; i < ASTEROIDS_NUM + level; i++) {
            let x, y;
            do {
                x = Math.floor(Math.random() * canvas.width);
                y = Math.floor(Math.random() * canvas.height);
            } while (distBetweenPoints(ship.x, ship.y, x, y) < ASTEROIDS_SIZE * 2);
            asteroids.push(newAsteroid(x, y, Math.ceil(ASTEROIDS_SIZE / 2)));
        }
    }

    function newAsteroid(x, y, r) {
        let speedMult = Math.pow(1.02, level); 
        return {
            x, y,
            xv: Math.random() * ASTEROIDS_SPD * speedMult / FPS * (Math.random() < 0.5 ? 1 : -1),
            yv: Math.random() * ASTEROIDS_SPD * speedMult / FPS * (Math.random() < 0.5 ? 1 : -1),
            r,
            vert: Math.floor(Math.random() * 7 + 5)
        };
    }

    function createExplosion(x, y, color, count) {
        for (let i = 0; i < count; i++) {
            particles.push({
                x, y,
                xv: (Math.random() - 0.5) * 4,
                yv: (Math.random() - 0.5) * 4,
                alpha: 1.0,
                color: color
            });
        }
    }

    function distBetweenPoints(x1, y1, x2, y2) {
        return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    }

    function fireLaser() {
        if (lasers.length < LASER_MAX) {
            playLaserSound(); // TRIGGER LASER SOUND
            lasers.push({
                x: ship.x + 4/3 * ship.r * Math.cos(ship.a),
                y: ship.y - 4/3 * ship.r * Math.sin(ship.a),
                xv: LASER_SPD * Math.cos(ship.a) / FPS,
                yv: -LASER_SPD * Math.sin(ship.a) / FPS,
                dist: 0
            });
        }
    }

    function loop() {
        if (!gameActive) return;

        // --- UPDATE LOGIC ---
        if (keys['ArrowLeft'] || keys['KeyA']) ship.a += SHIP_TURN_SPD / 180 * Math.PI / FPS;
        if (keys['ArrowRight'] || keys['KeyD']) ship.a -= SHIP_TURN_SPD / 180 * Math.PI / FPS;
        
        if (keys['ArrowUp'] || keys['KeyW']) {
            ship.thrust.x += SHIP_THRUST * Math.cos(ship.a) / FPS;
            ship.thrust.y -= SHIP_THRUST * Math.sin(ship.a) / FPS;
        } else {
            ship.thrust.x -= FRICTION * ship.thrust.x / FPS;
            ship.thrust.y -= FRICTION * ship.thrust.y / FPS;
        }

        if (keys['Space']) { fireLaser(); keys['Space'] = false; }

        ship.x += ship.thrust.x; ship.y += ship.thrust.y;

        // Wrap Ship
        if (ship.x < 0 - ship.r) ship.x = canvas.width + ship.r;
        else if (ship.x > canvas.width + ship.r) ship.x = 0 - ship.r;
        if (ship.y < 0 - ship.r) ship.y = canvas.height + ship.r;
        else if (ship.y > canvas.height + ship.r) ship.y = 0 - ship.r;

        // Particles
        for (let i = particles.length - 1; i >= 0; i--) {
            particles[i].x += particles[i].xv;
            particles[i].y += particles[i].yv;
            particles[i].alpha -= 0.02;
            if (particles[i].alpha <= 0) particles.splice(i, 1);
        }

        // Lasers
        for (let i = lasers.length - 1; i >= 0; i--) {
            lasers[i].x += lasers[i].xv;
            lasers[i].y += lasers[i].yv;
            lasers[i].dist += Math.sqrt(Math.pow(lasers[i].xv, 2) + Math.pow(lasers[i].yv, 2));
            if (lasers[i].x < 0) lasers[i].x = canvas.width; else if (lasers[i].x > canvas.width) lasers[i].x = 0;
            if (lasers[i].y < 0) lasers[i].y = canvas.height; else if (lasers[i].y > canvas.height) lasers[i].y = 0;
            if (lasers[i].dist > canvas.width) lasers.splice(i, 1);
        }

        // Asteroids & Collisions
        for (let i = asteroids.length - 1; i >= 0; i--) {
            let a = asteroids[i];
            a.x += a.xv; a.y += a.yv;
            if (a.x < 0 - a.r) a.x = canvas.width + a.r; else if (a.x > canvas.width + a.r) a.x = 0 - a.r;
            if (a.y < 0 - a.r) a.y = canvas.height + a.r; else if (a.y > canvas.height + a.r) a.y = 0 - a.r;

            // Ship Hit
            if (distBetweenPoints(ship.x, ship.y, a.x, a.y) < ship.r + a.r) {
                gameOver();
            }

            // Laser Hit
            for (let j = lasers.length - 1; j >= 0; j--) {
                let l = lasers[j];
                if (distBetweenPoints(l.x, l.y, a.x, a.y) < a.r) {
                    playExplosionSound(); // TRIGGER ASTEROID HIT SOUND
                    createExplosion(a.x, a.y, "slategrey", 15);
                    lasers.splice(j, 1);
                    if (a.r > 20) {
                        asteroids.push(newAsteroid(a.x, a.y, a.r / 2));
                        asteroids.push(newAsteroid(a.x, a.y, a.r / 2));
                    }
                    asteroids.splice(i, 1);
                    score += 100;
                    scoreEl.innerText = "SCORE: " + score;
                    break;
                }
            }
        }

        if (asteroids.length === 0) { level++; newLevel(); }

        // --- DRAW LOGIC ---
        ctx.fillStyle = "black"; ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw Particles
        for (let p of particles) {
            ctx.fillStyle = `rgba(255, 0, 221, ${p.alpha})`;
            ctx.fillRect(p.x, p.y, 2, 2);
        }

        // Draw Ship
        ctx.strokeStyle = "slategray"; ctx.lineWidth = SHIP_SIZE / 15;
        ctx.beginPath();
        ctx.moveTo(ship.x + 4/3 * ship.r * Math.cos(ship.a), ship.y - 4/3 * ship.r * Math.sin(ship.a));
        ctx.lineTo(ship.x - ship.r * (2/3 * Math.cos(ship.a) + Math.sin(ship.a)), ship.y + ship.r * (2/3 * Math.sin(ship.a) - Math.cos(ship.a)));
        ctx.lineTo(ship.x - ship.r * (2/3 * Math.cos(ship.a) - Math.sin(ship.a)), ship.y + ship.r * (2/3 * Math.sin(ship.a) + Math.cos(ship.a)));
        ctx.closePath(); ctx.stroke();

        // Draw Lasers
        ctx.fillStyle = "red";
        for (let l of lasers) { ctx.beginPath(); ctx.arc(l.x, l.y, 2, 0, Math.PI * 2); ctx.fill(); }

        // Draw Asteroids
        ctx.strokeStyle = "rgb(70, 49, 5)"; ctx.lineWidth = 2;
        for (let a of asteroids) { ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2); ctx.stroke(); }

        requestAnimationFrame(loop);
    }

    function gameOver() {
        gameActive = false;
        playDeathSound(); // TRIGGER PLAYER DEATH SOUND
        createExplosion(ship.x, ship.y, "orange", 30);
        if (score > highScore) {
            highScore = score;
            localStorage.setItem("asteroidHighScore", highScore);
            highScoreEl.innerText = "BEST: " + highScore;
        }
        msgEl.innerText = "GAME OVER - PRESS ANY KEY";
        msgEl.style.display = "block";
    }