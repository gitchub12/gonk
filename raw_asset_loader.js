// BROWSERFIREFOXHIDE raw_asset_loader.js
// Rewritten with corrected paths, underscore naming convention, and a comprehensive texture list.

class AssetManager {
  constructor() {
    this.textures = {};
    this.materials = {};
    this.assetDefs = {
      textures: {
        // --- Systematically added from user's file list ---
        // Ceilings
        'ceiling_1': 'data/pngs/ceiling/ceiling_1.png',
        'ceiling_2': 'data/pngs/ceiling/ceiling_2.png',
        // Doors
        'door_1': 'data/pngs/door/door_1.png',
        'door_2': 'data/pngs/door/door_2.png',
        // Floors (including special lava type)
        'floor_1': 'data/pngs/floor/floor_1.png',
        'floor_2': 'data/pngs/floor/floor_2.png',
        'floor_lava_1': 'data/pngs/floor/floor_lava_1.png', // Assuming this path for lava
        // Walls
        'wall_1': 'data/pngs/wall/wall_1.png',
        'wall_2': 'data/pngs/wall/wall_2.png',
        // Pamphlets (Corrected Path)
        'pamphlet1': 'data/weapons/pamphlets/pamphlet1.png', 
        'pamphlet2': 'data/weapons/pamphlets/pamphlet2.png',
        'pamphlet3': 'data/weapons/pamphlets/pamphlet3.png',
      }
    };
    this.pamphletTextureNames = ['pamphlet1', 'pamphlet2', 'pamphlet3'];
  }

  async loadAll() {
    console.log('Loading raw assets...');
    try {
      await this.loadTextures();
      this.createMaterials();
      return true;
    } catch (error) {
      console.error('Failed to load raw assets:', error);
      return false;
    }
  }
  
  async loadTextures() {
    const loader = new THREE.TextureLoader();
    const promises = [];
    for (const [name, path] of Object.entries(this.assetDefs.textures)) {
      promises.push(
        new Promise((resolve) => {
          loader.load(
            path,
            (texture) => { // onLoad
              this.textures[name] = texture;
              resolve();
            },
            undefined, // onProgress
            (error) => { // onError
              console.warn(`Could not load texture '${name}' from path: ${path}`, error.target.src);
              this.textures[name] = null;
              resolve(); // Resolve anyway to prevent hanging
            }
          );
        })
      );
    }
    await Promise.all(promises);
    console.log('Texture loading complete.');
  }
  
  createMaterials() {
    for (const [name, texture] of Object.entries(this.textures)) {
        if (texture) {
            this.materials[name] = new THREE.MeshStandardMaterial({ map: texture });
        }
    }
    console.log('Materials created.');
  }
  
  getMaterial(name) { 
    if (!this.materials[name]) {
        console.warn(`Material '${name}' not found. Using fallback.`);
        return new THREE.MeshStandardMaterial({ color: 0xff00ff }); // Bright pink for missing materials
    }
    return this.materials[name];
  }
  
  getTexture(name) { return this.textures[name] || null; }
  
  getRandomPamphletMaterial() {
    const textureName = this.pamphletTextureNames[Math.floor(Math.random() * this.pamphletTextureNames.length)];
    const material = this.getMaterial(textureName);
    return material ? material.clone() : new THREE.MeshBasicMaterial({ color: 0xffff00 }); 
  }
}

window.assetManager = new AssetManager();