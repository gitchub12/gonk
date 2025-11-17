// BROWSERFIREFOXHIDE loadingScreenManager.js
// update: This class was extracted from main.js to resolve a module conflict.
// update: Reverted trivia feedback popup to its original centered position to fix UI glitch.
// update: Halved the trivia screen's post-answer delay for a faster transition back to the game.
// update: Removed redundant instantiation line. Instantiation now happens in index.html's initGame function.

class LoadingScreenManager {
    constructor() {
        this.container = document.getElementById('loading-screen-container');
        this.status = document.getElementById('loadingStatus');
        this.question = document.getElementById('question');
        this.punchline = document.getElementById('punchline');
        this.answers = {
            top: document.getElementById('answer-top'),
            left: document.getElementById('answer-left'),
            right: document.getElementById('answer-right'),
            bottom: document.getElementById('answer-bottom')
        };
        this.answerElements = [this.answers.top, this.answers.left, this.answers.right, this.answers.bottom];
        this.feedbackPopup = document.getElementById('feedback-popup');
        this.backgroundImageElement = document.getElementById('loading-screen-bg-image');

        this.triviaData = null;
        this.backgroundImages = [];
        this.currentCorrectAnswer = '';
        this.isGameReady = false;
        this.isActive = false;
        this.isAnswered = false;
        this.unpauseTimer = 0;
        this.lastTime = 0;

        this.mouse = { x: 0, y: 0 };
        this.accumulatedX = 0;
        this.accumulatedY = 0;
        this.selectionThreshold = 50; 
        this.highlightedElement = null;

        document.addEventListener('mousemove', e => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        });

