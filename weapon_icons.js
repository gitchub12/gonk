// BROWSERFIREFOXHIDE weapon_icons.js
// PNG-to-3D weapon system with dynamic, anatomy-based positioning.

class WeaponIconSystem {
    constructor() {
        this.loadedWeapons = new Map();
        this.defaultPoses = {
            pistol: { position: new THREE.Vector3(0, -1, 4), rotation: new THREE.Euler(Math.PI / 2, 0, Math.PI, 'YXZ') },
            rifle: { position: new THREE.Vector3(0, 0, 4), rotation: new THREE.Euler(Math.PI / 2, 0, Math.PI, 'YXZ') },
            melee: { position: new THREE.Vector3(0, -2, 2), rotation: new THREE.Euler(Math.PI / 4, 0, Math.PI, 'YXZ') },
            saber: { position: new THREE.Vector3(0, -2, 2), rotation: new THREE.Euler(Math.PI / 4, 0, Math.PI, 'YXZ') },
            long: { position: new THREE.Vector3(0, 0, 4), rotation: new THREE.Euler(Math.PI / 2, 0, Math.PI, 'YXZ') },
            unique: { position: new THREE.Vector3(0, 0, 4), rotation: new THREE.Euler(Math.PI / 2, 0, Math.PI, 'YXZ') }
        };
        if (typeof window.Logger === 'undefined') {
            window.Logger = { debug: console.log, info: console.info, warn: console.warn, error: console.error };
        }
    }

    async createWeaponFromPNG(weaponName, pngPath, config = {}) {
        const texture = await window.assetManager.loadTexture(weaponName, pngPath);
        const canvas = document.createElement('canvas');
        canvas.width = texture.image.width;
        canvas.height = texture.image.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(texture.image, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let weaponGroup;
        if (config.mode === 'smooth') weaponGroup = this.buildExtrudedWeapon(imageData, texture, config);
        else weaponGroup = this.buildWeaponMesh(imageData, config);
        weaponGroup.userData.config = config;
        weaponGroup.userData.isWeapon = true;
        this.loadedWeapons.set(weaponName, weaponGroup);
        return weaponGroup;
    }

    traceContour(imageData) {
        const { width, height, data } = imageData;
        const isOpaque = (x, y) => { if (x < 0 || x >= width || y < 0 || y >= height) return false; return data[(y * width + x) * 4 + 3] > 128; };
        let startX = -1, startY = -1;
        for (let y = 0; y < height && startY === -1; y++) for (let x = 0; x < width && startX === -1; x++) if (isOpaque(x, y)) { startX = x; startY = y; }
        if (startX === -1) return null;
        const path = [];
        let x = startX, y = startY, dir = 0;
        const directions = [[1, 0], [0, 1], [-1, 0], [0, -1]];
        const turns = [3, 0, 1, 2];
        let sanity = 0;
        const maxSteps = width * height;
        do {
            path.push({x, y});
            dir = turns[dir];
            for (let i = 0; i < 4; i++) {
                const nextX = x + directions[dir][0], nextY = y + directions[dir][1];
                if (isOpaque(nextX, nextY)) { x = nextX; y = nextY; break; }
                dir = (dir + 1) % 4;
            }
            sanity++;
        } while ((x !== startX || y !== startY) && sanity < maxSteps);
        return path;
    }

    buildExtrudedWeapon(imageData, texture, config) {
        const { width, height } = imageData;
        const weaponGroup = new THREE.Group();
        const contour = this.traceContour(imageData);
        if (!contour) return weaponGroup;
        let minX = width, maxX = 0, minY = height, maxY = 0;
        for(const p of contour) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
        const contentH = maxY - minY + 1;
        const weaponHeight = config.height || 4;
        const pixelSize = weaponHeight / contentH;
        const scaleMultiplier = 0.5;
        const shapePoints = contour.map(p => new THREE.Vector2(p.x, -p.y));
        const shape = new THREE.Shape(shapePoints);
        const extrudeSettings = { depth: config.thickness || 1, bevelEnabled: false };
        const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        const uv = geometry.attributes.uv;
        for (let i = 0; i < uv.count; i++) {
            const u = uv.getX(i) / width, v = 1 + (uv.getY(i) / height);
            uv.setXY(i, u, v);
        }
        geometry.center();
        const faceMaterial = new THREE.MeshStandardMaterial({ map: texture, side: THREE.DoubleSide, transparent: true, alphaTest: 0.1 });
        const sideMaterial = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.6, metalness: 0.7 });
        const mesh = new THREE.Mesh(geometry, [faceMaterial, sideMaterial]);
        weaponGroup.add(mesh);
        weaponGroup.scale.setScalar(pixelSize * scaleMultiplier);
        return weaponGroup;
    }

    buildWeaponMesh(imageData, config) {
        const weaponGroup = new THREE.Group();
        const { width, height, data } = imageData;
        let minX = width, maxX = 0, minY = height, maxY = 0;
        for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (data[(y * width + x) * 4 + 3] > 128) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
        const contentW = maxX - minX + 1, contentH = maxY - minY + 1;
        const weaponHeight = config.height || 4;
        const pixelSize = weaponHeight / contentH;
        const thickness = config.thickness || 1;
        const blockSize = config.blockSize || 4;
        for (let py = minY; py <= maxY; py += blockSize) {
            for (let px = minX; px <= maxX; px += blockSize) {
                const idx = (py * width + px) * 4;
                if (data[idx + 3] > 128) {
                    const color = new THREE.Color(data[idx]/255, data[idx+1]/255, data[idx+2]/255);
                    const voxelGeo = new THREE.BoxGeometry(thickness, pixelSize * blockSize, pixelSize * blockSize);
                    const voxelMat = new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.2 });
                    const voxel = new THREE.Mesh(voxelGeo, voxelMat);
                    voxel.position.set(0, (-(py - minY) + contentH / 2) * pixelSize, ((px - minX) - contentW / 2) * pixelSize);
                    weaponGroup.add(voxel);
                }
            }
        }
        weaponGroup.userData = { config, bounds: { minX, maxX, minY, maxY, contentW, contentH } };
        weaponGroup.userData.isWeapon = true;
        return weaponGroup;
    }

    attachToCharacter(character, weaponName) {
        const weaponTemplate = this.loadedWeapons.get(weaponName);
        if (!weaponTemplate) return;
        if (character.weapon) this.removeWeapon(character);
        const weaponMesh = weaponTemplate.clone();
        const { config } = weaponMesh.userData;
        const category = config.category || 'rifle';
        const pose = this.defaultPoses[category] || this.defaultPoses.rifle;
        const armLength = character.modelDef.parts.rightArm.size[1];
        const scaledArmY = armLength * character.dimensionScale.y;
        const baseOffset = new THREE.Vector3(0, -scaledArmY, 0).add(pose.position);
        weaponMesh.userData.baseOffset = baseOffset;
        weaponMesh.userData.baseRotation = pose.rotation.clone();
        character.weapon = weaponMesh;
        character.parts.rightArm.add(weaponMesh);
    }

    removeWeapon(character) {
        if (character.weapon) {
            character.parts.rightArm.remove(character.weapon);
            character.weapon = null;
        }
    }
}
window.weaponIcons = new WeaponIconSystem();