// BROWSERFIREFOXHIDE environment_and_physics.js
// Simplified to use the new asset manager factory, removing all local cloning logic.

class NPC {
    constructor(characterMesh, itemData, config) {
        this.mesh = characterMesh;
        this.config = config;
        this.state = 'idle';
        this.health = itemData.health || config.stats.health || 10;

        this.speed = config.stats.speed || 0.025;
        this.perceptionRadius = 10;
        this.attackRange = config.stats.attackRange || 2.0;
        this.attackCooldown = config.stats.attackCooldown || 2.0;
        this.attackTimer = 0;
    }

    update(deltaTime, playerPosition) {
        this.attackTimer -= deltaTime;
        const distanceToPlayer = this.mesh.group.position.distanceTo(playerPosition);

        let isMoving = false;
        // State transitions
        if (distanceToPlayer < this.perceptionRadius && this.state !== 'attacking') {
            this.state = 'attacking';
        } else if (distanceToPlayer >= this.perceptionRadius && this.state === 'attacking') {
            this.state = 'idle';
        }

        // State actions
        switch (this.state) {
            case 'idle':
                // Idle behavior
                break;
            case 'attacking':
                this.mesh.group.lookAt(playerPosition.x, this.mesh.group.position.y, playerPosition.z);
                if (distanceToPlayer > this.attackRange) {
                    const direction = playerPosition.clone().sub(this.mesh.group.position).normalize();
                    this.mesh.group.position.add(direction.multiplyScalar(this.speed));
                    isMoving = true;
                } else if (this.attackTimer <= 0) {
                    this.attack();
                }
                break;
        }

        // Update animation based on state
        const animToSet = isMoving ? 'walk' : 'idle';
        window.setGonkAnimation(this.mesh, animToSet);
        window.updateGonkAnimation(this.mesh, { deltaTime });
    }

    attack() {
        // console.log(`${this.config.name} attacks!`);
        this.attackTimer = this.attackCooldown;
    }
}

class LevelRenderer {
    constructor() {
        this.gridSize = 1;
        this.wallHeight = GAME_GLOBAL_CONSTANTS.ENVIRONMENT.WALL_HEIGHT;
    }

    buildLevelFromData(levelData) {
        game.clearScene();
        const layers = levelData.layers || {};
        const settings = levelData.settings || { width: 64, height: 64, defaults: {} };

        const processTileLayer = (layerName, y, rotationX, isSpecial) => {
            const layerItems = layers[layerName] ? new Map(layers[layerName]) : new Map();
            for (const [pos, item] of layerItems.entries()) {
                const [x, z] = pos.split(',').map(Number);
                this.createTile(x, z, item, y, rotationX, isSpecial, layerName);
            }
        };

        processTileLayer('floor', 0, -Math.PI / 2, false);
        processTileLayer('water', 0.2, -Math.PI / 2, true);
        processTileLayer('ceiling', this.wallHeight - 0.001, Math.PI / 2, false);
        processTileLayer('sky', this.wallHeight + 1.0, Math.PI / 2, false);
        processTileLayer('decor', 0, 0, true);
        processTileLayer('floater', 0.4, -Math.PI / 2, true);
        processTileLayer('dangler', this.wallHeight - 0.01, Math.PI / 2, true);

        if (layers.walls) this.createWalls(layers.walls);
        if (layers.tapestry) this.createTapestries(layers.tapestry);
        if (layers.npcs) this.createNPCs(layers.npcs);

        if (layers.spawns && layers.spawns.length > 0) {
            const [posStr, item] = layers.spawns[0];
            const [x, z] = posStr.split(',').map(Number);
            game.camera.position.set(x * this.gridSize + this.gridSize/2, GAME_GLOBAL_CONSTANTS.PLAYER.HEIGHT, z * this.gridSize + this.gridSize/2);
            if (inputHandler) inputHandler.yaw = (item.rotation || 0) * -Math.PI / 2;
        } else {
             game.camera.position.set(this.gridSize/2, GAME_GLOBAL_CONSTANTS.PLAYER.HEIGHT, this.gridSize/2);
        }
    }

