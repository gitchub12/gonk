// BROWSERFIREFOXHIDE environment_and_physics.js
// Rewritten to introduce a centralized PhysicsSystem for robust collision detection and response.

// --- COLLISION CONSTANTS ---
const PLAYER_RADIUS = 0.4;
const PLAYER_HEIGHT = 1.0;
const NPC_RADIUS = 0.4;
const PUSH_FACTOR = 0.05;

class NPC {
    constructor(characterMesh, itemData, config) {
        this.mesh = characterMesh;
        this.config = config;
        this.state = 'idle';
        this.health = itemData.health || config.stats.health || 10;
        this.velocity = new THREE.Vector3();

        this.speed = config.stats.speed || 0.025;
        this.perceptionRadius = 10;
        this.attackRange = config.stats.attackRange || 2.0;
        this.attackCooldown = config.stats.attackCooldown || 2.0;
        this.attackTimer = 0;

        // Physics properties
        this.weight = config.stats.weight || 80;
        this.collider = {
            isPlayer: false,
            radius: config.stats.collisionRadius || NPC_RADIUS,
            position: this.mesh.group.position,
            velocity: this.velocity,
            weight: this.weight
        };
    }

    update(deltaTime, playerPosition) {
        this.attackTimer -= deltaTime;
        const distanceToPlayer = this.mesh.group.position.distanceTo(playerPosition);
        let isMoving = false;

        if (distanceToPlayer < this.perceptionRadius && this.state !== 'attacking') {
            this.state = 'attacking';
        } else if (distanceToPlayer >= this.perceptionRadius && this.state === 'attacking') {
            this.state = 'idle';
        }

        this.velocity.x = 0;
        this.velocity.z = 0;

        switch (this.state) {
            case 'idle':
                break;
            case 'attacking':
                this.mesh.group.lookAt(playerPosition.x, this.mesh.group.position.y, playerPosition.z);
                if (distanceToPlayer > this.attackRange) {
                    const direction = playerPosition.clone().sub(this.mesh.group.position).normalize();
                    // Set velocity instead of directly modifying position
                    this.velocity.x = direction.x * this.speed;
                    this.velocity.z = direction.z * this.speed;
                    isMoving = true;
                } else if (this.attackTimer <= 0) {
                    this.attack();
                }
                break;
        }

        const animToSet = isMoving ? 'walk' : 'idle';
        window.setGonkAnimation(this.mesh, animToSet);
        window.updateGonkAnimation(this.mesh, { deltaTime });
    }

    attack() {
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
        physics.clear(); // Clear physics colliders for the new level
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
            const spawnX = x * this.gridSize + this.gridSize/2;
            const spawnZ = z * this.gridSize + this.gridSize/2;
            game.camera.position.set(spawnX, PLAYER_HEIGHT / 2, spawnZ);
            physics.playerCollider.position.set(spawnX, PLAYER_HEIGHT / 2, spawnZ);
            if (inputHandler) inputHandler.yaw = (item.rotation || 0) * -Math.PI / 2;
        } else {
             game.camera.position.set(this.gridSize/2, PLAYER_HEIGHT / 2, this.gridSize/2);
             physics.playerCollider.position.set(this.gridSize/2, PLAYER_HEIGHT / 2, this.gridSize/2);
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
            physics.addWall(mesh); // Add wall to the physics system
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
                physics.addDynamicEntity(npcInstance); // Add NPC to physics system
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
        physics.removeWall(this.mesh); // Doors are not collidable when open
        setTimeout(() => this.close(), GAME_GLOBAL_CONSTANTS.ENVIRONMENT.DOOR_OPEN_TIME);
    }

    close() {
        if (!this.isOpen) return;
        this.mesh.position.y = this.originalY;
        this.isOpen = false;
        physics.addWall(this.mesh); // Re-add collision when closed
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
        this.walls = [];
        this.dynamicEntities = [];
        this.noclipEnabled = false;
        this.playerCollider = {
            isPlayer: true,
            radius: PLAYER_RADIUS,
            position: new THREE.Vector3(0, PLAYER_HEIGHT / 2, 0),
            velocity: new THREE.Vector3(),
            weight: 100 // Player is heaviest
        };
        this.playerEntity = { collider: this.playerCollider };
        this.addDynamicEntity(this.playerEntity);
    }

    clear() {
        this.walls = [];
        this.dynamicEntities = [];
        this.addDynamicEntity(this.playerEntity);
    }

    addWall(mesh) {
        mesh.geometry.computeBoundingBox();
        const wallCollider = {
            box: new THREE.Box3().setFromObject(mesh),
            uuid: mesh.uuid // Store mesh UUID for reliable removal
        };
        this.walls.push(wallCollider);
    }

