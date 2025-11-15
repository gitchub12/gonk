// BROWSERFIREFOXHIDE animated_gauges.js
// Animated Health and Power Gauge System
// Loads and animates sphere gauge images with dynamic clipping based on health/energy percentage

class AnimatedGauge {
    constructor(canvasId, animationPath, filePrefix, options = {}) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            console.error(`Canvas ${canvasId} not found`);
            return;
        }

        this.ctx = this.canvas.getContext('2d');
        this.animationPath = animationPath;
        this.filePrefix = filePrefix; // e.g., 'healthgauge' or 'energygauge'

        // Options
        this.opacity = options.opacity || 0.85; // Translucency (0.85 = slight transparency)
        this.showPreview = options.showPreview || false; // For energy gauge preview
        this.previewColor = options.previewColor || 'rgba(255, 255, 255, 0.3)';
        this.scale = options.scale || 1.0; // Scale factor for the image (0.1 to 3.0)
        this.flipVertical = options.flipVertical || false; // Flip image upside down

        // Animation state
        this.frames = [];
        this.currentFrame = 0;
        this.frameCount = 0;
        this.animationSpeed = options.animationSpeed || 100; // ms per frame
        this.lastFrameTime = 0;
        this.isLoaded = false;
        this.animationDirection = 1; // 1 for forward, -1 for reverse (ping-pong animation)

        // Gauge state
        this.percentage = 1.0; // 0.0 to 1.0
        this.previewPercentage = 0; // How much to preview for next shot (0.0 to 1.0)

        // Set canvas size
        const size = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--gauge-size')) || 200;
        this.canvas.width = size;
        this.canvas.height = size;

        // Load frames
        this.loadFrames();
    }

    async loadFrames() {
        console.log(`Loading gauge frames from ${this.animationPath}...`);

        // Try to load frames numbered 001, 002, 003, etc.
        const maxFrames = 200; // Maximum number to try
        const loadedFrames = [];
        let useUnderscore = null; // null = unknown, true = use underscore, false = no underscore

        for (let i = 1; i <= maxFrames; i++) {
            const frameNum = String(i).padStart(3, '0');
            let framePath;
            let img;

            // On first frame, determine naming pattern
            if (useUnderscore === null) {
                // Try with underscore separator first (powergauge_001.png)
                framePath = `${this.animationPath}/${this.filePrefix}_${frameNum}.png`;
                try {
                    img = await this.loadImage(framePath);
                    loadedFrames.push(img);
                    useUnderscore = true;
                    if (i === 1) console.log(`${this.filePrefix}: using underscore pattern`);
                } catch (error) {
                    // Try without underscore (healthgauge001.png)
                    framePath = `${this.animationPath}/${this.filePrefix}${frameNum}.png`;
                    try {
                        img = await this.loadImage(framePath);
                        loadedFrames.push(img);
                        useUnderscore = false;
                        if (i === 1) console.log(`${this.filePrefix}: using no-underscore pattern`);
                    } catch (error2) {
                        // Neither pattern worked - silently stop
                        break;
                    }
                }
            } else {
                // Use established naming pattern
                framePath = useUnderscore
                    ? `${this.animationPath}/${this.filePrefix}_${frameNum}.png`
                    : `${this.animationPath}/${this.filePrefix}${frameNum}.png`;

                try {
                    img = await this.loadImage(framePath);
                    loadedFrames.push(img);
                } catch (error) {
                    // Stop when we can't load the next frame - silently
                    break;
                }
            }
        }

        if (loadedFrames.length === 0) {
            console.warn(`No frames found for ${this.filePrefix}. Using fallback rendering.`);
            this.frameCount = 0;
            this.isLoaded = true;
            this.renderFallback();
        } else {
            console.log(`Loaded ${loadedFrames.length} ${this.filePrefix} frames`);
            this.frames = loadedFrames;
            this.frameCount = loadedFrames.length;
            this.isLoaded = true;
        }
    }

    loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();

            // Set up error handler BEFORE setting src to catch the error early
            img.onerror = (e) => {
                // Silently reject without logging
                reject(new Error(`Failed to load ${src}`));
            };

            img.onload = () => resolve(img);

            // Set src after handlers are attached
            img.src = src;
        });
    }

    update(deltaTime) {
        if (!this.isLoaded) return;

        // Update animation frame with ping-pong behavior (1,2,3,3,2,1)
        if (this.frameCount > 0) {
            this.lastFrameTime += deltaTime * 1000; // Convert to ms

            if (this.lastFrameTime >= this.animationSpeed) {
                this.currentFrame += this.animationDirection;

                // Reverse direction at boundaries
                if (this.currentFrame >= this.frameCount - 1) {
                    this.currentFrame = this.frameCount - 1;
                    this.animationDirection = -1;
                } else if (this.currentFrame <= 0) {
                    this.currentFrame = 0;
                    this.animationDirection = 1;
                }

                this.lastFrameTime = 0;
            }
        }

        this.render();
    }

    setPercentage(value) {
        this.percentage = Math.max(0, Math.min(1, value));
    }

    setPreviewPercentage(value) {
        this.previewPercentage = Math.max(0, Math.min(1, value));
    }

    setScale(value) {
        this.scale = Math.max(0.1, Math.min(3.0, value));
    }

    render() {
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        if (this.frameCount === 0) {
            this.renderFallback();
            return;
        }

        // Save context state
        ctx.save();

        // Set global opacity for translucency
        ctx.globalAlpha = this.opacity;

        // Get current frame
        const currentImage = this.frames[this.currentFrame];

        // Calculate clipping region (bottom portion based on percentage)
        const fillHeight = height * this.percentage;
        const clipY = height - fillHeight;

        // Draw the visible portion (bottom X% of the sphere)
        // Use image's natural aspect ratio to prevent squishing
        ctx.save();

        // First, create circular clipping mask to contain gauge within circle
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = width / 2;

        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.clip();

        // Second, clip to bottom portion based on percentage
        ctx.beginPath();
        ctx.rect(0, clipY, width, fillHeight);
        ctx.clip();

        // Calculate dimensions to maintain aspect ratio
        const imgAspect = currentImage.naturalWidth / currentImage.naturalHeight;
        const canvasAspect = width / height;
        let drawWidth, drawHeight, drawX, drawY;

        if (imgAspect > canvasAspect) {
            // Image is wider - fit to height
            drawHeight = height * this.scale;
            drawWidth = height * imgAspect * this.scale;
            drawX = (width - drawWidth) / 2;
            drawY = (height - drawHeight) / 2;
        } else {
            // Image is taller or square - fit to width
            drawWidth = width * this.scale;
            drawHeight = width / imgAspect * this.scale;
            drawX = (width - drawWidth) / 2;
            drawY = (height - drawHeight) / 2;
        }

        // Apply vertical flip if enabled (for health gauge)
        if (this.flipVertical) {
            ctx.save();
            ctx.translate(0, height);
            ctx.scale(1, -1);
            ctx.drawImage(currentImage, drawX, height - drawY - drawHeight, drawWidth, drawHeight);
            ctx.restore();
        } else {
            ctx.drawImage(currentImage, drawX, drawY, drawWidth, drawHeight);
        }

        ctx.restore();

        // Draw preview indicator for energy gauge (if enabled)
        if (this.showPreview && this.previewPercentage > 0) {
            const previewHeight = height * this.previewPercentage;
            const previewY = height - fillHeight;
            const previewEndY = previewY + previewHeight;

            // Only draw preview if it's within the visible gauge area
            if (previewEndY > clipY) {
                ctx.save();

                // Create circular clipping mask for preview
                const centerX = width / 2;
                const centerY = height / 2;
                const radius = width / 2;

                ctx.beginPath();
                ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
                ctx.clip();

                // Draw preview highlight
                ctx.fillStyle = this.previewColor;
                const drawY = Math.max(previewY, clipY);
                const drawHeight = previewEndY - drawY;

                if (drawHeight > 0) {
                    ctx.fillRect(0, drawY, width, drawHeight);
                }

                ctx.restore();
            }
        }

        // Restore context state
        ctx.restore();
    }

    renderFallback() {
        // Fallback rendering when no frames are loaded
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;

        ctx.clearRect(0, 0, width, height);

        // Draw a simple colored circle as fallback
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = width / 2 - 2;

        // Background circle (dark)
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Border
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.stroke();

        // Fill (bottom portion)
        ctx.save();
        const fillHeight = height * this.percentage;
        const clipY = height - fillHeight;

        ctx.beginPath();
        ctx.rect(0, clipY, width, fillHeight);
        ctx.clip();

        ctx.globalAlpha = this.opacity;
        ctx.fillStyle = this.filePrefix.includes('health') ? '#ff0000' : '#0000ff';
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        // Preview for energy gauge
        if (this.showPreview && this.previewPercentage > 0) {
            const previewHeight = height * this.previewPercentage;
            const previewY = height - fillHeight;
            const previewEndY = previewY + previewHeight;

            if (previewEndY > clipY) {
                ctx.save();

                ctx.beginPath();
                ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
                ctx.clip();

                ctx.fillStyle = this.previewColor;
                const drawY = Math.max(previewY, clipY);
                const drawHeight = previewEndY - drawY;

                if (drawHeight > 0) {
                    ctx.fillRect(0, drawY, width, drawHeight);
                }

                ctx.restore();
            }
        }
    }
}

