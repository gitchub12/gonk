// BROWSERFIREFOXHIDE main.js
// Main Game Logic - Supports Character Viewer and Level Player modes.

// --- Asset Manager (Shared) ---
const textureLoader = new THREE.TextureLoader();
const assetManager = {
    textures: {},
    getTexture: function(name) { return this.textures[name]; },
    loadTexture: function(name, path) {
        return new Promise((resolve, reject) => {
            if (this.textures[name]) return resolve(this.textures[name]);
            textureLoader.load(path, texture => {
                texture.magFilter = THREE.NearestFilter;
                texture.minFilter = THREE.NearestFilter;
                this.textures[name] = texture;
                resolve(texture);
            }, undefined, err => { console.error(`Failed to load: ${path}`); reject(err); });
        });
    }
};
window.assetManager = assetManager;

// --- Level Player Logic ---
class LevelPlayer {
    constructor() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x111111);
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.player = new THREE.Group();
        this.player.add(this.camera);
        this.scene.add(this.player);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(this.renderer.domElement);
        
        const ambient = new THREE.AmbientLight(0xffffff, 0.7);
        this.scene.add(ambient);
        const sun = new THREE.DirectionalLight(0xffffff, 0.5);
        sun.position.set(50, 50, 50);
        this.scene.add(sun);

        this.raycaster = new THREE.Raycaster();
        this.clock = new THREE.Clock();
        this.moveState = { forward: 0, backward: 0, left: 0, right: 0 };
        this.playerSpeed = 8;
        this.levelObjects = { walls: [], doors: [], interactables: [] };
        this.interactionPrompt = document.getElementById('interaction-prompt');

        this.characterDefs = null;
        this.furnitureLoader = new FurnitureLoader();
        
        document.querySelectorAll('.player-hud').forEach(el => el.style.display = 'block');
        this.setupControls();
        this.loadLevel();
        this.animate();
    }

    setupControls() {
        document.addEventListener('keydown', e => this.onKey(e, true));
        document.addEventListener('keyup', e => this.onKey(e, false));
        document.addEventListener('mousemove', e => this.onMouseMove(e));
        document.body.addEventListener('click', () => document.body.requestPointerLock());
    }

    async loadLevel() {
        const levelDataString = localStorage.getItem('gonk_level_to_play');
        if (!levelDataString) {
            alert("No level found to play. Launch from the editor's PLAY button.");
            return;
        }
        const levelData = JSON.parse(levelDataString);

        // Fetch manifests
        const [charResponse, furnitureResponse] = await Promise.all([
            fetch('data/characters.json'),
            fetch('data/furniture.json')
        ]);
        this.characterDefs = await charResponse.json();
        const furnitureManifest = await furnitureResponse.json();

        // Discover and load all required assets
        const texturePaths = new Set();
        const npcSkins = new Set();
        const furnitureModels = new Set();

        if (levelData.layers) {
            for (const layerName in levelData.layers) {
                for (const [, item] of levelData.layers[layerName]) {
                    if (item.key && item.key.endsWith('.png')) texturePaths.add(item.key);
                    if (layerName === 'npcs') npcSkins.add(item.key);
                    if (layerName === 'assets') furnitureModels.add(item.key);
                }
            }
        }
        
        // Load textures
        const texturePromises = [...texturePaths].map(path => assetManager.loadTexture(path, path));
        const npcSkinPromises = [...npcSkins].map(skin => assetManager.loadTexture(skin, `data/skins/${skin}`));
        await Promise.all([...texturePromises, ...npcSkinPromises]);

        // Load furniture models
        const furnitureModelPromises = [...furnitureModels].map(modelKey => {
            const modelDef = furnitureManifest.models[modelKey];
            if(modelDef) return this.furnitureLoader.loadModel(modelKey, modelDef);
        });
        await Promise.all(furnitureModelPromises);

        this.buildLevel(levelData);
    }

    buildLevel(levelData) {
        const gs = 1, wallHeight = 2.5;

        // Set player spawn
        const spawnLayer = levelData.layers.spawns || [];
        if (spawnLayer.length > 0) {
            const [posStr, item] = spawnLayer[0];
            const [x, y] = posStr.split(',').map(Number);
            this.player.position.set(x * gs + gs / 2, wallHeight / 2, y * gs + gs / 2);
            this.player.rotation.y = (item.rotation || 0) * -Math.PI / 2;
        }

        if (!levelData.layers) return;

        for (const layerName in levelData.layers) {
            const items = levelData.layers[layerName];
            for (const [key, item] of items) {
                const texture = item.key ? assetManager.getTexture(item.key) : null;
                const material = texture ? new THREE.MeshLambertMaterial({ map: texture }) : new THREE.MeshLambertMaterial({ color: 0xff00ff });

                if (['floor', 'subfloor', 'ceiling'].includes(layerName)) {
                    const geom = new THREE.PlaneGeometry(gs, gs);
                    const mesh = new THREE.Mesh(geom, material);
                    const yPos = layerName === 'floor' ? 0 : (layerName === 'ceiling' ? wallHeight : -0.01);
                    mesh.position.set(key.split(',').map(Number)[0] * gs + gs / 2, yPos, key.split(',').map(Number)[1] * gs + gs / 2);
                    mesh.rotation.x = -Math.PI / 2;
                    this.scene.add(mesh);
                } else if (layerName === 'walls') {
                    const [type, xStr, yStr] = key.split('_');
                    const x = Number(xStr); const y = Number(yStr);
                    const isDoor = item.key.includes('/door/');
                    const geom = new THREE.BoxGeometry(type === 'H' ? gs : 0.1, wallHeight, type === 'V' ? gs : 0.1);
                    const mesh = new THREE.Mesh(geom, material);
                    mesh.position.set((type === 'H' ? x * gs + gs/2 : (x + 1) * gs), wallHeight / 2, (type === 'V' ? y * gs + gs/2 : (y + 1) * gs));
                    if (isDoor) {
                        mesh.isDoor = true; mesh.isOpen = false; mesh.userData = item.properties || {};
                        this.levelObjects.doors.push(mesh); this.levelObjects.interactables.push(mesh);
                    } else {
                        this.levelObjects.walls.push(mesh);
                    }
                    this.scene.add(mesh);
                } else if (layerName === 'water') {
                    const geom = new THREE.PlaneGeometry(gs, gs);
                    const waterMat = new THREE.MeshStandardMaterial({
                        map: texture,
                        color: 0x6699ff,
                        transparent: true,
                        opacity: 0.7,
                        roughness: 0.1,
                        metalness: 0.2
                    });
                    const mesh = new THREE.Mesh(geom, waterMat);
                    const [x, z] = key.split(',').map(Number);
                    mesh.position.set(x * gs + gs / 2, 0.4, z * gs + gs / 2);
                    mesh.rotation.x = -Math.PI / 2;
                    this.scene.add(mesh);
                } else if (layerName === 'npcs') {
                    const [x, z] = key.split(',').map(Number);
                    const skinName = item.key;
                    let charDef = Object.values(this.characterDefs).find(def => def.texture === skinName);
                    if (!charDef) charDef = { minecraftModel: 'humanoid' };

                    const char = window.createGonkMesh(
                        charDef.minecraftModel || 'humanoid',
                        { skinTexture: skinName },
                        new THREE.Vector3(x * gs + gs / 2, 0, z * gs + gs / 2),
                        skinName
                    );
                    if (char) {
                        char.group.rotation.y = (item.rotation || 0) * -Math.PI / 2;
                        this.scene.add(char.group);
                    }
                } else if (layerName === 'assets') {
                    const [x, z] = key.split(',').map(Number);
                    const instanceDef = {
                        model: item.key,
                        position: [x * gs + gs / 2, 0, z * gs + gs / 2],
                        rotation: [0, (item.rotation || 0) * -90, 0]
                    };
                    const instance = this.furnitureLoader.createInstance(instanceDef);
                    if (instance) this.scene.add(instance);
                }
            }
        }
    }
    
    onKey(e, isDown) {
        const state = isDown ? 1 : 0;
        switch(e.code) {
            case 'KeyW': this.moveState.forward = state; break;
            case 'KeyS': this.moveState.backward = state; break;
            case 'KeyA': this.moveState.left = state; break;
            case 'KeyD': this.moveState.right = state; break;
            case 'Space': if(isDown) this.interact(); break;
        }
    }

    onMouseMove(e) {
        if (document.pointerLockElement !== document.body) return;
        this.player.rotation.y -= (e.movementX || 0) * 0.002;
        this.camera.rotation.x -= (e.movementY || 0) * 0.002;
        this.camera.rotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, this.camera.rotation.x));
    }

    interact() {
        this.raycaster.setFromCamera({x:0, y:0}, this.camera);
        const intersects = this.raycaster.intersectObjects(this.levelObjects.interactables);
        if (intersects.length > 0 && intersects[0].distance < 2) {
            const obj = intersects[0].object;
            if (obj.isDoor) obj.isOpen = !obj.isOpen;
        }
    }

    update(deltaTime) {
        const moveDirection = new THREE.Vector3(this.moveState.right - this.moveState.left, 0, this.moveState.backward - this.moveState.forward);
        moveDirection.normalize().applyEuler(this.player.rotation).multiplyScalar(this.playerSpeed * deltaTime);
        this.player.position.add(moveDirection);
        this.levelObjects.doors.forEach(door => {
            const targetY = door.isOpen ? door.position.y + 2.5 : wallHeight / 2;
            door.position.y += (targetY - door.position.y) * 0.1;
        });
        this.raycaster.setFromCamera({x:0, y:0}, this.camera);
        const intersects = this.raycaster.intersectObjects(this.levelObjects.interactables);
        this.interactionPrompt.style.display = (intersects.length > 0 && intersects[0].distance < 2) ? 'block' : 'none';
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.update(this.clock.getDelta());
        this.renderer.render(this.scene, this.camera);
    }
}

