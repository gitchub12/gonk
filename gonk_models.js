// BROWSERFIREFOXHIDE gonk_models.js
// gonk_models.js
// Finalized. Minecraft-style character model system with full skin format support.

class GonkModelSystem {
  constructor() {
    this.models = this.defineModels();
    if (typeof window.Logger === 'undefined') {
        window.Logger = {
            debug: console.log, info: console.info, warn: console.warn, error: console.error
        };
    }
    Logger.debug('Gonk Model System initialized.');
  }

  defineModels() {
    return {
      humanoid: {
        parts: {
          head: { size: [8, 8, 8], position: [0, 6, 0], pivot: [0, 0, 0], parent: 'body' },
          body: { size: [8, 12, 4], position: [0, 0, 0], pivot: [0, 0, 0], parent: null },
          rightArm: { size: [4, 12, 4], position: [6, 5, 0], pivot: [0, 0, 0], parent: 'body' },
          leftArm: { size: [4, 12, 4], position: [-6, 5, 0], pivot: [0, 0, 0], parent: 'body' },
          rightLeg: { size: [4, 12, 4], position: [2, -6, 0], pivot: [0, 0, 0], parent: 'body' },
          leftLeg: { size: [4, 12, 4], position: [-2, -6, 0], pivot: [0, 0, 0], parent: 'body' }
        },
        scale: 0.0625,
        animationSpeed: 4.0,
        iconUV: { x: 8, y: 8, size: 8 }
      },
      slime: {
        parts: {
          slimeBody: { size: [16, 16, 16], position: [0, 8, 0], pivot: [0, 0, 0], parent: null }
        },
        scale: 0.0625,
        animationSpeed: 1.5,
        iconUV: { x: 0, y: 16, size: 16 }
      },
      snowgolem: {
        parts: {
          base: { size: [10, 10, 10], position: [0, -5, 0], pivot: [0, 5, 0], parent: null },
          body: { size: [10, 10, 10], position: [0, 5, 0], pivot: [0, 5, 0], parent: 'base' },
          head: { size: [8, 8, 8], position: [0, 13, 0], pivot: [0, 4, 0], parent: 'base' },
          rightArm: { size: [12, 2, 2], position: [6, 5, 0], pivot: [-4, 0, 0], parent: 'base' },
          leftArm: { size: [12, 2, 2], position: [-6, 5, 0], pivot: [4, 0, 0], parent: 'base' }
        },
        scale: 0.0625,
        animationSpeed: 3.0,
        iconUV: { x: 0, y: 0, size: 8 }
      },
      irongolem: {
        parts: {
          body: { size: [14, 20, 6], position: [0, -10, 0], pivot: [0, 10, 0], parent: null },
          head: { size: [10, 10, 10], position: [0, 15, 0], pivot: [0, -5, 0], parent: 'body' },
          nose: { size: [2, 4, 2], position: [0, 0, 5], pivot: [0, 0, -1], parent: 'head' },
          rightArm: { size: [4, 12, 6], position: [9, 6, 0], pivot: [0, -6, 0], parent: 'body' },
          leftArm: { size: [4, 12, 6], position: [-9, 6, 0], pivot: [0, -6, 0], parent: 'body' },
          rightLeg: { size: [6, 10, 6], position: [4, -10, 0], pivot: [0, 5, 0], parent: 'body' },
          leftLeg: { size: [6, 10, 6], position: [-4, -10, 0], pivot: [0, 5, 0], parent: 'body' }
        },
        scale: 0.0625,
        animationSpeed: 2.5,
        iconUV: { x: 0, y: 0, size: 10 }
      }
    };
  }

  detectSkinFormat(texture) {
    const width = texture.image.width;
    const height = texture.image.height;
    if (width === 64 && height === 32) return { type: 'legacy', scale: 1, hasOverlay: false };
    if (width === 64 && height === 64) return { type: 'modern', scale: 1, hasOverlay: true };
    if (width >= 128) return { type: 'modern', scale: width / 64, hasOverlay: true };
    return { type: 'legacy', scale: 1, hasOverlay: false }; // Default fallback
  }