// Gauge Manager - handles both health and power gauges
class GaugeManager {
    constructor() {
        this.healthGauge = null;
        this.powerGauge = null;
        this.initialized = false;
    }

    init() {
        console.log('Initializing Animated Gauge System...');

        // Create health gauge
        this.healthGauge = new AnimatedGauge(
            'health-gauge-canvas',
            'data/pngs/HUD/HealthSphereAnimation',
            'healthgauge',
            {
                opacity: 0.85,
                animationSpeed: 200, // Slowed to 50% speed (was 100ms)
                showPreview: false,
                scale: 1.85,
                flipVertical: false // Health gauge right-side up
            }
        );

        // Create power gauge with preview enabled
        this.powerGauge = new AnimatedGauge(
            'power-gauge-canvas',
            'data/pngs/HUD/PowerSphereAnimation',
            'powergauge',
            {
                opacity: 0.85,
                animationSpeed: 200, // Slowed to 50% speed (was 100ms)
                showPreview: true,
                previewColor: 'rgba(100, 150, 255, 0.4)',
                scale: 1.65
            }
        );

        this.initialized = true;
        console.log('Animated Gauge System initialized.');
    }

    update(deltaTime) {
        if (!this.initialized) return;

        if (this.healthGauge) {
            this.healthGauge.update(deltaTime);
        }

        if (this.powerGauge) {
            this.powerGauge.update(deltaTime);
        }
    }

    updateHealth(current, max) {
        if (this.healthGauge && max > 0) {
            this.healthGauge.setPercentage(current / max);
        }
    }

    updatePower(current, max, nextShotCost = 0) {
        if (this.powerGauge && max > 0) {
            this.powerGauge.setPercentage(current / max);

            // Set preview for next shot
            if (nextShotCost > 0) {
                this.powerGauge.setPreviewPercentage(nextShotCost / max);
            } else {
                this.powerGauge.setPreviewPercentage(0);
            }
        }
    }
}

// Create global instance
window.gaugeManager = new GaugeManager();
console.log('Animated Gauges System Loaded.');
