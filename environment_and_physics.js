// BROWSERFIREFOXHIDE environment_and_physics.js
// Rewritten to support transparency, default textures, and multi-sized tiles.

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
            const defaultInfo = settings.defaults[layerName];
            const layerItems = layers[layerName] ? new Map(layers[layerName]) : new Map();

            // Apply default textures first
            if (defaultInfo && defaultInfo.key) {
                const defaultSize = defaultInfo.size || 1;
                for (let z = 0; z < settings.height; z += defaultSize) {
                    for (let x = 0; x < settings.width; x += defaultSize) {
                        const coordKey = `${x},${z}`;
                        // Only place default if no specific tile exists at this origin
                        if (!layerItems.has(coordKey)) {
                             this.createTile(x, z, { key: defaultInfo.key, size: defaultSize, rotation: 0 }, y, rotationX, isSpecial, layerName);
                        }
                    }
                }
            }
            
            // Render specific tiles from the layer, overriding defaults
            for (const [pos, item] of layerItems.entries()) {
                const [x, z] = pos.split(',').map(Number);
                this.createTile(x, z, item, y, rotationX, isSpecial, layerName);
            }
        };

        processTileLayer('subfloor', -1.0, -Math.PI / 2, false);
        processTileLayer('floor', 0, -Math.PI / 2, false);
        processTileLayer('water', 0.2, -Math.PI / 2, true);
        processTileLayer('ceiling', this.wallHeight, Math.PI / 2, false);
        processTileLayer('sky', this.wallHeight + 1.0, Math.PI / 2, false);
        processTileLayer('decor', 0.01, -Math.PI / 2, true);
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
        let material = assetManager.getMaterial(materialName).clone();
        
        material.transparent = true;
        material.alphaTest = 0.1;
        if (layerName === 'water') material.opacity = 0.7;
        
        const size = item.size || 1;
        const geoSize = this.gridSize * size;

        const planeGeo = new THREE.PlaneGeometry(geoSize, geoSize);
        const mesh = new THREE.Mesh(planeGeo, material);
        mesh.rotation.x = rotationX;

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
            const material = assetManager.getMaterial(materialName).clone();
            
            material.transparent = true;
            material.alphaTest = 0.1;

            const isDoor = item.key.includes('/door/');
            let mesh;

            if (key.startsWith('VEC_')) {
                const [x1, z1, x2, z2] = item.points;
                const dx = (x2 - x1) * this.gridSize;
                const dz = (z2 - z1) * this.gridSize;
                const length = Math.sqrt(dx*dx + dz*dz);
                const angle = Math.atan2(dx, dz);

                const wallGeo = new THREE.BoxGeometry(length, this.wallHeight, 0.1);
                mesh = new THREE.Mesh(wallGeo, material);

                mesh.position.set(
                    (x1 + x2) / 2 * this.gridSize,
                    this.wallHeight / 2,
                    (z1 + z2) / 2 * this.gridSize
                );
                mesh.rotation.y = -angle + Math.PI / 2;
            } else {
                const [type, xStr, zStr] = key.split('_');
                const x = Number(xStr); const z = Number(zStr);
                const wallGeo = new THREE.BoxGeometry(type === 'H' ? this.gridSize : 0.1, this.wallHeight, type === 'V' ? this.gridSize : 0.1);
                mesh = new THREE.Mesh(wallGeo, material);
                let posX, posZ;
                if (type === 'H') { posX = x * this.gridSize + this.gridSize / 2; posZ = (z + 1) * this.gridSize; } 
                else { posX = (x + 1) * this.gridSize; posZ = z * this.gridSize + this.gridSize / 2; }
                mesh.position.set(posX, this.wallHeight / 2, posZ);
            }
            
            mesh.castShadow = true; mesh.receiveShadow = true;
            game.scene.add(mesh);
            if (isDoor) game.entities.doors.push(new Door(mesh, item));
        }
    }
    
    createTapestries(items) { for (const [key, item] of items) { const [type, xStr, zStr] = key.split('_'); const x = Number(xStr); const z = Number(zStr); const materialName = item.key.split('/').pop().replace(/\.[^/.]+$/, ""); const material = assetManager.getMaterial(materialName).clone(); material.map.wrapS = THREE.RepeatWrapping; material.map.repeat.x = -1; material.side = THREE.DoubleSide; material.transparent = true; material.alphaTest = 0.1; const tapestryGeo = new THREE.PlaneGeometry(this.gridSize, this.wallHeight); const mesh = new THREE.Mesh(tapestryGeo, material); let posX, posZ, rotY; const offset = 0.06; if (type === 'H') { posX = x * this.gridSize + this.gridSize / 2; posZ = (z + 1) * this.gridSize - offset; rotY = 0; } else { posX = (x + 1) * this.gridSize - offset; posZ = z * this.gridSize + this.gridSize / 2; rotY = Math.PI / 2; } mesh.position.set(posX, this.wallHeight / 2, posZ); mesh.rotation.y = rotY; mesh.castShadow = true; game.scene.add(mesh); } }
    createNPCs(items) { for (const [pos, item] of items) { const [x, z] = pos.split(',').map(Number); const skinTextureName = item.key; const characterId = item.key.replace(/\d+$/, ''); const config = CHARACTER_CONFIG[characterId]; if (!config) { console.warn(`No character config found for '${characterId}'`); continue; } const char = window.createGonkMesh( config.minecraftModel || 'humanoid', { skinTexture: skinTextureName }, new THREE.Vector3(x * this.gridSize + this.gridSize/2, 0, z * this.gridSize + this.gridSize/2), item.key ); if(char) { char.group.rotation.y = (item.rotation || 0) * -Math.PI / 2; game.scene.add(char.group); game.entities.npcs.push(char); } } }
    createFallbackFloor() { const floor = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshStandardMaterial({ color: 0x111111 })); floor.rotation.x = -Math.PI / 2; game.scene.add(floor); const gridHelper = new THREE.GridHelper(100, 100, 0x888888, 0x444444); gridHelper.position.y = 0.01; game.scene.add(gridHelper); }
}

