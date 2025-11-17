// BROWSERFIREFOXHIDE gonk_models.js
// update: DRAMATIC PERFORMANCE REWRITE.
// 1. Replaced per-face material creation with a single shared material per skin, massively reducing draw calls.
// 2. Implemented direct UV mapping on geometries instead of texture cloning and offsetting, reducing memory and improving performance.
// 3. Cached materials to prevent re-creation.
// update: Added support for external model definitions (Iron Golem, Snow Golem, Pig, Creeper, Slime).

class GonkModelSystem {
  constructor() {
    this.models = this.defineModels();
    this.externalModels = new Map(); // Stores loaded external model definitions
    this.materialCache = new Map();
    if (typeof window.Logger === 'undefined') {
        window.Logger = {
            debug: console.log, info: console.info, warn: console.warn, error: console.error
        };
    }
    Logger.debug('Gonk Model System initialized.');
  }

  // Register an external model definition
  registerExternalModel(modelDef) {
    if (!modelDef || !modelDef.name) {
        Logger.warn('Cannot register model: missing name');
        return;
    }
    this.externalModels.set(modelDef.name, modelDef);

    // Also add to the models registry for compatibility
    this.models[modelDef.name] = {
        parts: modelDef.parts,
        scale: modelDef.scale || 0.0625,
        animationSpeed: modelDef.animationSpeed || 2.0,
        textureWidth: modelDef.textureWidth,
        textureHeight: modelDef.textureHeight
    };

    Logger.debug(`Registered external model: ${modelDef.name}`);
  }

  // Initialize and register all available external models
  initializeExternalModels() {
    // Check for each external model and register if available
    console.log('[GonkModels] Initializing external models...');
    if (window.IronGolemModel) {
        this.registerExternalModel(window.IronGolemModel);
        console.log('[GonkModels] Registered IronGolemModel');
    } else {
        console.warn('[GonkModels] IronGolemModel not found on window');
    }
    if (window.SnowGolemModel) {
        this.registerExternalModel(window.SnowGolemModel);
        console.log('[GonkModels] Registered SnowGolemModel');
    } else {
        console.warn('[GonkModels] SnowGolemModel not found on window');
    }
    if (window.PigModel) {
        this.registerExternalModel(window.PigModel);
        console.log('[GonkModels] Registered PigModel');
    } else {
        console.warn('[GonkModels] PigModel not found on window');
    }
    if (window.CreeperModel) {
        this.registerExternalModel(window.CreeperModel);
        console.log('[GonkModels] Registered CreeperModel');
    } else {
        console.warn('[GonkModels] CreeperModel not found on window');
    }
    if (window.SlimeModel) {
        this.registerExternalModel(window.SlimeModel);
        console.log('[GonkModels] Registered SlimeModel');
    } else {
        console.warn('[GonkModels] SlimeModel not found on window');
    }
    console.log(`[GonkModels] Total external models registered: ${this.externalModels.size}`);
    console.log(`[GonkModels] Available model types: ${Array.from(this.externalModels.keys()).join(', ')}`);
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
        animationSpeed: 4.0
      },
      humanoid_alex: {
        parts: {
          head: { size: [8, 8, 8], position: [0, 6, 0], pivot: [0, 0, 0], parent: 'body' },
          body: { size: [8, 12, 4], position: [0, 0, 0], pivot: [0, 0, 0], parent: null },
          rightArm: { size: [3, 12, 4], position: [5.5, 5, 0], pivot: [0, 0, 0], parent: 'body' },
          leftArm: { size: [3, 12, 4], position: [-5.5, 5, 0], pivot: [0, 0, 0], parent: 'body' },
          rightLeg: { size: [4, 12, 4], position: [2, -6, 0], pivot: [0, 0, 0], parent: 'body' },
          leftLeg: { size: [4, 12, 4], position: [-2, -6, 0], pivot: [0, 0, 0], parent: 'body' }
        },
        scale: 0.0625,
        animationSpeed: 4.0
      }
      // External models (irongolem, snowgolem, pig, creeper, slime) are registered dynamically
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

