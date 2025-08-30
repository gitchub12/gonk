// BROWSERFIREFOXHIDE environment_and_physics.js 
// Corrected to load singular layer names ('wall', 'door', 'dock') from level JSON.

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
        physics.clear();
        const layers = levelData.layers || {};
        const settings = levelData.settings || { width: 64, height: 64, defaults: {} };

        const processTileLayer = (layerName, y, rotationX, isSpecial) => {
            const layerItems = layers[layerName] ? new Map(layers[layerName]) : new Map();
            for (const [pos, item] of layerItems.entries()) {
                const [x, z] = pos.split(',').map(Number);
                this.createTile(x, z, item, y, rotationX, isSpecial, layerName);
            }
        };

        processTileLayer('subfloor', -0.1, -Math.PI / 2, false);
        processTileLayer('floor', 0, -Math.PI / 2, false);
        processTileLayer('water', 0.2, -Math.PI / 2, true);
        processTileLayer('ceiling', this.wallHeight - 0.001, Math.PI / 2, false);
        processTileLayer('sky', this.wallHeight + 1.0, Math.PI / 2, false);
        processTileLayer('decor', 0, 0, true);
        processTileLayer('floater', 0.4, -Math.PI / 2, true);
        processTileLayer('dangler', this.wallHeight - 0.01, Math.PI / 2, true);

        if (layers.wall) this.createWalls(layers.wall);
        if (layers.door) this.createDoors(layers.door);
        if (layers.dock) this.createDocks(layers.dock);
        if (layers.tapestry) this.createTapestries(layers.tapestry);
        if (layers.npcs) this.createNPCs(layers.npcs);

        let spawnPoint = null;
        if (layers.spawns && layers.spawns.length > 0) {
            const lastDock = localStorage.getItem('gonk_last_dock');
            if (lastDock) {
                const dockData = JSON.parse(lastDock);
                const targetSpawnId = dockData.properties.target;
                const foundSpawn = layers.spawns.find(item => item[1].id === targetSpawnId);
                if (foundSpawn) {
                    spawnPoint = foundSpawn;
                } else {
                    console.warn(`Target spawn ID '${targetSpawnId}' not found, using first spawn.`);
                }
                localStorage.removeItem('gonk_last_dock');
            }
            if (!spawnPoint) {
                spawnPoint = layers.spawns[0];
            }
        }
        
        if (spawnPoint) {
            const [posStr, item] = spawnPoint;
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

    createLineLayerObject(item, key) {
        const materialName = item.key.split('/').pop().replace(/\.[^/.]+$/, "");
        const material = assetManager.getMaterial(materialName);
        material.transparent = true;
        material.alphaTest = 0.1;
        let mesh;
        let isOBB = false;

        if (key.startsWith('VEC_')) {
            isOBB = true;
            const [x1_grid, y1_grid, x2_grid, y2_grid] = item.points;
            const startPoint = new THREE.Vector3(x1_grid * this.gridSize, this.wallHeight / 2, y1_grid * this.gridSize);
            const endPoint = new THREE.Vector3(x2_grid * this.gridSize, this.wallHeight / 2, y2_grid * this.gridSize);
            const length = startPoint.distanceTo(endPoint);
            if (length < 0.01) return null;

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
            isOBB = false;
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
        return { mesh, isOBB };
    }

    createWalls(items) {
        for (const [key, item] of items) {
            const wallObj = this.createLineLayerObject(item, key);
            if(wallObj) physics.addWall(wallObj.mesh, wallObj.isOBB);
        }
    }

    createDoors(items) {
        for (const [key, item] of items) {
            const doorObj = this.createLineLayerObject(item, key);
            if(doorObj) game.entities.doors.push(new Door(doorObj.mesh, item, doorObj.isOBB));
        }
    }

    createDocks(items) {
         for (const [key, item] of items) {
            const dockObj = this.createLineLayerObject(item, key);
            if(dockObj) game.entities.doors.push(new Dock(dockObj.mesh, item, dockObj.isOBB));
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
                physics.addDynamicEntity(npcInstance);
            } 
        } 
    }

    createFallbackFloor() { const floor = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshStandardMaterial({ color: 0x111111 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -0.01; game.scene.add(floor); const gridHelper = new THREE.GridHelper(100, 100, 0x888888, 0x444444); gridHelper.position.y = 0; game.scene.add(gridHelper); }
}

class Door {
    constructor(mesh, itemData = {}, isOBB) {
        this.mesh = mesh;
        this.isOBB = isOBB;
        this.isOpen = false;
        this.properties = itemData.properties || {};
        this.originalY = mesh.position.y;
        
        physics.addWall(this.mesh, this.isOBB);
    }

    open() {
        if (this.isOpen) return;
        audioSystem.playSound('dooropen');
        this.mesh.position.y = this.originalY + GAME_GLOBAL_CONSTANTS.ENVIRONMENT.WALL_HEIGHT;
        this.isOpen = true;
        physics.removeWall(this.mesh);
        setTimeout(() => this.close(), GAME_GLOBAL_CONSTANTS.ENVIRONMENT.DOOR_OPEN_TIME);
    }

    close() {
        if (!this.isOpen) return;
        this.mesh.position.y = this.originalY;
        this.isOpen = false;
        physics.addWall(this.mesh, this.isOBB);
    }
}

class Dock extends Door {
    constructor(mesh, itemData = {}, isOBB) {
        super(mesh, itemData, isOBB);
    }

    open() {
        if (this.isOpen) return;
        
        if (this.properties.target) {
            const match = this.properties.target.match(/(\d+)/);
            const targetLevel = match ? parseInt(match[1]) : null;

            if (targetLevel && levelManager.currentLevel !== targetLevel) {
                 audioSystem.playSound('dooropen2');
                 localStorage.setItem('gonk_last_dock', JSON.stringify({ properties: this.properties }));
                 levelManager.loadLevel(targetLevel);
                 return;
            } else if (targetLevel) {
                console.log("Side-path dock not yet implemented.");
            }
        }
        
        super.open();
    }
}

class LevelManager {
    constructor() {
        this.currentLevel = 0;
    }

    async loadLevel(levelId) {
        const playtestDataString = localStorage.getItem('gonk_level_to_play');
        try {
            this.currentLevel = levelId;
            let levelData;
            if (playtestDataString) {
                levelData = JSON.parse(playtestDataString);
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
        } finally {
            if (playtestDataString) {
                localStorage.removeItem('gonk_level_to_play');
            }
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
            weight: 100
        };
        this.playerEntity = { collider: this.playerCollider };
        this.addDynamicEntity(this.playerEntity);
    }

    clear() {
        this.walls = [];
        this.dynamicEntities = [];
        this.addDynamicEntity(this.playerEntity);
    }

    addWall(mesh, isOBB) {
        mesh.updateWorldMatrix(true, false);
        const wallCollider = {
            isOBB: isOBB,
            uuid: mesh.uuid
        };

        if (isOBB) {
            wallCollider.center = mesh.position.clone();
            const geoParams = mesh.geometry.parameters;
            wallCollider.halfSize = new THREE.Vector3(geoParams.width / 2, geoParams.height / 2, geoParams.depth / 2);
            wallCollider.rotation = mesh.quaternion.clone();
            wallCollider.inverseRotation = mesh.quaternion.clone().invert();
        } else {
            wallCollider.aabb = new THREE.Box3().setFromObject(mesh);
        }
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
        
        if (this.noclipEnabled) {
            this.playerCollider.position.add(this.playerCollider.velocity);
        } else {
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
        
        this.playerCollider.velocity.add(acceleration);
        this.playerCollider.velocity.multiplyScalar(GAME_GLOBAL_CONSTANTS.MOVEMENT.FRICTION);
    }

    resolveCollisions() {
        for (let i = 0; i < 3; i++) {
            for (const entity of this.dynamicEntities) {
                for (const wall of this.walls) {
                    this.resolveWallCollision(entity.collider, wall);
                }
            }
            
            for (let j = 0; j < this.dynamicEntities.length; j++) {
                for (let k = j + 1; k < this.dynamicEntities.length; k++) {
                    this.resolveEntityCollision(this.dynamicEntities[j], this.dynamicEntities[k]);
                }
            }
        }
    }

    resolveWallCollision(collider, wall) {
        if (wall.isOBB) {
            this.resolveSphereOBBCollision(collider, wall);
        } else {
            this.resolveSphereAABBCollision(collider, wall);
        }
    }
    
    resolveSphereAABBCollision(collider, wall) {
        const sphere = new THREE.Sphere(collider.position, collider.radius);
        if (sphere.intersectsBox(wall.aabb)) {
            const closestPoint = wall.aabb.clampPoint(sphere.center, new THREE.Vector3());
            const penetrationVector = new THREE.Vector3().subVectors(sphere.center, closestPoint);
            const penetrationDepth = sphere.radius - penetrationVector.length();
            
            if (penetrationDepth > 0) {
                const resolutionVector = penetrationVector.normalize().multiplyScalar(penetrationDepth);
                collider.position.add(resolutionVector);
            }
        }
    }

    resolveSphereOBBCollision(collider, wall) {
        const sphereCenter = collider.position;
        const sphereCenterInOBBSpace = sphereCenter.clone().sub(wall.center);
        sphereCenterInOBBSpace.applyQuaternion(wall.inverseRotation);

        const localAABB = new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(), wall.halfSize.clone().multiplyScalar(2));
        
        const closestPointInOBBSpace = localAABB.clampPoint(sphereCenterInOBBSpace, new THREE.Vector3());
        
        const distanceSq = closestPointInOBBSpace.distanceToSquared(sphereCenterInOBBSpace);

        if (distanceSq < collider.radius * collider.radius) {
            const penetrationVecLocal = new THREE.Vector3().subVectors(sphereCenterInOBBSpace, closestPointInOBBSpace);
            const penetrationDepth = collider.radius - Math.sqrt(distanceSq);
            
            if (penetrationDepth > 0 && penetrationVecLocal.lengthSq() > 0) {
                const resolutionVecLocal = penetrationVecLocal.normalize().multiplyScalar(penetrationDepth);
                const resolutionVecWorld = resolutionVecLocal.applyQuaternion(wall.rotation);
                collider.position.add(resolutionVecWorld);
            }
        }
    }

    resolveEntityCollision(entityA, entityB) {
        const colA = entityA.collider;
        const colB = entityB.collider;

        const distVec = new THREE.Vector3().subVectors(colB.position, colA.position);
        distVec.y = 0;
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
        }
    }
    
    applyPostPhysicsUpdates(camera) {
        camera.position.copy(this.playerCollider.position);
        
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