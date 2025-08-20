// BROWSERFIREFOXHIDE player_physics_and_interactions.js
// Vertical camera bobbing has been removed for a stable view.

class PhysicsSystem {
  constructor() {
    this.velocity = new THREE.Vector3();
    this.bobTime = 0;
  }

  updateMovement(deltaTime, keys, camera, noClipMode = false) {
    if (!camera) return false;

    const acceleration = new THREE.Vector3();
    let isMoving = false;
    const moveSpeed = GAME_GLOBAL_CONSTANTS.MOVEMENT.SPEED;
    
    const yaw = inputHandler.yaw;
    const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).negate();
    const right = new THREE.Vector3(forward.z, 0, -forward.x);

    if (keys['KeyW']) { acceleration.add(forward); isMoving = true; }
    if (keys['KeyS']) { acceleration.sub(forward); isMoving = true; }
    if (keys['KeyA']) { acceleration.sub(right); isMoving = true; }
    if (keys['KeyD']) { acceleration.add(right); isMoving = true; }
    
    if (isMoving) {
      acceleration.normalize().multiplyScalar(moveSpeed);
    }

    this.velocity.add(acceleration);
    this.velocity.multiplyScalar(GAME_GLOBAL_CONSTANTS.MOVEMENT.FRICTION);
    
    const newPosition = camera.position.clone().add(this.velocity);
    
    // Set fixed height for the camera
    newPosition.y = GAME_GLOBAL_CONSTANTS.PLAYER.HEIGHT;

    // TODO: Collision check
    
    camera.position.copy(newPosition);
    
    // The bobbing function no longer affects camera height.
    this.updateBobbing(deltaTime, isMoving, camera);
    return isMoving;
  }

  updateBobbing(deltaTime, isMoving, camera) {
    // This function can be used for weapon sway or other horizontal effects later.
    // For now, it does nothing to the camera's Y position.
    if (isMoving) {
      this.bobTime += deltaTime; // Still track time for other potential effects
    } else {
      this.bobTime = 0;
    }
  }
}

window.physics = new PhysicsSystem();