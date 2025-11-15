// BROWSERFIREFOXHIDE player_gear.js
// update: Forced a camera matrix update before firing weapons to ensure projectile origin and melee hit detection use the correct, up-to-date player position, fixing spawn/hit registration errors.
// update: Replaced performance-intensive PointLights on blaster bolts with billboarded glow sprites for significant optimization in large battles.
// update: Changed BlasterBolt material from MeshBasicMaterial to MeshStandardMaterial to allow it to receive lighting and emissive properties, making it glow correctly.
// rewrite: Refactored PlayerWeaponSystem to manage an array of weapons and allow cycling. MeleeWeapon class is now generic for all player melee weapons.
// update: Corrected the path for the Gaffi Stick asset to fix 404 error.
// rewrite: Implemented sprite-based frame animation for the Zapper, extended weapon slots, and added logic for starting gear including the 4-slot module.
// fix: Corrected Zapper path construction in _generateWeaponConfigs to eliminate duplication and ensure the correct key is used, solving the persistent 404 error.
// fix: Ensured only the Zapper loads multiple frames; all other weapons load only their base image for the 'idle' state, fixing massive 404 floods.
// fix: Implemented robust hit detection in PlayerWeaponSystem.performMeleeHitDetection for melee/saber weapons.

class BlasterBolt {
    constructor(startPos, direction, config) {
        this.owner = config.owner;
        this.ownerType = config.ownerType || 'enemy'; // 'player', 'ally', 'enemy'
        this.damage = config.damage || 5;
        this.speed = GAME_GLOBAL_CONSTANTS.WEAPONS.BLASTER_BOLT_SPEED;
        this.lifetime = config.lifetime || 120; // frames

        const radius = GAME_GLOBAL_CONSTANTS.WEAPONS.BLASTER_BOLT_RADIUS * (this.ownerType === 'player' ? 0.5 : 1.0);
        const geo = new THREE.CylinderGeometry(radius, radius, 0.5, 8);
        const mat = new THREE.MeshStandardMaterial({ 
            color: 0xff0000, 
            emissive: 0xff0000,
            emissiveIntensity: 1,
            transparent: true,
            opacity: GAME_GLOBAL_CONSTANTS.WEAPONS.BLASTER_BOLT_OPACITY
        });

        this.mesh = new THREE.Mesh(geo, mat);
        this.mesh.position.copy(startPos);

        // PERFORMANCE FIX: Use a shared glow sprite instead of a PointLight
        if (window.sharedGlowMaterial) {
            this.glowSprite = new THREE.Sprite(window.sharedGlowMaterial.clone());
            this.glowSprite.material.color.set(0xff0000);
            const glowScale = GAME_GLOBAL_CONSTANTS.WEAPONS.BLASTER_GLOW_SIZE; // Adjust for desired glow size
            this.glowSprite.material.opacity = GAME_GLOBAL_CONSTANTS.WEAPONS.BLASTER_BOLT_OPACITY;
            this.glowSprite.scale.set(glowScale, glowScale, glowScale);
            this.mesh.add(this.glowSprite);
        }

        const quaternion = new THREE.Quaternion();
        quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
        this.mesh.quaternion.copy(quaternion);

        this.velocity = direction.clone().normalize().multiplyScalar(this.speed);
        
        // The collider sphere remains for hit detection
        this.collider = new THREE.Sphere(this.mesh.position, 0.25);
        this.uuid = this.mesh.uuid;

        window.game.scene.add(this.mesh);
    }

    update(deltaTime) {
        this.mesh.position.add(this.velocity);
        this.collider.center.copy(this.mesh.position);
        this.lifetime--;
        return this.lifetime > 0;
    }

    dispose() {
        window.game.scene.remove(this.mesh);
        if (this.glowSprite) {
            this.glowSprite.material.dispose();
        }
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
    }
}


class PamphletProjectile {
    constructor(position, direction, speed, lifetime) {
        const textureName = window.assetManager.getRandomPamphletTextureName();
        const texture = window.assetManager.getTexture(textureName); // Get by name, which is just "pamphlet_00XX"
        
        const sizeMultiplier = GAME_GLOBAL_CONSTANTS.WEAPONS.PAMPHLET_SIZE_MULTIPLIER || 1.0;
        const width = 0.2 * sizeMultiplier;
        const height = 0.3 * sizeMultiplier;

        let material;
        if (!texture) {
            console.warn(`Pamphlet texture '${textureName}' not found. Using fallback.`);
            material = new THREE.MeshBasicMaterial({ color: 0xff00ff }); // Fallback color
        } else {
            material = new THREE.MeshStandardMaterial({
                map: texture,
                side: THREE.DoubleSide,
                transparent: true,
                alphaTest: 0.1
            });
        }

        this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
        this.mesh.position.copy(position);

        this.mesh.quaternion.copy(game.camera.quaternion);
        this.mesh.rotation.x -= Math.PI / 6;

        this.velocity = direction.clone().multiplyScalar(speed);
        this.lifetime = lifetime;
        this.collider = new THREE.Sphere(this.mesh.position, 0.3 * sizeMultiplier); // Increased radius
        this.uuid = this.mesh.uuid;
        this.ownerType = 'player'; // Pamphlets are always from the player
        this.isStuck = false;

        window.game.scene.add(this.mesh);
    }

