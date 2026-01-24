const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    
    const EFFECT_DURATION = 600; 
    const BALL_RADIUS = 7, POWERUP_SIZE = 30;

    let score = 0, lives = 3, level = 1, state = 'START';
    let paddle, balls = [], bricks = [], powerUps = [], lasers = [];
    let isMouseDown = false, spacePressed = false;
    let paddleX = 400; 

    let timers = { laser: 0, magnet: 0, wide: 0, ultimate: 0, laserCooldown: 0 };

    let savedData = JSON.parse(localStorage.getItem('brickHS_v4')) || {name: 'CPU', score: 0};
    document.getElementById('highScore').innerText = `${savedData.name} - ${savedData.score}`;

    // --- AUDIO ENGINE ---
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
        laser: () => playSound(800, 'sawtooth', 0.1, 0.05),
        hit: () => playSound(400 + Math.random() * 200, 'square', 0.05, 0.05),
        death: () => {
            playSound(300, 'sine', 0.5);
            setTimeout(() => playSound(200, 'sine', 0.5), 100);
        },
        highScore: () => {
            [440, 554, 659, 880].forEach((f, i) => {
                setTimeout(() => playSound(f, 'triangle', 0.4, 0.1), i * 150);
            });
        }
    };

    const sprites = {};
    function createSprites() {
        const configs = [{t:'L', c:'#ff3333'}, {t:'M', c:'#ffff33'}, {t:'G', c:'#ff33ff'}, {t:'W', c:'#33ffff'}, {t:'U', c:'#ff9900'}];
        configs.forEach((cfg, i) => {
            const s = document.createElement('canvas'); s.width = s.height = 30;
            const sctx = s.getContext('2d');
            sctx.fillStyle = cfg.c; sctx.beginPath(); sctx.arc(15, 15, 13, 0, Math.PI*2); sctx.fill();
            sctx.strokeStyle = '#fff'; sctx.lineWidth = 2; sctx.stroke();
            sctx.fillStyle = '#000'; sctx.font = 'bold 16px Arial'; sctx.textAlign = 'center'; sctx.fillText(cfg.t, 15, 21);
            sprites[i+1] = s;
        });
    }
    createSprites();

    class Paddle {
        constructor() { this.baseW = 110; this.w = 110; this.h = 18; this.y = canvas.height - 35; }
        draw() {
            let grad = ctx.createLinearGradient(paddleX - this.w/2, this.y, paddleX - this.w/2, this.y + this.h);
            grad.addColorStop(0, '#777'); grad.addColorStop(0.5, '#333'); grad.addColorStop(1, '#111');
            ctx.fillStyle = grad;
            ctx.roundRect(paddleX - this.w/2, this.y, this.w, this.h, 4); ctx.fill();
            ctx.shadowBlur = 15;
            ctx.shadowColor = timers.ultimate > 0 ? '#ff9900' : (timers.laser > 0 ? '#ff3333' : (timers.magnet > 0 ? '#ff33ff' : '#00d2ff'));
            ctx.fillStyle = ctx.shadowColor;
            ctx.fillRect(paddleX - 20, this.y + 6, 40, 4); ctx.shadowBlur = 0;
            if (timers.laser > 0) {
                ctx.fillStyle = '#ff3333';
                ctx.fillRect(paddleX - this.w/2, this.y - 6, 6, 6);
                ctx.fillRect(paddleX + this.w/2 - 6, this.y - 6, 6, 6);
            }
        }
    }

    class Ball {
        constructor(x, y, isMain = false) {
            this.x = x; this.y = y;
            let speedMult = Math.pow(1.01, level - 1);
            this.dx = (Math.random() - 0.5) * 8 * speedMult;
            this.dy = -6 * speedMult;
            this.attached = isMain && (timers.magnet > 0);
        }
        update() {
            if (this.attached) {
                this.x = paddleX; this.y = paddle.y - BALL_RADIUS - 2;
                if ((isMouseDown || spacePressed) || timers.magnet <= 0) { this.attached = false; this.dy = -Math.abs(this.dy); }
                return;
            }
            this.x += this.dx; this.y += this.dy;
            if (this.x + BALL_RADIUS > canvas.width || this.x - BALL_RADIUS < 0) this.dx *= -1;
            if (this.y - BALL_RADIUS < 0) this.dy *= -1;
            if (this.y + BALL_RADIUS > paddle.y && this.x > paddleX - paddle.w/2 && this.x < paddleX + paddle.w/2) {
                if (timers.magnet > 0) { this.attached = true; } 
                else { this.dy = -Math.abs(this.dy); this.dx = ((this.x - paddleX) / (paddle.w/2)) * 9; }
            }
        }
        draw() {
            ctx.beginPath(); ctx.arc(this.x, this.y, BALL_RADIUS, 0, Math.PI*2);
            ctx.fillStyle = timers.ultimate > 0 ? "#ff9900" : "#fff"; 
            if (timers.ultimate > 0) { ctx.shadowBlur = 10; ctx.shadowColor = "#ff9900"; }
            ctx.fill(); ctx.shadowBlur = 0;
        }
    }

    class Brick {
        constructor(x, y, hits) { this.x = x; this.y = y; this.w = 72; this.h = 22; this.hits = hits; this.status = 1; }
        draw() {
            if (this.status === 0) return;
            ctx.fillStyle = this.hits === -1 ? '#222' : `hsl(${this.hits * 45}, 60%, 40%)`;
            ctx.fillRect(this.x, this.y, this.w, this.h);
            ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.strokeRect(this.x, this.y, this.w, this.h);
        }
    }

    class PowerUp {
        constructor(x, y, type) { this.x = x; this.y = y; this.type = type; this.speed = 3; }
        update() { this.y += this.speed; }
        draw() { ctx.drawImage(sprites[this.type], this.x, this.y); }
    }

    canvas.addEventListener('click', () => {
        if (state === 'PLAYING') canvas.requestPointerLock();
    });

    document.addEventListener('mousemove', (e) => {
        if (document.pointerLockElement === canvas) {
            paddleX += e.movementX;
            paddleX = Math.max(paddle.w/2, Math.min(canvas.width - paddle.w/2, paddleX));
        }
    });

    window.addEventListener('mousedown', () => isMouseDown = true);
    window.addEventListener('mouseup', () => isMouseDown = false);
    window.addEventListener('keydown', (e) => { 
        if (e.code === 'Space') spacePressed = true; 
        if (e.key === 'p') togglePause();
        if (e.key === 'ArrowLeft') paddleX -= 30;
        if (e.key === 'ArrowRight') paddleX += 30;
        paddleX = Math.max(paddle.w/2, Math.min(canvas.width - paddle.w/2, paddleX));
    });
    window.addEventListener('keyup', (e) => { if (e.code === 'Space') spacePressed = false; });

    function initGame() { 
        if (audioCtx.state === 'suspended') audioCtx.resume();
        score = 0; lives = 3; level = 1; 
        document.getElementById('screen-start').style.display = 'none'; 
        canvas.requestPointerLock();
        startLevel(); 
    }

    function startLevel() {
        state = 'PLAYING'; document.getElementById('screen-next').style.display = 'none';
        paddle = new Paddle(); balls = [new Ball(canvas.width/2, paddle.y - BALL_RADIUS, true)];
        powerUps = []; lasers = []; Object.keys(timers).forEach(k => timers[k] = 0);
        createBricks(); update();
    }

    function createBricks() {
        bricks = [];
        for(let r=0; r<6; r++) {
            for(let c=0; c<10; c++) {
                let x = c * 76 + 20, y = r * 26 + 60;
                let hp = Math.ceil(level / 2);
                if (level >= 10 && (c === 2 || c === 7) && r < 4) bricks.push(new Brick(x, y, -1));
                else bricks.push(new Brick(x, y, hp));
            }
        }
    }

    function togglePause() {
        if (state === 'PLAYING') { state = 'PAUSE'; document.getElementById('screen-pause').style.display = 'flex'; document.exitPointerLock(); }
        else if (state === 'PAUSE') { state = 'PLAYING'; document.getElementById('screen-pause').style.display = 'none'; canvas.requestPointerLock(); update(); }
    }

    function update() {
        if (state !== 'PLAYING') return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        Object.keys(timers).forEach(k => { if(timers[k] > 0) timers[k]--; });
        paddle.w = timers.wide > 0 ? 200 : paddle.baseW;
        paddle.draw();

        if (timers.laser > 0 && (spacePressed || isMouseDown) && timers.laserCooldown <= 0) {
            sfx.laser(); // LASER SOUND
            lasers.push({x: paddleX - paddle.w/2 + 4, y: paddle.y}, {x: paddleX + paddle.w/2 - 4, y: paddle.y});
            timers.laserCooldown = 12;
        }

        lasers.forEach((l, i) => {
            l.y -= 12; ctx.fillStyle = "#ff0000"; ctx.fillRect(l.x-1, l.y, 3, 15);
            if (l.y < 0) lasers.splice(i, 1);
        });

        balls.forEach((b, bi) => {
            b.update(); b.draw();
            if (b.y > canvas.height) balls.splice(bi, 1);
        });

        if (balls.length === 0) {
            sfx.death(); // DEATH SOUND
            lives--; document.getElementById('lives').innerText = lives;
            if (lives <= 0) { 
                state = 'GAMEOVER'; 
                document.exitPointerLock(); 
                document.getElementById('screen-over').style.display = 'flex'; 
                if (score > savedData.score) sfx.highScore(); // HIGH SCORE SOUND
            }
            else { balls.push(new Ball(paddleX, paddle.y - BALL_RADIUS, true)); }
        }

        bricks.forEach((br) => {
            if (br.status === 0) return; br.draw();
            balls.forEach(b => {
                if (b.x > br.x && b.x < br.x+br.w && b.y > br.y && b.y < br.y+br.h) {
                    if (br.hits !== -1) { 
                        sfx.hit(); // BRICK HIT SOUND
                        br.hits--; 
                        if(br.hits<=0) { br.status=0; score+=10; spawnLogic(br.x, br.y); } 
                    }
                    if (timers.ultimate <= 0) b.dy *= -1;
                }
            });
            lasers.forEach((l, li) => {
                if (l.x > br.x && l.x < br.x + br.w && l.y > br.y && l.y < br.y + br.h) {
                    if (br.hits !== -1) { 
                        sfx.hit(); // LASER BRICK HIT SOUND
                        br.hits--; 
                        if(br.hits<=0) { br.status=0; score+=10; } 
                    }
                    lasers.splice(li, 1);
                }
            });
        });

        powerUps.forEach((p, i) => {
            p.update(); p.draw();
            if (p.y + POWERUP_SIZE > paddle.y && p.x > paddleX - paddle.w/2 - 10 && p.x < paddleX + paddle.w/2 + 10) {
                applyPowerUp(p.type); powerUps.splice(i, 1);
            }
        });

        document.getElementById('score').innerText = score;
        if (bricks.filter(b => b.status === 1 && b.hits !== -1).length === 0) {
            state = 'LEVEL_UP'; level++; document.exitPointerLock();
            document.getElementById('level-msg').innerText = `SECTOR ${level} ACTIVE`;
            document.getElementById('screen-next').style.display = 'flex';
        }
        requestAnimationFrame(update);
    }

    function spawnLogic(x, y) {
        let rand = Math.random();
        if (rand < 0.02) powerUps.push(new PowerUp(x, y, 5));
        else if (rand < 0.20) powerUps.push(new PowerUp(x, y, Math.floor(Math.random()*4)+1));
    }

    function applyPowerUp(type) {
        if (type === 1) timers.laser = EFFECT_DURATION;
        if (type === 2) { for(let i=0; i<3; i++) balls.push(new Ball(paddleX, paddle.y - 10)); }
        if (type === 3) timers.magnet = EFFECT_DURATION;
        if (type === 4) timers.wide = EFFECT_DURATION;
        if (type === 5) timers.ultimate = EFFECT_DURATION;
    }

    function saveHighScore() {
        let name = document.getElementById('nameInput').value.toUpperCase() || 'ID';
        if (score > savedData.score) localStorage.setItem('brickHS_v4', JSON.stringify({name, score}));
        location.reload();
    }