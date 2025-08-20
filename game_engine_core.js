// BROWSERFIREFOXHIDE game_engine_core.js
// This new file establishes the central 'Game' class to manage state and entities.

class Game {
  constructor() {
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.canvas = null;
    this.isInitialized = false;
    this.lastFrameTime = performance.now();
    this.deltaTime = 0;
    this.currentLevel = null;

    // Entity manager
    this.entities = {
      npcs: [],
      projectiles: [],
      doors: [],
      pickups: []
    };

    // Game state
    this.state = {
      health: GAME_GLOBAL_CONSTANTS.PLAYER.MAX_HEALTH,
      gameOver: false,
      gameStarted: false
    };
  }

  init() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(0, GAME_GLOBAL_CONSTANTS.PLAYER.HEIGHT, 5);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(this.renderer.domElement);
    this.canvas = this.renderer.domElement;
    
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.setupLighting();

    window.addEventListener('resize', this.onWindowResize.bind(this));
    this.isInitialized = true;
  }

  setupLighting() {
    const ambientLight = new THREE.AmbientLight(0x404040, 0.8);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
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
    this.deltaTime = (currentTime - this.lastFrameTime) / 1000; // Delta in seconds
    this.lastFrameTime = currentTime;

    // Update projectiles
    for (let i = this.entities.projectiles.length - 1; i >= 0; i--) {
      if (!this.entities.projectiles[i].update(this.deltaTime)) {
        this.entities.projectiles.splice(i, 1);
      }
    }
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  clearScene() {
    // Clear entities
     Object.values(this.entities).forEach(entityArray => {
      entityArray.forEach(entity => {
        if (entity.cleanup) entity.cleanup();
      });
      entityArray.length = 0;
    });
    
    // Clear other scene objects
    while(this.scene.children.length > 0){ 
      const child = this.scene.children[0];
      this.scene.remove(child);
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(mat => mat.dispose());
        } else {
          child.material.dispose();
        }
      }
    }
    
    this.setupLighting();
  }
}

window.game = new Game();