console.log("FurnitureLoader v3 loaded.");
class FurnitureLoader {
    constructor(assetManager) {
        this.assetManager = assetManager;
        this.modelCache = new Map();
        this.config = null;
        this.configPath = '/furniture_config.json';
        this.modelBasePath = '/data/furniture/';
    }

    async _loadConfig() {
        if (this.config) return;
        try {
            const response = await fetch(this.configPath);
            if (!response.ok) throw new Error(`Failed to fetch furniture config at ${this.configPath}`);
            this.config = await response.json();
        } catch (error) {
            console.error("Error loading furniture config:", error);
        }
    }

    async getModel(modelName) {
        if (this.modelCache.has(modelName)) {
            const cached = this.modelCache.get(modelName);
            return cached ? cached.clone() : null;
        }

        await this._loadConfig();
        if (!this.config || !this.config.models[modelName]) {
            console.error(`Furniture model "${modelName}" not found in config.`);
            return null;
        }

        const modelFileName = this.config.models[modelName].file;
        const modelJsonPath = `${this.modelBasePath}${modelFileName}`;

        try {
            const response = await fetch(modelJsonPath);
            if (!response.ok) throw new Error(`Network response was not ok for ${modelJsonPath}`);
            const modelData = await response.json();

            const texturePromises = [];
            if (modelData.textures) {
                for (const key in modelData.textures) {
                    const texturePath = modelData.textures[key];
                    if (texturePath) {
                        const fullTexturePath = `/data/furniture/textures/${texturePath}`;
                        texturePromises.push(this.assetManager.loadTexture(fullTexturePath));
                    }
                }
                await Promise.all(texturePromises);
            }

            const modelObject = this.createModelObject(modelData);
            if (modelObject) {
                this.modelCache.set(modelName, modelObject);
                return modelObject.clone();
            }
            throw new Error("createModelObject returned null");

        } catch (error) {
            console.error(`Error processing furniture model ${modelName}:`, error);
            this.modelCache.set(modelName, null);
            return null;
        }
    }

    createModelObject(modelData) {
        const group = new THREE.Group();
        const scale = 0.0625;

        if (!modelData.elements || !Array.isArray(modelData.elements)) {
            console.error("Invalid model data: 'elements' property is missing or not an array.", modelData);
            return group;
        }

        const materials = {};
        if (modelData.textures) {
            for (const key in modelData.textures) {
                const texturePath = modelData.textures[key];
                if (!texturePath) continue;
                const materialName = texturePath.split('/').pop().replace(/\..+$/, '');
                materials[key] = this.assetManager.getMaterial(materialName);
            }
        }

        modelData.elements.forEach((element, i) => {
            if (!element.from || !Array.isArray(element.from) || element.from.length < 3 ||
                !element.to || !Array.isArray(element.to) || element.to.length < 3) {
                console.warn(`Skipping element ${i} due to missing or invalid 'from'/'to' properties.`, element);
                return; // Skips to the next element in forEach
            }

            const from = element.from;
            const to = element.to;
            const size = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
            if (size.some(s => s < 0)) {
                console.warn(`Skipping element ${i} due to negative size.`, element);
                return;
            }
            const geometry = new THREE.BoxGeometry(size[0] * scale, size[1] * scale, size[2] * scale);

            const position = [
                (from[0] + size[0] / 2) * scale - 0.5,
                (from[1] + size[1] / 2) * scale - 0.5,
                (from[2] + size[2] / 2) * scale - 0.5
            ];

            const faceMaterials = [];
            const faceOrder = ['east', 'west', 'up', 'down', 'south', 'north'];

            if (element.faces) {
                faceOrder.forEach((faceName, index) => {
                    const faceData = element.faces[faceName];
                    if (faceData && faceData.texture) {
                        let textureId = faceData.texture.substring(1);
                        faceMaterials[index] = materials[textureId] || new THREE.MeshBasicMaterial({ color: 0xff00ff, wireframe: true });

                        if (faceData.uv && Array.isArray(faceData.uv) && faceData.uv.length >= 4) {
                            const uv = faceData.uv;
                            const u0 = uv[0] / 16; const v0 = uv[1] / 16;
                            const u1 = uv[2] / 16; const v1 = uv[3] / 16;
                            
                            const faceUVs = [ new THREE.Vector2(u0, 1 - v1), new THREE.Vector2(u1, 1 - v1), new THREE.Vector2(u1, 1 - v0), new THREE.Vector2(u0, 1 - v0) ];
                            
                            const faceIndex = index * 2;
                            if (geometry.faceVertexUvs[0][faceIndex] && geometry.faceVertexUvs[0][faceIndex+1]) {
                                geometry.faceVertexUvs[0][faceIndex] = [faceUVs[0], faceUVs[1], faceUVs[3]];
                                geometry.faceVertexUvs[0][faceIndex + 1] = [faceUVs[1], faceUVs[2], faceUVs[3]];
                            }
                        }
                    } else {
                        faceMaterials[index] = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 });
                    }
                });
            }
            
            const mesh = new THREE.Mesh(geometry, faceMaterials);
            mesh.position.set(position[0], position[1], position[2]);

            if (element.rotation && element.rotation.origin && Array.isArray(element.rotation.origin) && element.rotation.origin.length >= 3) {
                const rot = element.rotation;
                const angle = THREE.MathUtils.degToRad(rot.angle);
                const axis = new THREE.Vector3(rot.axis === 'x' ? 1 : 0, rot.axis === 'y' ? 1 : 0, rot.axis === 'z' ? 1 : 0);
                
                const origin = new THREE.Vector3( rot.origin[0] * scale - 0.5, rot.origin[1] * scale - 0.5, rot.origin[2] * scale - 0.5 );

                const pivot = new THREE.Group();
                pivot.position.copy(origin);
                mesh.position.sub(origin);
                pivot.add(mesh);
                pivot.quaternion.setFromAxisAngle(axis, angle);
                group.add(pivot);
            } else {
                group.add(mesh);
            }
        });

        return group;
    }
}