    update(deltaTime) {
        if (!this.isStuck) {
            this.mesh.position.add(this.velocity);
            this.collider.center.copy(this.mesh.position);
            this.mesh.rotation.z += 0.2;
        }
        
        this.lifetime--;

        return this.lifetime > 0;
    }

    dispose() {
        if(this.mesh.parent) this.mesh.parent.remove(this.mesh);
        window.game.scene.remove(this.mesh);
        if(this.mesh.geometry) this.mesh.geometry.dispose();
        if(this.mesh.material) {
            if(this.mesh.material.map) this.mesh.material.map.dispose();
            this.mesh.material.dispose();
        }
    }
}

class MeleeWeapon {
    constructor(config) {
        this.config = config;
        this.textures = {};
        this.state = 'idle'; // 'idle', 'attacking'
        this.animTimer = 0;
        this.animFrame = 0;
        this.animDuration = 0.25;
        this.lightFadeTimer = 0; // Timer to control light fade
        this.name = config.name;
        this.isReady = false;

        // For layered weapons like sabers
        this.bladeMesh = null; 

        this.light = new THREE.PointLight(0x000000, 0, config.glow.distance, config.glow.decay);
        this.light.position.set(0, 0, -0.1); 

        const material = new THREE.MeshStandardMaterial({
            transparent: true, 
            alphaTest: 0.1, 
            side: THREE.DoubleSide,
            depthTest: false, 
            depthWrite: false,
            emissive: new THREE.Color(config.glow.color),
            emissiveIntensity: 0.005,
        });
        
        // This is a placeholder mesh, its texture will be set on loadTextures
        this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
        this.mesh.renderOrder = 999;
        this.mesh.add(this.light);

        this.basePosition = new THREE.Vector3(-0.815, -0.624, -1.5);
        this.mesh.position.copy(this.basePosition);
        this.mesh.rotation.z = -0.1;
        const scale = 1.4872; 
        this.mesh.scale.set(scale, scale, scale);
        
        // Hide until loaded and active
        this.mesh.visible = false;
        
        // Zapper specific animation properties
        this.isZapper = this.config.key.includes('gmelee_zapper');
        if (this.isZapper) {
            this.zapperSequence = ['a', 'b', 'c', 'd', 'e', 'a']; // d is full extension, e is quick return
            this.zapperFrameTime = this.animDuration / (this.zapperSequence.length - 1); // Time per frame
        }
    }