  getUVMapForFormat(partName, skinFormat, isOverlay = false, armType = 'steve') {
    const isModern = skinFormat.type === 'modern';
    const scale = skinFormat.scale;

    const steveUVMaps = {
        head:     { base: { right: [0, 8, 8, 8],   left: [16, 8, 8, 8],  top: [8, 0, 8, 8],    bottom: [16, 0, 8, 8],  front: [8, 8, 8, 8],    back: [24, 8, 8, 8]  }, overlay: { right: [32, 8, 8, 8],  left: [48, 8, 8, 8],  top: [40, 0, 8, 8],   bottom: [48, 0, 8, 8],  front: [40, 8, 8, 8],   back: [56, 8, 8, 8]  } },
        body:     { base: { right: [16, 20, 4, 12],left: [28, 20, 4, 12], top: [20, 16, 8, 4],  bottom: [28, 16, 8, 4], front: [20, 20, 8, 12], back: [32, 20, 8, 12] }, overlay: { right: [16, 36, 4, 12],left: [28, 36, 4, 12], top: [20, 32, 8, 4],  bottom: [28, 32, 8, 4], front: [20, 36, 8, 12], back: [32, 36, 8, 12] } },
        rightArm: { base: { right: [40, 20, 4, 12],left: [48, 20, 4, 12], top: [44, 16, 4, 4],  bottom: [48, 16, 4, 4], front: [44, 20, 4, 12], back: [52, 20, 4, 12] }, overlay: { right: [40, 36, 4, 12],left: [48, 36, 4, 12], top: [44, 32, 4, 4],  bottom: [48, 32, 4, 4], front: [44, 36, 4, 12], back: [52, 36, 4, 12] } },
        leftArm:  { base: { right: [32, 52, 4, 12],left: [40, 52, 4, 12], top: [36, 48, 4, 4],  bottom: [40, 48, 4, 4], front: [36, 52, 4, 12], back: [44, 52, 4, 12] }, overlay: { right: [48, 52, 4, 12],left: [56, 52, 4, 12], top: [52, 48, 4, 4],  bottom: [56, 48, 4, 4], front: [52, 52, 4, 12], back: [60, 52, 4, 12] } },
        rightLeg: { base: { right: [0, 20, 4, 12], left: [8, 20, 4, 12],  top: [4, 16, 4, 4],   bottom: [8, 16, 4, 4],  front: [4, 20, 4, 12],  back: [12, 20, 4, 12] }, overlay: { right: [0, 36, 4, 12], left: [8, 36, 4, 12],  top: [4, 32, 4, 4],   bottom: [8, 32, 4, 4],  front: [4, 36, 4, 12],  back: [12, 36, 4, 12] } },
        leftLeg:  { base: { right: [16, 52, 4, 12],left: [24, 52, 4, 12], top: [20, 48, 4, 4],  bottom: [24, 48, 4, 4], front: [20, 52, 4, 12], back: [28, 52, 4, 12] }, overlay: { right: [0, 52, 4, 12],  left: [8, 52, 4, 12],  top: [4, 48, 4, 4],   bottom: [8, 48, 4, 4],  front: [4, 52, 4, 12],  back: [12, 52, 4, 12] } },
        slimeBody:{ base: { front: [8, 8, 8, 8], back: [24, 8, 8, 8], left: [16, 8, 8, 8], right: [0, 8, 8, 8], top: [8, 0, 8, 8], bottom: [16, 0, 8, 8] }, overlay: { front: [40, 8, 8, 8], back: [56, 8, 8, 8], left: [48, 8, 8, 8], right: [32, 8, 8, 8], top: [40, 0, 8, 8], bottom: [48, 0, 8, 8] } }
    };

    const alexUVMaps = {
        rightArm: { base: { right: [40, 20, 3, 12], left: [47, 20, 3, 12], top: [44, 16, 3, 4], bottom: [47, 16, 3, 4], front: [44, 20, 3, 12], back: [51, 20, 3, 12] }, overlay: { right: [40, 36, 3, 12], left: [47, 36, 3, 12], top: [44, 32, 3, 4], bottom: [47, 32, 3, 4], front: [44, 36, 3, 12], back: [51, 36, 3, 12] }},
        leftArm:  { base: { right: [33, 52, 3, 12], left: [40, 52, 3, 12], top: [36, 48, 3, 4], bottom: [39, 48, 3, 4], front: [36, 52, 3, 12], back: [43, 52, 3, 12] }, overlay: { right: [49, 52, 3, 12], left: [56, 52, 3, 12], top: [52, 48, 3, 4], bottom: [55, 48, 3, 4], front: [52, 52, 3, 12], back: [59, 52, 3, 12] }}
    };

    let modernUVMaps = steveUVMaps;
    if (armType === 'alex' && (partName === 'rightArm' || partName === 'leftArm')) {
        modernUVMaps = { ...steveUVMaps, ...alexUVMaps };
    }

    if (!isModern) {
      if (isOverlay) return null; 
      if (partName === 'leftArm' || partName === 'leftLeg') {
        const rightPartName = partName === 'leftArm' ? 'rightArm' : 'rightLeg';
        const rightUV = modernUVMaps[rightPartName].base;
        return { right: rightUV.left, left: rightUV.right, top: rightUV.top, bottom: rightUV.bottom, front: rightUV.front, back: rightUV.back };
      }
    }

    const uvSource = modernUVMaps[partName];
    if (!uvSource) return null;

    const uvMap = isOverlay ? uvSource.overlay : uvSource.base;
    if (!uvMap) return null;

    if (scale !== 1) {
      const scaledUV = {};
      for (const [face, coords] of Object.entries(uvMap)) {
        scaledUV[face] = coords.map(v => v * scale);
      }
      return scaledUV;
    }
    return uvMap;
  }

