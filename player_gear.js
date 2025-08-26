// BROWSERFIREFOXHIDE player_gear.js
// Consolidated file for player gear, level management, and core game logic.

// === EXISTING PLAYER WEAPONS ===
class Projectile {
    // ... (existing Projectile class code would be here)
}

class PlayerWeaponSystem {
    // ... (existing PlayerWeaponSystem class code would be here)
}

// === NEW LEVEL MANAGER ===
class LevelManager {
    constructor(scene) {
        this.scene = scene;
        this.collidables = [];
        this.currentLevel = 0;
        this.levelData = null;
    }

    async loadLevel(levelNumber) {
        try {
            const response = await fetch(`data/level_${levelNumber}.json`);
            if (!response.ok) {
                throw new Error(`Failed to load level_${levelNumber}.json`);
            }
            let levelData = await response.json();
            this.currentLevel = levelNumber;
            this._applyDefaults(levelData);
            this.levelData = levelData;
            this.buildLevel(levelData);
            return levelData;
        } catch (error) {
            console.error("Error loading level:", error);
            return null;
        }
    }

    _applyDefaults(levelData) {
        const defaults = levelData.settings.defaults;
        if (!defaults) return;

        const { width, height } = levelData.settings;

        for (const layerName in defaults) {
            if (!levelData.layers[layerName]) {
                levelData.layers[layerName] = [];
            }

            const existingCoords = new Set(levelData.layers[layerName].map(tile => tile[0]));
            const defaultTileData = defaults[layerName];

            for (let x = 0; x < width; x++) {
                for (let y = 0; y < height; y++) {
                    const coord = `${x},${y}`;
                    if (!existingCoords.has(coord)) {
                        levelData.layers[layerName].push([
                            coord,
                            { type: 'texture', key: defaultTileData.key, rotation: 0 }
                        ]);
                    }
                }
            }
        }
    }

    buildLevel(levelData) {
        this.clearLevel();
        const layers = levelData.layers;
        if (layers.walls) {
            layers.walls.forEach(wallData => this.buildWall(wallData));
        }
    }

    buildWall(wallData) {
        const wallInfo = wallData[1];
        const key = wallInfo.key;
        const doorName = key.substring(key.lastIndexOf('/') + 1);

        const wall = new THREE.Object3D();
        wall.name = `wall_${wallData[0]}`;

        if (wallInfo.properties) {
            Object.assign(wall.userData, wallInfo.properties);
        }

        if (doorName === 'door_2.png') {
            wall.userData.isLevelExit = true;
            wall.userData.targetLevel = this.currentLevel + 1;
        } else if (doorName === 'door_0.png' && this.currentLevel > 1) {
            wall.userData.isLevelExit = true;
            wall.userData.targetLevel = this.currentLevel - 1;
        }

        this.collidables.push(wall);
    }

    clearLevel() {
        this.collidables = [];
    }
}

// === NEW CORE GAME LOGIC ===
class Game {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer();
        this.levelManager = new LevelManager(this.scene);
        this.raycaster = new THREE.Raycaster();
        this.lastLevelLoad = 0;
        this.init();
    }

    init() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(this.renderer.domElement);
        this.instanceTimestamp = Date.now();

        window.addEventListener('storage', (event) => {
            if (event.key === 'game_instance_timestamp') {
                const newTimestamp = parseInt(event.newValue, 10);
                if (newTimestamp > this.instanceTimestamp) {
                    window.close();
                }
            }
        });

        this.camera.position.z = 5;
        const startLevel = localStorage.getItem('game_start_level') || 1;
        this.loadLevel(parseInt(startLevel, 10));
        localStorage.removeItem('game_start_level');
        this.animate();
    }

    async loadLevel(levelNumber) {
        const now = Date.now();
        if (now - this.lastLevelLoad < 1000) return;
        this.lastLevelLoad = now;
        const levelData = await this.levelManager.loadLevel(levelNumber);
    }

    checkCollisions() {
        // Simplified collision check for doors
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));
        this.checkCollisions();
        this.renderer.render(this.scene, this.camera);
    }
}

// === NEW EDITOR COMMUNICATION LOGIC ===
class EditorManager {
    constructor() {
        this.playButton = document.getElementById('play-button'); 
        if (this.playButton) {
            this.playButton.addEventListener('click', this.handlePlayClick.bind(this));
        }
    }

    handlePlayClick() {
        const levelToLoad = 2; 
        localStorage.setItem('game_start_level', levelToLoad.toString());
        localStorage.setItem('game_instance_timestamp', Date.now().toString());
        window.open('http://localhost:8000/index.html', 'gameWindow');
    }
}

// === INSTANTIATION ===
// These will now be created based on the context.

// If we are in the game (e.g., index.html), start the game.
if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
    window.game = new Game();
    // The original weapon systems can be instantiated here if needed by the game
    window.equipmentSystem = {}; // Placeholder
    window.playerWeaponSystem = new PlayerWeaponSystem();
}

// If a #play-button exists, we assume we are in an editor context.
window.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('play-button')) {
        window.editorManager = new EditorManager();
    }
});