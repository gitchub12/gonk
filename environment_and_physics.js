// BROWSERFIREFOXHIDE environment_and_physics.js
// update: Corrected TypeError by changing playerSphere.distanceTo(pickup.mesh.position) to playerSphere.center.distanceTo(pickup.mesh.position) as THREE.Sphere has no direct distanceTo method.
// update: The `createSkybox` function now explicitly checks for a null or empty key, ensuring the "None" option in the editor correctly removes the skybox.
// update: Replaced performance-intensive PointLights on blaster bolts with billboarded glow sprites for significant optimization in large battles.

// --- OBB UTILITY CLASS (EMBEDDED TO FIX CRASH) ---
( function () {
    const _box3 = new THREE.Box3();
    const _vector = new THREE.Vector3();
    class OBB {
        constructor( center = new THREE.Vector3(), halfSize = new THREE.Vector3(), rotation = new THREE.Matrix3() ) { this.center = center; this.halfSize = halfSize; this.rotation = rotation; }
        set( center, halfSize, rotation ) { this.center.copy( center ); this.halfSize.copy( halfSize ); this.rotation.copy( rotation ); return this; }
        copy( obb ) { this.center.copy( obb.center ); this.halfSize.copy( obb.halfSize ); this.rotation.copy( obb.rotation ); return this; }
        clone() { return new this.constructor().copy( this ); }
        getSize( result ) { return result.copy( this.halfSize ).multiplyScalar( 2 ); }
        getAABB( result ) { const { center, halfSize, rotation } = this; const x = rotation.elements[ 0 ], y = rotation.elements[ 1 ], z = rotation.elements[ 2 ]; const x_abs = Math.abs( x ), y_abs = Math.abs( y ), z_abs = Math.abs( z ); const size = halfSize.x * x_abs + halfSize.y * y_abs + halfSize.z * z_abs; result.min.copy( center ).subScalar( size ); result.max.copy( center ).addScalar( size ); return result; }
        containsPoint( point ) { _vector.subVectors( point, this.center ); this.rotation.transformVector( _vector ); return Math.abs( _vector.x ) <= this.halfSize.x && Math.abs( _vector.y ) <= this.halfSize.y && Math.abs( _vector.z ) <= this.halfSize.z; }
        intersectsBox3( box3 ) { return this.intersectsOBB( new OBB().fromBox3( box3 ) ); }
        intersectsSphere( sphere ) { _vector.copy( sphere.center ); this.clampPoint( _vector, _vector ); return _vector.distanceToSquared( sphere.center ) <= sphere.radius * sphere.radius; }
        intersectsOBB( obb, epsilon = Number.EPSILON ) { const _aabb2 = new THREE.Box3(); this.getAABB( _box3 ); obb.getAABB( _aabb2 ); if ( _box3.intersectsBox( _aabb2 ) === false ) return false; _vector.subVectors( obb.center, this.center ); const R0 = this.rotation.elements; const R1 = obb.rotation.elements; const R = [ 0, 0, 0, 0, 0, 0, 0, 0, 0 ]; for ( let i = 0; i < 3; i ++ ) { for ( let j = 0; j < 3; j ++ ) { R[ 3 * i + j ] = R0[ 3 * i + 0 ] * R1[ 3 * 0 + j ] + R0[ 3 * i + 1 ] * R1[ 3 * 1 + j ] + R0[ 3 * i + 2 ] * R1[ 3 * 2 + j ]; } } const t = [ _vector.dot( new THREE.Vector3().fromArray( R0, 0 ) ), _vector.dot( new THREE.Vector3().fromArray( R0, 3 ) ), _vector.dot( new THREE.Vector3().fromArray( R0, 6 ) ) ]; const a = this.halfSize; const b = obb.halfSize; const R_abs = [ 0, 0, 0, 0, 0, 0, 0, 0, 0 ]; for ( let i = 0; i < 9; i ++ ) { R_abs[ i ] = Math.abs( R[ i ] ) + epsilon; } let ra, rb; for ( let i = 0; i < 3; i ++ ) { ra = a.getComponent( i ); rb = b.x * R_abs[ 3 * i + 0 ] + b.y * R_abs[ 3 * i + 1 ] + b.z * R_abs[ 3 * i + 2 ]; if ( Math.abs( t[ i ] ) > ra + rb ) return false; } for ( let i = 0; i < 3; i ++ ) { ra = a.x * R_abs[ 3 * 0 + i ] + a.y * R_abs[ 3 * 1 + i ] + a.z * R_abs[ 3 * 2 + i ]; rb = b.getComponent( i ); if ( Math.abs( t[ 0 ] * R[ 3 * 0 + i ] + t[ 1 ] * R[ 3 * 1 + i ] + t[ 2 ] * R[ 3 * 2 + i ] ) > ra + rb ) return false; } ra = a.y * R_abs[ 6 ] + a.z * R_abs[ 3 ]; rb = b.y * R_abs[ 2 ] + b.z * R_abs[ 1 ]; if ( Math.abs( t[ 2 ] * R[ 3 ] - t[ 1 ] * R[ 6 ] ) > ra + rb ) return false; ra = a.y * R_abs[ 7 ] + a.z * R_abs[ 4 ]; rb = b.x * R_abs[ 2 ] + b.z * R_abs[ 0 ]; if ( Math.abs( t[ 2 ] * R[ 4 ] - t[ 1 ] * R[ 7 ] ) > ra + rb ) return false; ra = a.y * R_abs[ 8 ] + a.z * R_abs[ 5 ]; rb = b.x * R_abs[ 1 ] + b.y * R_abs[ 0 ]; if ( Math.abs( t[ 2 ] * R[ 5 ] - t[ 1 ] * R[ 8 ] ) > ra + rb ) return false; ra = a.x * R_abs[ 6 ] + a.z * R_abs[ 0 ]; rb = b.y * R_abs[ 5 ] + b.z * R_abs[ 4 ]; if ( Math.abs( t[ 0 ] * R[ 6 ] - t[ 2 ] * R[ 0 ] ) > ra + rb ) return false; ra = a.x * R_abs[ 7 ] + a.z * R_abs[ 1 ]; rb = b.x * R_abs[ 5 ] + b.z * R_abs[ 3 ]; if ( Math.abs( t[ 0 ] * R[ 7 ] - t[ 2 ] * R[ 1 ] ) > ra + rb ) return false; ra = a.x * R_abs[ 8 ] + a.z * R_abs[ 2 ]; rb = b.x * R_abs[ 4 ] + b.y * R_abs[ 3 ]; if ( Math.abs( t[ 0 ] * R[ 8 ] - t[ 2 ] * R[ 2 ] ) > ra + rb ) return false; ra = a.x * R_abs[ 3 ] + a.y * R_abs[ 0 ]; rb = b.y * R_abs[ 8 ] + b.z * R_abs[ 7 ]; if ( Math.abs( t[ 1 ] * R[ 0 ] - t[ 0 ] * R[ 3 ] ) > ra + rb ) return false; ra = a.x * R_abs[ 4 ] + a.y * R_abs[ 1 ]; rb = b.x * R_abs[ 8 ] + b.z * R_abs[ 6 ]; if ( Math.abs( t[ 1 ] * R[ 1 ] - t[ 0 ] * R[ 4 ] ) > ra + rb ) return false; ra = a.x * R_abs[ 5 ] + a.y * R_abs[ 2 ]; rb = b.x * R_abs[ 7 ] + b.y * R_abs[ 6 ]; if ( Math.abs( t[ 1 ] * R[ 2 ] - t[ 0 ] * R[ 5 ] ) > ra + rb ) return false; return true; }
        clampPoint( point, result ) { const { center, halfSize, rotation } = this; const R = rotation.elements; const p = [ point.x - center.x, point.y - center.y, point.z - center.z ]; const dist = [ p[ 0 ] * R[ 0 ] + p[ 1 ] * R[ 1 ] + p[ 2 ] * R[ 2 ], p[ 0 ] * R[ 3 ] + p[ 1 ] * R[ 4 ] + p[ 2 ] * R[ 5 ], p[ 0 ] * R[ 6 ] + p[ 1 ] * R[ 7 ] + p[ 2 ] * R[ 8 ] ]; for ( let i = 0; i < 3; i ++ ) { dist[ i ] = Math.max( - halfSize.getComponent( i ), Math.min( halfSize.getComponent( i ), dist[ i ] ) ); } result.set( center.x + dist[ 0 ] * R[ 0 ] + dist[ 1 ] * R[ 3 ] + dist[ 2 ] * R[ 6 ], center.y + dist[ 0 ] * R[ 1 ] + dist[ 1 ] * R[ 4 ] + dist[ 2 ] * R[ 7 ], center.z + dist[ 0 ] * R[ 2 ] + dist[ 1 ] * R[ 5 ] + dist[ 2 ] * R[ 8 ] ); return result; }
        fromBox3( box3 ) { box3.getCenter( this.center ); box3.getSize( this.halfSize ).multiplyScalar( 0.5 ); this.rotation.identity(); return this; }
        equals( obb ) { return obb.center.equals( this.center ) && obb.halfSize.equals( this.halfSize ) && obb.rotation.equals( obb.rotation ); }
        applyMatrix4( matrix4 ) { const e = matrix4.elements; let sx = this.halfSize.x, sy = this.halfSize.y, sz = this.halfSize.z; let m11 = e[ 0 ], m12 = e[ 4 ], m13 = e[ 8 ]; let m21 = e[ 1 ], m22 = e[ 5 ], m23 = e[ 9 ]; let m31 = e[ 2 ], m32 = e[ 6 ], m33 = e[ 10 ]; this.center.applyMatrix4( matrix4 ); this.rotation.setFromMatrix4( matrix4 ); this.halfSize.set( Math.sqrt( m11 * m11 * sx * sx + m12 * m12 * sy * sy + m13 * m13 * sz * sz ), Math.sqrt( m21 * m21 * sx * sx + m22 * m22 * sy * sy + m23 * m23 * sz * sz ), Math.sqrt( m31 * m31 * sx * sx + m32 * m32 * sy * sy + m33 * m33 * sz * sz ) ); return this; }
    }
    THREE.OBB = OBB;
} )();
// --- END OF EMBEDDED OBB CLASS ---

