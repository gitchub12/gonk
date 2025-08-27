// BROWSERFIREFOXHIDE asset_loaders.js
// Rewritten to act as a factory, creating fresh materials and textures on demand to prevent shared state issues.

class AssetManager {
  constructor() {
    this.textures = {}; // Caches the master loaded textures
    this.sounds = {};
    this.pamphletTextureNames = [];

    this.textureCategories = [
        'ceiling', 'dangler', 'decor', 'door', 'floater', 'floor', 
        'hologonk', 'sky', 'subfloor', 'tapestry', 'wall', 'water'
    ];
    this.soundDefs = {
        'dooropen': 'data/sounds/dooropen.wav',
        'dooropen2': 'data/sounds/dooropen2.wav'
    };
  }

  async fetchDirectoryListing(path) {
      try {
          const response = await fetch(path);
          if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
          const html = await response.text();
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');
          return Array.from(doc.querySelectorAll('a'))
              .map(a => a.getAttribute('href'))
              .filter(href => href.endsWith('.png'));
      } catch (e) {
          console.error(`Failed to fetch or parse directory listing for "${path}":`, e);
          return [];
      }
  }

  async discoverAndLoadAssets() {
      const loader = new THREE.TextureLoader();
      let promises = [];

      for (const category of this.textureCategories) {
          const path = `data/pngs/${category}/`;
          const files = await this.fetchDirectoryListing(path);
          for (const file of files) {
              const name = file.replace(/\.png$/, '');
              const fullPath = path + file;
              if (this.textures[name]) continue;
              promises.push(this.loadTextureWithPromise(loader, name, fullPath));
          }
      }
      
      const pamphletPath = 'data/weapons/pamphlets/';
      const pamphletFiles = await this.fetchDirectoryListing(pamphletPath);
      for (const file of pamphletFiles) {
          const name = file.replace(/\.png$/, '');
          const fullPath = pamphletPath + file;
           if (this.textures[name]) continue;
           this.pamphletTextureNames.push(name);
           promises.push(this.loadTextureWithPromise(loader, name, fullPath));
      }
      
      await Promise.all(promises);
  }

  loadTextureWithPromise(loader, name, path) {
      return new Promise((resolve) => {
          loader.load(path,
              (texture) => { 
                  texture.magFilter = THREE.NearestFilter;
                  texture.minFilter = THREE.NearestFilter;
                  this.textures[name] = texture; 
                  resolve(); 
              },
              undefined,
              (error) => { console.warn(`Could not load texture '${name}' from path '${path}'`, error); this.textures[name] = null; resolve(); }
          );
      });
  }
  
  async loadSounds() {
      const audioLoader = new THREE.AudioLoader();
      const promises = [];
      for (const [name, path] of Object.entries(this.soundDefs)) {
          promises.push(new Promise((resolve) => {
              audioLoader.load(path, (buffer) => {
                  this.sounds[name] = buffer;
                  resolve();
              }, undefined, () => {
                  console.warn(`Could not load sound '${name}' from path '${path}'`);
                  resolve()
              });
          }));
      }
      await Promise.all(promises);
  }

  async loadAll() {
    await this.discoverAndLoadAssets();
    await this.loadCharacterSkins();
    await this.loadSounds();
    console.log(`Asset loading complete. ${Object.keys(this.textures).length} textures and ${Object.keys(this.sounds).length} sounds loaded.`);
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

          promises.push(this.loadTextureWithPromise(loader, textureName, fullPath));
      }
      await Promise.all(promises);
  }

  async loadTexture(name, path) {
    if (this.textures[name]) return this.textures[name];
    
    const loader = new THREE.TextureLoader();
    return new Promise((resolve) => {
        loader.load(path, 
            (texture) => { 
                texture.magFilter = THREE.NearestFilter;
                texture.minFilter = THREE.NearestFilter;
                this.textures[name] = texture;
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
  
  getMaterial(name) {
    const baseTexture = this.getTexture(name);
    if (!baseTexture || !baseTexture.image) {
        console.warn(`Texture for material '${name}' not found or not loaded. Using fallback.`);
        return new THREE.MeshStandardMaterial({ color: 0xff00ff }); // Magenta fallback
    }

    // Create a new texture instance from the master image
    const newTexture = new THREE.Texture(baseTexture.image);
    newTexture.magFilter = THREE.NearestFilter;
    newTexture.minFilter = THREE.NearestFilter;
    newTexture.encoding = baseTexture.encoding;
    newTexture.needsUpdate = true;
    
    // Return a completely new material using the new texture
    return new THREE.MeshStandardMaterial({ map: newTexture });
  }

  getTexture(name) {
    if (!this.textures[name]) {
         console.warn(`Texture '${name}' not found.`);
    }
    return this.textures[name] || null;
  }
  
  getRandomPamphletMaterial() {
    const textureName = this.pamphletTextureNames[Math.floor(Math.random() * this.pamphletTextureNames.length)];
    const material = this.getMaterial(textureName); // This will now correctly return a new material
    return material ? material : new THREE.MeshBasicMaterial({ color: 0xffff00 }); 
  }
}

// === FURNITURE LOADER ===
// ... (code unchanged from previous correct version)
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