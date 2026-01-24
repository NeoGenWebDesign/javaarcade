// ===== SMOOTH SCROLLING AND NAV FUNCTIONALITY =====
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// ===== NAV ACTIVE STATE =====
window.addEventListener('scroll', () => {
    const sections = document.querySelectorAll('section');
    const navLinks = document.querySelectorAll('.nav-link');

    let currentSection = '';
    sections.forEach(section => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.clientHeight;
        if (pageYOffset >= sectionTop - 200) {
            currentSection = section.getAttribute('id');
        }
    });

    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === '#' + currentSection) {
            link.classList.add('active');
        }
    });
});

// ===== ADD ANIMATION ON SCROLL =====
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver(function(entries) {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('animate-in');
            observer.unobserve(entry.target);
        }
    });
}, observerOptions);

// Observe game cards for animation
document.querySelectorAll('.game-card').forEach(card => {
    observer.observe(card);
});

// ===== ARCADE SOUND EFFECT SIMULATION =====
// Add retro "beep" effect on button hovers (visual feedback)
document.querySelectorAll('.game-link, .social-link, .nav-link').forEach(link => {
    link.addEventListener('mouseenter', function() {
        // Create a visual "beep" feedback
        this.style.animation = 'none';
        setTimeout(() => {
            this.style.animation = '';
        }, 10);
    });
});

// ===== KEYBOARD NAVIGATION =====
document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
        window.scrollBy(0, 100);
    } else if (e.key === 'ArrowUp') {
        window.scrollBy(0, -100);
    }
});

// ===== PARALLAX EFFECT FOR HERO SECTION =====
window.addEventListener('scroll', () => {
    const hero = document.querySelector('.hero');
    if (hero) {
        const scrollPosition = window.pageYOffset;
        hero.style.backgroundPosition = `0% ${scrollPosition * 0.5}px`;
    }
});

// ===== ADD ACTIVE CLASS FOR NAV LINKS ON CLICK =====
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', function() {
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        this.classList.add('active');
    });
});

// ===== EASTER EGG: KONAMI CODE =====
const konamiCode = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
let konamiIndex = 0;

document.addEventListener('keydown', (e) => {
    if (e.key === konamiCode[konamiIndex]) {
        konamiIndex++;
        if (konamiIndex === konamiCode.length) {
            activateEasterEgg();
            konamiIndex = 0;
        }
    } else {
        konamiIndex = 0;
    }
});

function activateEasterEgg() {
    console.log('🎮 KONAMI CODE ACTIVATED! 🎮');
    const body = document.body;
    body.style.filter = 'invert(1) hue-rotate(180deg)';
    
    setTimeout(() => {
        body.style.filter = 'none';
    }, 2000);

    // Create arcade effect
    const message = document.createElement('div');
    message.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-family: 'Press Start 2P', cursive;
        font-size: 24px;
        color: #ffff00;
        text-shadow: 0 0 20px #ffff00;
        z-index: 9999;
        animation: fadeInOut 2s ease-in-out;
    `;
    message.textContent = '★ ARCADE MODE ACTIVATED ★';
    document.body.appendChild(message);

    setTimeout(() => {
        message.remove();
    }, 2000);
}

// ===== ADD ANIMATION STYLES =====
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeInOut {
        0%, 100% { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
        50% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    }

    @keyframes animate-in {
        from {
            opacity: 0;
            transform: translateY(20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    .animate-in {
        animation: animate-in 0.6s ease-out forwards;
    }

    .nav-link.active {
        color: var(--neon-cyan) !important;
        border-color: var(--neon-cyan) !important;
        text-shadow: 0 0 10px var(--neon-cyan) !important;
    }
`;
document.head.appendChild(style);

// ===== CONSOLE MESSAGE =====
console.log('%c🎮 Welcome to JavaScript Arcade! 🎮', 'font-size: 20px; color: #00d4ff; text-shadow: 0 0 10px #00d4ff;');
console.log('%cEnter the Konami Code (↑ ↑ ↓ ↓ ← → ← → B A) to activate Arcade Mode!', 'font-size: 14px; color: #39ff14;');
