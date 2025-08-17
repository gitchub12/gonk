// BROWSERFIREFOXHIDE furniture_loader.js
// Parses and constructs 3D models from Minecraft Java Edition custom model JSON files.

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
                const texture = await window.assetManager.loadTexture(resolvedPath, resolvedPath);
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