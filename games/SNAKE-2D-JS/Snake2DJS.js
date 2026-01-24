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
        [200, 300, 400].forEach((f, i) => {
            setTimeout(() => playSound(f, 'square', 0.2, 0.1), i * 100);
        });
    },
    eat: () => {
        playSound(523.25, 'sine', 0.1, 0.1);
        setTimeout(() => playSound(880, 'sine', 0.1, 0.1), 50);
    },
    death: () => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(40, audioCtx.currentTime + 0.5);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.start(); osc.stop(audioCtx.currentTime + 0.5);
    },
    highScore: () => {
        [523, 659, 783, 1046].forEach((f, i) => {
            setTimeout(() => playSound(f, 'triangle', 0.4, 0.1), i * 150);
        });
    }
};

// --- GAME LOGIC ---
const canvas = document.getElementById("gameCanvas");
        const ctx = canvas.getContext("2d");
        const scoreElement = document.getElementById("scoreVal");
        const highScoreElement = document.getElementById("highScoreVal");

        const gridSize = 20; 
        const tileCount = canvas.width / gridSize;

        let score = 0;
        let highScore = localStorage.getItem("snakeHighScore") || 0;
        highScoreElement.innerText = highScore;

        let dx = 0, dy = 0;
        let nextDx = 0, nextDy = 0;
        let snake = [{x: 10, y: 10}, {x: 10, y: 11}, {x: 10, y: 12}]; 
        let food = {x: 5, y: 5};
        let changingDirection = false;
        let gameStarted = false;

        function main() {
            if (didGameEnd()) {
                sfx.death();
                if (score > highScore) {
                    setTimeout(() => sfx.highScore(), 600);
                    highScore = score;
                    localStorage.setItem("snakeHighScore", highScore);
                    highScoreElement.innerText = highScore;
                }
                
                setTimeout(() => {
                    alert("Game Over! Score: " + score);
                    resetGame();
                    main();
                }, 100);
                return;
            }

            changingDirection = false;
            setTimeout(function onTick() {
                clearCanvas();
                drawFood();
                advanceSnake();
                drawSnake();
                main();
            }, 80);
        }

        function clearCanvas() {
            ctx.fillStyle = "black";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.strokeStyle = "#111";
            for(let i=0; i<canvas.width; i+=gridSize) {
                ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,canvas.height); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(canvas.width,i); ctx.stroke();
            }
        }

        function drawSnake() {
            snake.forEach((part, index) => {
                ctx.fillStyle = (index === 0) ? "yellow" : "lime";
                ctx.shadowBlur = (index === 0) ? 15 : 0;
                ctx.shadowColor = "yellow";
                ctx.fillRect(part.x * gridSize, part.y * gridSize, gridSize - 2, gridSize - 2);
                ctx.shadowBlur = 0;
            });
        }

        function advanceSnake() {
            dx = nextDx;
            dy = nextDy;

            const head = {x: snake[0].x + dx, y: snake[0].y + dy};
            snake.unshift(head);

            if (head.x === food.x && head.y === food.y) {
                score += 10;
                sfx.eat(); // Trigger "Enemy hit" sound when eating
                scoreElement.innerHTML = score;
                createFood();
            } else {
                snake.pop();
            }
        }

        function didGameEnd() {
            if (dx === 0 && dy === 0) return false;
            const hitWall = snake[0].x < 0 || snake[0].x >= tileCount || snake[0].y < 0 || snake[0].y >= tileCount;
            
            for (let i = 4; i < snake.length; i++) {
                if (snake[i].x === snake[0].x && snake[i].y === snake[0].y) return true;
            }
            return hitWall;
        }

        function createFood() {
            food.x = Math.floor(Math.random() * tileCount);
            food.y = Math.floor(Math.random() * tileCount);
            snake.forEach(part => {
                if (part.x === food.x && part.y === food.y) createFood();
            });
        }

        function drawFood() {
            ctx.fillStyle = "#ff3131";
            ctx.shadowBlur = 10;
            ctx.shadowColor = "gray";
            ctx.beginPath();
            let centerX = food.x * gridSize + gridSize/2;
            let centerY = food.y * gridSize + gridSize/2;
            ctx.arc(centerX, centerY, gridSize/2 - 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        }

        function resetGame() {
            snake = [{x: 10, y: 10}, {x: 10, y: 11}, {x: 10, y: 12}];
            dx = 0; dy = 0; nextDx = 0; nextDy = 0;
            score = 0;
            gameStarted = false;
            scoreElement.innerHTML = score;
            createFood();
        }

        window.addEventListener("keydown", e => {
            // Unblock audio on first interaction
            if (audioCtx.state === 'suspended') {
                audioCtx.resume();
            }

            if (!gameStarted && (e.key.includes("Arrow"))) {
                sfx.start();
                gameStarted = true;
            }

            if (changingDirection) return;
            changingDirection = true;
            
            const key = e.key;
            const goingUp = dy === -1;
            const goingDown = dy === 1;
            const goingRight = dx === 1;
            const goingLeft = dx === -1;

            if (key === "ArrowUp" && !goingDown) { nextDx = 0; nextDy = -1; }
            if (key === "ArrowDown" && !goingUp) { nextDx = 0; nextDy = 1; }
            if (key === "ArrowLeft" && !goingRight) { nextDx = -1; nextDy = 0; }
            if (key === "ArrowRight" && !goingLeft) { nextDx = 1; nextDy = 0; }
        });

        createFood();
        main();