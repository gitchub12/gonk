// BROWSERFIREFOXHIDE asset_loaders.js
// This is the complete, unabbreviated file.

// === RAW ASSET LOADER ===
class AssetManager {
  constructor() {
    this.textures = {};
    this.materials = {};
    this.assetDefs = {
      textures: {
        // Ceilings
        'ceiling_1': 'data/pngs/ceiling/ceiling_1.png',
        'ceiling_2': 'data/pngs/ceiling/ceiling_2.png',
        'ceiling_4': 'data/pngs/ceiling/ceiling_4.png',
        'ceiling_5': 'data/pngs/ceiling/ceiling_5.png',
        'ceiling_6': 'data/pngs/ceiling/ceiling_6.png',
        // Doors
        'door_1': 'data/pngs/door/door_1.png',
        'door_2': 'data/pngs/door/door_2.png',
        // Floors
        'floor_1': 'data/pngs/floor/floor_1.png',
        'floor_2': 'data/pngs/floor/floor_2.png',
        'floor_3': 'data/pngs/floor/floor_3.png',
        'floor_4': 'data/pngs/floor/floor_4.png',
        // Walls
        'wall_1': 'data/pngs/wall/wall_1.png',
        'wall_2': 'data/pngs/wall/wall_2.png',
        'wall_3': 'data/pngs/wall/wall_3.png',
        'wall_4': 'data/pngs/wall/wall_4.png',
        // Pamphlets
        'pamphlet1': 'data/weapons/pamphlets/pamphlet1.png',
        'pamphlet2': 'data/weapons/pamphlets/pamphlet2.png',
        'pamphlet3': 'data/weapons/pamphlets/pamphlet3.png',
        // Special Textures
        'tapestry_1': 'data/pngs/tapestry/tapestry_1.png',
        'water_1': 'data/pngs/water/water_1.png',
        'sky_1': 'data/pngs/sky/sky_1.png',
        'decor_1': 'data/pngs/decor/decor_1.png',
        'floater_1': 'data/pngs/floater/floater_1.png',
        'dangler_1': 'data/pngs/dangler/dangler_1.png'
      }
    };
    this.pamphletTextureNames = ['pamphlet1', 'pamphlet2', 'pamphlet3'];
  }

  async loadAll() {
    await this.loadDefinedTextures();
    await this.loadCharacterSkins();
    this.createMaterials();
  }
  
  async loadDefinedTextures() {
    const loader = new THREE.TextureLoader();
    const promises = [];
    for (const [name, path] of Object.entries(this.assetDefs.textures)) {
      promises.push( new Promise((resolve) => {
          loader.load(path, 
            (texture) => { this.textures[name] = texture; resolve() },
            undefined, 
            (error) => { console.warn(`Could not load texture '${name}' from path '${path}'`, error); this.textures[name] = null; resolve() }
          );
      }));
    }
    await Promise.all(promises);
  }

  async loadCharacterSkins() {
      const loader = new THREE.TextureLoader();
      const promises = [];
      const skinPath = 'data/skins/';

      for (const charKey in CHARACTER_CONFIG) {
          const char = CHARACTER_CONFIG[charKey];
          const textureFile = char.skinTexture;
          const textureName = textureFile.replace(/\.[^/.]+$/, "");
          const fullPath = skinPath + textureFile;

          if (this.textures[textureName]) continue;

          promises.push(new Promise((resolve) => {
              loader.load(fullPath,
                  (texture) => { this.textures[textureName] = texture; resolve(); },
                  undefined,
                  (error) => { console.warn(`Could not load character skin '${textureName}' from path '${fullPath}'`, error); this.textures[textureName] = null; resolve(); }
              );
          }));
      }
      await Promise.all(promises);
  }

  async loadTexture(name, path) {
    if (this.textures[name]) return this.textures[name];
    
    const loader = new THREE.TextureLoader();
    return new Promise((resolve) => {
        loader.load(path, 
            (texture) => { 
                this.textures[name] = texture; 
                this.materials[name] = new THREE.MeshStandardMaterial({ map: texture });
                resolve(texture); 
            },
            undefined, 
            (error) => { 
                console.warn(`Could not load texture '${name}' from path '${path}'`, error); 
                this.textures[name] = null;
                resolve(null);
            }
        );
    });
  }
  
  createMaterials() {
    for (const [name, texture] of Object.entries(this.textures)) {
        if (texture) {
            this.materials[name] = new THREE.MeshStandardMaterial({ map: texture });
        }
    }
  }
  
  getMaterial(name) { 
    if (!this.materials[name]) {
        console.warn(`Material '${name}' not found. Using fallback.`);
        return new THREE.MeshStandardMaterial({ color: 0xff00ff }); // Magenta fallback
    }
    return this.materials[name];
  }

  getTexture(name) {
    if (!this.textures[name]) {
         console.warn(`Texture '${name}' not found.`);
    }
    return this.textures[name] || null;
  }
  
  getRandomPamphletMaterial() {
    const textureName = this.pamphletTextureNames[Math.floor(Math.random() * this.pamphletTextureNames.length)];
    const material = this.getMaterial(textureName);
    return material ? material.clone() : new THREE.MeshBasicMaterial({ color: 0xffff00 }); 
  }
}

// === FURNITURE LOADER ===
class FurnitureLoader {
    constructor() {
        this.config = {};
        this.loadedModels = new Map();
        this.textureCache = new Map();
    }