  getOrCreateMaterial(textureName, isOverlay, config) {
    const cacheKey = `${textureName}_${isOverlay}_${config.transparent}_${config.alphaTexture}`;
    if (this.materialCache.has(cacheKey)) {
        return this.materialCache.get(cacheKey);
    }

    const texture = window.assetManager.getTexture(textureName);
    let material;

    if (isOverlay) {
        material = new THREE.MeshLambertMaterial({
            map: texture,
            transparent: true,
            alphaTest: 0.1,
            depthWrite: false,
            side: THREE.FrontSide
        });
    } else {
        material = new THREE.MeshStandardMaterial({
            map: texture,
            roughness: 1.0,
            metalness: 0.0,
            side: THREE.FrontSide // Default to FrontSide
        });
    }

    if (config.alphaTexture) {
        material.transparent = true;
        material.side = THREE.DoubleSide; // Make it double-sided for cutouts
        material.alphaTest = 0.5;
    }

    if (config.transparent) {
        material.transparent = true;
        material.opacity = 0.6;
        material.depthWrite = false;
    }
    
    this.materialCache.set(cacheKey, material);
    return material;
  }

  createGonkMesh(modelType, config, position, characterType) {
    const skinTexture = window.assetManager.getTexture(config.skinTexture);
    if (!skinTexture) {
      Logger.error(`Failed to create Gonk mesh for ${characterType}: Missing skin texture.`);
      return null;
    }

    let modelDef;
    let externalModelDef = null;
    const armType = config.armType || 'steve';

    console.log(`[GonkModels] Creating mesh: modelType=${modelType}, characterType=${characterType}`);
    console.log(`[GonkModels] External models available: ${Array.from(this.externalModels.keys()).join(', ')}`);

    // Check if this is an external model type
    if (this.externalModels.has(modelType)) {
        externalModelDef = this.externalModels.get(modelType);
        modelDef = this.models[modelType];
        console.log(`[GonkModels] Using external model: ${modelType}, parts: ${Object.keys(modelDef.parts).join(', ')}`);
    } else if (modelType === 'humanoid') {
        modelDef = (armType === 'alex') ? this.models.humanoid_alex : this.models.humanoid;
        console.log(`[GonkModels] Using humanoid model (${armType})`);
    } else {
        modelDef = this.models[modelType];
        console.log(`[GonkModels] Using internal model: ${modelType}`);
    }

    if (!modelDef) {
        Logger.error(`Failed to find model definition for type: ${modelType}`);
        return null;
    }

    // Use external model's texture size if available, otherwise detect from skin
    let textureWidth, textureHeight;
    if (externalModelDef) {
        textureWidth = externalModelDef.textureWidth || skinTexture.image.width;
        textureHeight = externalModelDef.textureHeight || skinTexture.image.height;
    } else {
        textureWidth = skinTexture.image.width;
        textureHeight = skinTexture.image.height;
    }

    const skinFormat = this.detectSkinFormat(skinTexture);
    const { scaleX = 1.0, scaleY = 1.0, scaleZ = 1.0, scale = 1.0 } = config;
    const universalScaleModifier = 0.3;

    const character = {
      modelDef, parts: {}, hitboxes: {}, group: new THREE.Group(), position, type: characterType,
      animState: 'idle', animTime: 0, skinFormat,
      dimensionScale: { x: scaleX, y: scaleY, z: scaleZ },
      weaponOffsets: { position: new THREE.Vector3(), rotation: new THREE.Euler(), scale: 1.0 },
      groundOffset: 0,
      editorRArmRot: null,
      editorLArmRot: null,
      onMeleeHitFrame: null,
      meleeHitFrameFired: false,
      externalModelDef: externalModelDef // Store reference for custom animations
    };

    const baseMaterial = this.getOrCreateMaterial(config.skinTexture, false, config);
    // External models typically don't have overlay layers (only humanoids do)
    const overlayMaterial = (!externalModelDef && skinFormat.hasOverlay) ? this.getOrCreateMaterial(config.skinTexture, true, config) : null;

    // Build all parts defined in the model
    const partNames = Object.keys(modelDef.parts);
    // Sort to ensure parents are built before children
    const sortedParts = this.sortPartsByDependency(partNames, modelDef.parts);

    for (const partName of sortedParts) {
      if (!modelDef.parts[partName]) continue;

      const partDef = modelDef.parts[partName];
      const scaledSize = [ partDef.size[0] * scaleX, partDef.size[1] * scaleY, partDef.size[2] * scaleZ ];
      const partGroup = new THREE.Group();

      const createLayer = (isOverlay) => {
          let uvMap;

          // Use external model's UV map if available
          if (externalModelDef && externalModelDef.getUVMap) {
              uvMap = externalModelDef.getUVMap(partName, isOverlay);
          } else {
              uvMap = this.getUVMapForFormat(partName, skinFormat, isOverlay, armType);
          }

          if (!uvMap) return;

          const size = isOverlay ? [ scaledSize[0] + 0.5, scaledSize[1] + 0.5, scaledSize[2] + 0.5 ] : scaledSize;
          const geometry = this.createBoxGeometryWithUVs(size, uvMap, textureWidth, textureHeight);

          // Check if part should be transparent (e.g., slime outer layer)
          let material = baseMaterial;
          if (isOverlay) {
              material = overlayMaterial;
          } else if (partDef.transparent) {
              // Create transparent material for this specific part
              material = this.getOrCreateMaterial(config.skinTexture, false, { ...config, transparent: true });
          }

          const mesh = new THREE.Mesh(geometry, material);
          mesh.castShadow = !isOverlay && !partDef.transparent;

          // Position mesh within its group based on pivot point
          if (externalModelDef && partDef.pivot) {
              // External models define explicit pivot points - offset mesh so pivot is at group origin
              const pivotOffset = [
                  -partDef.pivot[0] * scaleX,
                  -partDef.pivot[1] * scaleY,
                  -partDef.pivot[2] * scaleZ
              ];
              mesh.position.set(pivotOffset[0], pivotOffset[1], pivotOffset[2]);
          } else if (partName.includes('Arm') || partName.includes('Leg')) {
              // Humanoid models: pivot at top for limbs
              mesh.position.set(0, -scaledSize[1] / 2, 0);
          } else if (partName === 'head') {
              // Humanoid models: pivot at bottom for head
              mesh.position.set(0, scaledSize[1] / 2, 0);
          }

          // Apply any initial rotation defined in the part
          if (partDef.rotation) {
              mesh.rotation.set(partDef.rotation[0] || 0, partDef.rotation[1] || 0, partDef.rotation[2] || 0);
          }

          partGroup.add(mesh);
      };

      createLayer(false);
      if (overlayMaterial) createLayer(true);

      const scaledPos = [partDef.position[0] * scaleX, partDef.position[1] * scaleY, partDef.position[2] * scaleZ];
      partGroup.position.fromArray(scaledPos);

      character.parts[partName] = partGroup;
      if (partDef.parent && character.parts[partDef.parent]) {
        character.parts[partDef.parent].add(partGroup);
      } else {
        character.group.add(partGroup);
      }
    }

    for (const partName in character.parts) {
        character.hitboxes[partName] = new THREE.OBB();
    }

    character.group.scale.setScalar(modelDef.scale * scale * universalScaleModifier);

    // Calculate ground offset
    let groundOffset = 0;
    if (externalModelDef && externalModelDef.getGroundOffset) {
        groundOffset = externalModelDef.getGroundOffset(scaleY, modelDef.scale * scale, universalScaleModifier);
    } else if (modelType === 'humanoid') {
        groundOffset = 18 * scaleY * modelDef.scale * scale * universalScaleModifier;
    } else if (modelType === 'slime') {
        const slimePart = modelDef.parts.slimeBody || modelDef.parts.slimeOuter;
        if (slimePart) {
            groundOffset = (slimePart.size[1] / 2) * scaleY * modelDef.scale * scale * universalScaleModifier;
        }
    }
    character.groundOffset = groundOffset;
    character.group.position.copy(position).y += groundOffset;

    return character;
  }