  getUVMapForFormat(partName, skinFormat, isOverlay = false) {
    const isModern = skinFormat.type === 'modern';
    const scale = skinFormat.scale;

    const modernUVMaps = {
      head:     { base: { right: [0, 8, 8, 8],   left: [16, 8, 8, 8],  top: [8, 0, 8, 8],    bottom: [16, 0, 8, 8],  front: [8, 8, 8, 8],    back: [24, 8, 8, 8]  }, overlay: { right: [32, 8, 8, 8],  left: [48, 8, 8, 8],  top: [40, 0, 8, 8],   bottom: [48, 0, 8, 8],  front: [40, 8, 8, 8],   back: [56, 8, 8, 8]  } },
      body:     { base: { right: [16, 20, 4, 12],left: [28, 20, 4, 12], top: [20, 16, 8, 4],  bottom: [28, 16, 8, 4], front: [20, 20, 8, 12], back: [32, 20, 8, 12] }, overlay: { right: [16, 36, 4, 12],left: [28, 36, 4, 12], top: [20, 32, 8, 4],  bottom: [28, 32, 8, 4], front: [20, 36, 8, 12], back: [32, 36, 8, 12] } },
      rightArm: { base: { right: [40, 20, 4, 12],left: [48, 20, 4, 12], top: [44, 16, 4, 4],  bottom: [48, 16, 4, 4], front: [44, 20, 4, 12], back: [52, 20, 4, 12] }, overlay: { right: [40, 36, 4, 12],left: [48, 36, 4, 12], top: [44, 32, 4, 4],  bottom: [48, 32, 4, 4], front: [44, 36, 4, 12], back: [52, 36, 4, 12] } },
      leftArm:  { base: { right: [32, 52, 4, 12],left: [40, 52, 4, 12], top: [36, 48, 4, 4],  bottom: [40, 48, 4, 4], front: [36, 52, 4, 12], back: [44, 52, 4, 12] }, overlay: { right: [48, 52, 4, 12],left: [56, 52, 4, 12], top: [52, 48, 4, 4],  bottom: [56, 48, 4, 4], front: [52, 52, 4, 12], back: [60, 52, 4, 12] } },
      rightLeg: { base: { right: [0, 20, 4, 12], left: [8, 20, 4, 12],  top: [4, 16, 4, 4],   bottom: [8, 16, 4, 4],  front: [4, 20, 4, 12],  back: [12, 20, 4, 12] }, overlay: { right: [0, 36, 4, 12], left: [8, 36, 4, 12],  top: [4, 32, 4, 4],   bottom: [8, 32, 4, 4],  front: [4, 36, 4, 12],  back: [12, 36, 4, 12] } },
      leftLeg:  { base: { right: [16, 52, 4, 12],left: [24, 52, 4, 12], top: [20, 48, 4, 4],  bottom: [24, 48, 4, 4], front: [20, 52, 4, 12], back: [28, 52, 4, 12] }, overlay: { right: [0, 52, 4, 12],  left: [8, 52, 4, 12],  top: [4, 48, 4, 4],   bottom: [8, 48, 4, 4],  front: [4, 52, 4, 12],  back: [12, 52, 4, 12] } },
      slimeBody:{ base: { front: [0, 16, 16, 16], back: [32, 16, 16, 16], left: [16, 16, 16, 16], right: [48, 16, 16, 16], top: [16, 0, 16, 16], bottom: [32, 0, 16, 16] }, overlay: { front: [0, 48, 16, 16], back: [32, 48, 16, 16], left: [16, 48, 16, 16], right: [48, 48, 16, 16], top: [16, 32, 16, 16], bottom: [32, 32, 16, 16] } },
      snowgolem: { base: { head: { front: [0, 0, 8, 8], back: [16, 0, 8, 8], top: [8, 0, 8, 8], bottom: [16, 0, 8, 8], left: [24, 0, 8, 8], right: [0, 0, 8, 8] }, body: { front: [0, 16, 10, 10], back: [20, 16, 10, 10], top: [0, 16, 10, 10], bottom: [10, 16, 10, 10], left: [30, 16, 10, 10], right: [0, 16, 10, 10] }, base: { front: [0, 26, 10, 10], back: [20, 26, 10, 10], top: [0, 26, 10, 10], bottom: [10, 26, 10, 10], left: [30, 26, 10, 10], right: [0, 26, 10, 10] }, rightArm: { front: [40, 16, 12, 2], back: [40, 20, 12, 2], top: [40, 18, 12, 2], bottom: [40, 16, 12, 2], left: [40, 18, 2, 2], right: [50, 18, 2, 2] }, leftArm: { front: [40, 16, 12, 2], back: [40, 20, 12, 2], top: [40, 18, 12, 2], bottom: [40, 16, 12, 2], left: [40, 18, 2, 2], right: [50, 18, 2, 2] } }, overlay: null },
      irongolem: { base: { head: { front: [0, 0, 10, 10], back: [20, 0, 10, 10], top: [10, 0, 10, 10], bottom: [20, 0, 10, 10], left: [30, 0, 10, 10], right: [0, 0, 10, 10] }, body: { front: [0, 10, 14, 20], back: [28, 10, 14, 20], top: [14, 10, 14, 6], bottom: [28, 10, 14, 6], left: [42, 10, 6, 20], right: [0, 10, 6, 20] }, rightArm: { front: [40, 0, 6, 12], back: [52, 0, 6, 12], top: [46, 0, 6, 6], bottom: [40, 0, 6, 6], left: [40, 0, 6, 12], right: [52, 0, 6, 12] }, leftArm: { front: [40, 0, 6, 12], back: [52, 0, 6, 12], top: [46, 0, 6, 6], bottom: [40, 0, 6, 6], left: [40, 0, 6, 12], right: [52, 0, 6, 12] }, rightLeg: { front: [0, 30, 6, 10], back: [12, 30, 6, 10], top: [6, 30, 6, 6], bottom: [12, 30, 6, 6], left: [0, 30, 6, 10], right: [12, 30, 6, 10] }, leftLeg: { front: [0, 30, 6, 10], back: [12, 30, 6, 10], top: [6, 30, 6, 6], bottom: [12, 30, 6, 6], left: [0, 30, 6, 10], right: [12, 30, 6, 10] } }, overlay: null }
    };

    const legacyUVMaps = {
      head: { right: [0, 8, 8, 8], left: [16, 8, 8, 8], top: [8, 0, 8, 8], bottom: [16, 0, 8, 8], front: [8, 8, 8, 8], back: [24, 8, 8, 8] },
      body: { right: [16, 20, 4, 12], left: [28, 20, 4, 12], top: [20, 16, 8, 4], bottom: [28, 16, 8, 4], front: [20, 20, 8, 12], back: [32, 20, 8, 12] },
      rightArm: { right: [40, 20, 4, 12], left: [48, 20, 4, 12], top: [44, 16, 4, 4], bottom: [48, 16, 4, 4], front: [44, 20, 4, 12], back: [52, 20, 4, 12] },
      leftArm: { right: [48, 20, 4, 12], left: [40, 20, 4, 12], top: [44, 16, 4, 4], bottom: [48, 16, 4, 4], front: [44, 20, 4, 12], back: [52, 20, 4, 12] },
      rightLeg: { right: [0, 20, 4, 12], left: [8, 20, 4, 12], top: [4, 16, 4, 4], bottom: [8, 16, 4, 4], front: [4, 20, 4, 12], back: [12, 20, 4, 12] },
      leftLeg: { right: [8, 20, 4, 12], left: [0, 20, 4, 12], top: [4, 16, 4, 4], bottom: [8, 16, 4, 4], front: [4, 20, 4, 12], back: [12, 20, 4, 12] }
    };
    if (!isModern) return isOverlay ? null : legacyUVMaps[partName] || null;
    const uvSource = modernUVMaps[partName];
    if (!uvSource) return null;
    const uvMap = isOverlay ? uvSource.overlay : uvSource.base;
    if (!uvMap) return null;
    if (scale !== 1) {
      const scaledUV = {};
      for (const [face, coords] of Object.entries(uvMap)) scaledUV[face] = coords.map(v => v * scale);
      return scaledUV;
    }
    return uvMap;
  }