// --- Character Viewer Logic ---
class CharacterViewer {
    constructor() {
        this.scene = null; this.camera = null; this.renderer = null; this.player = null;
        this.characters = new Map(); this.characterDefs = {};
        this.selectedCharacter = null; this.selectedCharacterName = '';
        this.aimTarget = null;
        this.clock = new THREE.Clock();
        this.moveSpeed = 5; this.rotationSpeed = 0.002;
        this.moveState = { forward: 0, back: 0, left: 0, right: 0 };
        this.isMouseDown = false; this.prevMouseX = 0; this.prevMouseY = 0;
        this.animationStates = ['idle', 'walk', 'run', 'shoot', 'aim'];
        this.animationIndex = 0;
        this.currentWeaponIndex = 0; this.weaponList = [];
        this.furnitureInstances = []; this.selectedFurnitureIndex = -1;

        document.querySelectorAll('.viewer-hud').forEach(el => el.style.display = 'block');
        this.init();
    }
    
    async init() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB);
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(this.renderer.domElement);
        this.player = new THREE.Group();
        this.player.position.set(0, 1.6, 10);
        this.player.add(this.camera);
        this.scene.add(this.player);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 10, 5);
        this.scene.add(directionalLight);

        const floor = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshStandardMaterial({ color: 0x888888 }));
        floor.rotation.x = -Math.PI / 2;
        this.scene.add(floor);
        this.scene.add(new THREE.GridHelper(100, 100));

        await this.loadGameAssets();
        this.setupUI();
        this.animate();
    }

    async loadGameAssets() {
        const furnitureLoader = new FurnitureLoader();
        this.furnitureInstances = await furnitureLoader.loadFromManifest('data/furniture.json');
        this.furnitureInstances.forEach(instance => this.scene.add(instance));

        const response = await fetch('data/characters.json');
        this.characterDefs = await response.json();
        const characterPromises = Object.keys(this.characterDefs).filter(k => !k.startsWith('_')).map(async charKey => {
            const def = this.characterDefs[charKey];
            const textureFile = def.texture || def.skinTexture;
            await assetManager.loadTexture(textureFile, `data/skins/${textureFile}`);
            const char = window.createGonkMesh(def.minecraftModel || 'humanoid', { skinTexture: textureFile }, new THREE.Vector3(...def.position), charKey);
            if (char) {
                this.scene.add(char.group);
                this.characters.set(charKey, char);
            }
        });
        await Promise.all(characterPromises);
        if (this.characters.size > 0) this.selectCharacter(this.characters.keys().next().value);
    }
    
    setupUI() {
        document.addEventListener('keydown', e => this.onKey(e, true));
        document.addEventListener('keyup', e => this.onKey(e, false));
        document.addEventListener('mousedown', e => this.onMouseDown(e));
        document.addEventListener('mouseup', () => this.isMouseDown = false);
        document.addEventListener('mousemove', e => this.onMouseMove(e));
        document.getElementById('snapshotBtn').addEventListener('click', () => console.log(this.selectedCharacter.weaponOffsets));
        document.getElementById('aimBtn_clear').addEventListener('click', () => this.setAimTarget(null));
        Object.keys(this.characterDefs).filter(k => !k.startsWith('_')).forEach((charKey, i) => {
            const btn = document.getElementById(`aimBtn_${i + 1}`);
            if(btn) btn.addEventListener('click', () => this.setAimTarget(charKey));
        });
    }

    selectCharacter(name) {
        if (!this.characters.has(name) || !name) return;
        this.selectedCharacterName = name;
        this.selectedCharacter = this.characters.get(name);
        document.getElementById('charState').textContent = name;
    }

    setAimTarget(targetName) {
        this.aimTarget = (this.selectedCharacterName === targetName) ? null : targetName;
        document.getElementById('aimState').textContent = this.aimTarget || 'None';
    }

    onKey(e, isDown) {
        const state = isDown ? 1 : 0;
        switch(e.code) {
            case 'KeyW': this.moveState.forward = state; break; case 'KeyS': this.moveState.back = state; break;
            case 'KeyA': this.moveState.left = state; break; case 'KeyD': this.moveState.right = state; break;
        }
        if(isDown) {
            const charKeys = [...this.characters.keys()];
            switch(e.code) {
                case 'Space': this.animationIndex = (this.animationIndex + 1) % this.animationStates.length; if(this.selectedCharacter) window.setGonkAnimation(this.selectedCharacter, this.animationStates[this.animationIndex]); document.getElementById('animState').textContent = this.animationStates[this.animationIndex]; break;
                case 'KeyR': this.player.position.set(0, 1.6, 10); this.player.rotation.set(0,0,0); this.camera.rotation.set(0,0,0); break;
                case `Digit${charKeys.indexOf('stormtrooper')+1}`: this.selectCharacter('stormtrooper'); break;
                case `Digit${charKeys.indexOf('wookiee')+1}`: this.selectCharacter('wookiee'); break;
                case `Digit${charKeys.indexOf('gungan')+1}`: this.selectCharacter('gungan'); break;
                // Add other character selections if needed
            }
        }
    }

    onMouseDown(e) { if (!e.target.closest('.ui-panel')) { this.isMouseDown = true; this.prevMouseX = e.clientX; this.prevMouseY = e.clientY; }}
    onMouseMove(e) {
        if (!this.isMouseDown) return;
        const deltaX = e.clientX - this.prevMouseX; const deltaY = e.clientY - this.prevMouseY;
        this.player.rotation.y -= deltaX * this.rotationSpeed;
        this.camera.rotation.x -= deltaY * this.rotationSpeed;
        this.camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.camera.rotation.x));
        this.prevMouseX = e.clientX; this.prevMouseY = e.clientY;
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        const deltaTime = this.clock.getDelta();
        const moveDirection = new THREE.Vector3(this.moveState.right - this.moveState.left, 0, this.moveState.back - this.moveState.forward);
        moveDirection.normalize().applyEuler(this.player.rotation).multiplyScalar(this.moveSpeed * deltaTime);
        this.player.position.add(moveDirection);
        this.characters.forEach(char => window.updateGonkAnimation(char, {deltaTime}));
        this.renderer.render(this.scene, this.camera);
    }
}

// --- Startup Router ---
window.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('play') === 'true') {
        new LevelPlayer();
    } else {
        new CharacterViewer();
    }
});