  // Sort parts so parents are built before children
  sortPartsByDependency(partNames, partsDefinition) {
    const sorted = [];
    const visited = new Set();

    const visit = (partName) => {
        if (visited.has(partName)) return;
        visited.add(partName);

        const partDef = partsDefinition[partName];
        if (partDef && partDef.parent && partNames.includes(partDef.parent)) {
            visit(partDef.parent);
        }
        sorted.push(partName);
    };

    for (const partName of partNames) {
        visit(partName);
    }

    return sorted;
  }

  createBoxGeometryWithUVs(size, uvMap, textureWidth, textureHeight) {
    const geometry = new THREE.BoxGeometry(...size);
    const uvs = geometry.attributes.uv;
    const faceOrder = ['right', 'left', 'top', 'bottom', 'front', 'back'];

    for (let i = 0; i < faceOrder.length; i++) {
        const faceName = faceOrder[i];
        const uvCoords = uvMap[faceName];
        if (!uvCoords) continue;

        const [u, v, w, h] = uvCoords;
        const u0 = u / textureWidth;
        const v0 = 1 - (v + h) / textureHeight;
        const u1 = (u + w) / textureWidth;
        const v1 = 1 - v / textureHeight;

        const faceIndices = [i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 3];
        uvs.setXY(faceIndices[0], u0, v1);
        uvs.setXY(faceIndices[1], u1, v1);
        uvs.setXY(faceIndices[2], u0, v0);
        uvs.setXY(faceIndices[3], u1, v0);
    }

    uvs.needsUpdate = true;
    return geometry;
  }