// --- BLASTER BOLT GLOBALS (OPTIMIZATION) ---
let glowTexture; // Will be loaded by assetManager
let sharedGlowMaterial; // Will be created after texture is loaded

window.initializeGlowMaterial = () => {
    glowTexture = assetManager.getTexture('glow');
    sharedGlowMaterial = glowTexture ? new THREE.SpriteMaterial({
    map: glowTexture,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    opacity: 1.0
}) : null;    
    window.sharedGlowMaterial = sharedGlowMaterial;
};

// --- COLLISION CONSTANTS ---
const PLAYER_RADIUS = 0.4;
const NPC_RADIUS = 0.4;
const PUSH_FACTOR = 0.05;

class LevelRenderer {
    constructor() {
        this.gridSize = GAME_GLOBAL_CONSTANTS.GRID.SIZE;
        this.wallHeight = GAME_GLOBAL_CONSTANTS.ENVIRONMENT.WALL_HEIGHT;
        this.elevationStep = GAME_GLOBAL_CONSTANTS.ELEVATION.STEP_HEIGHT;
        this.waterMaterials = [];
    }

    createDefaultLayer(settings, layerName, y, rotationX) {
        const defaults = settings.defaults || {};
        const defaultInfo = defaults[layerName];
        if (!defaultInfo || !defaultInfo.key) return;

        const materialName = defaultInfo.key.split('/').pop().replace(/\.[^/.]+$/, "");
        let material = assetManager.getMaterial(materialName);
        if (!material) return;

        // Clone the material to avoid modifying the original in the asset manager
        material = material.clone();
        material.map = material.map.clone();
        material.map.needsUpdate = true;

        const size = defaultInfo.size || 1;
        
        // Ensure texture repeats instead of stretching
        material.map.wrapS = THREE.RepeatWrapping;
        material.map.wrapT = THREE.RepeatWrapping;
        material.map.repeat.set(settings.width / size, settings.height / size);
        
        const planeGeo = new THREE.PlaneGeometry(settings.width * this.gridSize, settings.height * this.gridSize);
        
        // Apply small offsets to prevent Z-fighting
        let yOffset = 0;
        if (layerName === 'subfloor') yOffset = -0.02;
        if (layerName === 'floor') yOffset = -0.01;
        if (layerName === 'ceiling') yOffset = 0.01;
        if (layerName === 'sky') yOffset = 0.02;
        if (layerName === 'water') material.opacity = 0.7;

        const mesh = new THREE.Mesh(planeGeo, material);
        mesh.userData.isLevelAsset = true;
        mesh.position.set((settings.width * this.gridSize) / 2, y + yOffset, (settings.height * this.gridSize) / 2);
        mesh.rotation.x = rotationX;
        mesh.receiveShadow = (layerName === 'floor' || layerName === 'subfloor');
        
        window.game.scene.add(mesh);
    }

    async buildLevelFromData(levelData) {
        window.game.clearScene();
        window.physics.clear();
        const layers = levelData.layers || {};
        const settings = levelData.settings || { width: 64, height: 64, defaults: {} };
        window.physics.initHeightmap(settings.width, settings.height, layers.elevation);
        
        const processTileLayer = (layerName, y, rotationX, isSpecial) => {
            const layerItems = layers[layerName] ? new Map(layers[layerName]) : new Map();
            for (const [pos, item] of layerItems.entries()) {
                const [x, z] = pos.split(',').map(Number);
                const groundHeight = window.physics.getGroundHeight(x * this.gridSize, z * this.gridSize);
                this.createTile(x, z, item, y + groundHeight, rotationX, isSpecial, layerName);
            }
        };
        
        let skyboxItem = null;
        if (layers.skybox) {
            skyboxItem = new Map(layers.skybox).get('0,0');
        } else if (settings.defaults.skybox) {
            skyboxItem = { key: settings.defaults.skybox.key, properties: {} };
        }

        if (skyboxItem) { 
            this.createSkybox(skyboxItem); 
        }

        // Create base layers from defaults
        this.createDefaultLayer(settings, 'subfloor', 0, -Math.PI / 2);
        this.createDefaultLayer(settings, 'floor', 0, -Math.PI / 2);
        this.createDefaultLayer(settings, 'water', 0.1, -Math.PI / 2);
        
        const defaultCeilingHeight = (settings.defaults?.ceiling?.heightMultiplier || 1) * this.wallHeight;
        this.createDefaultLayer(settings, 'ceiling', defaultCeilingHeight, Math.PI / 2);
        this.createDefaultLayer(settings, 'sky', defaultCeilingHeight, Math.PI / 2);


        // Process sparse tile data on top of defaults
        processTileLayer('subfloor', -0.1, -Math.PI / 2, false);
        processTileLayer('floor', 0, -Math.PI / 2, false);
        const waterItems = layers.water ? new Map(layers.water) : new Map();
        const waterCoords = new Set();
        for (const [pos, item] of waterItems.entries()) {
            const [x, z] = pos.split(',').map(Number);
            const size = item.size || 1;
            for (let i = 0; i < size; i++) for (let j = 0; j < size; j++) waterCoords.add(`${x+i},${z+j}`);
        }
        for (const [pos, item] of waterItems.entries()) {
            const [x, z] = pos.split(',').map(Number);
            const size = item.size || 1;
            let minGroundHeight = window.physics.getGroundHeight(x * this.gridSize, z * this.gridSize);
            if (size > 1) {
                for (let i = 0; i < size; i++) for (let j = 0; j < size; j++) minGroundHeight = Math.min(minGroundHeight, window.physics.getGroundHeight((x + i) * this.gridSize, (z + j) * this.gridSize));
            }
            const waterHeight = this.elevationStep + minGroundHeight;
            this.createTile(x, z, item, waterHeight, -Math.PI / 2, true, 'water');
            const waterMat = assetManager.getMaterial(item.key.split('/').pop().replace(/\.[^/.]+$/, ""));
            if (!waterMat) continue;
            for (let i = 0; i < size; i++) {
                for (let j = 0; j < size; j++) {
                    const currentX = x + i, currentZ = z + j;
                    const neighborOffsets = [ { dx: 0, dz: -1, dir: 'up' }, { dx: 0, dz: 1, dir: 'down' }, { dx: -1, dz: 0, dir: 'left' }, { dx: 1, dz: 0, dir: 'right' } ];
                    for (const offset of neighborOffsets) {
                        const checkX = currentX + offset.dx, checkZ = currentZ + offset.dz;
                        if (!waterCoords.has(`${checkX},${checkZ}`)) {
                            const neighborHeight = window.physics.getGroundHeight(checkX * this.gridSize, checkZ * this.gridSize);
                            if (neighborHeight < waterHeight) this.createWaterSide(currentX, currentZ, offset.dir, waterHeight - neighborHeight, neighborHeight, waterMat);
                        }
                    }
                }
            }
        }
        processTileLayer('sky', this.wallHeight + 1.0, Math.PI / 2, false);
        processTileLayer('decor', 0, 0, true);
        processTileLayer('floater', 0, 0, true);
        const ceilingItems = layers.ceiling ? new Map(layers.ceiling) : new Map();
        const ceilingTiles = new Map(); 
        for (const [pos, item] of ceilingItems.entries()) {
            const [x, z] = pos.split(',').map(Number);
            const size = item.size || 1;
            let maxGroundHeight = -Infinity;
             for (let dx = -1; dx <= size; dx++) for (let dz = -1; dz <= size; dz++) maxGroundHeight = Math.max(maxGroundHeight, window.physics.getGroundHeight((x + dx) * this.gridSize, (z + dz) * this.gridSize));
            const heightMultiplier = item.properties?.heightMultiplier || settings.defaults.ceiling?.heightMultiplier || 1;
            const ceilingHeight = maxGroundHeight + (this.wallHeight * heightMultiplier);
            this.createTile(x, z, item, ceilingHeight, Math.PI / 2, false, 'ceiling');
            for (let cz = 0; cz < size; cz++) for (let cx = 0; cx < size; cx++) ceilingTiles.set(`${x + cx},${z + cz}`, { x: x + cx, z: z + cz, item, height: ceilingHeight });
        }
        for (const [pos, tile] of ceilingTiles.entries()) {
            const {x, z, item, height} = tile;
            const ceilingWallTexture = item.properties?.wallsideTexture || settings.defaults.ceiling?.wallside;
            if (!ceilingWallTexture || ceilingWallTexture === 'none') continue;
            const neighborOffsets = [{dx:0, dz:-1, dir: 'up'}, {dx:0, dz:1, dir: 'down'}, {dx:-1, dz:0, dir: 'left'}, {dx:1, dz:0, dir: 'right'}];
            for (const offset of neighborOffsets) {
                const neighborTile = ceilingTiles.get(`${x + offset.dx},${z + offset.dz}`);
                if (!neighborTile) this.createCeilingSide(x, z, offset.dir, ceilingWallTexture, height + (this.wallHeight * 2), height);
                else if (neighborTile.height < height) this.createCeilingSide(x, z, offset.dir, ceilingWallTexture, height, neighborTile.height);
            }
        }
        processTileLayer('dangler', this.wallHeight - 0.01, Math.PI / 2, true);
        if (layers.elevation) this.createElevations(layers.elevation);
        if (layers.wall) this.createWalls(layers.wall);
        if (layers.door) this.createDoors(layers.door);
        if (layers.dock) this.createDocks(layers.dock);
        if (layers.screen) this.createWallOverlays(layers.screen);
        if (layers.panel) this.createWallOverlays(layers.panel); // The createNPCs call is now handled by levelManager after random resolution.
        if (layers.pillar) this.createPillars(layers.pillar);
        let spawnPoint = null;
        if (layers.spawns && layers.spawns.length > 0) {
            const lastDock = localStorage.getItem('gonk_last_dock');
            if (lastDock) {
                const targetSpawnId = JSON.parse(lastDock).properties.target;
                const foundSpawn = layers.spawns.find(item => item[1].id === targetSpawnId);
                if (foundSpawn) {
                    spawnPoint = foundSpawn;
                    window.game.lastSpawnPointPerLevel[levelManager.currentLevel] = spawnPoint;
                }
                localStorage.removeItem('gonk_last_dock');
            }
            if (!spawnPoint) {
                spawnPoint = window.game.lastSpawnPointPerLevel[levelManager.currentLevel] || layers.spawns[0];
                window.game.lastSpawnPointPerLevel[levelManager.currentLevel] = spawnPoint;
            }

            // Set home spawn point if this is level 1 (or current home level)
            if (levelManager.currentLevel === window.game.homeSpawnLevel && !window.game.homeSpawnPoint) {
                window.game.homeSpawnPoint = spawnPoint;
                console.log(`Home spawn point set for level ${window.game.homeSpawnLevel}`);
            }
        }
        if (spawnPoint) {
            const [posStr, item] = spawnPoint;
            const [x, z] = posStr.split(',').map(Number);
            const spawnX = x * this.gridSize + this.gridSize/2;
            const spawnZ = z * this.gridSize + this.gridSize/2;
            const spawnY = window.physics.getGroundHeight(spawnX, spawnZ) + GAME_GLOBAL_CONSTANTS.PLAYER.HEIGHT / 2;
            window.game.camera.position.set(spawnX, spawnY, spawnZ);
            window.physics.playerCollider.position.set(spawnX, spawnY, spawnZ);
            if (inputHandler) inputHandler.yaw = (item.rotation || 0) * -Math.PI / 2;
        } else {
             window.game.camera.position.set(this.gridSize/2, GAME_GLOBAL_CONSTANTS.PLAYER.HEIGHT / 2, this.gridSize/2);
             window.physics.playerCollider.position.set(this.gridSize/2, GAME_GLOBAL_CONSTANTS.PLAYER.HEIGHT / 2, this.gridSize/2);
        }
    }