  createGonkMesh(modelType, config, position, characterType) {
    const modelDef = this.models[modelType];
    const skinTexture = window.assetManager.getTexture(config.skinTexture);
    if (!modelDef || !skinTexture) {
      Logger.error(`Failed to create Gonk mesh for ${characterType}`);
      return null;
    }
    const skinFormat = this.detectSkinFormat(skinTexture);
    const { scaleX = 1.0, scaleY = 1.0, scaleZ = 1.0 } = config;
    const character = { modelDef, parts: {}, group: new THREE.Group(), position, type: characterType, animState: 'idle', animTime: 0, skinFormat, dimensionScale: { x: scaleX, y: scaleY, z: scaleZ }, weaponOffsets: { position: new THREE.Vector3(), rotation: new THREE.Euler(), scale: 1.0 } };
    const buildOrder = ['base', 'body', 'head', 'nose', 'rightArm', 'leftArm', 'rightLeg', 'leftLeg', 'slimeBody'];
    for (const partName of buildOrder) {
      if (!modelDef.parts[partName]) continue;
      const partDef = modelDef.parts[partName];
      const scaledSize = [ partDef.size[0] * scaleX, partDef.size[1] * scaleY, partDef.size[2] * scaleZ ];
      const partGroup = new THREE.Group();
      partGroup.name = partName;
      const createLayer = (isOverlay) => {
          const uvMap = this.getUVMapForFormat(partName, skinFormat, isOverlay);
          if (!uvMap) return;
          const size = isOverlay ? [ scaledSize[0] + 0.5, scaledSize[1] + 0.5, scaledSize[2] + 0.5 ] : scaledSize;
          const { geometry, materials } = this.createBoxGeometryWithUV(size, uvMap, skinTexture.image.width, skinTexture.image.height, config.skinTexture, isOverlay);
          const mesh = new THREE.Mesh(geometry, materials);
          mesh.name = `${partName}_mesh_${isOverlay ? 'overlay' : 'base'}`;
          mesh.castShadow = !isOverlay;
          if (partName.includes('Arm') || partName.includes('Leg')) mesh.position.set(0, -scaledSize[1] / 2, 0);
          else if (partName === 'head') mesh.position.set(0, scaledSize[1] / 2, 0);
          partGroup.add(mesh);
      };
      createLayer(false);
      if (skinFormat.hasOverlay) createLayer(true);
      const scaledPos = [partDef.position[0] * scaleX, partDef.position[1] * scaleY, partDef.position[2] * scaleZ];
      partGroup.position.fromArray(scaledPos);
      character.parts[partName] = partGroup;
      if (partDef.parent && character.parts[partDef.parent]) character.parts[partDef.parent].add(partGroup);
      else character.group.add(partGroup);
    }
    character.group.scale.setScalar(modelDef.scale);
    let groundOffset = 0;
    if (modelType === 'slime') groundOffset = (modelDef.parts.slimeBody.size[1] / 2) * scaleY * modelDef.scale;
    else if (modelType === 'snowgolem') groundOffset = (modelDef.parts.base.size[1] / 2 + 10) * scaleY * modelDef.scale;
    else groundOffset = 18 * scaleY * modelDef.scale;
    character.group.position.copy(position).y += groundOffset;
    return character;
  }