class Door { constructor(mesh, itemData = {}) { const config = itemData.properties || {}; this.mesh = mesh; this.textureKey = itemData.key || ''; this.isOpen = false; this.isLevelTransition = config.isLevelExit || false; this.targetLevel = config.targetLevel || null; this.originalY = mesh.position.y; } open() { if (this.isOpen) return; if (this.textureKey.includes('door_2.png')) { audioSystem.playSound('dooropen2'); } else { audioSystem.playSound('dooropen'); } if (this.isLevelTransition && this.targetLevel) { levelManager.loadLevel(this.targetLevel); return; } this.mesh.position.y = this.originalY + GAME_GLOBAL_CONSTANTS.ENVIRONMENT.WALL_HEIGHT; this.isOpen = true; setTimeout(() => this.close(), GAME_GLOBAL_CONSTANTS.ENVIRONMENT.DOOR_OPEN_TIME); } close() { if (!this.isOpen) return; this.mesh.position.y = this.originalY; this.isOpen = false; } }
class LevelManager { async loadLevel(levelId) { try { let levelData; const playtestDataString = localStorage.getItem('gonk_level_to_play'); if (playtestDataString) { levelData = JSON.parse(playtestDataString); localStorage.removeItem('gonk_level_to_play'); } else { const response = await fetch(`data/levels/level_${levelId}.json`); if (!response.ok) throw new Error(`Level file not found for level_${levelId}.json`); levelData = await response.json(); } levelRenderer.buildLevelFromData(levelData); const furnitureObjects = await furnitureLoader.loadFromManifest('data/furniture.json'); for (const furniture of furnitureObjects) { game.scene.add(furniture); } } catch (error) { console.error(`Failed to load or build level ${levelId}:`, error); levelRenderer.createFallbackFloor(); } } }

class PhysicsSystem { constructor() { this.velocity = new THREE.Vector3() } updateMovement(deltaTime, keys, camera) { const acceleration = new THREE.Vector3(); const yaw = inputHandler.yaw; const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).negate(); const right = new THREE.Vector3(forward.z, 0, -forward.x); if (keys['KeyW']) acceleration.add(forward); if (keys['KeyS']) acceleration.sub(forward); if (keys['KeyA']) acceleration.add(right); if (keys['KeyD']) acceleration.sub(right); if (acceleration.length() > 0) { acceleration.normalize().multiplyScalar(GAME_GLOBAL_CONSTANTS.MOVEMENT.SPEED); } this.velocity.add(acceleration); this.velocity.multiplyScalar(GAME_GLOBAL_CONSTANTS.MOVEMENT.FRICTION); const newPosition = camera.position.clone().add(this.velocity); newPosition.y = GAME_GLOBAL_CONSTANTS.PLAYER.HEIGHT; camera.position.copy(newPosition); } interact() { const playerPos = game.camera.position; let nearestDoor = null; let nearestDist = Infinity; for(const door of game.entities.doors) { const dist = playerPos.distanceTo(door.mesh.position); if (dist < nearestDist) { nearestDist = dist; nearestDoor = door; } } if (nearestDoor && nearestDist < 2.0) nearestDoor.open(); } }

window.levelRenderer = new LevelRenderer();
window.levelManager = new LevelManager();
window.physics = new PhysicsSystem();