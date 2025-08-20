// BROWSERFIREFOXHIDE rendering_system.js
// Rewritten with precise geometry positioning to ensure walls, floors, and ceilings connect perfectly.

class LevelRenderer {
    constructor() {
        this.gridSize = 1; // 1 unit = 1 meter
        this.wallHeight = GAME_GLOBAL_CONSTANTS.ENVIRONMENT.WALL_HEIGHT;
        console.log("Level Renderer initialized.");
    }

    buildLevelFromData(levelData) {
        console.log("Building level from data...");

        const layers = levelData.layers || {};

        if (layers.floor) this.createGeometry(layers.floor, 0, -Math.PI / 2);
        if (layers.ceiling) this.createGeometry(layers.ceiling, this.wallHeight, Math.PI / 2);
        if (layers.walls) this.createWalls(layers.walls);

        if (layers.spawns && layers.spawns.length > 0) {
            const [posStr, item] = layers.spawns[0];
            const [x, z] = posStr.split(',').map(Number);
            game.camera.position.set(x * this.gridSize + this.gridSize/2, GAME_GLOBAL_CONSTANTS.PLAYER.HEIGHT, z * this.gridSize + this.gridSize/2);
            if (inputHandler) {
                inputHandler.yaw = (item.rotation || 0) * -Math.PI / 2;
            }
        }
    }

    createGeometry(items, y, rotationX) {
        for (const [pos, item] of items) {
            const [x, z] = pos.split(',').map(Number);
            const materialName = item.key.split('/').pop().replace('.png', '');
            
            let material;
            if (materialName.includes('lava')) {
                const baseMaterial = assetManager.getMaterial(materialName);
                material = baseMaterial ? baseMaterial.clone() : new THREE.MeshStandardMaterial({color: 0xff00ff});
                material.emissive = new THREE.Color(0xff6600);
                material.emissiveIntensity = 1.5;
            } else {
                material = assetManager.getMaterial(materialName);
            }
            
            const planeGeo = new THREE.PlaneGeometry(this.gridSize, this.gridSize);
            const mesh = new THREE.Mesh(planeGeo, material);

            // CORRECTED: Center the tile in the middle of its grid square.
            mesh.position.set(x * this.gridSize + this.gridSize / 2, y, z * this.gridSize + this.gridSize / 2);
            mesh.rotation.x = rotationX;
            mesh.receiveShadow = true;
            game.scene.add(mesh);
        }
    }

    createWalls(items) {
        for (const [key, item] of items) {
            const [type, xStr, zStr] = key.split('_');
            const x = Number(xStr);
            const z = Number(zStr);
            const materialName = item.key.split('/').pop().replace('.png', '');
            const material = assetManager.getMaterial(materialName);

            const isDoor = item.key.includes('/door/');
            const wallWidth = type === 'H' ? this.gridSize : 0.1;
            const wallDepth = type === 'V' ? this.gridSize : 0.1;
            const wallGeo = new THREE.BoxGeometry(wallWidth, this.wallHeight, wallDepth);
            const mesh = new THREE.Mesh(wallGeo, material);
            
            let posX, posZ;
            // CORRECTED: Position walls precisely on the grid lines.
            if (type === 'H') { // Horizontal wall sits on the line between z and z+1
                posX = x * this.gridSize + this.gridSize / 2;
                posZ = (z + 1) * this.gridSize;
            } else { // Vertical wall sits on the line between x and x+1
                posX = (x + 1) * this.gridSize;
                posZ = z * this.gridSize + this.gridSize / 2;
            }
            mesh.position.set(posX, this.wallHeight / 2, posZ);
            
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            game.scene.add(mesh);

            if (isDoor) {
                const door = new Door(mesh, item.properties);
                game.entities.doors.push(door);
            }
        }
    }
    
    createFallbackFloor() {
        console.log("Creating fallback floor.");
        const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(100, 100),
            new THREE.MeshStandardMaterial({ color: 0x111111 })
        );
        floor.rotation.x = -Math.PI / 2;
        game.scene.add(floor);
        game.scene.add(new THREE.GridHelper(100, 100, 0x888888, 0x444444));
    }
}

window.levelRenderer = new LevelRenderer();