    // This function remains in the editor UI for placeholder generation
    generateDefaultNamePlaceholderForNpc(skinName) {
        const nameData = assetManager.nameData;
        if (!nameData || Object.keys(nameData).length === 0 || !skinName) return 'XF XL';

        const iconInfo = assetManager.npcIcons.get(skinName);
        if (!iconInfo || !iconInfo.config) {
            console.warn(`No iconInfo or config found for ${skinName} in generateDefaultNamePlaceholderForNpc`);
            return 'XF XL';
        }
        // Prioritize macroCategory for name type
        const categoryKey = iconInfo.config.macroCategory || iconInfo.config.baseType || 'other';
        const categoryLower = categoryKey.toLowerCase();

        // Mapping for Name Lists (same as in npc_behavior.js)
        const nameListMap = {
            'stormtrooper': 'stormtrooper', 'stormtroopers': 'stormtrooper',
            'darth': 'darth', 'sith': 'darth',
            'mandalorian': 'mando', 'mandalorians': 'mando',
            'gungan': 'gungan', 'gamorrean': 'gamorrean', 'wookiee': 'wookiee',
            'taker': 'taker', 'takers': 'taker',
            'human_female': 'female', 'human_male': 'male',
            'humanoid': 'humanoid', 'humans': 'humanoid',
            'ewok': 'ewok', 'halfpint': 'ewok',
            'clone': 'clone', 'clones': 'clone',
            'droid_humanoid': 'droid', 'bb8': 'droid', 'r2d2': 'droid', 'gonk': 'droid',
            'mousedroid': 'droid', 'probe': 'droid', 'r5d4': 'droid', 'irongolem': 'droid',
            'droids': 'droid',
            'aliens': 'humanoid',
            'moncalamari': 'other', 'bossk': 'other', 'aliens_generic': 'other',
            'quarterpint': 'other', 'hutt': 'other'
        };

        const listKey = nameListMap[categoryLower] || 'humanoid'; // Default if no specific mapping

        // Return placeholder string
        return `${listKey}F ${listKey}L`;
    }

    createTile(x, z, item, y, rotationX, isSpecial, layerName = '') {
        const materialName = item.key.split('/').pop().replace(/\.[^/.]+$/, "");
        let material = assetManager.getMaterial(materialName);
        if (!material) return; 
        material.transparent = true;
        material.alphaTest = 0.1;
        if (layerName === 'water') { material.opacity = 0.7; material.depthWrite = false; }
        if (layerName === 'decor' || layerName === 'floater') material.side = THREE.DoubleSide;
        const size = item.size || 1;
        const geoSize = this.gridSize * (size >= 1 ? size : 1);
        if (size < 1) { material.map.wrapS = THREE.RepeatWrapping; material.map.wrapT = THREE.RepeatWrapping; material.map.repeat.set(1 / size, 1 / size); }
        const planeGeo = new THREE.PlaneGeometry(geoSize, geoSize);
        const group = new THREE.Group();
        group.userData.isLevelAsset = true;
        group.position.set(x * this.gridSize + geoSize / 2, 0, z * this.gridSize + geoSize / 2);
        group.rotation.y = (item.rotation || 0) * -Math.PI / 2;
        group.receiveShadow = !isSpecial;
        if (layerName === 'ceiling') {
            const parapetHeight = this.wallHeight * 2;
            const meshBottom = new THREE.Mesh(planeGeo, material);
            meshBottom.position.y = y;
            meshBottom.rotation.x = Math.PI / 2;
            group.add(meshBottom);
            const meshTop = new THREE.Mesh(planeGeo, material.clone());
            meshTop.position.y = y + parapetHeight;
            meshTop.rotation.x = -Math.PI / 2;
            group.add(meshTop);
        } else {
            const mesh = new THREE.Mesh(planeGeo, material);
            mesh.position.y = (layerName === 'decor' || layerName === 'floater') ? y + this.wallHeight / 2 : y;
            mesh.rotation.x = rotationX;
            group.add(mesh);
        }
        if (layerName === 'water' || layerName === 'floater') group.renderOrder = 1; 
        window.game.scene.add(group);
    }

    createWaterSide(x, z, direction, height, groundY, material) {
        const sideGeo = new THREE.PlaneGeometry(this.gridSize, height);
        const sideMesh = new THREE.Mesh(sideGeo, material.clone());
        sideMesh.userData.isLevelAsset = true;
        sideMesh.material.side = THREE.DoubleSide;
        sideMesh.material.map = material.map.clone();
        sideMesh.material.map.needsUpdate = true;
        sideMesh.material.map.wrapS = THREE.RepeatWrapping;
        sideMesh.material.map.wrapT = THREE.RepeatWrapping;
        sideMesh.material.map.repeat.set(1, height / this.gridSize);
        sideMesh.material.map.offset.set(0, groundY / this.gridSize);

        let rotation = 0;
        let positionOffset = this.gridSize / 2;
        if (direction === 'up') { posX = x * this.gridSize + this.gridSize / 2; posZ = z * this.gridSize; rotY = 0; } 
        else if (direction === 'down') { posX = x * this.gridSize + this.gridSize / 2; posZ = (z + 1) * this.gridSize; rotY = Math.PI; } 
        else if (direction === 'left') { posX = x * this.gridSize; posZ = z * this.gridSize + this.gridSize / 2; rotY = Math.PI / 2; } 
        else { posX = (x + 1) * this.gridSize; posZ = z * this.gridSize + this.gridSize / 2; rotY = -Math.PI / 2; }
        sideMesh.position.set(posX, groundY + height / 2, posZ);
        sideMesh.rotation.y = rotY;
        window.game.scene.add(sideMesh);
    }