  createBoxGeometryWithUV(size, uvMap, textureWidth, textureHeight, textureName, isOverlay = false) {
    const materials = [];
    const faceNames = ['right', 'left', 'top', 'bottom', 'front', 'back'];
    for (const faceName of faceNames) {
      const uvCoords = uvMap[faceName];
      const texture = window.assetManager.getTexture(textureName);
      if (!uvCoords || !texture) {
          materials.push(new THREE.MeshStandardMaterial({visible: false}));
          continue;
      }
      const [u, v, w, h] = uvCoords;
      let mat;
      if (isOverlay) mat = new THREE.MeshLambertMaterial({ map: texture.clone(), transparent: true, alphaTest: 0.5, depthWrite: false });
      else mat = new THREE.MeshStandardMaterial({ map: texture.clone(), roughness: 1.0, metalness: 0.0 });
      mat.map.needsUpdate = true;
      mat.map.offset.set(u / textureWidth, 1 - (v + h) / textureHeight);
      mat.map.repeat.set(w / textureWidth, h / textureHeight);
      materials.push(mat);
    }
    return { geometry: new THREE.BoxGeometry(...size), materials };
  }

  updateCharacterSkin(character, skinFile) {
    const newTexture = window.assetManager.getTexture(skinFile);
    if (!newTexture) { Logger.error(`Cannot update skin. Texture not found: ${skinFile}`); return; }
    const newSkinFormat = this.detectSkinFormat(newTexture);
    character.skinFormat = newSkinFormat;
    const faceNames = ['right', 'left', 'top', 'bottom', 'front', 'back'];
    for (const partName in character.parts) {
        const partGroup = character.parts[partName];
        partGroup.traverse(mesh => {
            if (mesh.isMesh) {
                if (mesh.parent?.userData?.isWeapon) return;
                const isOverlay = mesh.name.includes('overlay');
                if (isOverlay && !newSkinFormat.hasOverlay) { mesh.visible = false; return; }
                mesh.visible = true;
                const uvMap = this.getUVMapForFormat(partName, newSkinFormat, isOverlay);
                if (!uvMap) return;
                const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
                for(let i=0; i < materials.length; i++) {
                    const mat = materials[i];
                    const faceName = faceNames[i];
                    const uvCoords = uvMap[faceName];
                    if (mat.map && uvCoords) {
                        const [u, v, w, h] = uvCoords;
                        mat.map = newTexture.clone();
                        mat.map.needsUpdate = true;
                        mat.map.offset.set(u / newTexture.image.width, 1 - (v + h) / newTexture.image.height);
                        mat.map.repeat.set(w / newTexture.image.width, h / newTexture.image.height);
                    }
                }
            }
        });
    }
    console.log(`Updated ${character.type} skin to ${skinFile}`);
  }