    async loadTextures() {
        if (this.isReady) return;
        
        if (!this.config.frames || Object.keys(this.config.frames).length === 0) return;
        const loader = new THREE.TextureLoader();
        const promises = [];
        
        // Determine which frames to load: all defined frames if Zapper, only 'idle' otherwise
        const framesToLoad = this.isZapper ? Object.keys(this.config.frames) : ['idle'];
        
        for (const key of framesToLoad) {
            // frames[key] contains the path relative to /data/gonkonlyweapons/, e.g., 'melee/gmelee_zapper/gmelee_zapper_a'
            const pathSegment = this.config.frames[key];
            const texturePath = `/data/gonkonlyweapons/${pathSegment}.png`;
            promises.push(new Promise(resolve => {
                loader.load(texturePath, (texture) => {
                    texture.magFilter = THREE.NearestFilter;
                    texture.minFilter = THREE.NearestFilter;
                    this.textures[key] = texture;
                    resolve();
                }, undefined, () => {
                    console.warn(`Failed to load texture for ${this.config.name}: ${texturePath}`);
                    resolve();
                });
            }));
        }

        await Promise.all(promises);

        // --- SABER BLADE LOADING ---
        if (this.config.category === 'saberhiltoverlayer') {
            const bladeTexture = assetManager.getTexture('gsaberbladethick');
            if (bladeTexture) {
                const bladeMaterial = new THREE.MeshStandardMaterial({
                    map: bladeTexture,
                    transparent: true, alphaTest: 0.1, side: THREE.DoubleSide,
                    depthTest: false, depthWrite: false,
                    emissive: new THREE.Color(this.config.glow.color), // Use glow color for blade
                    emissiveIntensity: 1.5 // Start with a visible glow
                });
                this.bladeMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), bladeMaterial);
                this.bladeMesh.renderOrder = 998; // Render blade behind hilt (999)
                this.mesh.add(this.bladeMesh); // Attach blade to hilt
                this.bladeMesh.visible = false; // Start invisible
            } else {
                console.error("Failed to load saber blade texture 'gsaberbladethick'.");
            }
        }

        if (this.textures.idle || this.textures.a) { // Default frame is 'a' or 'idle'
            this.mesh.material.map = this.textures.idle || this.textures.a;
            this.mesh.material.needsUpdate = true;
            this.isReady = true;
        } else {
            console.error(`Weapon ${this.config.name} missing base texture 'a' or 'idle'.`);
        }
    }

    setAsActive() {
        if (!this.isReady) return;
        // Apply the specific transform values when the weapon is made active.
        this.mesh.position.set(this.config.basePosition.x, this.config.basePosition.y, this.config.basePosition.z);
        this.mesh.rotation.set(this.config.rotation.x, this.config.rotation.y, this.config.rotation.z);
        this.mesh.scale.setScalar(this.config.scale);
        this.mesh.visible = true;
        this.state = 'idle';
        this.animTimer = 0;
        this.light.intensity = 0;

        // Play saber ignite sound on switch
        if (this.config.category === 'saberhiltoverlayer') {
            audioSystem.playSoundFromList('saberon');
        }

        if (this.bladeMesh) {
            this.bladeMesh.visible = true;
        }
    }

    setAsInactive() {
        this.mesh.visible = false;
        this.state = 'idle';
        this.light.intensity = 0;

        // Play saber deactivate sound on switch
        if (this.config.category === 'saberhiltoverlayer') {
            audioSystem.playSoundFromList('saberoff');
        }

        if (this.bladeMesh) {
            this.bladeMesh.visible = false;
        }
    }

    attack() {
        if (this.state !== 'idle') return;
        this.state = 'attacking';
        this.animTimer = 0;
        this.animFrame = 0;
        
        if (this.isZapper && this.textures.a) {
             this.mesh.material.map = this.textures.a;
             this.mesh.material.needsUpdate = true;
        }
        
        if (this.config.category === 'saberhiltoverlayer') {
            audioSystem.playSoundFromList('saberswing');
        } else if (this.isZapper) {
            audioSystem.playSoundFromList('zappershot');
        } else {
            // General ranged/pistol fire sound placeholder
            audioSystem.playSoundFromList(`${this.config.category}shot`);
        }

        // Light pops immediately
        this.light.color.set(this.config.glow.color);
        this.light.intensity = this.config.glow.intensity * 3; 
        this.lightFadeTimer = this.config.fadeTime; // Start the new fade timer
    }

    update(deltaTime, totalTime) {
        const bobSpeed = GAME_GLOBAL_CONSTANTS.MOVEMENT.BOB_SPEED;
        const bobAmount = GAME_GLOBAL_CONSTANTS.MOVEMENT.BOB_AMOUNT;
        const playerSpeed = physics.playerCollider.velocity.length();
        const bobIntensity = Math.min(playerSpeed * 20, 1.0);

        this.mesh.position.y = this.basePosition.y + Math.sin(totalTime * bobSpeed) * bobAmount * bobIntensity;
        this.mesh.position.x = this.basePosition.x + Math.cos(totalTime * bobSpeed / 2) * bobAmount * bobIntensity;
        this.mesh.position.z = this.basePosition.z; // FIX: Apply Z-position from basePosition

        // Handle light fading independent of attack state
        if (this.lightFadeTimer > 0) {
            this.lightFadeTimer -= deltaTime;
            const progress = this.lightFadeTimer / this.config.fadeTime;
            this.light.intensity = Math.max(0, this.config.glow.intensity * 3 * progress);
        } else if (this.light.intensity > 0) {
            this.light.intensity = 0;
        }

        // Update blade emissive color from UI controls
        if (this.bladeMesh) {
            // Placeholder: Assume this color is controlled by UI or logic
            const bladeColor = this.config.glow.color;
            this.bladeMesh.material.emissive.set(bladeColor);
            this.bladeMesh.material.needsUpdate = true;
        }

        // --- Zapper Animation Logic (Attack/Extension/Retraction) ---
        if (this.state === 'attacking' && this.isZapper) {
            this.animTimer += deltaTime;
            const sequenceIndex = Math.min(Math.floor(this.animTimer / this.zapperFrameTime), this.zapperSequence.length - 1);
            
            if (sequenceIndex !== this.animFrame) {
                this.animFrame = sequenceIndex;
                const frameKey = this.zapperSequence[this.animFrame];
                if (this.textures[frameKey]) {
                    this.mesh.material.map = this.textures[frameKey];
                    this.mesh.material.needsUpdate = true;
                }
            }

            if (this.animTimer >= this.animDuration) {
                this.state = 'idle';
                this.animFrame = 0;
                this.mesh.material.map = this.textures.a;
                this.mesh.material.needsUpdate = true;
            }
        }
    }
}