    createElevations(items) {
        const layerItems = new Map(items);
        for (const [pos, item] of layerItems.entries()) {
            const [x, z] = pos.split(',').map(Number);
            const size = item.size || 1;
            const topHeight = window.physics.getGroundHeight(x * this.gridSize, z * this.gridSize);
            const wallTextureName = item.properties?.wallsideTexture?.split('/').pop().replace(/\.[^/.]+$/, "");
            const wallMatTemplate = wallTextureName ? assetManager.getMaterial(wallTextureName) : null;
            if (!wallMatTemplate) continue;
            const neighborOffsets = [ { dir: 'right', rot: -Math.PI / 2, checkX: x + size, checkZ: z }, { dir: 'left', rot: Math.PI / 2, checkX: x - 1, checkZ: z }, { dir: 'down', rot: Math.PI, checkX: x, checkZ: z + size }, { dir: 'up', rot: 0, checkX: x, checkZ: z - 1 }, ];
            for(const offset of neighborOffsets) {
                const neighborHeight = window.physics.getGroundHeight(offset.checkX * this.gridSize, offset.checkZ * this.gridSize);
                if (neighborHeight < topHeight) {
                    const wallHeight = topHeight - neighborHeight;
                    const wallMat = wallMatTemplate.clone();
                    wallMat.map = wallMatTemplate.map.clone();
                    wallMat.map.needsUpdate = true;
                    wallMat.side = THREE.DoubleSide;
                    wallMat.map.wrapS = THREE.RepeatWrapping;
                    wallMat.map.wrapT = THREE.RepeatWrapping;
                    wallMat.map.repeat.set((this.gridSize * size) / this.gridSize, wallHeight / this.gridSize);
                    wallMat.map.offset.set(0, neighborHeight / this.gridSize);
                    const sideGeo = new THREE.PlaneGeometry(this.gridSize * size, wallHeight);
                    const sideMesh = new THREE.Mesh(sideGeo, wallMat);
                    sideMesh.userData.isLevelAsset = true;
                    let posX = x * this.gridSize + (this.gridSize * size) / 2, posZ = z * this.gridSize + (this.gridSize * size) / 2;
                    const halfGrid = (this.gridSize * size) / 2;
                    if (offset.dir === 'up') posZ -= halfGrid; else if (offset.dir === 'down') posZ += halfGrid;
                    else if (offset.dir === 'left') posX -= halfGrid; else if (offset.dir === 'right') posX += halfGrid;
                    sideMesh.position.set(posX, neighborHeight + wallHeight / 2, posZ);
                    sideMesh.rotation.y = offset.rot;
                    window.game.scene.add(sideMesh);
                }
            }
        }
    }

    createCeilingSide(x, z, direction, texturePath, topY, bottomY) {
        const wallMat = assetManager.getMaterial(texturePath.split('/').pop().replace(/\.[^/.]+$/, ""));
        if (!wallMat) return;
        wallMat.side = THREE.DoubleSide;
        const sideHeight = topY - bottomY;
        if (sideHeight <= 0) return;
        const wallGeo = new THREE.PlaneGeometry(this.gridSize, sideHeight);
        const wallMesh = new THREE.Mesh(wallGeo, wallMat);
        wallMesh.userData.isLevelAsset = true;
        let posX, posZ, rotY;
        if (direction === 'up') { posX = x * this.gridSize + this.gridSize / 2; posZ = z * this.gridSize; rotY = 0; } 
        else if (direction === 'down') { posX = x * this.gridSize + this.gridSize / 2; posZ = (z + 1) * this.gridSize; rotY = Math.PI; } 
        else if (direction === 'left') { posX = x * this.gridSize; posZ = z * this.gridSize + this.gridSize / 2; rotY = Math.PI / 2; } 
        else { posX = (x + 1) * this.gridSize; posZ = z * this.gridSize + this.gridSize / 2; rotY = -Math.PI / 2; }
        wallMesh.position.set(posX, bottomY + sideHeight / 2, posZ);
        wallMesh.rotation.y = rotY;
        window.game.scene.add(wallMesh);
    }

    createStackedLineObject(item, key) {
        const textures = [item.key, item.properties?.level2, item.properties?.level3];
        const isOBB = key.startsWith('VEC_');
        const objectGroup = new THREE.Group();
        objectGroup.userData.isLevelAsset = true;
        const colliders = []; 
        let length, center, maxGroundHeight;
        if (isOBB) {
            const [x1_grid, z1_grid, x2_grid, z2_grid] = item.points;
            const startPos = new THREE.Vector3(x1_grid * this.gridSize, 0, z1_grid * this.gridSize);
            const endPos = new THREE.Vector3(x2_grid * this.gridSize, 0, z2_grid * this.gridSize);
            const startGround = window.physics.getGroundHeight(startPos.x, startPos.z), endGround = window.physics.getGroundHeight(endPos.x, endPos.z);
            length = startPos.distanceTo(endPos);
            if (length < 0.01) return null;
            center = new THREE.Vector3().lerpVectors(startPos, endPos, 0.5);
            maxGroundHeight = Math.max(startGround, endGround);
        } else {
            const [type, xStr, zStr] = key.split('_');
            const x = Number(xStr), z = Number(zStr);
            let groundHeight1, groundHeight2;
            if (type === 'H') {
                const centerX = (x + 0.5) * this.gridSize;
                groundHeight1 = window.physics.getGroundHeight(centerX, (z + 0.5) * this.gridSize);
                groundHeight2 = window.physics.getGroundHeight(centerX, (z + 1.5) * this.gridSize);
                center = new THREE.Vector3(x * this.gridSize + this.gridSize / 2, 0, (z + 1) * this.gridSize);
            } else {
                const centerZ = (z + 0.5) * this.gridSize;
                groundHeight1 = window.physics.getGroundHeight((x + 0.5) * this.gridSize, centerZ);
                groundHeight2 = window.physics.getGroundHeight((x + 1.5) * this.gridSize, centerZ);
                center = new THREE.Vector3((x + 1) * this.gridSize, 0, z * this.gridSize + this.gridSize / 2);
            }
            length = this.gridSize;
            maxGroundHeight = Math.max(groundHeight1, groundHeight2);
        }
        objectGroup.position.copy(center);
        objectGroup.position.y = maxGroundHeight;

        if (isOBB) {
            const [x1_grid, z1_grid, x2_grid, z2_grid] = item.points;
            const angle = Math.atan2((z2_grid * this.gridSize) - (z1_grid * this.gridSize), (x2_grid * this.gridSize) - (x1_grid * this.gridSize));
            objectGroup.rotation.y = -angle;
        }

        for (let i = 0; i < textures.length; i++) {
            const texturePath = textures[i];
            if (!texturePath) continue;
            const materialName = texturePath.split('/').pop().replace(/\.[^/.]+$/, "");
            const material = assetManager.getMaterial(materialName);
            if (!material) continue;
            material.transparent = true; material.alphaTest = 0.1; material.map.wrapS = THREE.RepeatWrapping; material.map.wrapT = THREE.RepeatWrapping; 
            let mesh;
            if (isOBB) {
                material.side = THREE.DoubleSide;
                material.map.repeat.set(Math.round(length / this.gridSize), 1);
                mesh = new THREE.Mesh(new THREE.PlaneGeometry(length, this.wallHeight), material);
            } else {
                const [type] = key.split('_');
                material.map.repeat.set(1, 1);
                mesh = new THREE.Mesh(new THREE.BoxGeometry(type === 'H' ? this.gridSize : 0.08, this.wallHeight, type === 'V' ? this.gridSize : 0.08), material); // Reverted to BoxGeometry for grid walls
            }
            mesh.position.y = (this.wallHeight * i) + (this.wallHeight / 2);
            mesh.userData.isDoorSegment = (i === 0);
            objectGroup.add(mesh);
            colliders.push(window.physics.addWall(mesh, isOBB));
        }
        if (objectGroup.children.length > 0) {
            window.game.scene.add(objectGroup);
            objectGroup.userData.colliders = colliders;
            return { group: objectGroup, isOBB: isOBB };
        }
        return null;
    }

