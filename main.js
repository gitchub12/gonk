// BROWSERFIREFOXHIDE main.js
// Main game logic with master manifest loading and data-driven defaults.

let scene, camera, renderer, player;
let characters = new Map();
let characterDefs = {};
let selectedCharacter = null;
let selectedCharacterName = '';
let aimTarget = null;

let textureLoader = new THREE.TextureLoader();
let clock = new THREE.Clock();

const moveSpeed = 5;
const rotationSpeed = 0.002;
let moveState = { forward: 0, back: 0, left: 0, right: 0 };
let isMouseDown = false;
let prevMouseX = 0, prevMouseY = 0;

let animationStates = ['idle', 'walk', 'run', 'shoot', 'aim'];
let animationIndex = 0;
let currentWeaponIndex = 0;
let weaponList = [];
let isGameHud = false;
let availableSkins = {};
let currentSkinIndex = {};

let furnitureInstances = [];
let selectedFurnitureIndex = -1;

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

async function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    player = new THREE.Group();
    player.position.set(0, 1.6, 10);
    player.add(camera);
    scene.add(player);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshStandardMaterial({ color: 0x888888 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    scene.add(new THREE.GridHelper(100, 100));

    await loadGameAssets();
    setupUI();
    animate();
}

async function loadFurniture() {
    const furnitureLoader = new FurnitureLoader();
    furnitureInstances = await furnitureLoader.loadFromManifest('data/furniture.json');
    furnitureInstances.forEach(instance => {
        scene.add(instance);
    });
}

async function loadGameAssets() {
    await loadFurniture();
    
    try {
        const response = await fetch('data/characters.json');
        characterDefs = await response.json();
        const defaults = characterDefs._defaults || {};

        await discoverAllSkins(defaults.skinPath || 'data/skins/');

        for (const charKey in characterDefs) {
            if (charKey.startsWith('_')) continue;

            const def = characterDefs[charKey];
            const textureFile = def.texture || def.skinTexture;
            const texturePath = (defaults.skinPath || 'data/skins/') + textureFile;

            await assetManager.loadTexture(textureFile, texturePath);

            const gonkConfig = {
                skinTexture: textureFile,
                scaleX: def.scaleX,
                scaleY: def.scaleY,
                scaleZ: def.scaleZ
            };

            const modelType = def.minecraftModel || 'humanoid';
            const char = window.createGonkMesh(modelType, gonkConfig, new THREE.Vector3(...def.position), charKey);

            if (char) {
                const modelDefaults = (modelType === 'humanoid') ? defaults.humanoidWeaponOffsets : null;
                if (modelDefaults) {
                    char.weaponOffsets.position.set(modelDefaults.position.x, modelDefaults.position.y, modelDefaults.position.z);
                    char.weaponOffsets.rotation.set(modelDefaults.rotation.x, modelDefaults.rotation.y, modelDefaults.rotation.z);
                    char.weaponOffsets.scale = modelDefaults.scale;
                }
                if (def.defaultWeaponOffsets) {
                    const offsets = def.defaultWeaponOffsets;
                    char.weaponOffsets.position.set(offsets.position.x, offsets.position.y, offsets.position.z);
                    char.weaponOffsets.rotation.set(offsets.rotation.x, offsets.rotation.y, offsets.rotation.z);
                    char.weaponOffsets.scale = offsets.scale;
                }

                scene.add(char.group);
                characters.set(charKey, char);
                console.log(`${charKey} loaded.`);
            }
        }
    } catch (e) {
        console.error("Failed to load master character manifest:", e);
    }

    if (characters.size > 0) {
        selectCharacter(Object.keys(characterDefs).find(k => !k.startsWith('_')));
    }
    await initWeapons();
}

async function discoverAllSkins(skinPath) {
    availableSkins = {};
    currentSkinIndex = {};

    let allSkinFiles = [];
    try {
        const response = await fetch(skinPath);
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        allSkinFiles = Array.from(doc.querySelectorAll('a'))
            .filter(link => link.href.endsWith('.png'))
            .map(link => link.textContent)
            .sort();
    } catch (e) {
        console.error(`Could not discover skins from path: ${skinPath}.`, e);
        return;
    }

    for (const charKey in characterDefs) {
        if (charKey.startsWith('_')) continue;
        const def = characterDefs[charKey];
        availableSkins[charKey] = [];
        currentSkinIndex[charKey] = 0;
        const searchNames = [charKey.toLowerCase(), ...(def.skinAliases || [])];
        const charSkins = allSkinFiles.filter(fileName => {
            const lowerFileName = fileName.toLowerCase();
            return searchNames.some(searchName => lowerFileName.startsWith(searchName));
        });

        if (charSkins.length > 0) {
             availableSkins[charKey] = charSkins;
            for(const skinFile of charSkins) {
                await assetManager.loadTexture(skinFile, skinPath + skinFile);
            }
        } else {
            if (def.texture) {
                availableSkins[charKey] = [def.texture];
            }
        }

        const defaultTexture = def.texture || def.skinTexture;
        const defaultIndex = availableSkins[charKey].indexOf(defaultTexture);
        if (defaultIndex !== -1) {
            currentSkinIndex[charKey] = defaultIndex;
        }
    }
}

async function initWeapons() {
    let weaponOverrides = {};
    let categoryDefaults = {};

    try {
        const response = await fetch('data/weapons.json');
        const manifest = await response.json();
        weaponOverrides = manifest;
        categoryDefaults = manifest._defaults?.categoryDefaults || {};
    } catch (e) {
        console.log("No weapon override manifest found or failed to load. Using dynamic discovery only.");
    }

    try {
        const response = await fetch('data/weapons/');
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const links = Array.from(doc.querySelectorAll('a'));

        const weaponPromises = links
            .filter(link => link.href.endsWith('.png'))
            .map(async link => {
                const file = link.textContent;
                const name = file.replace('.png', '');
                const category = name.split('_')[0];
                let config = {
                    name,
                    file,
                    category,
                    ...(categoryDefaults[category] || {})
                };
                if (weaponOverrides[name]) {
                    config = { ...config, ...weaponOverrides[name] };
                }
                const path = `data/weapons/${config.file}`;
                await window.weaponIcons.createWeaponFromPNG(name + '_smooth', path, { ...config, mode: 'smooth' });
                weaponList.push(name + '_smooth');
            });
        await Promise.all(weaponPromises);
    } catch (e) {
        console.error("Could not dynamically discover weapons. The server may not support directory listing.", e);
    }

    console.log(`Loaded ${weaponList.length} weapon variants dynamically.`);
    updateWeaponDisplay();
}

function selectCharacter(name) {
    if (!characters.has(name) || !name) return;
    selectedCharacterName = name;
    selectedCharacter = characters.get(name);
    document.getElementById('charState').textContent = name;
    aimTarget = null;
    applyCharacterWeaponDefaults();
    updateAimDisplay();
    updateWeaponDisplay();
    updateSkinDisplay();
}

function updateSkinDisplay() {
    const skinStateEl = document.getElementById('skinState');
    if (skinStateEl && selectedCharacterName) {
        const skins = availableSkins[selectedCharacterName] || [];
        const currentIndex = currentSkinIndex[selectedCharacterName] || 0;
        const currentSkin = skins[currentIndex] || 'default';

        const displayName = currentSkin.replace('.png', '');
        skinStateEl.textContent = `${displayName} (${currentIndex + 1}/${skins.length})`;
    }
}

function cycleFurniture() {
    if (furnitureInstances.length === 0) return;
    selectedFurnitureIndex = (selectedFurnitureIndex + 1) % furnitureInstances.length;
    const targetFurniture = furnitureInstances[selectedFurnitureIndex];
    
    const offset = new THREE.Vector3(0, 5, 10);
    const targetPosition = targetFurniture.position.clone().add(offset);
    player.position.copy(targetPosition);

    const lookAtPosition = targetFurniture.position.clone();
    player.lookAt(lookAtPosition);
    camera.rotation.x = -0.4;
}

function toggleHUD() {
    isGameHud = !isGameHud;
    const testingElements = document.querySelectorAll('.testing-hud');
    const gameElements = document.querySelectorAll('.game-hud');
    testingElements.forEach(el => el.style.display = isGameHud ? 'none' : 'block');
    gameElements.forEach(el => el.style.display = isGameHud ? 'block' : 'none');
    if (isGameHud) updateGameHudInfo();
}

function updateGameHudInfo() {
    const weaponEl = document.getElementById('gameHudWeapon');
    const ammoEl = document.getElementById('gameHudAmmo');

    if (weaponEl) {
        const weaponName = selectedCharacter?.weapon ? 
            weaponList[currentWeaponIndex].replace(/_/g, ' ').toUpperCase() : 'NO WEAPON';
        weaponEl.textContent = weaponName;
    }
    if (ammoEl) ammoEl.textContent = '31 / 200';
}

function setupUI() {
    document.addEventListener('keydown', e => onKey(e, true));
    document.addEventListener('keyup', e => onKey(e, false));
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('mousemove', onMouseMove);
    window.addEventListener('resize', onWindowResize);

    ['posX', 'posY', 'posZ', 'rotX', 'rotY', 'rotZ', 'scale'].forEach(id => {
        document.getElementById(id).addEventListener('input', updateWeaponFromEditor);
    });

    document.getElementById('snapshotBtn').addEventListener('click', () => {
        if (!selectedCharacter) return;
        const offsets = selectedCharacter.weaponOffsets;
        console.log(`--- WEAPON OFFSET SNAPSHOT FOR ${selectedCharacterName} ---`);
        console.log(`Position: { x: ${offsets.position.x.toFixed(4)}, y: ${offsets.position.y.toFixed(4)}, z: ${offsets.position.z.toFixed(4)} }`);
        console.log(`Rotation (rad): { x: ${offsets.rotation.x.toFixed(4)}, y: ${offsets.rotation.y.toFixed(4)}, z: ${offsets.rotation.z.toFixed(4)} }`);
        console.log(`Scale: ${offsets.scale.toFixed(4)}`);
    });

    document.getElementById('resetWeaponBtn').addEventListener('click', resetWeaponEditor);
    document.getElementById('resetCharBtn').addEventListener('click', () => {
        if (!selectedCharacter) return;
        selectedCharacter.group.rotation.set(0, 0, 0);
        window.setGonkAnimation(selectedCharacter, 'idle');
        animationIndex = 0;
        updateAnimationDisplay();
    });

    document.getElementById('aimBtn_0').addEventListener('click', () => setAimTarget('camera'));
    const charKeys = Object.keys(characterDefs).filter(k => !k.startsWith('_'));
    charKeys.forEach((charKey, i) => {
        const btn = document.getElementById(`aimBtn_${i + 1}`);
        if(btn) btn.addEventListener('click', () => setAimTarget(charKey));
    });
    document.getElementById('aimBtn_clear').addEventListener('click', () => setAimTarget(null));
}

function setAimTarget(targetName) {
    if (selectedCharacterName === targetName) { aimTarget = null; } 
    else { aimTarget = targetName; }
    if (aimTarget && selectedCharacter && !selectedCharacter.modelDef.parts.slimeBody) {
        animationIndex = animationStates.indexOf('aim');
        window.setGonkAnimation(selectedCharacter, 'aim');
        updateAnimationDisplay();
    }
    updateAimDisplay();
}

function updateWeaponFromEditor() {
    if (!selectedCharacter || selectedCharacter.modelDef.parts.slimeBody) return;
    const offsets = selectedCharacter.weaponOffsets;
    offsets.position.x = parseFloat(document.getElementById('posX').value);
    offsets.position.y = parseFloat(document.getElementById('posY').value);
    offsets.position.z = parseFloat(document.getElementById('posZ').value);
    offsets.rotation.x = THREE.MathUtils.degToRad(parseFloat(document.getElementById('rotX').value));
    offsets.rotation.y = THREE.MathUtils.degToRad(parseFloat(document.getElementById('rotY').value));
    offsets.rotation.z = THREE.MathUtils.degToRad(parseFloat(document.getElementById('rotZ').value));
    offsets.scale = parseFloat(document.getElementById('scale').value);
    applyWeaponOffsets();
    updateEditorDisplay();
}

function applyWeaponOffsets() {
    if (!selectedCharacter?.weapon) return;
    const { baseOffset, baseRotation } = selectedCharacter.weapon.userData;
    selectedCharacter.weapon.position.copy(baseOffset).add(selectedCharacter.weaponOffsets.position);
    selectedCharacter.weapon.rotation.copy(baseRotation).reorder('YXZ');
    selectedCharacter.weapon.rotation.x += selectedCharacter.weaponOffsets.rotation.x;
    selectedCharacter.weapon.rotation.y += selectedCharacter.weaponOffsets.rotation.y;
    selectedCharacter.weapon.rotation.z += selectedCharacter.weaponOffsets.rotation.z;
    selectedCharacter.weapon.scale.setScalar(selectedCharacter.weaponOffsets.scale);
}

function updateEditorDisplay() {
    if (!selectedCharacter) return;
    const { position, rotation, scale } = selectedCharacter.weaponOffsets;
    document.getElementById('posX_val').textContent = position.x.toFixed(2);
    document.getElementById('posY_val').textContent = position.y.toFixed(2);
    document.getElementById('posZ_val').textContent = position.z.toFixed(2);
    document.getElementById('rotX_val').textContent = THREE.MathUtils.radToDeg(rotation.x).toFixed(1);
    document.getElementById('rotY_val').textContent = THREE.MathUtils.radToDeg(rotation.y).toFixed(1);
    document.getElementById('rotZ_val').textContent = THREE.MathUtils.radToDeg(rotation.z).toFixed(1);
    document.getElementById('scale_val').textContent = scale.toFixed(2);
}

function updateEditorFromCharacter() {
    if (!selectedCharacter) return;
    const { position, rotation, scale } = selectedCharacter.weaponOffsets;
    document.getElementById('posX').value = position.x;
    document.getElementById('posY').value = position.y;
    document.getElementById('posZ').value = position.z;
    document.getElementById('rotX').value = THREE.MathUtils.radToDeg(rotation.x);
    document.getElementById('rotY').value = THREE.MathUtils.radToDeg(rotation.y);
    document.getElementById('rotZ').value = THREE.MathUtils.radToDeg(rotation.z);
    document.getElementById('scale').value = scale;
    updateEditorDisplay();
}

function applyCharacterWeaponDefaults() {
    if (!selectedCharacter) return;
    const charDef = characterDefs[selectedCharacterName];
    const modelType = charDef.minecraftModel || 'humanoid';
    const weaponName = weaponList[currentWeaponIndex];
    const weaponTemplate = window.weaponIcons.loadedWeapons.get(weaponName);
    const weaponConfig = weaponTemplate?.userData.config;
    const weaponCategory = weaponConfig?.category;
    let dataToApply = null;
    if (weaponConfig?.offsets) dataToApply = weaponConfig.offsets;
    else if (charDef.weaponOffsetByCategory?.[weaponCategory]) dataToApply = charDef.weaponOffsetByCategory[weaponCategory];
    else if (characterDefs._defaults.weaponOffsetByCategory?.[weaponCategory]) dataToApply = characterDefs._defaults.weaponOffsetByCategory[weaponCategory];
    else if (modelType === 'humanoid' && characterDefs._defaults.humanoidWeaponOffsets) dataToApply = characterDefs._defaults.humanoidWeaponOffsets;
    if (dataToApply) {
        selectedCharacter.weaponOffsets.position.set(dataToApply.position.x, dataToApply.position.y, dataToApply.position.z);
        selectedCharacter.weaponOffsets.rotation.set(dataToApply.rotation.x, dataToApply.rotation.y, dataToApply.rotation.z);
        selectedCharacter.weaponOffsets.scale = dataToApply.scale;
    } else {
        selectedCharacter.weaponOffsets.position.set(0,0,0);
        selectedCharacter.weaponOffsets.rotation.set(0,0,0);
        selectedCharacter.weaponOffsets.scale = 1.0;
    }
    updateEditorFromCharacter();
    applyWeaponOffsets();
}

function resetWeaponEditor() { applyCharacterWeaponDefaults(); }

function attachCurrentWeapon() {
    if (!selectedCharacter || weaponList.length === 0 ) return;
    if (selectedCharacter.modelDef.parts.slimeBody) {
        if(selectedCharacter.weapon) window.weaponIcons.removeWeapon(selectedCharacter);
        updateWeaponDisplay();
        return;
    }
    applyCharacterWeaponDefaults();
    window.weaponIcons.attachToCharacter(selectedCharacter, weaponList[currentWeaponIndex]);
    applyWeaponOffsets();
    updateWeaponDisplay();
}

function updateAnimationDisplay() { document.getElementById('animState').textContent = animationStates[animationIndex]; }
function updateWeaponDisplay() { const el = document.getElementById('weaponState'); el.textContent = selectedCharacter?.weapon ? weaponList[currentWeaponIndex].replace(/_/g, ' ') : 'none'; }
function updateAimDisplay() { const el = document.getElementById('aimState'); const targetDef = characterDefs[aimTarget]; el.textContent = targetDef ? targetDef.name : (aimTarget || 'None'); }
function onWindowResize() { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); }