class RangedWeapon extends MeleeWeapon {
    constructor(config) {
        super(config);
        this.ammo = 101;
        this.maxAmmo = 101;
        this.attackCooldown = 0.2; // Faster firing rate for ranged
        this.lastAttackTime = 0;
        // Overwrite base position with ranged default
        this.basePosition = new THREE.Vector3(-0.957, -0.624, -1.5);
    }

    attack() {
        const now = performance.now();
        let fireRateBonus = 0;
        if (this.config.category === 'rifle' && game.state.playerStats.rifle_firerate_bonus) {
            fireRateBonus = game.state.playerStats.rifle_firerate_bonus;
        }
        if (now - this.lastAttackTime < (this.attackCooldown * 1000) / (1 + fireRateBonus)) return;
        
        // Check for energy instead of ammo
        if (window.game.state.energy < this.config.energyCost) {
            // play empty sound
            audioSystem.playSoundFromList('empty');
            return;
        }

        // Consume energy
        window.game.state.energy -= this.config.energyCost;

        this.lastAttackTime = now;
        this.state = 'attacking';
        this.animTimer = 0;
        this.animFrame = 0;

        // Fire the blaster bolt
        this.fireBolt();

        // Light pops immediately
        this.light.color.set(this.config.glow.color);
        this.light.intensity = this.config.glow.intensity * 3;
        this.lightFadeTimer = this.config.fadeTime;
    }

    fireBolt() {
        const cam = this.camera;
        cam.updateWorldMatrix(true, true);

        const startPosition = new THREE.Vector3();
        cam.getWorldPosition(startPosition);

        const direction = new THREE.Vector3();
        cam.getWorldDirection(direction);

        // Offset the bolt to appear to come from the weapon, not the player's face.
        const right = new THREE.Vector3();
        right.crossVectors(cam.up, direction).normalize();

        const originOffsetX = GAME_GLOBAL_CONSTANTS.WEAPONS.BOLT_ORIGIN_X;
        const originOffsetY = GAME_GLOBAL_CONSTANTS.WEAPONS.BOLT_ORIGIN_Y;
        const originOffsetZ = GAME_GLOBAL_CONSTANTS.WEAPONS.BOLT_ORIGIN_Z;

        startPosition.add(direction.clone().multiplyScalar(originOffsetZ));
        startPosition.add(right.clone().multiplyScalar(originOffsetX));
        startPosition.y += originOffsetY;

        let damage = this.config.damage || 10;
        if (this.config.category === 'rifle' && game.state.playerStats.rifle_damage_bonus) {
            damage *= (1 + game.state.playerStats.rifle_damage_bonus);
        }
        if (this.config.category === 'pistol' && game.state.playerStats.pistol_damage_bonus) {
            damage *= (1 + game.state.playerStats.pistol_damage_bonus);
        }
        if (this.config.category === 'longarm' && game.state.playerStats.longarm_damage_bonus) {
            damage *= (1 + game.state.playerStats.longarm_damage_bonus);
        }

        const bolt = new BlasterBolt(startPosition, direction, {
            owner: window.physics.playerEntity,
            ownerType: 'player',
            damage: damage
        });
        window.game.entities.projectiles.push(bolt);

        audioSystem.playSoundFromList(`${this.config.category}shot`, 0.5);
    }

    // Ranged weapons have their own simple recoil animation.
    update(deltaTime, totalTime) {
        // Call parent update for bobbing and light fading
        super.update(deltaTime, totalTime);

        if (this.state === 'attacking') {
            this.animTimer += deltaTime;
            const recoilDuration = 0.15; // Total duration of the recoil
            const recoilDistance = 0.05; // How far back it kicks
            const progress = this.animTimer / recoilDuration;

            // A simple parabola: moves back and then returns to start.
            this.mesh.position.z = this.basePosition.z + recoilDistance * Math.sin(progress * Math.PI);

            if (this.animTimer > recoilDuration) {
                this.state = 'idle';
                this.mesh.position.z = this.basePosition.z; // Ensure it snaps back perfectly
            }
        }
    }
}