    createWalls(items) { for (const [key, item] of items) this.createStackedLineObject(item, key); }
    createDoors(items) { for (const [key, item] of items) { const doorObj = this.createStackedLineObject(item, key); if(doorObj) window.game.entities.doors.push(new Door(doorObj.group, item, doorObj.isOBB)); } }
    createDocks(items) { for (const [key, item] of items) { const dockObj = this.createStackedLineObject(item, key); if(dockObj) window.game.entities.doors.push(new Dock(dockObj.group, item, dockObj.isOBB)); } }

    createWallOverlays(items) { 
        for (const [key, item] of items) { 
            const [type, xStr, zStr] = key.split('_'); 
            const x = Number(xStr), z = Number(zStr); 
            const material = assetManager.getMaterialFromPath(item.key); 
            if(!material) continue;
            material.side = THREE.DoubleSide; material.transparent = true; material.alphaTest = 0.1; 
            const mesh = new THREE.Mesh(new THREE.PlaneGeometry(this.gridSize, this.wallHeight), material); 
            mesh.userData.isLevelAsset = true;
            let posX, posZ, rotY; 
            const direction = item.properties?.direction || 1;
            const offset = 0.06, groundHeight = window.physics.getGroundHeight(x * this.gridSize, z * this.gridSize);
            if (type === 'H') { posX = x * this.gridSize + this.gridSize / 2; posZ = (z + 1) * this.gridSize - (direction * offset); rotY = 0; } 
            else { posX = (x + 1) * this.gridSize - (direction * offset); posZ = z * this.gridSize + this.gridSize / 2; rotY = -Math.PI / 2; } 
            mesh.position.set(posX, groundHeight + this.wallHeight / 2, posZ); 
            mesh.rotation.y = rotY; 
            mesh.castShadow = true; 
            window.game.scene.add(mesh); 
        } 
    } 

    createPillars(items) {
        for (const [pos, item] of items) {
            const [x, z] = pos.split(',').map(Number);
            const material = assetManager.getMaterialFromPath(item.key);
            if (!material) continue;

            const width = item.properties?.width || 11;
            const height = item.properties?.height || 3;
            const placement = item.properties?.placement || 'center';

            const radius = (this.gridSize * (width / 100)) / 2;
            let posX = (x + 0.5) * this.gridSize;
            let posZ = (z + 0.5) * this.gridSize;

            if (placement === 'topLeft') {
                posX = x * this.gridSize;
                posZ = z * this.gridSize;
            } else if (placement === 'topRight') {
                posX = (x + 1) * this.gridSize;
                posZ = z * this.gridSize;
            } else if (placement === 'bottomLeft') {
                posX = x * this.gridSize;
                posZ = (z + 1) * this.gridSize;
            } else if (placement === 'bottomRight') {
                posX = (x + 1) * this.gridSize;
                posZ = (z + 1) * this.gridSize;
            }

            const groundHeight = window.physics.getGroundHeight(posX, posZ);
            const pillarHeight = this.wallHeight * height;

            const geometry = new THREE.CylinderGeometry(radius, radius, pillarHeight, 16);
            const pillarMesh = new THREE.Mesh(geometry, material);
            pillarMesh.userData.isLevelAsset = true;
            pillarMesh.castShadow = true;
            pillarMesh.receiveShadow = true;

            pillarMesh.position.set(posX, groundHeight + pillarHeight / 2, posZ);

            window.game.scene.add(pillarMesh);
            window.physics.addWall(pillarMesh, false); // Add as an AABB collider
        }
    }

    async buildFurniture(items) {
        if (!items || !window.furnitureLoader) return;

        const layerItems = new Map(items);
        for (const [pos, item] of layerItems.entries()) {
            const [x, z] = pos.split(',').map(Number);
            
            const modelName = item.key;
            
            const model = await window.furnitureLoader.getModel(modelName);

            if (model) {
                const groundHeight = window.physics.getGroundHeight(x * this.gridSize, z * this.gridSize);
                
                model.position.set(
                    x * this.gridSize + this.gridSize / 2,
                    groundHeight,
                    z * this.gridSize + this.gridSize / 2
                );

                model.rotation.y = (item.rotation || 0) * -Math.PI / 2;

                // Add visible model to the scene
                window.game.scene.add(model);

                // Create a simplified physics object for each element
                const modelData = await window.furnitureLoader.getModelData(modelName);
                if (modelData && modelData.elements) {
                    modelData.elements.forEach(element => {
                        const from = element.from;
                        const to = element.to;
                        const size = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
                        const scale = 0.0625;

                        const physicsGeo = new THREE.BoxGeometry(size[0] * scale, size[1] * scale, size[2] * scale);
                        const physicsMat = new THREE.MeshBasicMaterial({ visible: false });
                        const physicsMesh = new THREE.Mesh(physicsGeo, physicsMat);

                        const position = [
                            (from[0] + size[0] / 2) * scale - 0.5,
                            (from[1] + size[1] / 2) * scale - 0.5,
                            (from[2] + size[2] / 2) * scale - 0.5
                        ];

                        physicsMesh.position.set(
                            model.position.x + position[0],
                            model.position.y + position[1],
                            model.position.z + position[2]
                        );
                        
                        window.physics.addWall(physicsMesh, false);
                    });
                }
            }
        }
    }


    async createSkybox(item) {
        if (window.game.skyboxAnimator) {
            window.game.skyboxAnimator.dispose();
            window.game.skyboxAnimator = null;
        }

        // Explicitly handle "None" selection
        if (!item || item.key === null || item.key === '') {
            window.game.scene.background = null;
            return;
        }

        const skyboxKey = item.key.replace(/\.(png|jpg)$/, ''); // Remove extension for lookup
        const skyboxType = item.properties?.type || 'static';
        const skyboxInfo = assetManager.skyboxSets.get(skyboxKey);

        if (!skyboxInfo) {
            console.warn(`Skybox key '${skyboxKey}' not found. Using fallback color.`);
            // Fallback to a space-like dark blue color instead of null
            window.game.scene.background = new THREE.Color(0x000011);
            return;
        }

        if (skyboxType === 'animation') {
            const textures = await assetManager.loadAnimatedSkybox(skyboxKey);
            if (textures && textures.length > 0) {
                window.game.skyboxAnimator = new SkyboxAnimator(textures);
                if (window.game.renderer) {
                    await window.game.skyboxAnimator.initialize(window.game.renderer);
                }
            } else {
                console.warn(`Failed to load animated skybox '${skyboxKey}'. Using fallback color.`);
                window.game.scene.background = new THREE.Color(0x000011);
            }
        } else if (skyboxType === 'random_static') {
            const randomPath = await assetManager.loadRandomStaticSkybox(skyboxKey);
            if (randomPath) {
                await assetManager.loadTexture(randomPath);
                const texture = assetManager.getTexture(randomPath);
                if (texture) {
                    const pmremGenerator = new THREE.PMREMGenerator(window.game.renderer);
                    pmremGenerator.compileEquirectangularShader();
                    texture.mapping = THREE.EquirectangularReflectionMapping;
                    texture.encoding = THREE.sRGBEncoding;
                    const envMap = pmremGenerator.fromEquirectangular(texture);
                    window.game.scene.background = envMap.texture;
                    pmremGenerator.dispose();
                } else {
                    console.warn(`Failed to load random static skybox texture. Using fallback color.`);
                    window.game.scene.background = new THREE.Color(0x000011);
                }
            } else {
                console.warn(`Failed to select random static skybox from '${skyboxKey}'. Using fallback color.`);
                window.game.scene.background = new THREE.Color(0x000011);
            }
        } else {
            // Static skybox
            const pmremGenerator = new THREE.PMREMGenerator(window.game.renderer);
            pmremGenerator.compileEquirectangularShader();
            const texture = assetManager.getTexture(skyboxKey);
            if (!texture) {
                console.warn(`Skybox texture for key '${skyboxKey}' not loaded. Using fallback color.`);
                window.game.scene.background = new THREE.Color(0x000011);
                pmremGenerator.dispose();
                return;
            }
            texture.mapping = THREE.EquirectangularReflectionMapping;
            texture.encoding = THREE.sRGBEncoding;
            const envMap = pmremGenerator.fromEquirectangular(texture);
            window.game.scene.background = envMap.texture;
            pmremGenerator.dispose();
        }
    }

