// BROWSERFIREFOXHIDE weapon_icons.js
// update: Fixed a critical bug where an NPC's weapon mesh was not being correctly assigned to the NPC instance, causing ranged units to default to melee attacks. Both attach and remove functions now correctly modify the primary NPC object.
// update: Added a clear() method and improved disposal logic to prevent memory leaks during level transitions.
// update: Modified getCategoryFromName to correctly parse player weapon keys (starting with 'g') and map them to the correct inventory categories (pistol, rifle, longarm, etc.), fixing the slot assignment error.
// fix: Corrected the category mapping for NPC saber weapons (those not starting with 'g') to search the expected 'saber' folder, resolving 404 errors for NPC sabers used in character JSONs.
// fix: Corrected typo 'persistentAllyWehes' to 'persistentAllyWeapons' in the clear method, resolving the game-breaking ReferenceError.

class WeaponIconSystem {
    constructor() {
        this.loadedWeapons = new Map();
        this.activeWeaponMeshes = []; // List of all live weapon meshes in the scene
    }

    clear() {
        // This is called when a level changes to clean up weapon meshes of non-persistent NPCs.
        const persistentAllyWeapons = [];
        if (window.game && window.game.state && window.game.state.allies) {
            window.game.state.allies.forEach(ally => {
                if (ally.npc && ally.npc.weaponMesh) {
                    persistentAllyWeapons.push(ally.npc.weaponMesh);
                }
            });
        }
        
        this.activeWeaponMeshes.forEach(weaponMesh => {
            if (!persistentAllyWeapons.includes(weaponMesh)) {
                 // The weapon mesh is removed from the scene when its parent NPC group is removed.
                 // We just need to dispose of its geometry and materials here.
                 this._disposeOfMesh(weaponMesh);
            }
        });
        
        this.activeWeaponMeshes = persistentAllyWeapons; // FIX: Corrected typo from persistentAllyWehes
    }