class SaberWeapon extends MeleeWeapon {
    constructor(config) {
        super(config);
        // Attack animation properties
        this.attackStartPosition = new THREE.Vector3();
        this.attackStartQuaternion = new THREE.Quaternion();
        this.attackTargetPosition = new THREE.Vector3(-0.335, -0.635, -1.638);
        this.attackTargetQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(-1.405, 0.782, 0.546, 'YXZ'));
    }

    setAsActive() {
        super.setAsActive();
        // Store the starting position/rotation for the attack animation
        this.attackStartPosition.copy(this.mesh.position);
        this.attackStartQuaternion.copy(this.mesh.quaternion);
    }

    setAsInactive() {
        super.setAsInactive();
    }

    attack() {
        if (this.state !== 'idle') return; // Only allow attack from idle state
        // Store the current position and rotation to animate from
        this.attackStartPosition.copy(this.mesh.position);
        this.attackStartQuaternion.copy(this.mesh.quaternion);
        
        super.attack(); // Call parent attack to set state, play sound, and start light fade
    }

    update(deltaTime, totalTime) {
        super.update(deltaTime, totalTime); // Handles bobbing and light fade

        if (this.state === 'attacking') {
            this.animTimer += deltaTime;
            const totalAttackDuration = 4 / 24; // Total time for the swing animation
            const attackInDuration = 1.5 / 24;
            const attackOutDuration = 2.5 / 24;

            if (this.animTimer <= attackInDuration) {
                const progress = Math.sin((this.animTimer / attackInDuration) * (Math.PI / 2)); // Ease out
                this.mesh.position.lerpVectors(this.attackStartPosition, this.attackTargetPosition, progress);
                this.mesh.quaternion.slerpQuaternions(this.attackStartQuaternion, this.attackTargetQuaternion, progress);
            } else if (this.animTimer <= totalAttackDuration) {
                const progress = (this.animTimer - attackInDuration) / attackOutDuration;
                this.mesh.position.lerpVectors(this.attackTargetPosition, this.attackStartPosition, progress);
                this.mesh.quaternion.slerpQuaternions(this.attackTargetQuaternion, this.attackStartQuaternion, progress);
            } else {
                this.state = 'idle';
                this.mesh.position.copy(this.attackStartPosition);
                this.mesh.quaternion.copy(this.mesh.quaternion);
            }
        }
    }
}

class PlayerWeaponSystem {
    constructor(){
      this.camera = null;
      this.weaponHolder = null;
      this.weapons = []; 
      
      this.categories = ['melee', 'pistol', 'rifle', 'longarm', 'unique', 'saberhiltoverlayer', 'special'];
      // Each category slot is now an array to hold multiple weapons
      this.slots = this.categories.map(() => []); 
      // Defines how many weapons can be in each slot
      this.slotCapacity = this.categories.map(() => 0); 
      
      this.unlockedSlots = 0; // Start with 0, will be unlocked by nodes
      this.activeWeaponIndex = 0;
      this.activeWeapon = null;
      this.isAttacking = false;
    }
    
    get primaryWeapon() { return this.activeWeapon; }

    async init(camera, weaponHolder) {
        this.camera = camera;
        this.weaponHolder = weaponHolder;
        
        const weaponPaths = await assetManager.discoverPlayerWeapons();
        const weaponConfigs = this._generateWeaponConfigs(weaponPaths);
        await this._loadAndInstantiateWeapons(weaponConfigs);
        
        await this._addStartingGear();
        
        // Set initial active weapon if available
        if (this.slots[0] && this.slots[0][0]) {
            this.activeWeaponIndex = 0;
            this.setActiveWeapon(0);
        }
    }