    async loadFromManifest(manifestPath) {
        try {
            const response = await fetch(manifestPath);
            const manifest = await response.json();
            this.config = manifest._config;

            for (const modelKey in manifest.models) {
                const modelDef = manifest.models[modelKey];
                await this.loadModel(modelKey, modelDef);
            }
            
            const sceneObjects = [];
            for (const instanceDef of manifest.instances) {
                const sceneObject = this.createInstance(instanceDef);
                if (sceneObject) sceneObjects.push(sceneObject);
            }
            return sceneObjects;

        } catch (e) {
            console.error(`Failed to load furniture manifest: ${manifestPath}`, e);
            return [];
        }
    }

    async loadModel(modelKey, modelDef) {
        if (this.loadedModels.has(modelKey)) return;

        const modelPath = this.config.modelPath + modelDef.file;
        try {
            const response = await fetch(modelPath);
            const modelJson = await response.json();
            
            const textureMap = await this.preloadTextures(modelJson.textures);
            const modelGroup = this.buildMeshFromModelData(modelJson, textureMap, modelDef);

            this.loadedModels.set(modelKey, modelGroup);
        } catch (e) {
            console.error(`Failed to load and parse model: ${modelKey}`, e);
        }
    }

    async preloadTextures(textures) {
        const textureMap = new Map();
        for (const key in textures) {
            const texturePath = textures[key];
            const resolvedPath = this.resolveTexturePath(texturePath);
            
            if (!this.textureCache.has(resolvedPath)) {
                const texture = await assetManager.loadTexture(resolvedPath, resolvedPath);
                this.textureCache.set(resolvedPath, texture);
            }
            textureMap.set(key, this.textureCache.get(resolvedPath));
        }
        return textureMap;
    }

    resolveTexturePath(path) {
        const namespace = this.config.textureNamespace + ":";
        let cleanPath = path.startsWith(namespace) ? path.substring(namespace.length) : path;
        if(cleanPath.startsWith('blocks/')) cleanPath = cleanPath.substring('blocks/'.length);
        if(cleanPath.startsWith('items/')) cleanPath = cleanPath.substring('items/'.length);

        return `${this.config.texturePath}${cleanPath}.png`;
    }

    buildMeshFromModelData(modelJson, textureMap, modelDef) {
        const modelGroup = new THREE.Group();
        const masterScale = modelDef.scale ?? 0.0625;

        if (!modelJson.elements) return modelGroup;

        for (const element of modelJson.elements) {
            const from = element.from;
            const to = element.to;

            const size = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
            const position = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2];

            position[0] -= 8;
            position[1] -= 8;
            position[2] -= 8;
            
            const geometry = new THREE.BoxGeometry(...size);
            const materials = this.createMaterialsForElement(element, textureMap);
            
            const mesh = new THREE.Mesh(geometry, materials);
            mesh.position.fromArray(position);

            if (element.rotation) {
                const rot = element.rotation;
                const pivot = rot.origin.map(p => p - 8);
                const axis = new THREE.Vector3(0, 0, 0);
                axis[rot.axis] = 1;
                const angle = THREE.MathUtils.degToRad(rot.angle);

                const pivotGroup = new THREE.Group();
                pivotGroup.position.fromArray(pivot);
                modelGroup.add(pivotGroup);
                
                mesh.position.sub(new THREE.Vector3(...pivot));
                pivotGroup.add(mesh);
                pivotGroup.setRotationFromAxisAngle(axis, angle);
            } else {
                 modelGroup.add(mesh);
            }
        }
        modelGroup.scale.setScalar(masterScale);
        return modelGroup;
    }

    createMaterialsForElement(element, textureMap) {
        const materials = [];
        const faceOrder = ['east', 'west', 'up', 'down', 'south', 'north'];
        
        for (const faceName of faceOrder) {
            const faceData = element.faces[faceName];
            if (!faceData) {
                materials.push(new THREE.MeshStandardMaterial({ visible: false }));
                continue;
            }

            const texture = textureMap.get(faceData.texture.substring(1));
            if (!texture) {
                materials.push(new THREE.MeshStandardMaterial({ color: 0xff00ff }));
                continue;
            }
            
            const mat = new THREE.MeshStandardMaterial({ map: texture.clone(), roughness: 0.8, metalness: 0.1 });
            const [u1, v1, u2, v2] = faceData.uv || [0, 0, 16, 16];
            const texWidth = texture.image.width;
            const texHeight = texture.image.height;
            
            mat.map.offset.set(u1 / texWidth, 1 - (v2 / texHeight));
            mat.map.repeat.set((u2 - u1) / texWidth, (v2 - v1) / texHeight);
            mat.map.needsUpdate = true;
            
            materials.push(mat);
        }

        return materials;
    }

    createInstance(instanceDef) {
        const baseModel = this.loadedModels.get(instanceDef.model);
        if (!baseModel) {
            console.warn(`Model not found for instance: ${instanceDef.model}`);
            return null;
        }

        const instance = baseModel.clone();
        instance.name = `furniture_${instanceDef.model}`;
        instance.position.fromArray(instanceDef.position);

        if (instanceDef.rotation) {
            instance.rotation.set(
                THREE.MathUtils.degToRad(instanceDef.rotation[0]),
                THREE.MathUtils.degToRad(instanceDef.rotation[1]),
                THREE.MathUtils.degToRad(instanceDef.rotation[2])
            );
        }
        if (instanceDef.scale) {
            instance.scale.multiplyScalar(instanceDef.scale);
        }
        return instance;
    }
}


// === INSTANTIATION ===
window.assetManager = new AssetManager();
window.furnitureLoader = new FurnitureLoader();