    removeWall(mesh) {
        const wallIndex = this.walls.findIndex(wall => wall.uuid === mesh.uuid);
        if (wallIndex > -1) {
            this.walls.splice(wallIndex, 1);
        }
    }

    addDynamicEntity(entity) {
        if (entity && entity.collider) {
            this.dynamicEntities.push(entity);
        }
    }

    update(deltaTime, inputHandler, camera) {
        this.updatePlayerVelocity(inputHandler);
        
        // Apply raw velocity movement if noclip is on
        if (this.noclipEnabled) {
            this.playerCollider.position.add(this.playerCollider.velocity);
        } else {
            // Move all dynamic entities based on their velocity
            for (const entity of this.dynamicEntities) {
                entity.collider.position.add(entity.collider.velocity);
            }
            this.resolveCollisions();
        }

        this.applyPostPhysicsUpdates(camera);
    }
    
    updatePlayerVelocity(inputHandler) {
        const acceleration = new THREE.Vector3();
        const yaw = inputHandler.yaw;
        const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).negate();
        const right = new THREE.Vector3(forward.z, 0, -forward.x);
        if (inputHandler.keys['KeyW']) acceleration.add(forward);
        if (inputHandler.keys['KeyS']) acceleration.sub(forward);
        if (inputHandler.keys['KeyA']) acceleration.add(right);
        if (inputHandler.keys['KeyD']) acceleration.sub(right);
        
        if (acceleration.length() > 0) {
            acceleration.normalize().multiplyScalar(GAME_GLOBAL_CONSTANTS.MOVEMENT.SPEED);
        }
        
        const currentVelocity = this.playerCollider.velocity;
        currentVelocity.add(acceleration);
        currentVelocity.multiplyScalar(GAME_GLOBAL_CONSTANTS.MOVEMENT.FRICTION);
    }

    resolveCollisions() {
        // Run multiple passes to allow collisions to propagate and settle
        for (let i = 0; i < 3; i++) {
            // Entity vs Wall
            for (const entity of this.dynamicEntities) {
                for (const wall of this.walls) {
                    this.resolveWallCollision(entity.collider, wall.box);
                }
            }
            
            // Entity vs Entity
            for (let j = 0; j < this.dynamicEntities.length; j++) {
                for (let k = j + 1; k < this.dynamicEntities.length; k++) {
                    this.resolveEntityCollision(this.dynamicEntities[j], this.dynamicEntities[k]);
                }
            }
        }
    }

    resolveWallCollision(collider, wallBox) {
        const sphere = new THREE.Sphere(collider.position, collider.radius);
        if (sphere.intersectsBox(wallBox)) {
            const closestPoint = new THREE.Vector3();
            wallBox.clampPoint(sphere.center, closestPoint);
            const penetrationVector = new THREE.Vector3().subVectors(sphere.center, closestPoint);
            const penetrationDepth = sphere.radius - penetrationVector.length();
            
            if (penetrationDepth > 0) {
                const resolutionVector = penetrationVector.normalize().multiplyScalar(penetrationDepth);
                collider.position.add(resolutionVector);
            }
        }
    }

    resolveEntityCollision(entityA, entityB) {
        const colA = entityA.collider;
        const colB = entityB.collider;

        const distVec = new THREE.Vector3().subVectors(colB.position, colA.position);
        distVec.y = 0; // Collisions are 2D
        const distance = distVec.length();
        const totalRadius = colA.radius + colB.radius;

        if (distance < totalRadius) {
            const overlap = totalRadius - distance;
            const resolutionVec = distance > 0 ? distVec.normalize().multiplyScalar(overlap) : new THREE.Vector3(totalRadius, 0, 0);

            const totalWeight = colA.weight + colB.weight;
            const ratioA = colB.weight / totalWeight;
            const ratioB = colA.weight / totalWeight;

            colA.position.sub(resolutionVec.clone().multiplyScalar(ratioA));
            colB.position.add(resolutionVec.clone().multiplyScalar(ratioB));

            // After pushing an entity, re-check its collision with walls immediately
            for (const wall of this.walls) {
                this.resolveWallCollision(colA, wall.box);
                this.resolveWallCollision(colB, wall.box);
            }
        }
    }
    
    applyPostPhysicsUpdates(camera) {
        // Update camera from player collider
        camera.position.copy(this.playerCollider.position);
        
        // Apply friction to non-player entities
        for(const entity of this.dynamicEntities) {
            if (!entity.collider.isPlayer) {
                entity.collider.velocity.multiplyScalar(GAME_GLOBAL_CONSTANTS.MOVEMENT.FRICTION);
            }
        }
    }

    interact() {
        const playerPos = this.playerCollider.position;
        let nearestDoor = null;
        let nearestDist = Infinity;
        for (const door of game.entities.doors) {
            if (door.isOpen) continue;
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