    createTile(x, z, item, y, rotationX, isSpecial, layerName = '') {
        const materialName = item.key.split('/').pop().replace(/\.[^/.]+$/, "");
        let material = assetManager.getMaterial(materialName);

        material.transparent = true;
        material.alphaTest = 0.1;
        if (layerName === 'water') {
            material.opacity = 0.7;
            material.depthWrite = false;
        }
        if (layerName === 'decor') {
            material.side = THREE.DoubleSide;
        }

        const size = item.size || 1;
        const geoSize = this.gridSize * size;

        const planeGeo = new THREE.PlaneGeometry(geoSize, geoSize);
        const mesh = new THREE.Mesh(planeGeo, material);

        if (layerName === 'decor') {
            mesh.position.y = this.wallHeight / 2;
        } else {
            mesh.rotation.x = rotationX;
        }

        const group = new THREE.Group();
        const posX = x * this.gridSize + geoSize / 2;
        const posZ = z * this.gridSize + geoSize / 2;
        group.position.set(posX, y, posZ);
        group.rotation.y = (item.rotation || 0) * -Math.PI / 2;

        group.add(mesh);
        group.receiveShadow = !isSpecial;
        game.scene.add(group);
    }

    createWalls(items) {
        for (const [key, item] of items) {
            const materialName = item.key.split('/').pop().replace(/\.[^/.]+$/, "");
            const material = assetManager.getMaterial(materialName);
            
            material.transparent = true;
            material.alphaTest = 0.1;
            const isDoor = item.key.includes('/door/');
            let mesh;

            if (key.startsWith('VEC_')) {
                const [x1_grid, y1_grid, x2_grid, y2_grid] = item.points;
                const startPoint = new THREE.Vector3(x1_grid * this.gridSize, this.wallHeight / 2, y1_grid * this.gridSize);
                const endPoint = new THREE.Vector3(x2_grid * this.gridSize, this.wallHeight / 2, y2_grid * this.gridSize);

                const length = startPoint.distanceTo(endPoint);
                if (length < 0.01) continue;

                material.map.wrapS = THREE.RepeatWrapping;
                material.map.wrapT = THREE.RepeatWrapping;
                material.map.repeat.set(Math.round(length / this.gridSize), this.wallHeight / this.gridSize);

                const wallGeo = new THREE.BoxGeometry(length, this.wallHeight, 0.1);
                mesh = new THREE.Mesh(wallGeo, material);

                const direction = new THREE.Vector3().subVectors(endPoint, startPoint).normalize();
                const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), direction);
                mesh.quaternion.copy(quaternion);

                mesh.position.lerpVectors(startPoint, endPoint, 0.5);

            } else {
                const [type, xStr, zStr] = key.split('_');
                const x = Number(xStr); const z = Number(zStr);
                
                material.map.wrapS = THREE.RepeatWrapping;
                material.map.wrapT = THREE.RepeatWrapping;
                material.map.repeat.set(1, 1);

                const wallGeo = new THREE.BoxGeometry(this.gridSize, this.wallHeight, 0.1);
                mesh = new THREE.Mesh(wallGeo, material);
                
                let posX, posZ;
                if (type === 'H') {
                    posX = x * this.gridSize + this.gridSize / 2;
                    posZ = (z + 1) * this.gridSize;
                } else { // 'V' type
                    posX = (x + 1) * this.gridSize;
                    posZ = z * this.gridSize + this.gridSize / 2;
                    mesh.rotation.y = Math.PI / 2;
                }
                mesh.position.set(posX, this.wallHeight / 2, posZ);
            }