    // _generateWeaponConfigs and _loadAndInstantiateWeapons remain the same...
    _generateWeaponConfigs(paths) {
        const weaponConfigs = [];
        const processedWeapons = new Set();

        for (const path of paths) {
            const pathPrefix = '/data/gonkonlyweapons/';
            if (!path.startsWith(pathPrefix)) continue;
            const relativePath = path.substring(pathPrefix.length);
            const parts = relativePath.split('/');
            if (parts.length < 2) continue;
            
            const category = parts[0];
            const filenameWithExt = parts[parts.length - 1];
            const filename = filenameWithExt.replace('.png', '');
            if (!filename) continue;

            let baseKey = filename;
            if (filename.includes('gmelee_zapper_')) {
                baseKey = 'gmelee_zapper';
            }
            
            if (processedWeapons.has(baseKey)) continue;

            let name = filename;
            if (name.startsWith('g')) name = name.slice(1);
            
            if (filename.includes('gmelee_zapper')) {
                 name = 'Zapper';
            } else {
                 const nameParts = name.split('_');
                 name = nameParts.length > 1 ? nameParts[1] : name;
                 name = name.charAt(0).toUpperCase() + name.slice(1);
            }

            const isZapper = baseKey === 'gmelee_zapper';
            const isSaber = category === 'saberhiltoverlayer';

            const frames = {};
            if (isZapper) {
                 const zapperPath = 'melee/gmelee_zapper/gmelee_zapper';
                 frames.a = `${zapperPath}_a`;
                 frames.b = `${zapperPath}_b`;
                 frames.c = `${zapperPath}_c`;
                 frames.d = `${zapperPath}_d`;
                 frames.e = `${zapperPath}_e`;
                 processedWeapons.add(baseKey);
            } else if (isSaber) {
                frames.idle = `saberhiltoverlayer/${filename}`;
                processedWeapons.add(filename);
            } else {
                frames.idle = `${category}/${filename}`;
                processedWeapons.add(filename);
            }

            const baseConfig = {
                key: filename,
                name: name.replace(/_/g, ' '),
                category: category,
                frames: frames,
                glow: { color: "#0088ff", intensity: 1.5, distance: 3, decay: 2 },
                fadeTime: 0.15,
                basePosition: { x: -0.815, y: -0.624, z: -1.5 },
                rotation: { x: 0, y: 0, z: -0.1 },
                scale: 1.4872,
                damage: 10,
                range: category === 'melee' || isSaber ? 1.5 : 15.0,
                cone: 0.8,
                energyCost: 30
            };
            
            if (isSaber) {
                baseConfig.basePosition = { x: -0.9898, y: -0.4164, z: -1.500 };
                baseConfig.rotation = { x: -0.187, y: 0.388, z: 1.126 };
                baseConfig.scale = 1.572;
                baseConfig.glow.color = "#00ff00";
            } else if (category === 'longarm') {
                baseConfig.basePosition = { x: -0.6764, y: -0.624, z: -1.5 };
                baseConfig.rotation = { x: 0, y: 0, z: -0.0227 };
                baseConfig.scale = 2.6388;
            } else if (category === 'rifle') {
                baseConfig.basePosition = { x: -0.7809, y: -0.624, z: -1.5 };
                baseConfig.rotation = { x: 0, y: 0, z: -0.0995 };
                baseConfig.scale = 2.5748;
            } else if (category === 'pistol') {
                baseConfig.basePosition = { x: -0.957, y: -0.624, z: -1.5 };
            } else if (category === 'unique') {
                baseConfig.basePosition = { x: -0.7809, y: -0.624, z: -1.5 };
            }
            
            weaponConfigs.push(baseConfig);
        }
        return weaponConfigs;
    }
    
    async _loadAndInstantiateWeapons(configs) {
        const loadPromises = [];
        configs.forEach(config => {
            let weapon;
            if (config.category === 'saberhiltoverlayer') {
                weapon = new SaberWeapon(config);
            } else if (['pistol', 'rifle', 'longarm', 'unique'].includes(config.category) || config.category === 'longarm') {
                weapon = new RangedWeapon(config);
            } else {
                weapon = new MeleeWeapon(config);
            }
            weapon.camera = this.camera;
            this.weapons.push(weapon);
            this.weaponHolder.add(weapon.mesh);
            loadPromises.push(weapon.loadTextures());
        });
        await Promise.all(loadPromises);
    }
    
    async _addStartingGear() {
        // Unlock and equip starting gear with your default weapons
        this.unlockedSlots = 7; // Unlock all 7 slots by default (melee, pistol, rifle, longarm, unique, saber, special)
        // Set capacity for each slot
        for (let i = 0; i < 7; i++) {
            this.slotCapacity[i] = 1; // Each slot can hold 1 weapon initially
        }

        // Add zapper to melee slot (index 0)
        const zapper = this.weapons.find(w => w.config.key.includes('gmelee_zapper'));
        if (zapper) {
            this.slots[0].push(zapper);
            this.setActiveWeapon(0);
        }

        // Add Relby pistol to pistol slot (index 1)
        const relby = this.weapons.find(w => w.config.key.includes('gpistol_relby'));
        if (relby) {
            this.slots[1].push(relby);
        }

        // Add EE-3 Boba rifle to rifle slot (index 2)
        const ee3Boba = this.weapons.find(w => w.config.key.includes('grifle_ee3_boba'));
        if (ee3Boba) {
            this.slots[2].push(ee3Boba);
        }

        // Add F-11D Phasma longarm to longarm slot (index 3)
        const f11dPhasma = this.weapons.find(w => w.config.key.includes('glong_f11d_phasma'));
        if (f11dPhasma) {
            this.slots[3].push(f11dPhasma);
        }

        // Add E-Web to unique slot (index 4)
        const eweb = this.weapons.find(w => w.config.key.includes('gunique_eweb'));
        if (eweb) {
            this.slots[4].push(eweb);
        }

        // Add Luke's saber to saber slot (index 5)
        const lukeSaber = this.weapons.find(w => w.config.key === 'gsaberhiltluke');
        if (lukeSaber) {
            this.slots[5].push(lukeSaber);
            console.log(`Added Luke saber with key: ${lukeSaber.config.key}`);
        } else {
            console.warn('Could not find Luke saber weapon! Available sabers:',
                this.weapons.filter(w => w.config.category === 'saberhiltoverlayer').map(w => w.config.key));
        }

        this.updateUI();
    }