        this.update = this.update.bind(this);
    }

    handleClick() {
        if (this.isActive && !this.isAnswered && this.currentCorrectAnswer && this.highlightedElement) {
            this.checkAnswer(this.highlightedElement.textContent);
        }
    }

    handleMouseMove(dx, dy) {
        if (!this.isActive || this.isAnswered) return;
        this.accumulatedX += dx;
        this.accumulatedY += dy;
    }

    async loadTriviaData() {
        try {
            const response = await fetch('data/trivia_questions.json');
            if (!response.ok) throw new Error('Failed to fetch trivia data');
            this.triviaData = await response.json();
        } catch (e) {
            console.error("Failed to load trivia data:", e);
        }
        await this.loadBackgroundImages();
    }

    async fetchDirectoryListing(path) {
        try {
            const response = await fetch(path);
            if (!response.ok) return [];
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            return Array.from(doc.querySelectorAll('a'))
                .map(a => a.getAttribute('href'))
                .filter(href => href && !href.startsWith('?') && !href.startsWith('../') && !href.endsWith('/'));
        } catch (e) {
            console.warn(`Could not fetch directory listing for "${path}".`);
            return [];
        }
    }

    async loadBackgroundImages() {
        const path = '/data/pngs/loadscreens/';
        const imageFiles = await this.fetchDirectoryListing(path);
        this.backgroundImages = imageFiles.map(file => `${path}${file}`);
    }

    show() {
        game.state.isPaused = true; 
        this.status.style.display = 'none';

        if (!this.triviaData) {
            this.container.style.display = 'flex';
            this.question.textContent = 'Loading...';
            this.status.style.display = 'block';
            return;
        }

        this.isAnswered = false;
        this.unpauseTimer = 0;
        this.highlightedElement = null;
        Object.values(this.answers).forEach(el => {
            el.style.display = 'flex';
            el.classList.remove('highlighted', 'correct', 'incorrect', 'faded');
            el.style.opacity = 1;
        });
        this.punchline.style.opacity = 0;
        this.punchline.style.display = 'none'; // Ensure it's hidden initially

        if (this.backgroundImages.length > 0) {
            const bgImage = this.backgroundImages[Math.floor(Math.random() * this.backgroundImages.length)];
            this.backgroundImageElement.src = bgImage;
        }

        const item = this.triviaData.loadingItems[Math.floor(Math.random() * this.triviaData.loadingItems.length)];

        this.question.textContent = item.question;
        this.currentCorrectAnswer = item.correctAnswer;

        let answers = [item.correctAnswer, item.cleverWrong];
        const category = item.category || 'other';
        const wrongAnswerPool = this.triviaData.genericWrongAnswers[category] || this.triviaData.genericWrongAnswers.other;

        while (answers.length < 4) {
            const wrong = wrongAnswerPool[Math.floor(Math.random() * wrongAnswerPool.length)];
            if (!answers.includes(wrong)) {
                answers.push(wrong);
            }
        }

        for (let i = answers.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [answers[i], answers[j]] = [answers[j], answers[i]];
        }
        this.answers.top.textContent = answers[0];
        this.answers.left.textContent = answers[1];
        this.answers.right.textContent = answers[2];
        this.answers.bottom.textContent = answers[3];
        Object.values(this.answers).forEach(el => el.style.display = 'flex');

        this.container.style.display = 'flex';
        this.isActive = true;
        this.lastTime = performance.now();

        // Defer music playback to allow level data to load first
        // Music will be started when pendingMusicSettings is available
        this.musicStarted = false;
        requestAnimationFrame(this.update);
    }

    update() {
        if (!this.isActive) return;
        const now = performance.now();
        const deltaTime = (now - this.lastTime) / 1000;
        this.lastTime = now;

        // Start music once level data is loaded (levelDataParsed flag is set)
        if (!this.musicStarted && window.audioSystem && audioSystem.musicCategories.length > 0 && window.levelManager?.levelDataParsed) {
            // Stop any currently playing music first
            if (audioSystem.musicAudio && audioSystem.musicAudio.isPlaying) {
                audioSystem.musicAudio.stop();
                audioSystem.isMusicPlaying = false;
            }

            // Check if level has specific music settings
            const levelMusicSettings = window.levelManager?.pendingMusicSettings;
            if (levelMusicSettings) {
                console.log('[Music] Playing level-specific music:', levelMusicSettings);
                audioSystem.playLevelMusic(levelMusicSettings);
            } else {
                // Level is loaded but no music settings defined - play random
                console.log('[Music] No level music settings, playing random');
                const nonLyricalCategories = audioSystem.musicCategories.filter(c => c.toLowerCase() !== 'lyrics');
                if (nonLyricalCategories.length > 0) {
                    const randomCategory = nonLyricalCategories[Math.floor(Math.random() * nonLyricalCategories.length)];
                    audioSystem.playRandomTrackFromCategory(randomCategory);
                }
            }
            this.musicStarted = true;
        }

        if (!this.isAnswered && this.currentCorrectAnswer) {
            let newHighlight = null;
            const usePointerLock = document.pointerLockElement === game.canvas;

            if (usePointerLock) {
                if (Math.abs(this.accumulatedX) > this.selectionThreshold || Math.abs(this.accumulatedY) > this.selectionThreshold) {
                    if (Math.abs(this.accumulatedX) > Math.abs(this.accumulatedY)) {
                        newHighlight = this.accumulatedX < 0 ? this.answers.left : this.answers.right;
                    } else {
                        newHighlight = this.accumulatedY < 0 ? this.answers.top : this.answers.bottom;
                    }
                    this.accumulatedX = 0;
                    this.accumulatedY = 0;
                }
            } else {
                const screenW = window.innerWidth, screenH = window.innerHeight;
                const mouseX = this.mouse.x, mouseY = this.mouse.y;
                const centerX = screenW / 2, centerY = screenH / 2;
                const dx = mouseX - centerX, dy = mouseY - centerY;
                if (Math.abs(dx) < Math.abs(dy)) { 
                    newHighlight = (dy < 0) ? this.answers.top : this.answers.bottom;
                } else { 
                    newHighlight = (dx < 0) ? this.answers.left : this.answers.right;
                }
            }

            if (this.highlightedElement !== newHighlight && newHighlight) {
                if (this.highlightedElement) this.highlightedElement.classList.remove('highlighted');
                newHighlight.classList.add('highlighted');
                this.highlightedElement = newHighlight;
            }
        }

        if (this.unpauseTimer > 0) {
            this.unpauseTimer -= deltaTime;
            if (this.unpauseTimer <= 0) this.hide();
        }

        requestAnimationFrame(this.update);
    }

    checkAnswer(selectedAnswer) {
        this.isAnswered = true;
        const isCorrect = selectedAnswer === this.currentCorrectAnswer;

        if (isCorrect) {
            if (window.audioSystem) audioSystem.playSound('triviacorrect');
            this.showFeedback('Correct!', true);
        } else {
            if (window.audioSystem) audioSystem.playSound('triviawrong');
            this.showFeedback('Incorrect!', false);
        }

        this.answerElements.forEach(el => {
            el.classList.remove('highlighted');
            if (el.textContent === this.currentCorrectAnswer) el.classList.add('correct');
            else el.classList.add('faded');
        });
        this.unpauseTimer = 1.5;
    }

    showFeedback(message, isCorrect) {
        this.feedbackPopup.textContent = message;
        this.feedbackPopup.className = 'feedback-popup ' + (isCorrect ? 'correct' : 'incorrect');

        this.feedbackPopup.style.display = 'block';
    }

    finishLoading() {
        this.isGameReady = true;
    }

    hide() {
        this.container.style.display = 'none';
        this.backgroundImageElement.src = '';
        this.feedbackPopup.style.display = 'none';
        this.isActive = false;
        this.currentCorrectAnswer = '';
        this.isGameReady = false;
        game.state.isPaused = false; 
        if (game.hudContainer) game.hudContainer.style.display = 'block';
        if (game.canvas) game.canvas.requestPointerLock();
    }

    updateStatus(text) {
        if (this.status) {
            if (this.isActive) {
                this.status.style.display = 'none';
            } else {
                this.status.style.display = 'block';
            }
            this.status.textContent = text;
        }
    }
}
// Instantiation moved to index.html