            mesh.castShadow = true; mesh.receiveShadow = true;
            game.scene.add(mesh);
            if (isDoor) game.entities.doors.push(new Door(mesh, item));
        }
    }

    createTapestries(items) { 
        for (const [key, item] of items) { 
            const [type, xStr, zStr] = key.split('_'); 
            const x = Number(xStr); const z = Number(zStr); 
            const materialName = item.key.split('/').pop().replace(/\.[^/.]+$/, ""); 
            const material = assetManager.getMaterial(materialName); 

            material.side = THREE.DoubleSide; 
            material.transparent = true; 
            material.alphaTest = 0.1; 
            const tapestryGeo = new THREE.PlaneGeometry(this.gridSize, this.wallHeight); 
            const mesh = new THREE.Mesh(tapestryGeo, material); 
            let posX, posZ, rotY; 
            const offset = item.direction === 1 ? -0.06 : 0.06;
            if (type === 'H') { 
                posX = x * this.gridSize + this.gridSize / 2; 
                posZ = (z + 1) * this.gridSize + offset; 
                rotY = 0; 
            } else { 
                posX = (x + 1) * this.gridSize + offset; 
                posZ = z * this.gridSize + this.gridSize / 2; 
                rotY = Math.PI / 2; 
            } 
            mesh.position.set(posX, this.wallHeight / 2, posZ); 
            mesh.rotation.y = rotY; 
            mesh.castShadow = true; 
            game.scene.add(mesh); 
        } 
    }

    createNPCs(items) { 
        for (const [pos, item] of items) { 
            const [x, z] = pos.split(',').map(Number); 
            const skinTextureName = item.key; 
            const characterId = item.key.replace(/\d+$/, ''); 
            const config = CHARACTER_CONFIG[characterId]; 
            if (!config) { console.warn(`No character config found for '${characterId}'`); continue; } 
            const charMesh = window.createGonkMesh( config.minecraftModel || 'humanoid', { skinTexture: skinTextureName }, new THREE.Vector3(x * this.gridSize + this.gridSize/2, 0, z * this.gridSize + this.gridSize/2), item.key ); 
            if(charMesh) { 
                charMesh.group.rotation.y = (item.rotation || 0) * -Math.PI / 2; 
                if (config.scale) {
                     charMesh.group.scale.multiplyScalar(config.scale);
                }
                game.scene.add(charMesh.group); 
                const npcInstance = new NPC(charMesh, item, config);
                game.entities.npcs.push(npcInstance); 
            } 
        } 
    }

    createFallbackFloor() { const floor = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshStandardMaterial({ color: 0x111111 })); floor.rotation.x = -Math.PI / 2; game.scene.add(floor); const gridHelper = new THREE.GridHelper(100, 100, 0x888888, 0x444444); gridHelper.position.y = 0.01; game.scene.add(gridHelper); }
}

class Door {
    constructor(mesh, itemData = {}) {
        const config = itemData.properties || {};
        this.mesh = mesh;
        this.textureKey = itemData.key || '';
        this.isOpen = false;
        this.isLevelTransition = config.isLevelExit || false;
        this.targetLevel = config.targetLevel || null;
        this.originalY = mesh.position.y;

        // Fallback to filename-based logic if not specified in properties
        if (!config.isLevelExit && this.textureKey) {
            const doorName = this.textureKey.substring(this.textureKey.lastIndexOf('/') + 1);
            
            if (doorName === 'door_2.png') {
                this.isLevelTransition = true;
                this.targetLevel = window.levelManager.currentLevel + 1;
            } else if (doorName === 'door_0.png' && window.levelManager.currentLevel > 1) {
                this.isLevelTransition = true;
                this.targetLevel = window.levelManager.currentLevel - 1;
            }
        }
    }

    open() {
        if (this.isOpen) return;
        if (this.textureKey.includes('door_2.png')) {
            audioSystem.playSound('dooropen2');
        } else {
            audioSystem.playSound('dooropen');
        }
        if (this.isLevelTransition && this.targetLevel) {
            levelManager.loadLevel(this.targetLevel);
            return;
        }
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
    constructor() {
        this.currentLevel = 0;
    }

    async loadLevel(levelId) {
        try {
            this.currentLevel = levelId;
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
            const furnitureObjects = await furnitureLoader.loadFromManifest('data/furniture.json');
            for (const furniture of furnitureObjects) {
                game.scene.add(furniture);
            }
        } catch (error) {
            console.error(`Failed to load or build level ${levelId}:`, error);
            levelRenderer.createFallbackFloor();
        }
    }
}

class PhysicsSystem {
    constructor() {
        this.velocity = new THREE.Vector3();
    }
    updateMovement(deltaTime, keys, camera) {
        const acceleration = new THREE.Vector3();
        const yaw = inputHandler.yaw;
        const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).negate();
        const right = new THREE.Vector3(forward.z, 0, -forward.x);
        if (keys['KeyW']) acceleration.add(forward);
        if (keys['KeyS']) acceleration.sub(forward);
        if (keys['KeyA']) acceleration.add(right);
        if (keys['KeyD']) acceleration.sub(right);
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

window.levelRenderer = new LevelRenderer();
window.levelManager = new LevelManager();
window.physics = new PhysicsSystem();