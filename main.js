// BROWSERFIREFOXHIDE main.js
// This file now only DEFINES and INSTANTIATES the core classes. The game loop has been moved to index.html.

// === GAME GLOBAL CONSTANTS ===
const GAME_GLOBAL_CONSTANTS = {
  PLAYER: {
    MAX_HEALTH: 10,
    HEIGHT: 0.5,
    COLLISION_RADIUS: 0.4
  },
  MOVEMENT: {
    SPEED: 0.028,
    FRICTION: 0.85,
    BOB_SPEED: 8,
    BOB_AMOUNT: 0.02
  },
  WEAPONS: {
    PAMPHLET_SPEED: 0.2,
    PAMPHLET_LIFE: 120,
    PAMPHLET_MAX_AMMO: 50,
    PAMPHLET_START_AMMO: 25,
  },
  ENVIRONMENT: {
    WALL_HEIGHT: 1.0,
    DOOR_OPEN_TIME: 5000,
    WALL_BARRIER: 0.6
  },
};
Object.freeze(GAME_GLOBAL_CONSTANTS);
// ... freeze other sub-objects ...

// === INPUT HANDLER ===
class InputHandler {
  constructor() {
    this.keys = {};
    this.yaw = Math.PI;
    this.setupEventListeners();
  }
  
  setupEventListeners() {
    document.addEventListener('keydown', (e) => this.onKeyDown(e));
    document.addEventListener('keyup', (e) => this.keys[e.code] = false);
    document.addEventListener('click', () => { if (game.canvas) game.canvas.requestPointerLock() });
    document.addEventListener('mousemove', (e) => this.onMouseMove(e));
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('mousedown', (e) => this.onMouseDown(e));
  }

  onKeyDown(e) {
    this.keys[e.code] = true;
    if (e.code === 'Space') {
        e.preventDefault();
        if(window.physics) physics.interact();
    }
    if (e.code === 'KeyP') {
        e.preventDefault();
        if (window.physics) {
            window.physics.noclipEnabled = !window.physics.noclipEnabled;
            console.log(`Noclip ${window.physics.noclipEnabled ? 'Enabled' : 'Disabled'}`);
        }
    }
    if (e.code === 'KeyH') {
        const hud = document.querySelector('.game-hud-container');
        if (hud) {
            hud.style.display = (hud.style.display === 'block') ? 'none' : 'block';
        }
    }
  }

  onMouseDown(e) {
    if (document.pointerLockElement !== game.canvas) return;
    if (e.button === 2) { 
        if (window.playerWeaponSystem) playerWeaponSystem.handlePamphletAttack();
    }
  }
  
  onMouseMove(e) {
    if (document.pointerLockElement !== game.canvas) return;
    this.yaw -= e.movementX * 0.002;
    if (game.camera) {
        game.camera.rotation.y = this.yaw;
        game.camera.rotation.x = 0; 
    }
  }
}

// === GAME ENGINE CORE ===
class Game {
  constructor() {
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.canvas = null;
    this.isInitialized = false;
    this.lastFrameTime = performance.now();
    this.deltaTime = 0;
    this.entities = { npcs: [], projectiles: [], doors: [], pickups: [] };
    this.state = { 
        health: GAME_GLOBAL_CONSTANTS.PLAYER.MAX_HEALTH,
        ammo: GAME_GLOBAL_CONSTANTS.WEAPONS.PAMPHLET_START_AMMO,
        maxAmmo: GAME_GLOBAL_CONSTANTS.WEAPONS.PAMPHLET_MAX_AMMO,
        gameOver: false 
    };
    this.hudGonkIcon = {
        basePath: 'data/pngs/hologonk/hologonk_',
        totalFrames: 40,
        currentFrame: 1,
        animTimer: 0,
        animSpeed: 0.05, // Time in seconds between frames
        needsUpdate: true
    };
  }

  init() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(this.renderer.domElement);
    this.canvas = this.renderer.domElement;
    this.renderer.shadowMap.enabled = true;
    this.setupLighting();
    window.addEventListener('resize', this.onWindowResize.bind(this));
    this.isInitialized = true;
  }

  setupLighting() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 15);
    directionalLight.castShadow = true;
    this.scene.add(directionalLight);
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  update(currentTime) {
    this.deltaTime = (currentTime - this.lastFrameTime) / 1000;
    this.lastFrameTime = currentTime;
    for (let i = this.entities.projectiles.length - 1; i >= 0; i--) {
      if (!this.entities.projectiles[i].update(this.deltaTime)) {
        this.entities.projectiles.splice(i, 1);
      }
    }
    this.updateHUD();
  }

  updateHUD() {
      const healthFill = document.querySelector('.health-fill');
      const healthLabel = document.querySelector('.health-label');
      const ammoDisplay = document.getElementById('gameHudAmmo');
      const gonkImage = document.getElementById('gonkImage');
      
      // Health and Ammo
      if (healthFill && healthLabel) {
          const healthPercent = Math.max(0, (this.state.health / GAME_GLOBAL_CONSTANTS.PLAYER.MAX_HEALTH) * 100);
          healthFill.style.width = `${healthPercent}%`;
          healthLabel.textContent = `HEALTH: ${Math.round(healthPercent)}%`;
      }
      if (ammoDisplay) {
          ammoDisplay.textContent = `${this.state.ammo} / ${this.state.maxAmmo}`;
      }

      // Animated Icon
      const icon = this.hudGonkIcon;
      icon.animTimer += this.deltaTime;

      if (icon.animTimer >= icon.animSpeed) {
          let frameChanged = false;
          if (inputHandler.keys['KeyW']) {
              icon.currentFrame++;
              if (icon.currentFrame > icon.totalFrames) icon.currentFrame = 1;
              frameChanged = true;
          } else if (inputHandler.keys['KeyS']) {
              icon.currentFrame--;
              if (icon.currentFrame < 1) icon.currentFrame = icon.totalFrames;
              frameChanged = true;
          }
          if (frameChanged) {
              icon.animTimer = 0;
              icon.needsUpdate = true;
          }
      }

      if (icon.needsUpdate && gonkImage) {
          gonkImage.src = `${icon.basePath}${icon.currentFrame}.png`;
          icon.needsUpdate = false;
      }
  }

  render() { this.renderer.render(this.scene, this.camera) }

  clearScene() {
    while(this.scene.children.length > 0){ this.scene.remove(this.scene.children[0]) }
    this.entities = { npcs: [], projectiles: [], doors: [], pickups: [] };
    this.setupLighting();
  }
}


// === INSTANTIATION ===
window.game = new Game();
window.inputHandler = new InputHandler();