function onKey(event, isDown) {
    const state = isDown ? 1 : 0;
    switch (event.code) {
        case 'KeyW': moveState.forward = state; break;
        case 'KeyS': moveState.back = state; break;
        case 'KeyA': moveState.left = state; break;
        case 'KeyD': moveState.right = state; break;
    }

    if (isDown) {
        const charKeys = Object.keys(characterDefs).filter(k => !k.startsWith('_'));
        switch (event.code) {
            case 'KeyY': cycleFurniture(); break;
            case 'KeyH': toggleHUD(); break;
            case 'Space':
                animationIndex = (animationIndex + 1) % animationStates.length;
                if (selectedCharacter) {
                    if (selectedCharacter.modelDef.parts.slimeBody && (animationStates[animationIndex] === 'aim' || animationStates[animationIndex] === 'shoot')) animationIndex = 0;
                    window.setGonkAnimation(selectedCharacter, animationStates[animationIndex]);
                    if (animationStates[animationIndex] !== 'aim') { aimTarget = null; updateAimDisplay(); }
                }
                updateAnimationDisplay();
                break;
            case 'KeyQ':
                if (weaponList.length > 0) {
                    currentWeaponIndex = (currentWeaponIndex + 1) % weaponList.length;
                    attachCurrentWeapon();
                    if (isGameHud) updateGameHudInfo();
                }
                break;
            case 'KeyE':
                if (selectedCharacter && !selectedCharacter.modelDef.parts.slimeBody) {
                    if (selectedCharacter.weapon) window.weaponIcons.removeWeapon(selectedCharacter);
                    else attachCurrentWeapon();
                    if (isGameHud) updateGameHudInfo();
                }
                break;
            case 'KeyT': break;
            case 'KeyR': player.position.set(0, 1.6, 10); player.rotation.set(0,0,0); camera.rotation.set(0,0,0); break;
            case 'Digit1': selectCharacter(charKeys[0]); break;
            case 'Digit2': selectCharacter(charKeys[1]); break;
            case 'Digit3': selectCharacter(charKeys[2]); break;
            case 'Digit4': selectCharacter(charKeys[3]); break;
            case 'Digit5': selectCharacter(charKeys[4]); break;
            case 'Digit6': selectCharacter(charKeys[5]); break;
            case 'Digit7': selectCharacter(charKeys[6]); break;
        }
    }
}

