// BROWSERFIREFOXHIDE input.js
// Mouse look is now locked to the horizontal axis (yaw only).

class InputHandler {
  constructor() {
    this.keys = {};
    this.yaw = Math.PI;
    this.pitch = 0; // Pitch is no longer used for camera rotation
    this.noClipMode = false;
    this.setupEventListeners();
  }
  
  setupEventListeners() {
    document.addEventListener('keydown', (e) => this.keys[e.code] = true);
    document.addEventListener('keyup', (e) => this.keys[e.code] = false);
    
    document.addEventListener('click', () => {
        if (game.canvas) game.canvas.requestPointerLock();
    });
    
    document.addEventListener('mousemove', (e) => this.onMouseMove(e));
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('mousedown', (e) => this.onMouseDown(e));
  }

  onMouseDown(e) {
    if (document.pointerLockElement !== game.canvas) return;
    if (e.button === 2) { // Right-click
        if (window.playerWeaponSystem) playerWeaponSystem.handlePamphletAttack();
    }
  }
  
  onMouseMove(e) {
    if (document.pointerLockElement !== game.canvas) return;
      
    // Horizontal mouse movement controls yaw (left/right)
    this.yaw -= e.movementX * 0.002;
    
    // Vertical mouse movement (movementY) is now ignored.
    // The camera's pitch (up/down look) is locked.
    
    if (game.camera) {
        game.camera.rotation.y = this.yaw;
        game.camera.rotation.x = 0; // Lock pitch to 0
    }
  }
}

window.inputHandler = new InputHandler();