// BROWSERFIREFOXHIDE player_gear.js
// update: Forced a camera matrix update before firing weapons to ensure projectile origin and melee hit detection use the correct, up-to-date player position, fixing spawn/hit registration errors.
// update: Replaced performance-intensive PointLights on blaster bolts with billboarded glow sprites for significant optimization in large battles.
// update: Changed BlasterBolt material from MeshBasicMaterial to MeshStandardMaterial to allow it to receive lighting and emissive properties, making it glow correctly.
// rewrite: Refactored PlayerWeaponSystem to manage an array of weapons and allow cycling. MeleeWeapon class is now generic for all player melee weapons.
// update: Corrected the path for the Gaffi Stick asset to fix 404 error.

class BlasterBolt {
    constructor(startPos, direction, config) {
        this.owner = config.owner;
        this.ownerType = config.ownerType || 'enemy'; // 'player', 'ally', 'enemy'
        this.damage = config.damage || 5;
        this.speed = GAME_GLOBAL_CONSTANTS.WEAPONS.BLASTER_BOLT_SPEED * (config.speedMultiplier || 1.0);
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
            this.glowSprite.material.opacity = GAME_GLOBAL_CONSTANTS.WEAPONS.BLASTER_GLOW_OPACITY;
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

        // FIX: Use a basePosition vector that can be modified by the UI
        this.basePosition = new THREE.Vector3(-0.815, -0.624, -1.5);
        this.mesh.position.copy(this.basePosition);
        this.mesh.rotation.z = -0.1;
        const scale = 1.4872; 
        this.mesh.scale.set(scale, scale, scale);
        
        // Hide until loaded and active
        this.mesh.visible = false;
    }

