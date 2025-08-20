// BROWSERFIREFOXHIDE level_management_system.js
// Rewritten to handle fetching and parsing JSON level files.

class Door {
    constructor(mesh, config = {}) {
        this.mesh = mesh;
        this.isOpen = false;
        this.isAnimating = false;
        this.isLevelTransition = config.isLevelTransition || false;
        this.targetLevel = config.targetLevel || null;
        this.originalY = mesh.position.y;
    }
    
    open() {
        if (this.isOpen || this.isAnimating) return;

        if (this.isLevelTransition) {
            console.log(`Transitioning to level: ${this.targetLevel}`);
            levelManager.loadLevel(this.targetLevel);
            return;
        }

        this.isAnimating = true;
        // Simple animation: move door up
        const targetY = this.originalY + GAME_GLOBAL_CONSTANTS.ENVIRONMENT.WALL_HEIGHT;
        // In a real implementation, you'd use a library like GSAP or a tweening function
        // For now, we'll just snap it open for simplicity
        this.mesh.position.y = targetY;
        this.isOpen = true;
        this.isAnimating = false;
        
        // Auto-close logic
        setTimeout(() => this.close(), GAME_GLOBAL_CONSTANTS.ENVIRONMENT.DOOR_OPEN_TIME);
    }

    close() {
        if (!this.isOpen || this.isAnimating) return;
        this.isAnimating = true;
        this.mesh.position.y = this.originalY;
        this.isOpen = false;
        this.isAnimating = false;
    }

    cleanup() {
        // Cleanup handled by game.clearScene()
    }
}

class LevelManager {
    constructor() {
        this.currentLevelData = null;
    }

    async loadLevel(levelId) {
        console.log(`Attempting to load level: ${levelId}`);
        game.clearScene();
        
        try {
            const response = await fetch(`data/levels/level_${levelId}.json`);
            if (!response.ok) throw new Error(`Level file not found for level_${levelId}.json`);
            
            this.currentLevelData = await response.json();
            console.log(`Level ${levelId} data loaded successfully.`);

            levelRenderer.buildLevelFromData(this.currentLevelData);

        } catch (error) {
            console.error(`Failed to load or build level ${levelId}:`, error);
            // Create a fallback floor so the player doesn't fall into the void
            levelRenderer.createFallbackFloor();
        }
    }
}

window.levelManager = new LevelManager();