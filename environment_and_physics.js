// BROWSERFIREFOXHIDE environment_and_physics.js
// This is the complete, unabbreviated file.

// === LEVEL RENDERER ===
class LevelRenderer {
    constructor() {
        this.gridSize = 1;
        this.wallHeight = GAME_GLOBAL_CONSTANTS.ENVIRONMENT.WALL_HEIGHT;
    }

    buildLevelFromData(levelData) {
        const layers = levelData.layers || {};
        
        if (layers.subfloor) this.createGeometry(layers.subfloor, -0.01, -Math.PI / 2);
        if (layers.floor) this.createGeometry(layers.floor, 0, -Math.PI / 2);
        if (layers.water) this.createGeometry(layers.water, 0.2, -Math.PI / 2);
        if (layers.ceiling) this.createGeometry(layers.ceiling, this.wallHeight, Math.PI / 2);
        if (layers.sky) this.createGeometry(layers.sky, this.wallHeight + 0.01, Math.PI / 2);

        if (layers.walls) this.createWalls(layers.walls);
        if (layers.npcs) this.createNPCs(layers.npcs);

        if (layers.spawns && layers.spawns.length > 0) {
            const [posStr, item] = layers.spawns[0];
            const [x, z] = posStr.split(',').map(Number);
            game.camera.position.set(x * this.gridSize + this.gridSize/2, GAME_GLOBAL_CONSTANTS.PLAYER.HEIGHT, z * this.gridSize + this.gridSize/2);
            if (inputHandler) inputHandler.yaw = (item.rotation || 0) * -Math.PI / 2;
        } else {
             game.camera.position.set(0, GAME_GLOBAL_CONSTANTS.PLAYER.HEIGHT, 0);
        }
    }

    createGeometry(items, y, rotationX) {
        for (const [pos, item] of items) {
            const [x, z] = pos.split(',').map(Number);
            const materialName = item.key.split('/').pop().replace('.png', '');
            let material = assetManager.getMaterial(materialName);
            const planeGeo = new THREE.PlaneGeometry(this.gridSize, this.gridSize);
            const mesh = new THREE.Mesh(planeGeo, material);
            mesh.position.set(x * this.gridSize + this.gridSize / 2, y, z * this.gridSize + this.gridSize / 2);
            mesh.rotation.x = rotationX;
            mesh.receiveShadow = true;
            game.scene.add(mesh);
        }
    }

    createWalls(items) {
        for (const [key, item] of items) {
            const [type, xStr, zStr] = key.split('_');
            const x = Number(xStr); const z = Number(zStr);
            const material = assetManager.getMaterial(item.key.split('/').pop().replace('.png', ''));
            const isDoor = item.key.includes('/door/');
            const wallGeo = new THREE.BoxGeometry(type === 'H' ? this.gridSize : 0.1, this.wallHeight, type === 'V' ? this.gridSize : 0.1);
            const mesh = new THREE.Mesh(wallGeo, material);
            let posX, posZ;
            if (type === 'H') {
                posX = x * this.gridSize + this.gridSize / 2;
                posZ = (z + 1) * this.gridSize;
            } else {
                posX = (x + 1) * this.gridSize;
                posZ = z * this.gridSize + this.gridSize / 2;
            }
            mesh.position.set(posX, this.wallHeight / 2, posZ);
            mesh.castShadow = true; mesh.receiveShadow = true;
            game.scene.add(mesh);
            if (isDoor) game.entities.doors.push(new Door(mesh, item.properties));
        }
    }

    createNPCs(items) {
        for (const [pos, item] of items) {
            const [x, z] = pos.split(',').map(Number);
            const characterId = item.key.replace(/\d+$/, '');
            const config = CHARACTER_CONFIG[characterId];
            if (!config) {
                console.warn(`No character config found for '${characterId}'`);
                continue;
            }
            
            const skinTexture = config.skinTexture.replace('.png','');

            const char = window.createGonkMesh(
                config.minecraftModel || 'humanoid',
                { skinTexture: skinTexture },
                new THREE.Vector3(x * this.gridSize + this.gridSize/2, 0, z * this.gridSize + this.gridSize/2),
                item.key
            );
            if(char) {
                char.group.rotation.y = (item.rotation || 0) * -Math.PI / 2;
                game.scene.add(char.group);
                game.entities.npcs.push(char);
            }
        }
    }