    async loadTextures() {
        if (this.isReady) return;
        
        if (!this.config.frames || Object.keys(this.config.frames).length === 0) return;
        const loader = new THREE.TextureLoader();
        const promises = [];
        
        for (const key in this.config.frames) {
            // FIX: Use the correct base path for player-specific weapons.
            const texturePath = `/data/gonkonlyweapons/${this.config.frames[key]}.png`;
            promises.push(new Promise(resolve => {
                loader.load(texturePath, (texture) => {
                    texture.magFilter = THREE.NearestFilter;
                    texture.minFilter = THREE.NearestFilter;
                    this.textures[key] = texture;
                    resolve();
                }, undefined, () => {
                    console.warn(`Failed to load hilt texture for ${this.config.name}: ${texturePath}`);
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
            } else {
                console.error("Failed to load saber blade texture 'gsaberbladethick'.");
            }
        }

        if (this.textures.idle) {
            this.mesh.material.map = this.textures.idle;
            this.mesh.material.needsUpdate = true;
            this.isReady = true;
        } else {
            // Fallback material setup if all fails
            this.mesh.material.map = null;
            this.mesh.material.color.set(0xff00ff);
        }
    }

    setAsActive() {
        if (!this.isReady) return;
        // FIX: Apply the specific transform values when the weapon is made active.
        this.mesh.position.copy(this.basePosition);
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

        if (this.textures.idle) {
             this.mesh.material.map = this.textures.idle;
             this.mesh.material.needsUpdate = true;
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
    }

    attack() {
        if (this.state !== 'idle') return;
        this.state = 'attacking';
        this.animTimer = 0;
        this.animFrame = 0;
        if (this.config.category === 'saberhiltoverlayer') {
            audioSystem.playSoundFromList('saberswing');
        } else {
            audioSystem.playSoundFromList('zapper');
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
            const glowColor = document.getElementById('fx_glow_color')?.value || '#00ffff';
            this.bladeMesh.material.emissive.set(glowColor);
            this.bladeMesh.material.needsUpdate = true;
        }

        if (this.state === 'idle') {
            // Do nothing
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
    }

    attack() {
        const now = performance.now();
        if (now - this.lastAttackTime < this.attackCooldown * 1000) return;
        if (this.ammo <= 0) {
            // play empty sound
            return;
        }

        this.lastAttackTime = now;
        this.ammo--;
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

        // FIX: Start the bolt from the camera's perspective for perfect center-screen aiming.
        const startPosition = new THREE.Vector3();
        cam.getWorldPosition(startPosition);

        const direction = new THREE.Vector3();
        cam.getWorldDirection(direction);

        // Offset the bolt to appear to come from the weapon, not the player's face.
        // We move it forward, slightly to the right, and down.
        const right = new THREE.Vector3();
        right.crossVectors(cam.up, direction).normalize();

        // NEW: Use configurable offsets for the bolt origin
        const originOffsetX = GAME_GLOBAL_CONSTANTS.WEAPONS.BOLT_ORIGIN_X;
        const originOffsetY = GAME_GLOBAL_CONSTANTS.WEAPONS.BOLT_ORIGIN_Y;
        const originOffsetZ = GAME_GLOBAL_CONSTANTS.WEAPONS.BOLT_ORIGIN_Z;

        startPosition.add(direction.clone().multiplyScalar(originOffsetZ));
        startPosition.add(right.clone().multiplyScalar(originOffsetX));
        startPosition.y += originOffsetY;

        const bolt = new BlasterBolt(startPosition, direction, {
            owner: window.physics.playerEntity,
            ownerType: 'player',
            damage: this.config.damage || 10
        });
        window.game.entities.projectiles.push(bolt);

        // FIX: The function name was incorrect. It should be playWeaponFireSound for NPCs and a non-positional sound for the player.
        audioSystem.playSoundFromList(`${this.config.category}shot`, 0.5);
    }

    // Ranged weapons have their own simple recoil animation, separate from melee.
    update(deltaTime, totalTime) {
        // Call parent update for bobbing and light fading
        super.update(deltaTime, totalTime);

        // FIX: Implement a simple, subtle recoil animation.
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
        this.attackTargetPosition = new THREE.Vector3(0.0377, -0.6415, -1.5);
        this.attackTargetQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(-1.1711, 0, -0.1326, 'YXZ'));
    }

    setAsActive() {
        super.setAsActive();
        // Store the starting position/rotation for the attack animation
        this.attackStartPosition.copy(this.mesh.position);
        this.attackStartQuaternion.copy(this.mesh.quaternion);
    }

    attack() {
        super.attack();
        // Store the current position and rotation to animate from
        this.attackStartPosition.copy(this.mesh.position);
        this.attackStartQuaternion.copy(this.mesh.quaternion);
    }

    update(deltaTime, totalTime) {
        super.update(deltaTime, totalTime);

        if (this.state === 'attacking') {
            this.animTimer += deltaTime;
            const totalAttackDuration = 4 / 24; // 4 frames at 24fps (much faster)
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
                this.mesh.quaternion.copy(this.attackStartQuaternion);
            }
        }
    }
}

class PlayerWeaponSystem {
    constructor(){
      this.camera = null;
      this.weaponHolder = null;
      this.weapons = []; // Array of all owned weapon objects
      this.activeWeaponIndex = 0;
      this.activeWeapon = null;
    }
    
    get primaryWeapon() { return this.activeWeapon; }

    async init(camera, weaponHolder) {
        this.camera = camera;
        this.weaponHolder = weaponHolder;
        
        const weaponConfigs = [];
        const weaponPaths = await assetManager.discoverPlayerWeapons();

        for (const path of weaponPaths) {
            // e.g., path = '/data/gonkonlyweapons/saber/gsaber_red.png'
            const parts = path.split('/'); // ['', 'data', 'gonkonlyweapons', 'saber', 'gsaber_red.png']
            const filenameWithExt = parts.pop(); // 'gsaber_red.png'
            const category = parts.pop(); // 'saber' (the folder name is the category)
            const filename = filenameWithExt.replace('.png', ''); // 'gsaber_red'
            
            // FIX: Correctly parse weapon name. 'glong_ee3_mando' -> 'ee3'
            let name = filename.split('_')[1] || filename;
            // Handle special naming convention: glong_ee3_mando -> Ee3
            if (category === 'longarm' && name.includes('_')) {
                name = name.split('_')[0]; // Take 'ee3' from 'ee3_mando'
            }

            // A generic config for all discovered weapons. We can specialize this later.
            const weaponConfig = {
                key: filename, // e.g., 'gsaberhiltluke'
                name: name.charAt(0).toUpperCase() + name.slice(1),
                category: category,
                damage: 10,
                range: 2.0,
                cone: 0.8,
                frames: { idle: `${category}/${filename}` },
                sequence: ['idle'], // Default to a non-attacking sequence
                frameDuration: 0.1,
                glow: { color: "#0088ff", intensity: 1.5, distance: 3, decay: 2 },
                fadeTime: 0.15,
                // Set default transforms, to be overridden if needed
                basePosition: { x: -0.815, y: -0.624, z: -1.5 },
                rotation: { x: 0, y: 0, z: -0.1 },
                scale: 1.4872
            };

            // Apply specific overrides for the saber hilt
            if (category === 'saberhiltoverlayer') {
                weaponConfig.basePosition = { x: -0.9724, y: -0.6241, z: -1.5 };
                weaponConfig.rotation = { 
                    x: -0.1868, 
                    y: 0.3875, 
                    z: 1.1257 
                };
                weaponConfig.scale = 1.3801;
                // Set default blade color to green for Luke's saber
                weaponConfig.glow.color = "#00ff00";
            }

            // Apply new defaults for all 'longarm' weapons
            if (category === 'longarm') {
                weaponConfig.basePosition = { x: -0.6764, y: -0.624, z: -1.5 };
                weaponConfig.rotation = { 
                    x: 0, 
                    y: 0, 
                    z: -0.0227 
                };
                weaponConfig.scale = 2.6388;
            }
            // Apply new defaults for all 'rifle' weapons
            if (category === 'rifle') {
                weaponConfig.basePosition = { x: -0.7809, y: -0.624, z: -1.5 };
                weaponConfig.rotation = {
                    x: 0,
                    y: 0,
                    z: -0.0995
                };
                weaponConfig.scale = 2.5748;
            }
            weaponConfigs.push(weaponConfig);
        }
        
        // Create weapon instances and load textures
        const loadPromises = [];
        weaponConfigs.forEach(config => {
            let weapon;
            // Treat saber hilts as melee for now
            if (config.category === 'saberhiltoverlayer') {
                weapon = new SaberWeapon(config);
            } else if (['pistol', 'rifle', 'longarm', 'unique'].includes(config.category)) {
                weapon = new RangedWeapon(config);
            } else { // generic melee
                weapon = new MeleeWeapon(config);
            }
            weapon.camera = this.camera; // Pass camera reference
            this.weapons.push(weapon);
            // Apply saber-specific transform overrides from the config
            weapon.basePosition.set(config.basePosition.x, config.basePosition.y, config.basePosition.z);
            // We store rotation and scale in the config to be applied when the weapon is activated.
            this.weaponHolder.add(weapon.mesh);
            loadPromises.push(weapon.loadTextures());
        });
        
        await Promise.all(loadPromises);

        // Set the first weapon as active
        if (this.weapons.length > 0) {
            this.activeWeapon = this.weapons[0];
            this.activeWeapon.setAsActive();
        }
    }

    update(deltaTime, totalTime) {
        if (this.activeWeapon) {
            this.activeWeapon.update(deltaTime, totalTime);
        }
    }
    
    // ADDED: Weapon cycling logic
    nextWeapon() {
        if (this.weapons.length <= 1) return;
        this.activeWeapon.setAsInactive();
        this.activeWeaponIndex = (this.activeWeaponIndex + 1) % this.weapons.length;
        this.activeWeapon = this.weapons[this.activeWeaponIndex];
        this.activeWeapon.setAsActive();
    }
    
    // ADDED: Weapon cycling logic
    prevWeapon() {
        if (this.weapons.length <= 1) return;
        this.activeWeapon.setAsInactive();
        this.activeWeaponIndex = (this.activeWeaponIndex - 1 + this.weapons.length) % this.weapons.length;
        this.activeWeapon = this.weapons[this.activeWeaponIndex];
        this.activeWeapon.setAsActive();
    }

    performMeleeHitDetection() {
        // Ensure it's a melee weapon and is currently attacking
        if (!this.activeWeapon || !(this.activeWeapon instanceof MeleeWeapon) || this.activeWeapon.state !== 'attacking') return;

        this.camera.updateWorldMatrix(true, true); // Ensure camera transform is up-to-date

        const attackConfig = this.activeWeapon.config;
        const playerPos = new THREE.Vector3();
        this.camera.getWorldPosition(playerPos);

        const forward = new THREE.Vector3();
        this.camera.getWorldDirection(forward);

        let closestTarget = null;
        let minDistance = attackConfig.range;

        for (const npc of game.entities.npcs) {
            if (npc.isDead || npc.isAlly) continue;

            const distance = playerPos.distanceTo(npc.mesh.group.position);

            if (distance < minDistance) {
                const toNpc = npc.mesh.group.position.clone().sub(playerPos).normalize();
                const dot = forward.dot(toNpc);

                if (dot > attackConfig.cone) {
                    closestTarget = npc;
                    minDistance = distance;
                }
            }
        }

        if (closestTarget) {
            closestTarget.takeDamage(attackConfig.damage, window.physics.playerEntity);
            // If the weapon is a saber, play a strike sound on hit
            if (this.activeWeapon.config.category === 'saberhiltoverlayer') {
                audioSystem.playPositionalSoundFromList('saberstrike', closestTarget.mesh.group.position, 0.8);
            }
        }
    }

    handlePrimaryAttack() { // LEFT CLICK
        if (this.activeWeapon) {
            this.activeWeapon.attack();
            // Melee hit detection is now called from within MeleeWeapon.attack()
            this.performMeleeHitDetection();
        }
    }

    handleSecondaryAttack() { // RIGHT CLICK
        if (game.state.ammo <= 0) return; 

        game.state.ammo--;
        audioSystem.playSoundFromList('pamphlet');

        const cam = this.camera;
        cam.updateWorldMatrix(true, true); // Ensure camera transform is up-to-date, including parents

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
}


// === INSTANTIATION ===
if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
    window.playerWeaponSystem = new PlayerWeaponSystem();
}