    async createNPCs(items) { 
        for (const [pos, item] of items) { 
            const [x, z] = pos.split(',').map(Number); 
            const skinName = item.key;
            const iconInfo = assetManager.npcIcons.get(skinName);

            if (!iconInfo || !iconInfo.config) {
                console.warn(`No config found for NPC skin '${skinName}' at ${pos}. Skipping.`);
                continue;
            }
            const npcConfig = iconInfo.config;
            const modelType = npcConfig.minecraftModel || 'humanoid';
            const groundHeight = window.physics.getGroundHeight(x * this.gridSize, z * this.gridSize);
            const meshConfig = { 
                skinTexture: item.key,
                scaleX: npcConfig.scale_x, scaleY: npcConfig.scale_y, scaleZ: npcConfig.scale_z,
                scale: item.size || npcConfig.scale || 1.0,
                transparent: item.properties?.transparent || false,
                alphaTexture: item.properties?.alphaTexture || false,
                armType: npcConfig.armType || 'steve'
            };
            const charMesh = window.createGonkMesh(modelType, meshConfig, new THREE.Vector3(x * this.gridSize + this.gridSize/2, groundHeight, z * this.gridSize + this.gridSize/2), item.key); 
            if(charMesh) {
                const npcInstance = new NPC(charMesh, item, npcConfig);
                // Prioritize the instance-specific weapon property from the level data.
                if (item.properties?.weapon && item.properties.weapon !== "" && item.properties.weapon !== "none") {
                    const weaponName = item.properties.weapon.split('/').pop().replace('.png', '');
                    await window.weaponIcons.attachToCharacter(npcInstance, weaponName);
                // Fallback to the default_weapon from the character config (e.g., 1_aliens.json).
                } else if (npcConfig.default_weapon && npcConfig.default_weapon !== "") {
                    const weaponName = npcConfig.default_weapon.split('/').pop().replace('.png', '');
                    npcInstance.itemData.properties.weapon = npcConfig.default_weapon;
                    await window.weaponIcons.attachToCharacter(npcInstance, weaponName);
                }
                charMesh.group.rotation.y = (item.rotation || 0) * -Math.PI / 2; 
                window.game.scene.add(charMesh.group); 
                window.game.entities.npcs.push(npcInstance);
                window.physics.addDynamicEntity(npcInstance);
            } 
        } 
    }

    createFallbackFloor() { const floor = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshStandardMaterial({ color: 0x111111 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -0.01; window.game.scene.add(floor); const gridHelper = new THREE.GridHelper(100, 100, 0x888888, 0x444444); gridHelper.position.y = 0; window.game.scene.add(gridHelper); }
}

class Door {
    constructor(meshGroup, itemData = {}, isOBB) {
        this.meshGroup = meshGroup; this.isOBB = isOBB; this.properties = itemData.properties || {}; this.colliders = meshGroup.userData.colliders || []; this.doorSegment = meshGroup.children.find(child => child.userData.isDoorSegment); this.originalSegmentY = this.doorSegment ? this.doorSegment.position.y : 0; this.state = 'closed'; this.animProgress = 0; this.openHeight = GAME_GLOBAL_CONSTANTS.ENVIRONMENT.WALL_HEIGHT * 2; this.animationSpeed = 4.0; this.closeTimer = null;
    }
    open() { if (this.state === 'closed' || this.state === 'closing') { audioSystem.playSound('dooropen'); this.state = 'opening'; if (this.colliders) this.colliders.forEach(c => c.active = false); if (this.closeTimer) { clearTimeout(this.closeTimer); this.closeTimer = null; } } }
    close() { if (this.state === 'open' || this.state === 'opening') this.state = 'closing'; }
    update(deltaTime) {
        if (this.state === 'opening') { this.animProgress += deltaTime * this.animationSpeed; if (this.animProgress >= 1) { this.animProgress = 1; this.state = 'open'; this.closeTimer = setTimeout(() => this.close(), GAME_GLOBAL_CONSTANTS.ENVIRONMENT.DOOR_OPEN_TIME); }
        } else if (this.state === 'closing') { this.animProgress -= deltaTime * this.animationSpeed; if (this.animProgress <= 0) { this.animProgress = 0; this.state = 'closed'; if (this.colliders) this.colliders.forEach(c => c.active = true); } }
        if (this.doorSegment) this.doorSegment.position.y = this.originalSegmentY + (this.openHeight * this.animProgress);
    }
}

class Dock extends Door {
    constructor(meshGroup, itemData = {}, isOBB) { super(meshGroup, itemData, isOBB); }
    open() {
        if (this.state !== 'closed') return;
        if (this.properties.target) {
            const match = this.properties.target.match(/(\d+)/);
            const targetLevel = match ? parseInt(match[1]) : null;
            if (targetLevel && levelManager.currentLevel !== targetLevel) {
                 audioSystem.playSound('dooropen2');
                 localStorage.setItem('gonk_last_dock', JSON.stringify({ properties: this.properties }));
                 levelManager.loadLevel(targetLevel);
                 return;
            }
        }
        super.open();
    }
}

class PhysicsSystem {
    constructor() {
        this.walls = []; this.dynamicEntities = []; this.ragdolls = []; this.noclipEnabled = false; this.heightmap = null; this.heightmapWidth = 0; this.heightmapHeight = 0; this.playerFallStart_Y = 0; this.wasPlayerOnGroundLastFrame = true; this._ragdollBox = new THREE.Box3(); this.playerCollider = { isPlayer: true, radius: PLAYER_RADIUS, position: new THREE.Vector3(0, GAME_GLOBAL_CONSTANTS.PLAYER.HEIGHT / 2, 0), velocity: new THREE.Vector3(), weight: 100, onGround: true, climbHeight: GAME_GLOBAL_CONSTANTS.PLAYER.CLIMB_HEIGHT * GAME_GLOBAL_CONSTANTS.ELEVATION.STEP_HEIGHT }; this.playerEntity = { collider: this.playerCollider, isPlayer: true, faction: 'player_droid' }; this.addDynamicEntity(this.playerEntity);
        this.raycaster = new THREE.Raycaster();
        this.wallMeshes = [];
    }
    initHeightmap(width, height, elevationData) {
        this.heightmapWidth = width; this.heightmapHeight = height; this.heightmap = new Array(width * height).fill(0);
        if (elevationData) {
            const layerMap = new Map(elevationData);
            layerMap.forEach((item, key) => {
                const [x, z] = key.split(',').map(Number);
                const heightValue = item.properties?.elevation || 0, size = item.size || 1;
                for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
                    const index = (z + j) * width + (x + i);
                    if (index >= 0 && index < this.heightmap.length) this.heightmap[index] = heightValue * GAME_GLOBAL_CONSTANTS.ELEVATION.STEP_HEIGHT;
                }
            });
        }
    }
    getGroundHeight(x, z) { if (!this.heightmap) return 0; const gridX = Math.floor(x / GAME_GLOBAL_CONSTANTS.GRID.SIZE), gridZ = Math.floor(z / GAME_GLOBAL_CONSTANTS.GRID.SIZE); if (gridX >= 0 && gridX < this.heightmapWidth && gridZ >= 0 && gridZ < this.heightmapHeight) return this.heightmap[gridZ * this.heightmapWidth + gridX] || 0; return 0;  }

    clear() { 
        this.walls = []; 
        this.wallMeshes = [];
        this.dynamicEntities = []; 

        for (const ragdoll of this.ragdolls) {
            for (const part of ragdoll) {
                window.game.scene.remove(part.mesh);
                part.mesh.geometry.dispose();
                if(Array.isArray(part.mesh.material)) {
                    part.mesh.material.forEach(m => { 
                        if(m.map) m.map.dispose(); 
                        m.dispose(); 
                    });
                } else {
                    if(part.mesh.material.map) window.part.mesh.material.map.dispose();
                    part.mesh.material.dispose();
                }
            }
        }
        this.ragdolls = []; 

        this.addDynamicEntity(this.playerEntity); 
        this.heightmap = null; 
    }

    addWall(mesh, isOBB) { 
        mesh.updateWorldMatrix(true, false); 
        const wallCollider = { mesh, isOBB, uuid: mesh.uuid, active: true };
        if (isOBB) {
            // For OBB, we create a box and apply the mesh's world matrix to it.
            const box = new THREE.Box3().setFromObject(mesh, true);
            const obb = new THREE.OBB().fromBox3(box);
            obb.applyMatrix4(mesh.matrixWorld);
            wallCollider.obb = obb;
        } else {
            wallCollider.aabb = new THREE.Box3().setFromObject(mesh);
        }
        this.walls.push(wallCollider); 
        this.wallMeshes.push(mesh);
        return wallCollider; 
    }
    addDynamicEntity(entity) { if (entity && entity.movementCollider) this.dynamicEntities.push(entity); else if (entity && entity.collider) this.dynamicEntities.push(entity); }
    jump() { if (this.playerCollider.onGround) { this.playerCollider.velocity.y = window.game.state.playerStats.jump_strength; this.playerCollider.onGround = false; } }
    
    hasLineOfSight(start, end) {
        if (!this.wallMeshes.length) return true;
        const direction = end.clone().sub(start).normalize();
        const distance = start.distanceTo(end);
        this.raycaster.set(start, direction);
        this.raycaster.far = distance;
    
        const intersects = this.raycaster.intersectObjects(this.wallMeshes, true);
    
        for(const intersect of intersects) {
            let currentObject = intersect.object;
            while (currentObject) {
                // Check if any parent object corresponds to an active wall collider
                const wall = this.walls.find(w => w.mesh.uuid === currentObject.uuid);
                if (wall && wall.active) {
                    return false; // Blocked by an active wall
                }
                currentObject = currentObject.parent;
            }
        }
        
        return true; // No active walls block the view
    }

    update(deltaTime, inputHandler, camera) {
        this.noclipEnabled = window.game.state.noClipping;
        if (this.noclipEnabled) { this.updatePlayerVelocity(inputHandler); this.playerCollider.position.add(this.playerCollider.velocity);
        } else {
            this.updatePlayerPosition(inputHandler); // Player has special ledge logic
            
            // ADDED: Ledge detection logic for NPCs
            for (const entity of this.dynamicEntities) {
                const collider = entity.movementCollider || entity.collider;
                if (!collider.isPlayer && !collider.parent.isDead && collider.velocity.lengthSq() > 0) {
                    const currentPos = collider.position;
                    const futurePos = currentPos.clone().add(collider.velocity);
                    const currentHeight = this.getGroundHeight(currentPos.x, currentPos.z);
                    const futureHeight = this.getGroundHeight(futurePos.x, futurePos.z);
                    if ((futureHeight - currentHeight) > (collider.parent.config.jump_strength || 0.75)) {
                        collider.velocity.x = 0; collider.velocity.z = 0;
                    }
                }
            }

            for (const entity of this.dynamicEntities) { const collider = entity.movementCollider || entity.collider; if (!collider.isPlayer && !collider.parent.isDead) collider.position.add(collider.velocity); }
            this.resolveEntityCollisions();
            for (const entity of this.dynamicEntities) { const collider = entity.movementCollider || entity.collider; if (collider.parent && collider.parent.isDead) continue; for (const wall of this.walls) if (wall.active) this.resolveWallCollision(collider, wall); }
            this.applyGravityAndGroundDetection();
        }
        this.updateRagdolls();
        this.resolveProjectileCollisions(deltaTime);
        this.applyPostPhysicsUpdates(camera);
        this.wasPlayerOnGroundLastFrame = this.playerCollider.onGround;
    }
    updatePlayerPosition(inputHandler) {
        this.updatePlayerVelocity(inputHandler);
        const intendedMove = this.playerCollider.velocity.clone();
        if (intendedMove.lengthSq() === 0) return;
        const currentPos = this.playerCollider.position, futurePos = currentPos.clone().add(intendedMove);
        const currentHeight = this.getGroundHeight(currentPos.x, currentPos.z), futureHeight = this.getGroundHeight(futurePos.x, futurePos.z);
        if (this.playerCollider.onGround && (futureHeight - currentHeight) > this.playerCollider.climbHeight) { this.playerCollider.velocity.x = 0; this.playerCollider.velocity.z = 0; }
        this.playerCollider.position.x += this.playerCollider.velocity.x; this.playerCollider.position.z += this.playerCollider.velocity.z;
    }
    updatePlayerVelocity(inputHandler) {
        const acceleration = new THREE.Vector3(); const yaw = inputHandler.yaw; const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).negate(); const right = new THREE.Vector3(forward.z, 0, -forward.x); if (inputHandler.keys['KeyW']) acceleration.add(forward); if (inputHandler.keys['KeyS']) acceleration.sub(forward); if (inputHandler.keys['KeyA']) acceleration.add(right); if (inputHandler.keys['KeyD']) acceleration.sub(right); 
        let speed = inputHandler.keys['ShiftLeft'] ? window.game.state.playerStats.speed * GAME_GLOBAL_CONSTANTS.MOVEMENT.SPRINT_MULTIPLIER : window.game.state.playerStats.speed;
        if (game.state.playerStats.movement_speed_bonus) {
            speed *= (1 + game.state.playerStats.movement_speed_bonus);
        }
        if (acceleration.length() > 0) acceleration.normalize().multiplyScalar(speed); this.playerCollider.velocity.x = acceleration.x; this.playerCollider.velocity.z = acceleration.z;
    }
    handleFallDamage(distance) { if (distance / GAME_GLOBAL_CONSTANTS.ELEVATION.STEP_HEIGHT >= 4) { window.game.takePlayerDamage(10); if (window.audioSystem) audioSystem.playSoundFromList('bonk'); } }
    applyGravityAndGroundDetection(skipPlayer = false) {
        for (const entity of this.dynamicEntities) {
            if (skipPlayer && entity.isPlayer) continue;

            const collider = entity.movementCollider || entity.collider; 
            if (collider.parent && collider.parent.isDead) continue; 

            const gravity = collider.isPlayer 
                ? GAME_GLOBAL_CONSTANTS.ELEVATION.PLAYER_GRAVITY 
                : GAME_GLOBAL_CONSTANTS.ELEVATION.NPC_GRAVITY;

            collider.velocity.y -= gravity; 
            collider.position.y += collider.velocity.y; 
            const groundHeight = this.getGroundHeight(collider.position.x, collider.position.z); 

            const offset = collider.isPlayer 
                ? GAME_GLOBAL_CONSTANTS.PLAYER.HEIGHT / 2 
                : (collider.parent.mesh.groundOffset || 0);
            const targetY = groundHeight + offset;

            if (collider.position.y < targetY) {
                collider.position.y = targetY; 
                collider.velocity.y = 0;
                if (collider.isPlayer) { 
                    if (!this.wasPlayerOnGroundLastFrame) this.handleFallDamage(this.playerFallStart_Y - collider.position.y); 
                    collider.onGround = true; 
                }
            } else if (collider.isPlayer) { 
                if (this.wasPlayerOnGroundLastFrame) this.playerFallStart_Y = collider.position.y; 
                collider.onGround = false; 
            }
        }
    }
    resolveEntityCollisions() {
        for (let i = 0; i < this.dynamicEntities.length; i++) for (let j = i + 1; j < this.dynamicEntities.length; j++) { const entityA = this.dynamicEntities[i], entityB = this.dynamicEntities[j]; const colA = entityA.movementCollider || entityA.collider, colB = entityB.movementCollider || entityB.collider; if ((colA.parent && colA.parent.isDead) || (colB.parent && colB.parent.isDead) ) continue; this.resolveEntityCollision(colA, colB); }
    }