    createFallbackFloor() {
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshStandardMaterial({ color: 0x111111 }));
        floor.rotation.x = -Math.PI / 2;
        game.scene.add(floor);
        const gridHelper = new THREE.GridHelper(100, 100, 0x888888, 0x444444);
        gridHelper.position.y = 0.01;
        game.scene.add(gridHelper);
    }
}

// === LEVEL MANAGER & DOOR ===
class Door {
    constructor(mesh, config = {}) {
        this.mesh = mesh;
        this.isOpen = false;
        this.isLevelTransition = config?.isLevelExit || false;
        this.targetLevel = config?.targetLevel || null;
        this.originalY = mesh.position.y;
    }
    
    open() {
        if (this.isOpen) return;
        if (this.isLevelTransition) { levelManager.loadLevel(this.targetLevel); return; }
        this.mesh.position.y = this.originalY + GAME_GLOBAL_CONSTANTS.ENVIRONMENT.WALL_HEIGHT;
        this.isOpen = true;
        setTimeout(() => this.close(), GAME_GLOBAL_CONSTANTS.ENVIRONMENT.DOOR_OPEN_TIME);
    }

    close() {
        if (!this.isOpen) return;
        this.mesh.position.y = this.originalY;
        this.isOpen = false;
    }
}

class LevelManager {
    async loadLevel(levelId) {
        game.clearScene();
        try {
            let levelData;
            const playtestDataString = localStorage.getItem('gonk_level_to_play');
            if (playtestDataString) {
                levelData = JSON.parse(playtestDataString);
                localStorage.removeItem('gonk_level_to_play');
            } else {
                const response = await fetch(`data/levels/level_${levelId}.json`);
                if (!response.ok) throw new Error(`Level file not found for level_${levelId}.json`);
                levelData = await response.json();
            }
            levelRenderer.buildLevelFromData(levelData);
        } catch (error) {
            console.error(`Failed to load or build level ${levelId}:`, error);
            levelRenderer.createFallbackFloor();
        }
    }
}

// === PLAYER PHYSICS ===
class PhysicsSystem {
  constructor() { this.velocity = new THREE.Vector3() }

  updateMovement(deltaTime, keys, camera) {
    const acceleration = new THREE.Vector3();
    const yaw = inputHandler.yaw;
    const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).negate();
    const right = new THREE.Vector3(forward.z, 0, -forward.x);

    if (keys['KeyW']) acceleration.add(forward);
    if (keys['KeyS']) acceleration.sub(forward);
    if (keys['KeyA']) acceleration.sub(right);
    if (keys['KeyD']) acceleration.add(right);
    
    if (acceleration.length() > 0) {
      acceleration.normalize().multiplyScalar(GAME_GLOBAL_CONSTANTS.MOVEMENT.SPEED);
    }

    this.velocity.add(acceleration);
    this.velocity.multiplyScalar(GAME_GLOBAL_CONSTANTS.MOVEMENT.FRICTION);
    
    const newPosition = camera.position.clone().add(this.velocity);
    newPosition.y = GAME_GLOBAL_CONSTANTS.PLAYER.HEIGHT;
    camera.position.copy(newPosition);
  }

  interact() {
      const playerPos = game.camera.position;
      let nearestDoor = null;
      let nearestDist = Infinity;
      for(const door of game.entities.doors) {
          const dist = playerPos.distanceTo(door.mesh.position);
          if (dist < nearestDist) {
              nearestDist = dist;
              nearestDoor = door;
          }
      }
      if (nearestDoor && nearestDist < 2.0) nearestDoor.open();
  }
}

// === INSTANTIATION ===
window.levelRenderer = new LevelRenderer();
window.levelManager = new LevelManager();
window.physics = new PhysicsSystem();