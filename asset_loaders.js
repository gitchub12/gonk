// BROWSERFIREFOXHIDE asset_loaders.js
// Consolidated file for loading all non-character assets like textures and furniture.

// === RAW ASSET LOADER ===
class AssetManager {
  constructor() {
    this.textures = {};
    this.materials = {};
    this.assetDefs = {
      textures: {
        'ceiling_1': 'data/pngs/ceiling/ceiling_1.png',
        'door_1': 'data/pngs/door/door_1.png',
        'floor_1': 'data/pngs/floor/floor_1.png',
        'wall_1': 'data/pngs/wall/wall_1.png',
        'pamphlet1': 'data/weapons/pamphlets/pamphlet1.png', 
      }
    };
    this.pamphletTextureNames = ['pamphlet1'];
  }

  async loadAll() {
    await this.loadTextures();
    this.createMaterials();
  }
  
  async loadTextures() {
    const loader = new THREE.TextureLoader();
    const promises = [];
    for (const [name, path] of Object.entries(this.assetDefs.textures)) {
      promises.push( new Promise((resolve) => {
          loader.load(path, (texture) => { this.textures[name] = texture; resolve() },
            undefined, (error) => { this.textures[name] = null; resolve() }
          );
      }));
    }
    await Promise.all(promises);
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
        return new THREE.MeshStandardMaterial({ color: 0xff00ff });
    }
    return this.materials[name];
  }
  
  getRandomPamphletMaterial() {
    const textureName = this.pamphletTextureNames[Math.floor(Math.random() * this.pamphletTextureNames.length)];
    const material = this.getMaterial(textureName);
    return material ? material.clone() : new THREE.MeshBasicMaterial({ color: 0xffff00 }); 
  }
}

// === FURNITURE LOADER ===
class FurnitureLoader {
    // ... existing furniture loader class ...
}

// === INSTANTIATION ===
window.assetManager = new AssetManager();
window.furnitureLoader = new FurnitureLoader();