    resolveProjectileCollisions(deltaTime) {
        for (let i = window.game.entities.projectiles.length - 1; i >= 0; i--) {
            const projectile = window.game.entities.projectiles[i];
            const owner = projectile.owner;

            if (!projectile.update(deltaTime)) {
                projectile.dispose();
                window.game.entities.projectiles.splice(i, 1);
                continue;
            }

            // --- Ground/Ceiling Collision for Pamphlets ---
            if (projectile instanceof PamphletProjectile && !projectile.isStuck) {
                const groundHeight = this.getGroundHeight(projectile.mesh.position.x, projectile.mesh.position.z);
                if (projectile.mesh.position.y <= groundHeight + 0.05) { // Check if it hit the floor
                    projectile.isStuck = true;
                    projectile.velocity.set(0, 0, 0);
                    projectile.mesh.position.y = groundHeight + 0.01; // Place it just on top of the ground
                }
            }

            if (projectile.isStuck) continue;

            let hit = false;

            // --- Wall Collision ---
            for (const wall of this.walls) {
                if (!wall.active) continue;

                const intersectsWall = wall.isOBB ? 
                    wall.obb.intersectsSphere(projectile.collider) : 
                    wall.aabb.intersectsSphere(projectile.collider);

                if (intersectsWall) {
                    if (projectile instanceof PamphletProjectile) {
                        projectile.isStuck = true;
                        projectile.velocity.set(0, 0, 0);
                    } else {
                        projectile.dispose();
                        window.game.entities.projectiles.splice(i, 1);
                    }
                    hit = true;
                    break; 
                }
            }
            if (hit && !(projectile instanceof PamphletProjectile)) continue;

            // --- Entity Collision ---
            const potentialTargets = [this.playerEntity, ...window.game.entities.npcs];
            for (const target of potentialTargets) {
                if (hit) break;
                if (!target || (target.parent && target.parent.isDead) || target === owner || (target.parent && target.parent === owner)) {
                    continue;
                }
                
                // --- Friendly Fire Checks ---
                if (target.isPlayer && projectile.ownerType === 'ally') continue; // Allies can't hurt player
                if (target.parent?.isAlly && projectile.ownerType === 'ally') continue; // Allies can't hurt other allies

                if (target.isPlayer) {
                    if (projectile.ownerType !== 'player' && projectile.collider.intersectsSphere(new THREE.Sphere(this.playerCollider.position, PLAYER_RADIUS))) {
                        window.game.takePlayerDamage(projectile.damage, owner);
                        if (window.audioSystem) audioSystem.playPlayerHurtSound('ranged');
                        hit = true;
                    }
                } else { // Target is an NPC
                    if (target.isDead) continue;

                    // Broadphase: Check against the NPC's single bounding sphere first.
                    if (projectile.collider.intersectsSphere(target.boundingSphere)) {
                        // Narrowphase: If broadphase passes, check individual hitboxes.
                        for (const partName in target.hitboxes) {
                            if (target.hitboxes[partName].intersectsSphere(projectile.collider)) {
                                if (projectile instanceof PamphletProjectile) {
                                    target.onPamphletHit();
                                    projectile.isStuck = true;
                                    projectile.velocity.set(0, 0, 0);
                                    const partGroup = target.mesh.parts[partName];
                                    partGroup.attach(projectile.mesh);
                                } else {
                                    target.takeDamage(projectile.damage, owner);
                                }
                                hit = true;
                                break; // One hit is enough, exit hitbox loop.
                            }
                        }
                    }
                }
            }

            if (hit && !(projectile instanceof PamphletProjectile)) {
                projectile.dispose();
                window.game.entities.projectiles.splice(i, 1);
            }
        }
        
        // ADDED: Pickup collision check (Fixes TypeError by using .center)
        for (let i = window.game.entities.pickups.length - 1; i >= 0; i--) {
            const pickup = window.game.entities.pickups[i];
            const playerSphere = new THREE.Sphere(this.playerCollider.position, this.playerCollider.radius);
            
            // FIX: Use playerSphere.center.distanceTo(pickup.mesh.position)
            if (playerSphere.center.distanceTo(pickup.mesh.position) < pickup.size + playerSphere.radius) {
                 if (!pickup.update(deltaTime)) { // Manually trigger pickup update which handles the logic and returns false to remove
                    pickup.dispose();
                    window.game.entities.pickups.splice(i, 1);
                }
            }
        }
    }