  setAnimation(character, animState) { if (character.animState !== animState) { character.animState = animState; character.animTime = 0; } }
  updateAnimation(character, options = {}) { character.animTime += options.deltaTime || 0; this.applyAnimationPose(character, character.animTime, options); }
  applyAnimationPose(character, currentTime, options = {}) {
    const { modelDef, parts, dimensionScale, group } = character;
    const { deltaTime = 0.016, isPlayer = false, target } = options;
    const time = currentTime * modelDef.animationSpeed;
    Object.values(parts).forEach(part => part.rotation.set(0,0,0));
    if (parts.slimeBody) {
        const jumpPhase = time % 2.0; let scaleY = 1.0;
        if (jumpPhase < 0.2) scaleY = 1.0 - (jumpPhase / 0.2) * 0.5; 
        else if (jumpPhase >= 1.0 && jumpPhase < 1.2) { const landPhase = (jumpPhase - 1.0) / 0.2; scaleY = 0.5 + (1.0 - landPhase) * 0.5; }
        parts.slimeBody.scale.y = scaleY; return;
    }
    const bodyBaseY = (parts.body && modelDef.parts.body) ? modelDef.parts.body.position[1] * dimensionScale.y : 0;
    if(parts.body) parts.body.position.y = bodyBaseY;
    if (!isPlayer && character.animState !== 'aim') group.rotation.y += deltaTime * 0.25;
    switch (character.animState) {
      case 'walk': const walk = Math.sin(time); if (parts.rightLeg) parts.rightLeg.rotation.x = walk * 0.5; if (parts.leftLeg) parts.leftLeg.rotation.x = -walk * 0.5; if (parts.rightArm) parts.rightArm.rotation.x = -walk * 0.4; if (parts.leftArm) parts.leftArm.rotation.x = walk * 0.4; if (parts.body) parts.body.position.y = bodyBaseY + Math.abs(Math.sin(time * 2)) * 0.5; if (parts.head) parts.head.rotation.x = Math.abs(Math.sin(time * 2)) * 0.05; break;
      case 'run': const run = Math.sin(time * 1.5); if (parts.rightLeg) parts.rightLeg.rotation.x = run * 0.8; if (parts.leftLeg) parts.leftLeg.rotation.x = -run * 0.8; if (parts.rightArm) parts.rightArm.rotation.x = -run * 0.8; if (parts.leftArm) parts.leftArm.rotation.x = run * 0.8; if (parts.body) parts.body.position.y = bodyBaseY + Math.abs(Math.sin(time * 3)) * 1.5; if (parts.head) parts.head.rotation.x = Math.abs(Math.sin(time * 3)) * 0.08; break;
      case 'shoot': if (parts.rightArm) parts.rightArm.rotation.x = -Math.PI / 2; if (parts.leftArm) parts.leftArm.rotation.x = -Math.PI / 2.2; if (parts.head) parts.head.rotation.y = -0.05; break;
      default: const sway = Math.sin(time * 0.3) * 0.05; if (parts.rightArm) parts.rightArm.rotation.z = -sway; if (parts.leftArm) parts.leftArm.rotation.z = sway; if (parts.head) parts.head.rotation.y = Math.sin(time * 0.5) * 0.15; break;
    }
    if (target && character.animState === 'aim') {
        const charPos = new THREE.Vector3(); group.getWorldPosition(charPos);
        let targetYaw = Math.atan2(target.x - charPos.x, target.z - charPos.z);
        let diff = targetYaw - group.rotation.y;
        while(diff < -Math.PI) diff += 2 * Math.PI; while(diff > Math.PI) diff -= 2 * Math.PI;
        group.rotation.y += diff * 0.1;
        if (parts.rightArm) parts.rightArm.rotation.x = -Math.PI / 2;
        if (parts.head) parts.head.rotation.y = 0;
    }
  }
}

window.gonkModels = new GonkModelSystem();
window.createGonkMesh = window.gonkModels.createGonkMesh.bind(window.gonkModels);
window.setGonkAnimation = window.gonkModels.setAnimation.bind(window.gonkModels);
window.updateGonkAnimation = window.gonkModels.updateAnimation.bind(window.gonkModels);
window.gonkModels.updateCharacterSkin = window.gonkModels.updateCharacterSkin.bind(window.gonkModels);