    _disposeOfMesh(mesh) {
        if (!mesh) return;
        mesh.traverse(child => {
            if (child.isMesh) {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => {
                            if (m.map) m.map.dispose();
                            m.dispose();
                        });
                    } else {
                        if (child.material.map) child.material.map.dispose();
                        child.material.dispose();
                    }
                }
            }
        });
    }

    async preloadWeapons(levelData) {
        const weaponPaths = new Set();
        if (levelData && levelData.layers && levelData.layers.npcs) {
            const npcLayer = new Map(levelData.layers.npcs);
            for (const npc of npcLayer.values()) {
                if (npc.properties && npc.properties.weapon) {
                    weaponPaths.add(npc.properties.weapon);
                }
            }
        }

        const promises = [];
        for (const path of weaponPaths) {
            if(!path || path === "") continue;
            const name = path.split('/').pop().replace('.png', ''); // e.g., 'pistol_dh17_rebel'
            
            // FIX: If the path is just a filename, construct the full path.
            // This handles cases where level data might store only the weapon name.
            let fullPath = path;
            if (!path.includes('/')) {
                const category = this.getCategoryFromName(name);
                fullPath = `data/NPConlyweapons/${category}/${name}.png`;
            }

            if (!this.loadedWeapons.has(name)) {
                promises.push(this.createWeaponFromPNG(name, fullPath));
            }
        }
        await Promise.all(promises);
    }
    
    async createWeaponFromPNG(weaponName, pngPath) {
        if (this.loadedWeapons.has(weaponName)) {
            return this.loadedWeapons.get(weaponName);
        }

        let texture;
        try {
            texture = await new THREE.TextureLoader().loadAsync(pngPath);
            if (!texture || !texture.image) {
                console.warn(`Texture could not be loaded for weapon: ${weaponName}. Using placeholder.`);
                texture = null; // Explicitly set to null if image is bad
            } else {
                texture.magFilter = THREE.NearestFilter;
                texture.minFilter = THREE.NearestFilter;
            }
        } catch (error) {
            console.error(`Error loading texture for weapon ${weaponName} from ${pngPath}:`, error);
            texture = null; // Explicitly set to null on error
        }

        const weaponGroup = new THREE.Group();
        let width = 0.5, height = 0.5; // Default size for placeholder
        if (texture) {
            const aspect = texture.image.width / texture.image.height;
            height = 0.5;
            width = height * aspect;
        }
        
        const thickness = 0.001; 
        const layers = 3; 
        
        let mat;
        if (texture) {
            mat = new THREE.MeshStandardMaterial({
                map: texture,
                transparent: true,
                alphaTest: 0.1,
                side: THREE.DoubleSide,
                roughness: 0.8,
                metalness: 0.1,
                emissive: new THREE.Color(0x000000), // Default black emissive
                emissiveIntensity: 0
            });
        } else {
            // Fallback material (magenta for missing texture)
            mat = new THREE.MeshStandardMaterial({
                color: 0xff00ff, // Magenta
                roughness: 0.8,
                metalness: 0.1,
                side: THREE.DoubleSide
            });
        }
        
        const geo = new THREE.PlaneGeometry(width, height);

        for (let i = 0; i < layers; i++) {
            const layerMesh = new THREE.Mesh(geo, mat.clone());
            layerMesh.position.z = (i - (layers - 1) / 2) * thickness;
            weaponGroup.add(layerMesh);
        }
        
        this.loadedWeapons.set(weaponName, weaponGroup);
        return weaponGroup;
    }
    
    getCategoryFromName(weaponName) {
        // Map prefixes to folder/inventory category keys. Player weapon names start with 'g'.
        let name = weaponName.toLowerCase();
        
        // Handle names that start with 'g' (player weapons) by stripping the 'g' prefix
        let isPlayerWeapon = name.startsWith('g');
        if (isPlayerWeapon) {
            name = name.slice(1);
        }
        
        const prefixToCategoryMap = {
            'melee': 'melee', 
            'pistol': 'pistol',
            'rifle': 'rifle',
            'long': 'longarm',
            // Note: 'saberhilt' is player, 'saber' is often NPC
            'saberhilt': 'saberhiltoverlayer', 
            'saber': 'saber', 
            'unique': 'unique'
        };
        
        const nameParts = name.split('_');
        if (nameParts.length > 1) {
            const prefix = nameParts[0];
            let category = prefixToCategoryMap[prefix] || prefix;

            // FIX: If it's an NPC weapon and the name starts with 'saber', assume the folder name is simply 'saber'
            if (!isPlayerWeapon && category === 'saber') {
                 return 'saber';
            }
            
            if (category === 'long') {
                return 'longarm';
            }
            
            // Handle the zapper
            if (category === 'melee' && name.includes('zapper')) {
                return 'melee';
            }

            return category;
        }
        return 'unique'; // Default to unique if no clear category prefix
    }

    async getWeaponPickupMesh(weaponName) {
        let weaponTemplate = this.loadedWeapons.get(weaponName);
        if (!weaponTemplate) {
            const category = this.getCategoryFromName(weaponName);
            let npcWeaponPath;
            if (category === 'melee' && weaponName.includes('zapper')) {
                npcWeaponPath = `data/gonkonlyweapons/melee/gmelee_zapper/gmelee_zapper_a.png`;
            } else {
                npcWeaponPath = `data/NPConlyweapons/${category}/${weaponName}.png`;
            }
            weaponTemplate = await this.createWeaponFromPNG(weaponName, npcWeaponPath);
            if (!weaponTemplate) {
                console.error(`Failed to load weapon for pickup: ${weaponName}`);
                return null;
            }
        }

        const weaponMesh = weaponTemplate.clone();
        weaponMesh.children.forEach(child => child.material = child.material.clone());

        const weaponData = window.assetManager.weaponData || {};
        const weaponConfig = weaponData[weaponName] || {};
        const category = weaponConfig.category || this.getCategoryFromName(weaponName);
        const weaponDefaults = weaponData._defaults || {};

        let poseData = weaponConfig.offsets;
        let glowData = weaponConfig.glow;

        if (!poseData && weaponDefaults && weaponDefaults.categoryDefaults) {
            poseData = weaponDefaults.categoryDefaults[category]?.offsets;
        }
        if (!glowData && weaponDefaults && weaponDefaults.categoryDefaults) {
            glowData = weaponDefaults.categoryDefaults[category]?.glow;
        }

        // Apply pose data for pickup (can be different from character attachment)
        if (poseData) {
            // For pickups, we might want a more generic upright pose or a slightly rotated one
            // For now, let's use a simplified version of the attached pose
            weaponMesh.position.set(0, 0, 0); // Reset position relative to its own group
            weaponMesh.rotation.set(0, Math.PI / 2, 0); // Rotate to face forward/upright
            if (poseData.scale) weaponMesh.scale.setScalar(poseData.scale * 0.01); // Scale down for pickup
        } else {
            weaponMesh.position.set(0, 0, 0);
            weaponMesh.rotation.set(0, Math.PI / 2, 0);
            weaponMesh.scale.setScalar(0.005); // Default scale if no pose data
        }
        
        if (glowData) {
            const lightOrigin = glowData.origin || {x: 0, y: 0, z: 0};
            const light = new THREE.PointLight(glowData.color, glowData.intensity, glowData.distance, glowData.decay || 2);
            light.position.set(lightOrigin.x, lightOrigin.y, lightOrigin.z);
            weaponMesh.add(light);
            weaponMesh.userData.light = light; 
            
            weaponMesh.children.forEach(child => {
                if (child.isMesh) {
                    child.material.emissive.set(glowData.color);
                    child.material.emissiveIntensity = (category === 'saberhiltoverlayer' || category === 'saber') ? 1.0 : 0.05;
                }
            });
        }

        return weaponMesh;
    }

    async attachToCharacter(npc, weaponName) {
        const characterMesh = npc.mesh;
        const weaponData = window.assetManager.weaponData || {};
        const weaponConfig = weaponData[weaponName] || {};
        const category = weaponConfig.category || this.getCategoryFromName(weaponName);

        if (npc.traits) {
            if (npc.traits.weaponRestrictions && npc.traits.weaponRestrictions.includes(category)) {
                return;
            }
            const techReq = weaponConfig.technicalRequirement || 0;
            const forceReq = weaponConfig.forceSensitivityRequirement || 0;
            const npcTech = npc.traits.technicalUnderstanding || 0;
            const npcForce = npc.traits.forceSensitivity || 0;
            if (npcTech < techReq || npcForce < forceReq) {
                return;
            }
        }

        let weaponTemplate = this.loadedWeapons.get(weaponName);
        if (!weaponTemplate) {
            // FIX: Construct the correct path for NPC weapons using their resolved category.
            const category = this.getCategoryFromName(weaponName);
            let npcWeaponPath;
            if (category === 'melee' && weaponName.includes('zapper')) {
                // Zapper is a special case, located in the player weapon directory.
                // We hardcode the path to the 'a' frame, as the NPC weapon system currently treats it as static.
                npcWeaponPath = `data/gonkonlyweapons/melee/gmelee_zapper/gmelee_zapper_a.png`;
            } else {
                npcWeaponPath = `data/NPConlyweapons/${category}/${weaponName}.png`;
            }
            weaponTemplate = await this.createWeaponFromPNG(weaponName, npcWeaponPath);
            if (!weaponTemplate) {
                console.error(`Failed to load weapon: ${weaponName}`);
                return;
            }
        }

        if (npc.weaponMesh) this.removeWeapon(npc);
        
        const weaponMesh = weaponTemplate.clone();
        weaponMesh.children.forEach(child => child.material = child.material.clone());

        const weaponDefaults = weaponData._defaults || {};
        let poseData = weaponConfig.offsets;
        let glowData = weaponConfig.glow;

        if (!poseData && weaponDefaults && weaponDefaults.categoryDefaults) {
            poseData = weaponDefaults.categoryDefaults[category]?.offsets;
        }
        if (!glowData && weaponDefaults && weaponDefaults.categoryDefaults) {
            glowData = weaponDefaults.categoryDefaults[category]?.glow;
        }

        if (category === 'saberhiltoverlayer' || category === 'saber') {
             glowData = { color: "#ff0000", intensity: 3.3, distance: 1.5, origin: { x: -0.1, y: -0.05, z: -0.15 }, decay: 2, ...(glowData || {}) };
            weaponMesh.children.forEach(child => {
                if (child.isMesh) {
                    child.material.roughness = 1.0;
                    child.material.metalness = 0.0;
                }
            });
        }

        if (poseData) {
            weaponMesh.position.set(poseData.position.x, poseData.position.y, poseData.position.z);
            weaponMesh.rotation.set(poseData.rotation.x, poseData.rotation.y, poseData.rotation.z);
            if (poseData.scale) weaponMesh.scale.setScalar(poseData.scale);
            if (poseData.planes && weaponMesh.children.length === 3) {
                const [plane1, , plane3] = weaponMesh.children;
                plane1.position.z = poseData.planes.dist;
                plane3.position.z = -poseData.planes.dist;
                plane1.rotation.y = THREE.MathUtils.degToRad(poseData.planes.yaw);
                plane3.rotation.y = THREE.MathUtils.degToRad(-poseData.planes.yaw);
                plane1.rotation.x = THREE.MathUtils.degToRad(poseData.planes.pitch);
                plane3.rotation.x = THREE.MathUtils.degToRad(-poseData.planes.pitch);
            }
        } else {
            weaponMesh.position.set(0.1, -0.25, 0.2); 
            weaponMesh.rotation.set(0, -Math.PI / 2, 0);
        }
        
        if (glowData) {
            const lightOrigin = glowData.origin || {x: 0, y: 0, z: 0};
            const light = new THREE.PointLight(glowData.color, glowData.intensity, glowData.distance, glowData.decay || 2);
            light.position.set(lightOrigin.x, lightOrigin.y, lightOrigin.z);
            weaponMesh.add(light);
            weaponMesh.userData.light = light; 
            
            weaponMesh.children.forEach(child => {
                if (child.isMesh) {
                    child.material.emissive.set(glowData.color);
                    child.material.emissiveIntensity = (category === 'saberhiltoverlayer' || category === 'saber') ? 1.0 : 0.05;
                }
            });
        }

        npc.weaponMesh = weaponMesh; // Assign directly to the NPC instance
        if (characterMesh.parts && characterMesh.parts.leftArm) {
            characterMesh.parts.leftArm.add(weaponMesh);
        } else {
            console.error("Character does not have a leftArm to attach a weapon to.");
        }
        
        this.activeWeaponMeshes.push(weaponMesh);
    }

    removeWeapon(npc) {
        if (npc.weaponMesh && npc.mesh.parts && npc.mesh.parts.leftArm) {
            npc.mesh.parts.leftArm.remove(npc.weaponMesh);
            
            this.activeWeaponMeshes = this.activeWeaponMeshes.filter(mesh => mesh !== npc.weaponMesh);

            this._disposeOfMesh(npc.weaponMesh);
            
            npc.weaponMesh = null; // Clear from the NPC instance
        }
    }
    
    setGlobalGlowProperties(color, intensity, distance, origin) {
        const threeColor = new THREE.Color(color);
        const intensityFactor = intensity; 
        
        this.activeWeaponMeshes.forEach(weaponMesh => {
            // This part is for NPC weapon glows, which still use lights for now.
            const light = weaponMesh.userData.light;
            if (light) {
                light.color.copy(threeColor);
                light.intensity = intensityFactor;
                light.distance = distance;
            }
            
            weaponMesh.children.forEach(child => {
                if (child.isMesh) {
                    child.material.emissive.copy(threeColor);
                }
            });
        });
        
        game.entities.projectiles.forEach(projectile => {
            if (projectile instanceof BlasterBolt && projectile.mesh.material.isMeshStandardMaterial) {
                projectile.mesh.material.color.copy(threeColor);
                // Update the new glow sprite instead of the old light
                if (projectile.glowSprite) {
                    projectile.glowSprite.material.color.copy(threeColor);
                    const scale = intensityFactor * 0.8; // Convert intensity to scale
                    projectile.glowSprite.scale.set(scale, scale, scale);
                }
            }
        });
    }
}

window.weaponIcons = new WeaponIconSystem();