function onMouseDown(event) { if (event.target.closest('.ui-panel')) return; isMouseDown = true; prevMouseX = event.clientX; prevMouseY = event.clientY; }
function onMouseUp(event) { isMouseDown = false; }
function onMouseMove(event) {
    if (!isMouseDown) return;
    const deltaX = event.clientX - prevMouseX;
    const deltaY = event.clientY - prevMouseY;
    player.rotation.y -= deltaX * rotationSpeed;
    camera.rotation.x -= deltaY * rotationSpeed;
    camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, camera.rotation.x));
    prevMouseX = event.clientX;
    prevMouseY = event.clientY;
}

function animate() {
    requestAnimationFrame(animate);
    const deltaTime = clock.getDelta();
    const moveDirection = new THREE.Vector3(moveState.right - moveState.left, 0, moveState.back - moveState.forward);
    moveDirection.normalize().applyEuler(player.rotation).multiplyScalar(moveSpeed * deltaTime);
    player.position.add(moveDirection);
    let targetWorldPos = null;
    if (aimTarget) {
        if (aimTarget === 'camera') camera.getWorldPosition(targetWorldPos = new THREE.Vector3());
        else if (characters.has(aimTarget)) {
            const aimPart = characters.get(aimTarget).parts.head || characters.get(aimTarget).parts.slimeBody;
            if (aimPart) aimPart.getWorldPosition(targetWorldPos = new THREE.Vector3());
        }
    }
    characters.forEach((char) => {
        let options = { deltaTime };
        if (char === selectedCharacter) {
            options.isPlayer = true;
            if (targetWorldPos && !selectedCharacter.modelDef.parts.slimeBody) options.target = targetWorldPos;
        }
        window.updateGonkAnimation(char, options);
    });
    renderer.render(scene, camera);
}

window.onload = init;