    setStartingWeapon(category, weaponKey) {
        const slotIndex = this.categories.indexOf(category);
        if (slotIndex === -1 || slotIndex >= this.unlockedSlots) return;

        const weaponInstance = this.weapons.find(w => w.config.key === weaponKey);
        if (!weaponInstance) {
            console.warn(`Cannot set starting weapon. Key not found: ${weaponKey}`);
            return;
        }

        // Clear the slot and add the new starting weapon at the front.
        const slot = this.slots[slotIndex];
        slot.forEach(w => w.setAsInactive()); // Make sure old weapons are hidden
        
        // For simplicity, we replace the entire slot content with the new starting weapon
        this.slots[slotIndex] = [weaponInstance];

        // If this is the active slot, update the active weapon
        if (this.activeWeaponIndex === slotIndex) {
            this.setActiveWeapon(slotIndex);
        }
        this.updateUI();
    }

    async addWeapon(weaponKey) {
        const newWeapon = this.weapons.find(w => w.config.key === weaponKey);
        if (!newWeapon) {
            console.warn(`Failed to add weapon: ${weaponKey}. Not found in pre-loaded weapons.`);
            return;
        }

        const category = newWeapon.config.category;
        const slotIndex = this.categories.indexOf(category);

        if (slotIndex === -1 || slotIndex >= this.unlockedSlots) {
            console.warn(`Cannot add weapon "${weaponKey}": Slot for category "${category}" is locked.`);
            return;
        }

        const slot = this.slots[slotIndex];
        const capacity = this.slotCapacity[slotIndex];

        if (slot.length >= capacity) {
            // Drop the oldest weapon (the one at the front of the array)
            const droppedWeapon = slot.shift(); 
            const dropPosition = window.physics.playerCollider.position.clone();
            const droppedWeaponPickup = new WeaponPickup(droppedWeapon.config.key, dropPosition);
            window.game.entities.droppedWeapons.push(droppedWeaponPickup);
            console.log(`Slot full. Player dropped ${droppedWeapon.config.name}.`);
        }

        // Add the new weapon to the end of the array for this slot
        slot.push(newWeapon);

        // If the new weapon is for the currently active slot, make it active
        if (this.activeWeaponIndex === slotIndex) {
            this.setActiveWeapon(slotIndex);
        } else {
            newWeapon.setAsInactive();
        }
        
        this.updateUI();
        audioSystem.playSound('pickup');
    }

    update(deltaTime, totalTime) {
        if (this.isAttacking && game.state.playerStats.autofire) {
            this.handlePrimaryAttack();
        }
        if (this.activeWeapon) {
            this.activeWeapon.update(deltaTime, totalTime);
        }
    }
    
    _getFilledUnlockedSlots() {
        // A slot is considered "filled" if it has at least one weapon in its array.
        return this.slots.map((w, i) => (w.length > 0 && i < this.unlockedSlots) ? i : -1).filter(i => i !== -1);
    }
    
    nextWeapon() {
        const filledSlots = this._getFilledUnlockedSlots();
        if (filledSlots.length <= 1) return;

        const currentIndexInFilled = filledSlots.indexOf(this.activeWeaponIndex);
        const nextIndexInFilled = (currentIndexInFilled + 1) % filledSlots.length;
        const newSlotIndex = filledSlots[nextIndexInFilled];
        
        this.setActiveWeapon(newSlotIndex);
    }
    
    prevWeapon() {
        const filledSlots = this._getFilledUnlockedSlots();
        if (filledSlots.length <= 1) return;

        const currentIndexInFilled = filledSlots.indexOf(this.activeWeaponIndex);
        const prevIndexInFilled = (currentIndexInFilled - 1 + filledSlots.length) % filledSlots.length;
        const newSlotIndex = filledSlots[prevIndexInFilled];

        this.setActiveWeapon(newSlotIndex);
    }

    updateUI() {
        const weaponContainer = document.querySelector('.weapon-display');
        const ammoDisplay = document.getElementById('gameHudAmmo');

        if (weaponContainer && this.activeWeapon) {
            const weapon = this.activeWeapon;
            let category = weapon.config.category || 'weapon';
            if (category === 'saberhiltoverlayer') { category = 'saber'; }
            let categoryName = category.charAt(0).toUpperCase() + category.slice(1);
            if (category === 'longarm') categoryName = 'Longarm';
            
            const weaponName = weapon.config.name;
            weaponContainer.innerHTML = `<div class="ammo-label">${categoryName}</div><div id="gameHudWeapon" style="text-transform: capitalize;">${weaponName}</div>`;
            if (ammoDisplay) { 
                ammoDisplay.textContent = `${window.game.state.ammo}`; 
            }
        }
    }