    resolveWallCollision(collider, wall) {
        wall.mesh.updateWorldMatrix(true, false);
        const sphere = new THREE.Sphere(collider.position, collider.radius);
        let intersects, resolutionBox;

        if (wall.isOBB) {
            resolutionBox = wall.obb;
            if (!resolutionBox) {
                const box = new THREE.Box3().setFromObject(wall.mesh, true);
                resolutionBox = new THREE.OBB().fromBox3(box);
                resolutionBox.applyMatrix4(wall.mesh.matrixWorld);
                wall.obb = resolutionBox;
            }
            intersects = resolutionBox.intersectsSphere(sphere);
        } else {
            resolutionBox = wall.aabb;
            if (!resolutionBox) {
                resolutionBox = new THREE.Box3().setFromObject(wall.mesh);
                wall.aabb = resolutionBox;
            }
            intersects = sphere.intersectsBox(resolutionBox);
        }

        if (intersects) {
            const closestPoint = new THREE.Vector3();
            resolutionBox.clampPoint(sphere.center, closestPoint);
            const penetrationVector = new THREE.Vector3().subVectors(sphere.center, closestPoint);
            const penetrationDepth = sphere.radius - penetrationVector.length();

            if (penetrationDepth > 0) {
                let resolutionNormal;
                if (penetrationVector.lengthSq() > 1e-9) {
                    resolutionNormal = penetrationVector.normalize();
                } else {
                    // Player is completely inside the box, find the smallest escape route.
                    const aabb = (resolutionBox instanceof THREE.OBB) ? resolutionBox.getAABB(new THREE.Box3()) : resolutionBox;
                    const center = sphere.center;
                    
                    const dx_min = center.x - aabb.min.x;
                    const dx_max = aabb.max.x - center.x;
                    const dy_min = center.y - aabb.min.y;
                    const dy_max = aabb.max.y - center.y;
                    const dz_min = center.z - aabb.min.z;
                    const dz_max = aabb.max.z - center.z;

                    let min_dist = dx_min;
                    resolutionNormal = new THREE.Vector3(-1, 0, 0);

                    if (dx_max < min_dist) { min_dist = dx_max; resolutionNormal.set(1, 0, 0); }
                    if (dy_min < min_dist) { min_dist = dy_min; resolutionNormal.set(0, -1, 0); }
                    if (dy_max < min_dist) { min_dist = dy_max; resolutionNormal.set(0, 1, 0); }
                    if (dz_min < min_dist) { min_dist = dz_min; resolutionNormal.set(0, 0, -1); }
                    if (dz_max < min_dist) { min_dist = dz_max; resolutionNormal.set(0, 0, 1); }
                }

                collider.position.add(resolutionNormal.clone().multiplyScalar(penetrationDepth));

                // If we are pushing the entity UP, it's a ground collision.
                if (resolutionNormal.y > 0.7) { // Normal points mostly up
                    if (collider.velocity.y < 0) {
                        collider.velocity.y = 0;
                    }
                    if (collider.isPlayer) {
                        if (!this.wasPlayerOnGroundLastFrame) {
                            this.handleFallDamage(this.playerFallStart_Y - collider.position.y);
                        }
                        collider.onGround = true;
                    }
                }
            }
        }
    }
    resolveEntityCollision(colA, colB) {
        const distVec = new THREE.Vector3().subVectors(colB.position, colA.position); distVec.y = 0; const distance = distVec.length(); const totalRadius = colA.radius + colB.radius;
        if (distance < totalRadius) { const overlap = totalRadius - distance; const resolutionVec = distance > 0 ? distVec.normalize().multiplyScalar(overlap) : new THREE.Vector3(totalRadius, 0, 0); const totalWeight = colA.weight + colB.weight; colA.position.sub(resolutionVec.clone().multiplyScalar(colB.weight / totalWeight)); colB.position.add(resolutionVec.clone().multiplyScalar(colA.weight / totalWeight)); }
    }
    applyPostPhysicsUpdates(camera) {
        camera.position.copy(this.playerCollider.position);
    }
    interact() {
        const playerPos = this.playerCollider.position;
        let nearestDoor = null;
        let nearestDist = Infinity;
        for (const door of window.game.entities.doors) {
            if (door.state !== 'closed' && door.state !== 'closing') continue;
            const dist = playerPos.distanceTo(door.meshGroup.position);
            if (dist < nearestDist) {
                nearestDist = dist;
                nearestDoor = door;
            }
        }
        if (nearestDoor && nearestDist < 2.0) {
            nearestDoor.open();
            return true;
        }
        return false;
    }
    createRagdoll(characterMesh) {
        const ragdollParts = []; characterMesh.group.updateWorldMatrix(true, true);
        for (const partName in characterMesh.parts) {
            const partGroup = characterMesh.parts[partName]; const sourceMesh = partGroup.children.find(c => c.isMesh); if (!sourceMesh) continue; const newGeo = sourceMesh.geometry.clone(); const newMats = Array.isArray(sourceMesh.material) ? sourceMesh.material.map(m => m.clone()) : sourceMesh.material.clone(); if(Array.isArray(newMats)) newMats.forEach(m => {m.transparent = true;}); else newMats.transparent = true; const newMesh = new THREE.Mesh(newGeo, newMats); const position = new THREE.Vector3(), quaternion = new THREE.Quaternion(), scale = new THREE.Vector3(); partGroup.matrixWorld.decompose(position, quaternion, scale); newMesh.position.copy(position); newMesh.quaternion.copy(quaternion); newMesh.scale.copy(scale); const ragdollPart = { mesh: newMesh, velocity: new THREE.Vector3(0, 0, 0), angularVelocity: new THREE.Vector3( (Math.random() - 0.5) * 0.05, (Math.random() - 0.5) * 0.05, (Math.random() - 0.5) * 0.05 ), lifetime: 180 }; ragdollParts.push(ragdollPart); window.game.scene.add(newMesh);
        }
        this.ragdolls.push(ragdollParts);
    }
    updateRagdolls() {
        for (let i = this.ragdolls.length - 1; i >= 0; i--) {
            const parts = this.ragdolls[i];
            for (let j = parts.length - 1; j >= 0; j--) {
                const part = parts[j]; part.lifetime--;
                if (part.lifetime <= 0) {
                    window.game.scene.remove(part.mesh); part.mesh.geometry.dispose(); if(Array.isArray(part.mesh.material)) part.mesh.material.forEach(m => { if(m.map) m.map.dispose(); m.dispose(); }); else { if(part.mesh.material.map) part.mesh.material.map.dispose(); part.mesh.material.dispose(); } parts.splice(j, 1); continue;
                }
                if (part.lifetime < 60) { const opacity = part.lifetime / 60; if(Array.isArray(part.mesh.material)) part.mesh.material.forEach(m => m.opacity = opacity); else part.mesh.material.opacity = opacity; }
                part.velocity.y -= GAME_GLOBAL_CONSTANTS.ELEVATION.NPC_GRAVITY; part.mesh.position.add(part.velocity); part.mesh.rotation.x += part.angularVelocity.x; part.mesh.rotation.y += part.angularVelocity.y; part.mesh.rotation.z += part.angularVelocity.z; const groundHeight = this.getGroundHeight(part.mesh.position.x, part.mesh.position.z); this._ragdollBox.setFromObject(part.mesh); const halfHeight = (this._ragdollBox.max.y - this._ragdollBox.min.y) / 2;
                if (part.mesh.position.y - halfHeight < groundHeight) { part.mesh.position.y = groundHeight + halfHeight; part.velocity.y *= -0.5; part.velocity.x *= 0.9; part.velocity.z *= 0.9; part.angularVelocity.multiplyScalar(0.9); }
            }
            if (parts.length === 0) this.ragdolls.splice(i, 1);
        }
    }
}

window.levelRenderer = new LevelRenderer();
window.physics = new PhysicsSystem();