  setAnimation(character, animState) {
    if (character.animState !== animState) {
      character.animState = animState;
      character.animTime = 0;
      character.meleeHitFrameFired = false; 
    }
  }

  updateAnimation(character, options = {}) {
    if (options.isPaused && character.animState !== 'aim') return;
    character.animTime += options.deltaTime || 0;
    this.applyAnimationPose(character, character.animTime, options);
  }

  applyAnimationPose(character, currentTime, options = {}) {
    if (!character || !character.modelDef) {
        return;
    }
    const { modelDef, parts, dimensionScale, group } = character;
    const { isPaused = false, target } = options;
    const time = currentTime * modelDef.animationSpeed;

    if (!isPaused) {
        Object.values(parts).forEach(part => part.rotation.set(0,0,0));
    }

    // Check if external model has custom animation handler
    if (character.externalModelDef && character.externalModelDef.applyAnimation) {
        if (!isPaused) {
            character.externalModelDef.applyAnimation(character, character.animState, time, options);
        }
        return;
    }

    if (parts.slimeBody) {
        const jumpPhase = time % 2.0;
        let scaleY = 1.0;
        if (jumpPhase < 0.2) { scaleY = 1.0 - (jumpPhase / 0.2) * 0.5; }
        else if (jumpPhase >= 1.0 && jumpPhase < 1.2) { const landPhase = (jumpPhase - 1.0) / 0.2; scaleY = 0.5 + (1.0 - landPhase) * 0.5; }
        parts.slimeBody.scale.y = scaleY;
        return;
    }

    const bodyBaseY = (parts.body && modelDef.parts.body) ? modelDef.parts.body.position[1] * dimensionScale.y : 0;
    if(parts.body) parts.body.position.y = bodyBaseY;

    if (!isPaused) {
        switch (character.animState) {
          case 'walk':
            const walk = Math.sin(time);
            if (parts.rightLeg) parts.rightLeg.rotation.x = walk * 0.5;
            if (parts.leftLeg) parts.leftLeg.rotation.x = -walk * 0.5;
            if (parts.rightArm) parts.rightArm.rotation.x = -walk * 0.4;
            if (parts.leftArm) parts.leftArm.rotation.x = walk * 0.4;
            if (parts.body) parts.body.position.y = bodyBaseY + Math.abs(Math.sin(time * 2)) * 0.5;
            if (parts.head) parts.head.rotation.x = Math.abs(Math.sin(time * 2)) * 0.05;
            break;
          case 'run':
            const run = Math.sin(time * 1.5);
            if (parts.rightLeg) parts.rightLeg.rotation.x = run * 0.8;
            if (parts.leftLeg) parts.leftLeg.rotation.x = -run * 0.8;
            if (parts.rightArm) parts.rightArm.rotation.x = -run * 0.8;
            if (parts.leftArm) parts.leftArm.rotation.x = run * 0.8;
            if (parts.body) parts.body.position.y = bodyBaseY + Math.abs(Math.sin(time * 3)) * 1.5;
            if (parts.head) parts.head.rotation.x = Math.abs(Math.sin(time * 3)) * 0.08;
            break;
          case 'shoot':
            if (parts.rightArm) parts.rightArm.rotation.x = -Math.PI / 2;
            if (parts.leftArm) parts.leftArm.rotation.x = -Math.PI / 2.2;
            if (parts.head) parts.head.rotation.y = -0.05; 
            break;
          case 'melee':
            const meleeDuration = 0.5;
            const hitFrameTime = 0.2;
            const progress = Math.min(character.animTime / meleeDuration, 1.0);
            
            if (character.animTime >= hitFrameTime && !character.meleeHitFrameFired) {
                if (typeof character.onMeleeHitFrame === 'function') {
                    character.onMeleeHitFrame();
                }
                character.meleeHitFrameFired = true;
            }
            
            const startAngle = THREE.MathUtils.degToRad(-147);
            const endAngle = THREE.MathUtils.degToRad(-29);
            const slashAngle = startAngle + (endAngle - startAngle) * progress;

            if (parts.leftArm) {
                parts.leftArm.rotation.x = slashAngle;
                parts.leftArm.rotation.z = Math.sin(progress * Math.PI) * 0.5;
            }
            if (parts.body) parts.body.rotation.y = Math.sin(progress * Math.PI) * -0.2;
            break;
          case 'death':
            const deathDuration = 0.5;
            const deathProgress = Math.min(character.animTime / deathDuration, 1.0);
            if (parts.body) {
                parts.body.rotation.x = -Math.PI / 2 * deathProgress;
            }
            if (deathProgress >= 1.0) {
                // After the animation is done, we can consider the animation "finished"
                // and it can be stopped.
            }
            break;
          case 'aim':
             if (parts.rightArm) parts.rightArm.rotation.x = -Math.PI / 2;
            if (parts.leftArm) {
                parts.leftArm.rotation.x = -Math.PI / 2;
                parts.leftArm.rotation.z = -0.2;
            }
            break;
          default: // idle
            const sway = Math.sin(time * 0.3) * 0.05;
            if (parts.rightArm) parts.rightArm.rotation.z = sway;
            if (parts.leftArm) parts.leftArm.rotation.z = -sway;
            if (parts.head) parts.head.rotation.y = Math.sin(time * 0.5) * 0.15;
            break;
        }
    }
    
    if (character.animState === 'aim' && target) {
        const targetPos = target.movementCollider?.position;
        if (targetPos) {
            const headPos = new THREE.Vector3();
            parts.head.getWorldPosition(headPos);

            const localTarget = new THREE.Vector3();
            parts.head.parent.worldToLocal(localTarget.copy(targetPos));

            const lookAtTarget = new THREE.Vector3(localTarget.x, localTarget.y, localTarget.z);
            parts.head.lookAt(lookAtTarget);
        }
    } else if (!isPaused && parts.head) {
         parts.head.rotation.set(0,0,0);
         const sway = Math.sin(time * 0.5) * 0.15;
         parts.head.rotation.y = sway;
    }


    if (character.editorRArmRot && parts.rightArm) {
        parts.rightArm.rotation.copy(character.editorRArmRot);
    }
    if (character.editorLArmRot && parts.leftArm) {
        parts.leftArm.rotation.copy(character.editorLArmRot);
    }
  }
}

window.gonkModels = new GonkModelSystem();
window.createGonkMesh = window.gonkModels.createGonkMesh.bind(window.gonkModels);
window.setGonkAnimation = window.gonkModels.setAnimation.bind(window.gonkModels);
window.updateGonkAnimation = window.gonkModels.updateAnimation.bind(window.gonkModels);

window.generateNpcIconDataUrl = async (texture) => {
    if (!texture || !texture.image) return null;

    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const image = texture.image;

    if (!image.complete || image.naturalHeight === 0) {
        await new Promise(resolve => { 
            image.onload = resolve;
            image.onerror = () => resolve();
        });
    }

    const headX = 8, headY = 8, headSize = 8;
    const hatX = 40, hatY = 8, hatSize = 8;
    const scale = image.width / 64;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;

    ctx.drawImage(
        image,
        headX * scale, headY * scale, headSize * scale, headSize * scale,
        0, 0, canvas.width, canvas.height
    );

    ctx.drawImage(
        image,
        hatX * scale, hatY * scale, headSize * scale, headSize * scale,
        0, 0, canvas.width, canvas.height
    );

    return canvas.toDataURL();
};