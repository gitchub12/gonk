// BROWSERFIREFOXHIDE weapon_icons.js
// update: Fixed a critical bug where an NPC's weapon mesh was not being correctly assigned to the NPC instance, causing ranged units to default to melee attacks. Both attach and remove functions now correctly modify the primary NPC object.
// update: Added a clear() method and improved disposal logic to prevent memory leaks during level transitions.

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
        
        this.activeWeaponMeshes = persistentAllyWeapons;
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

        try {
            const texture = await new THREE.TextureLoader().loadAsync(pngPath);
            if (!texture || !texture.image) {
                console.warn(`Texture could not be loaded for weapon: ${weaponName}`);
                return null;
            }
            texture.magFilter = THREE.NearestFilter;
            texture.minFilter = THREE.NearestFilter;

            const weaponGroup = new THREE.Group();
            const aspect = texture.image.width / texture.image.height;
            
            const height = 0.5;
            const width = height * aspect;
            const thickness = 0.02; 
            const layers = 3; 
            
            const mat = new THREE.MeshStandardMaterial({
                map: texture,
                transparent: true,
                alphaTest: 0.1,
                side: THREE.DoubleSide,
                roughness: 0.8,
                metalness: 0.1,
                emissive: new THREE.Color(0x000000), // Default black emissive
                emissiveIntensity: 0
            });
            
            const geo = new THREE.PlaneGeometry(width, height);

            for (let i = 0; i < layers; i++) {
                const layerMesh = new THREE.Mesh(geo, mat.clone());
                layerMesh.position.z = (i - (layers - 1) / 2) * thickness;
                weaponGroup.add(layerMesh);
            }
            
            this.loadedWeapons.set(weaponName, weaponGroup);
            return weaponGroup;
        } catch (error) {
            console.error(`Error creating weapon ${weaponName} from ${pngPath}:`, error);
            return null;
        }
    }
    
    getCategoryFromName(weaponName) {
        // FIX: The weapon prefix doesn't always match the folder name (e.g., 'long' vs 'longarm').
        // This map ensures the correct folder is always used.
        const prefixToCategoryMap = {
            'long': 'longarm',
            'melee': 'melee',
            'pistol': 'pistol',
            'rifle': 'rifle',
            'saber': 'saber', // For NPC sabers if any
            'unique': 'unique'
        };

        const nameParts = weaponName.split('_');
        if (nameParts.length > 1) {
            return prefixToCategoryMap[nameParts[0]] || nameParts[0];
        }
        return 'unique'; // Default to unique if no category prefix
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
            // FIX: Construct the correct path for NPC weapons using their category.
            // e.g., 'pistol_dh17_rebel' -> category 'pistol' -> 'data/NPConlyweapons/pistol/pistol_dh17_rebel.png'
            const category = this.getCategoryFromName(weaponName);
            const npcWeaponPath = `data/NPConlyweapons/${category}/${weaponName}.png`;
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

        if (category === 'saber') {
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
                    child.material.emissiveIntensity = (category === 'saber') ? 1.0 : 0.05;
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