    setActiveWeapon(index) {
        if (index < 0 || index >= this.unlockedSlots) return;

        const slot = this.slots[index];
        if (!slot || slot.length === 0) return; // Nothing in this slot

        if (this.activeWeapon) {
            this.activeWeapon.setAsInactive();
        }

        this.activeWeaponIndex = index;
        // The active weapon is the last one in the slot's array (most recently picked up)
        this.activeWeapon = slot[slot.length - 1]; 
        this.activeWeapon.setAsActive();
        this.updateUI();
    }
    
    // performMeleeHitDetection, handlePrimaryAttack, handleSecondaryAttack, handleForcePush remain the same...
    performMeleeHitDetection() {
        if (!this.activeWeapon || !(this.activeWeapon instanceof MeleeWeapon) || this.activeWeapon.state !== 'attacking') return;
        this.camera.updateWorldMatrix(true, true);
        let attackConfig = { ...this.activeWeapon.config };
        if (this.activeWeapon.config.category === 'melee' && game.state.playerStats.melee_damage_bonus) {
            attackConfig.damage *= (1 + game.state.playerStats.melee_damage_bonus);
        }
        if (this.activeWeapon.config.category === 'saberhiltoverlayer' && game.state.playerStats.saber_damage_bonus) {
            attackConfig.damage *= (1 + game.state.playerStats.saber_damage_bonus);
        }
        const playerPos = new THREE.Vector3();
        this.camera.getWorldPosition(playerPos);
        const forward = new THREE.Vector3();
        this.camera.getWorldDirection(forward);
        let closestTarget = null;
        let minDistance = attackConfig.range;
        for (const npc of game.entities.npcs) {
            if (npc.isDead || npc.isAlly) continue;
            const npcPos = npc.movementCollider.position;
            const distance = playerPos.distanceTo(npcPos);
            if (distance <= minDistance) {
                const toNpc = npcPos.clone().sub(playerPos).normalize();
                const dot = forward.dot(toNpc);
                if (dot > attackConfig.cone) {
                    if (!closestTarget || distance < playerPos.distanceTo(closestTarget.movementCollider.position)) {
                        closestTarget = npc;
                    }
                }
            }
        }
        if (closestTarget) {
            closestTarget.takeDamage(attackConfig.damage, window.physics.playerEntity);
            if (this.activeWeapon.config.category === 'saberhiltoverlayer') {
                audioSystem.playPositionalSoundFromList('saberstrike', closestTarget.mesh.group.position, 0.8);
            }
        }
    }
    handlePrimaryAttack() {
        if (this.activeWeapon) {
            this.activeWeapon.attack();
            this.performMeleeHitDetection();
        }
    }
    handleSecondaryAttack() { // RIGHT CLICK - Throw pamphlet
        if (window.game.state.ammo <= 0) {
            audioSystem.playSoundFromList('empty');
            return;
        }

        window.game.state.ammo--;
        audioSystem.playSoundFromList('pamphlet');

        const cam = this.camera;
        cam.updateWorldMatrix(true, true);

        const position = new THREE.Vector3();
        cam.getWorldPosition(position);

        const direction = new THREE.Vector3();
        cam.getWorldDirection(direction);
        position.add(direction.clone().multiplyScalar(-0.2));

        const pamphlet = new PamphletProjectile(
            position,
            direction,
            GAME_GLOBAL_CONSTANTS.WEAPONS.PAMPHLET_SPEED,
            GAME_GLOBAL_CONSTANTS.WEAPONS.PAMPHLET_LIFESPAN
        );
        window.game.entities.projectiles.push(pamphlet);
    }
    handleForcePush() {
        if (!game.state.playerStats.force_push) return;
        const energyCost = 50;
        if (window.game.state.energy < energyCost) {
            audioSystem.playSoundFromList('empty');
            return;
        }
        window.game.state.energy -= energyCost;
        const playerPos = new THREE.Vector3();
        this.camera.getWorldPosition(playerPos);
        const forward = new THREE.Vector3();
        this.camera.getWorldDirection(forward);
        const pushRadius = 5;
        const pushForce = 15;
        for (const npc of game.entities.npcs) {
            if (npc.isDead) continue;
            const npcPos = npc.movementCollider.position;
            const distance = playerPos.distanceTo(npcPos);
            if (distance <= pushRadius) {
                const toNpc = npcPos.clone().sub(playerPos).normalize();
                const dot = forward.dot(toNpc);
                if (dot > 0.5) {
                    const force = toNpc.multiplyScalar(pushForce / (1 + distance));
                    npc.movementCollider.velocity.add(force);
                }
            }
        }
    }
}