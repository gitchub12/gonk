// BROWSERFIREFOXHIDE npc_behavior.js
class NPC {
    constructor(characterMesh, itemData, npcConfig) {
        this.mesh = characterMesh;
        this.itemData = itemData; 
        this.config = npcConfig; // The unified config from asset manager
        this.name = itemData.properties?.name || 'NPC';
        this.weaponData = null; // To be populated by weapon system
        this.isDead = false;
        this.spawnPoint = characterMesh.position.clone();
        
        this.currentState = 'IDLING';
        this.stateTimer = 0;
        this.wanderTarget = null;
        this.reactionTimer = 0;
        this.fleeTimer = 0;
        this.fleeDecisionTimer = -1; // Timer for the aggro check after fleeing
        this.hasMadeFleeDecision = false; // NEW: Flag to ensure flee check happens only once.
        this.followUpdateTimer = 0;
        this.followTarget = null;

        this.processName(itemData.properties?.name);

        this.hitboxes = this.mesh.hitboxes;
        this.weaponMesh = null;
        this.mesh.onMeleeHitFrame = () => this.onMeleeHitFrame();
        this.meleeHitFrameTriggered = false;
        this.allyRing = null;
        this.allySlotIndex = -1;
        
        // All stats are now read directly from the unified config
        this.maxHealth = itemData.properties?.health || this.config.health || 50;
        this.health = this.maxHealth;
        this.velocity = new THREE.Vector3();

        this.speed = this.config.speed || 0.025;
        this.perceptionRadius = this.config.perception_radius || 25;
        this.attackRange = this.config.attack_range || 1.2; // Base, will be modified by weapon
        this.attackCooldown = this.config.attack_cooldown || 2.0; // Base, will be modified by weapon
        this.attackTimer = 0;
        this.shootAnimTimer = 0;
        this.meleeAnimTimer = 0;

        this.hitCount = 0;
        this.conversionProgress = 0; 
        this.isAlly = false;
        this.isAggro = false; 

        this.target = null;
        this.lastTargetSearch = Math.random() * 0.5;
        
        this.faction = this.config.faction || 'aliens';
        this.originalFaction = this.faction;
        this.personalRelationships = {};
        this.traits = this.config; // The whole config is now the traits object

        this.weight = this.config.weight || 80;
        this.movementCollider = {
            isPlayer: false,
            radius: this.config.collision_radius || 0.5,
            lastPosition: this.mesh.group.position.clone(),
            position: this.mesh.group.position,
            velocity: this.velocity,
            weight: this.weight,
            parent: this 
        };
        const modelHeight = (this.config.scale_y || 1.0) * 1.8;
        this.boundingSphere = new THREE.Sphere(this.mesh.group.position, modelHeight * 0.7);

        this.createNameplate();
    }

    createNameplate() {
        this.nameplate = new THREE.Group();
        const parentObject = this.mesh.parts.head || this.mesh.group;
        parentObject.add(this.nameplate);
    
        this.nameplate.userData.parentObject = parentObject;
    
        this.nameplate.position.y = 0.5;
        this.nameplate.scale.set(0.005, 0.005, 0.005);
    
        this.nameplateName = new THREE.Group();
        const nameSprite = this.createTextSprite(this.name, { fontsize: 48, fontface: 'Arial', textColor: { r: 255, g: 255, b: 255, a: 1.0 } });
        const nameWidth = nameSprite.material.map.image.width;
        const nameHeight = nameSprite.material.map.image.height;
        nameSprite.scale.set(nameWidth, nameHeight, 1.0);
        this.nameplateName.add(nameSprite);
        this.nameplateName.position.y = 15;
        this.nameplate.add(this.nameplateName);
    
        this.nameplateHealthBar = new THREE.Group();
        const barWidth = 25;
        const barHeight = 9;
    
        const healthBarBgMat = new THREE.SpriteMaterial({ color: 0x330000, opacity: 0.7, depthTest: true, depthWrite: false });
        const healthBarBg = new THREE.Sprite(healthBarBgMat);
        healthBarBg.scale.set(barWidth, barHeight, 1.0);
        this.nameplateHealthBar.add(healthBarBg);
    
        const healthBarMat = new THREE.SpriteMaterial({ color: 0xff0000, depthTest: true, depthWrite: true });
        this.healthBar = new THREE.Sprite(healthBarMat);
        this.healthBar.scale.set(barWidth, barHeight, 1.0);
        this.healthBar.center.set(0.5, 0.5);
        this.healthBar.position.z = 0.001; // Prevent z-fighting
        healthBarBg.add(this.healthBar);
    
        this.nameplateHealthBar.position.y = -15;
        this.nameplate.add(this.nameplateHealthBar);
    
        // NEW: Conversion progress bar
        this.conversionBar = new THREE.Group();
        const conversionBarBgMat = new THREE.SpriteMaterial({ color: 0x000033, opacity: 0.7, depthTest: true, depthWrite: false });
        const conversionBarBg = new THREE.Sprite(conversionBarBgMat);
        conversionBarBg.scale.set(barWidth, barHeight, 1.0);
        this.conversionBar.add(conversionBarBg);
        this.conversionBar.position.y = -28; // Position below health bar
        this.nameplate.add(this.conversionBar);
        this.conversionBar.visible = false;

        this.updateNameplate();
        this.nameplate.visible = false; // Nameplate is hidden by default
    }

    processName(name) {
        if (!name) { this.name = 'NPC'; return; }

        const nameParts = name.trim().split(' ');
        const nameData = window.assetManager?.nameData;

        // Check if it's a default category name (e.g., "darthF darthL" or "wookieeL wookieeR")
        if (nameParts.length === 2 && nameData && nameParts[0].endsWith('F') && nameParts[1].endsWith('L')) {
            const colF = nameParts[0]; // e.g., "cloneF"
            const colL = nameParts[1];

            const validF = (nameData[colF] || []).filter(Boolean);
            const validL = (nameData[colL] || []).filter(Boolean);

            if (validF.length > 0) {
                const partF = validF[Math.floor(Math.random() * validF.length)];
                let partL = validL.length > 0 ? validL[Math.floor(Math.random() * validL.length)] : '';

                // Determine if a space is needed based on the category
                const noSpaceCategories = ['droid', 'wookiee', 'gamorrean', 'stormtrooper', 'taker'];
                // FIX: Use the NPC's actual macroCategory for name rules, not a guess from the name key.
                // This is the root cause of the naming bug.
                const nameType = (this.config.macroCategory || 'other').toLowerCase();

                if (noSpaceCategories.includes(nameType)) {
                    this.name = `${partF}${partL}`.trim();
                } else {
                    this.name = `${partF} ${partL}`.trim();
                }
            } else {
                this.name = name; // Fallback to the category name if columns are invalid
            }
        } else {
            // It's a manually set name, use it as is.
            this.name = name;
        }
    }

    updateNameplate() {
        const healthPercent = this.health / this.maxHealth;
        
        const barWidth = 25; // Use the same fixed base width
        this.healthBar.scale.x = barWidth * Math.max(0, healthPercent);
        this.healthBar.position.x = - (barWidth * (1 - healthPercent)) / 2;

        if (this.isAlly && this.healthBar.material.color.getHex() !== 0x00ff64) {
             this.healthBar.material.color.set(0x00ff64);
        }
    }

    createTextSprite(message, parameters) {
        const fontface = parameters.fontface || 'Arial';
        const fontsize = parameters.fontsize || 18;
        const textColor = parameters.textColor || { r: 255, g: 255, b: 255, a: 1.0 };

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        context.font = "Bold " + fontsize + "px " + fontface;

        canvas.width = context.measureText(message).width;
        canvas.height = fontsize * 1.4; 

        context.font = "Bold " + fontsize + "px " + fontface;
        context.fillStyle = `rgba(${textColor.r}, ${textColor.g}, ${textColor.b}, ${textColor.a})`;
        context.fillText(message, 0, fontsize);

        const texture = new THREE.Texture(canvas);
        texture.needsUpdate = true;
        const spriteMaterial = new THREE.SpriteMaterial({ map: texture, depthTest: true, depthWrite: true, transparent: true, alphaTest: 0.1 });
        return new THREE.Sprite(spriteMaterial);
    }

    updateHitboxes() {
        for (const partName in this.hitboxes) {
            const partGroup = this.mesh.parts[partName];
            const hitboxOBB = this.hitboxes[partName];
            if (partGroup && hitboxOBB) {
                partGroup.updateWorldMatrix(true, false);
                const sourceMesh = partGroup.children.find(c => c.isMesh);
                if (!sourceMesh) continue;

                if (!sourceMesh.geometry.boundingBox) {
                    sourceMesh.geometry.computeBoundingBox();
                }
                hitboxOBB.fromBox3(sourceMesh.geometry.boundingBox);
                hitboxOBB.applyMatrix4(partGroup.matrixWorld);
            }
        }
        this.boundingSphere.center.copy(this.mesh.group.position);
    }

    takeDamage(amount, attacker = null) {
        if (this.isDead) return;

        // Post-recruitment friendly fire grace period
        if (this.postRecruitInvincibility > 0 && attacker && (attacker.isPlayer || attacker.isAlly)) {
            return;
        }
        if (attacker && attacker.postRecruitInvincibility > 0 && this.isAlly) {
            return;
        }

        // --- ALLY FRIENDLY FIRE PREVENTION ---
        // If this NPC is an ally, check if the attacker is also friendly.
        if (this.isAlly && attacker) {
            const isAttackerFriendly = attacker.isPlayer || attacker.isAlly;
            if (isAttackerFriendly) {
                return; // Exit immediately, preventing damage and aggro.
            }
        }

        const wasAtFullHealth = (this.health === this.maxHealth);
        this.health -= amount;
        this.nameplate.visible = true;
        if (window.audioSystem) audioSystem.playNpcHurtSound(this);
        this.updateNameplate();

        if (attacker) {
            const attackerFaction = attacker.isPlayer ? 'player_droid' : (attacker.getEffectiveFaction ? attacker.getEffectiveFaction() : attacker.faction);
            const isHostileAttacker = window.game.factionManager.getRelationship(this.getEffectiveFaction(), attackerFaction) > GAME_GLOBAL_CONSTANTS.FACTIONS.HOSTILE_THRESHOLD;
            
            // --- Fleeing Logic Overhaul ---
            // If already in combat, ignore flee logic.
            if (this.currentState === 'ATTACKING') {
                // Do nothing, continue attacking.
            }
            // If hit while fleeing, immediately turn to fight.
            else if (this.currentState === 'FLEEING') {
                this.aggro(attacker);
            }
            // If this is the first time making a flee decision...
            else if (!this.hasMadeFleeDecision && isHostileAttacker && !this.isAlly) {
                this.hasMadeFleeDecision = true; // This decision is now permanent.
                const aggroChance = this.config.aggro !== undefined ? this.config.aggro : 0.1;
                const roll = Math.random();
                if (roll < aggroChance) { // Success: Fight back
                    this.aggro(attacker);
                } else {
                    this.fleeFrom(attacker);
                }
            } else {
                this.aggro(attacker);
            }
        }

        if (this.health <= 0) {
            this.die(attacker); 
        }
    }

    fleeFrom(attacker) {
        const attackerCollider = attacker.movementCollider || attacker.collider;
        if (this.currentState !== 'ATTACKING') this.target = null;
        this.currentState = 'FLEEING';
        const aggroValue = this.config.aggro !== undefined ? this.config.aggro : 0.1;
        const decisionDelay = 1.0 - aggroValue;
        this.fleeDecisionTimer = Math.max(0.1, decisionDelay); // Ensure at least a small delay
        this.fleeAttacker = attacker; // Remember who made us flee

        this.fleeTimer = 2.0 + Math.random() * 2.0;
        const fleeDirection = this.mesh.group.position.clone().sub(attackerCollider.position).normalize();
        this.wanderTarget = this.mesh.group.position.clone().add(fleeDirection.multiplyScalar(5));
    }

    // UPDATED: Added pickup drops with distinct scale and Y-offsets for intentional flicker/overlap
    die(killer = null) {
        this.isDead = true;
        this.currentState = 'DEAD';
        this.movementCollider.velocity.set(0, 0, 0);

        // --- Drop Pickups ---
        const dropPosition = this.mesh.group.position.clone();
        dropPosition.y = physics.getGroundHeight(dropPosition.x, dropPosition.z);

        // Health pickup (Overlay Icon/Flicker: slightly smaller, slightly higher Y-offset)
        game.entities.pickups.push(new Pickup('health', 'heatlhsmall', dropPosition.clone(), 0.85, 0.001));

        // Module drop (Base Icon: full scale, base Y-offset)
        const moduleOptions = [
            'force_mindtrick', 'force_shield', 'melee_damageup', 
            'move_jump', 'move_speed', 'ranged_firerateup', 
            'toughness_armorup', 'toughness_healthup'
        ];
        const randomModule = moduleOptions[Math.floor(Math.random() * moduleOptions.length)];
        // The yOffset should be 0 or slightly negative relative to the base hover height.
        game.entities.pickups.push(new Pickup('module', randomModule, dropPosition.clone(), 1.0, 0));
        // --- End Drop Pickups ---


        if (this.config.baseType === 'gamorrean' && window.audioSystem) {
            audioSystem.playPositionalSoundFromList('gamorreandeath', this.mesh.group.position, 0.9);
        } else if (this.config.baseType === 'wookiee' && window.audioSystem) {
            audioSystem.playPositionalSoundFromList('wookdeath', this.mesh.group.position, 0.9);
        } else if (window.audioSystem) {
            const maleTypes = ['human_male', 'humanoid', 'clone', 'mandalorian', 'stormtrooper', 'darth', 'taker'];
            const soundSet = this.itemData.properties?.soundSet;

            if (soundSet === 'female') {
                audioSystem.playPositionalSoundFromList('femaledeath', this.mesh.group.position, 0.9);
            } else if (maleTypes.includes(this.config.baseType) && soundSet !== 'female') {
                audioSystem.playMaleDeathSound(this.mesh.group.position, 0.9);
            }
        }

        if (killer && window.game.factionManager) {
            const killerFaction = (killer === physics.playerEntity || killer.isPlayer) ? 'player_droid' : killer.faction;
            if(killerFaction === 'player_droid') game.handlePlayerKill(this);

            window.game.factionManager.applyKillRepulsion(killerFaction, this.faction);

            // If killed by player or an ally, trigger the sad animation for the victim's faction
            if ((killerFaction === 'player_droid' || killer.isAlly) && window.factionAvatarManager) {
                window.factionAvatarManager.triggerSpecialAnimation(this.faction, 's1');
            }
        }

        if (this.mesh.modelDef && this.mesh.modelDef.parts.head) {
            physics.createRagdoll(this.mesh);
        }
        game.scene.remove(this.mesh.group);
        if (this.isAlly) game.removeAlly(this);
    }

    onPamphletHit() {
        if (this.isAlly || this.isDead) return;
        this.hitCount++;
        this.conversionProgress = Math.min(this.hitCount * 0.2, 1.0); // Increased conversion rate

        // Update and show the conversion bar
        this.conversionBar.visible = true;
        if (this.conversionBar.children.length > 1) {
            this.conversionBar.remove(this.conversionBar.children[1]);
        }
        const barWidth = 25;
        const barHeight = 9;
        const conversionBarMat = new THREE.SpriteMaterial({ color: 0x0099ff, depthTest: true, depthWrite: true });
        const conversionBarFill = new THREE.Sprite(conversionBarMat);
        conversionBarFill.scale.set(barWidth * this.conversionProgress, barHeight, 1.0);
        conversionBarFill.center.set(0.5, 0.5);
        conversionBarFill.position.x = - (barWidth * (1 - this.conversionProgress)) / 2;
        this.conversionBar.add(conversionBarFill);

        if (Math.random() < this.conversionProgress) {
            this.convert();
        }
    }

    convert() {
        this.isAlly = true;
        if (this.config.baseType === 'wookiee' && window.audioSystem) {
            // Play Wookiee conversion sound
            audioSystem.playSoundFromList('wookconvert', 0.8);
        }
        this.postRecruitInvincibility = 3.0; // 3 seconds of friendly fire immunity
        this.isAggro = false;
        const damageSustained = this.maxHealth - this.health;
        this.maxHealth *= 2;
        this.health = this.maxHealth - (damageSustained / 2); // Heal by half of the damage taken
        this.target = null;
        this.faction = 'player_droid';
        this.currentState = 'IDLING'; // Go to IDLING first to force re-evaluation
        this.personalRelationships = {};
        this.hasMadeFleeDecision = false; // Reset flee decision on conversion
        this.attackTimer = 0; // Immediately reset attack cooldown
        this.shootAnimTimer = 0;
        this.meleeAnimTimer = 0;
        this.nameplate.visible = true; this.conversionBar.visible = false;
        this.updateNameplate(); window.game.factionManager.registerAlly(this); game.addAlly(this);
    }

    onJoinParty() {
        if (!window.game.factionManager) return;
        game.state.allies.forEach(ally => {
            if (ally.npc !== this) {
                this.personalRelationships[ally.npc.faction] = 0;
            }
        });
        this.personalRelationships['player_droid'] = 0;
    }

    aggro(attacker = null) {
        if (this.isAlly && attacker && attacker.isPlayer) return; // Allies don't aggro player
        if (this.isDead || (this.isAggro && this.target === attacker)) return;

        // Absolute prohibition: Never aggro a friendly target.
        if (attacker) {
            const attackerFaction = attacker.isPlayer ? 'player_droid' : attacker.faction;
            if (attackerFaction === this.getEffectiveFaction()) return;
        }

        this.isAggro = true;
        this.currentState = 'ATTACKING';
        this.target = attacker;
        this.conversionProgress = 0;
    }

    getAttackRange() {
        // 1. Use weapon-specific range multiplier if available
        if (this.weaponData && this.weaponData.attack_range_mult) {
            const baseRange = this.config.attack_range || 10.0;
            return baseRange * this.weaponData.attack_range_mult;
        }

        // 2. Fallback to category-based range
        const weaponPath = this.itemData.properties.weapon;
        if (weaponPath && window.weaponIcons) {
            const weaponName = weaponPath.split('/').pop().replace('.png', '');
            const category = window.weaponIcons.getCategoryFromName(weaponName);
            if (GAME_GLOBAL_CONSTANTS.WEAPON_RANGES && GAME_GLOBAL_CONSTANTS.WEAPON_RANGES[category]) {
                return GAME_GLOBAL_CONSTANTS.WEAPON_RANGES[category];
            }
        }

        // 3. Absolute fallback for melee or un-categorized weapons
        if (!weaponPath || weaponPath === "") {
            return GAME_GLOBAL_CONSTANTS.WEAPON_RANGES.melee || 1.5;
        }
        // Fallback for ranged weapons not in the WEAPON_RANGES config.
        return this.config.attack_range || 10.0;
    }

    getEffectiveFaction() {
        return this.isAlly ? 'player_droid' : this.faction;
    }

    getVisionPoints(targetEntity) {
        const startPos = new THREE.Vector3();
        if (this.mesh.parts.head) {
            this.mesh.parts.head.getWorldPosition(startPos);
        } else {
            startPos.copy(this.mesh.group.position);
            const modelHeight = (this.config.scale_y || 1.0) * 1.6;
            startPos.y += modelHeight * 0.8; 
        }

        let endPos;
        const targetCollider = targetEntity.movementCollider || targetEntity.collider;
        if (targetEntity.isPlayer) {
            endPos = targetCollider.position.clone();
        } else if (targetEntity.mesh && targetEntity.mesh.parts.head) {
            endPos = new THREE.Vector3();
            targetEntity.mesh.parts.head.getWorldPosition(endPos);
        } else {
            endPos = targetCollider.position.clone();
            const targetModelHeight = (targetEntity.config?.scale_y || 1.0) * 1.6;
            endPos.y += targetModelHeight * 0.5;
        }
        return { start: startPos, end: endPos };
    }


    update(deltaTime) {
        if (this.isDead) return;
        if (this.reactionTimer > 0) this.reactionTimer -= deltaTime;

        this.stateTimer += deltaTime;
        if (this.postRecruitInvincibility > 0) {
            this.postRecruitInvincibility -= deltaTime;
        }

        this.attackTimer -= deltaTime;
        if (this.shootAnimTimer > 0) this.shootAnimTimer -= deltaTime;
        if (this.meleeAnimTimer > 0) this.meleeAnimTimer -= deltaTime;
        if (this.currentState === 'FOLLOWING') {
            this.followUpdateTimer -= deltaTime;
        }
        
        if (this.reactionTimer <= 0) {
            this.updateTarget();
        }
        this.updateTarget();
        this.executeState(deltaTime);

        if (this.nameplate.visible) {
            this.nameplate.lookAt(game.camera.position);
        }

        if (this.allyRing) {
            const groundHeight = physics.getGroundHeight(this.mesh.group.position.x, this.mesh.group.position.z);
            const heightOffset = GAME_GLOBAL_CONSTANTS.ALLY_RING.BASE_HEIGHT + (this.allySlotIndex * 0.001);
            this.allyRing.position.set(this.mesh.group.position.x, groundHeight + heightOffset, this.mesh.group.position.z);
        }
    }


    executeState(deltaTime) {
        this.velocity.set(0,0,0);
        let isMoving = false;

        switch(this.currentState) {
            case 'ATTACKING':
            case 'DEFENDING_ALLY':
                if (this.target && !this.target.isDead) {
                    const targetCollider = this.target.movementCollider || this.target.collider; // This can be undefined if target is invalid
                    if (!targetCollider) {
                        this.currentState = 'IDLING';
                        break;
                    }
                    // FIX: Separate the look-at target from the line-of-sight target.
                    // The body should only rotate on the Y-axis to prevent tilting.
                    const lookAtTarget = targetCollider.position.clone();
                    lookAtTarget.y = this.mesh.group.position.y;
                    this.mesh.group.lookAt(lookAtTarget);

                    const visionPoints = this.getVisionPoints(this.target);
                    if (!visionPoints) { // Target might have become invalid between checks
                        this.currentState = 'IDLING';
                        break;
                    }
                    const { start, end } = visionPoints;
                    if (physics.hasLineOfSight(start, end)) {
                        const distance = this.mesh.group.position.distanceTo(targetCollider.position);
                        const currentAttackRange = this.getAttackRange();
                        if (distance > currentAttackRange) {
                            const direction = targetCollider.position.clone().sub(this.mesh.group.position).normalize();
                            this.velocity.x = direction.x * this.speed;
                            this.velocity.z = direction.z * this.speed;
                            isMoving = true;
                        } else if (this.attackTimer <= 0) {
                            this.attack();
                        }
                    }
                } else {
                    this.currentState = 'IDLING';
                }
                break;
            
            case 'FLEEING':
                this.fleeTimer -= deltaTime;
                if (this.fleeTimer <= 0 || !this.wanderTarget) {
                    this.currentState = 'IDLING';
                } else {
                    const distanceToTarget = this.mesh.group.position.distanceTo(this.wanderTarget);
                    if (distanceToTarget > 0.5) {
                        const direction = this.wanderTarget.clone().sub(this.mesh.group.position).normalize();
                        this.velocity.x = direction.x * this.speed;
                        this.velocity.z = direction.z * this.speed;
                        this.mesh.group.lookAt(this.wanderTarget.x, this.mesh.group.position.y, this.wanderTarget.z);
                        isMoving = true;
                    } else {
                        this.wanderTarget = null;
                    }
                }
                break;
            
            case 'INVESTIGATING':
                 // Placeholder for future logic
                // Possible flags could be set here for random events like conversations,
                // turning hostile, etc. after the investigation movement is complete.
                this.currentState = 'IDLING';
                break;

            case 'FOLLOWING':
                if (this.followUpdateTimer <= 0) {
                    this.followUpdateTimer = 0.5 + Math.random() * 0.5; // Reset timer

                    const playerPos = physics.playerCollider.position;
                    const playerYaw = window.inputHandler.yaw;
                    const offsets = [
                        new THREE.Vector3(-2.0, 0, -1.5),  // ~9:30 o'clock
                        new THREE.Vector3(2.0, 0, -1.5),   // ~2:30 o'clock
                        new THREE.Vector3(-2.5, 0, -1.0),  // ~9:45 o'clock
                        new THREE.Vector3(2.5, 0, -1.0),   // ~2:45 o'clock
                        new THREE.Vector3(0, 0, 3.0)       // 6 o'clock (for 5th ally)
                    ];
                    const offset = this.allySlotIndex < offsets.length ? offsets[this.allySlotIndex].clone() : new THREE.Vector3(0,0,2);
                    offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), playerYaw);

                    this.followTarget = playerPos.clone().add(offset);
                }

                if (this.followTarget) {
                    const distanceToSlot = this.mesh.group.position.distanceTo(this.followTarget);
                    if (distanceToSlot > 1.2) {
                        const direction = this.followTarget.clone().sub(this.mesh.group.position).normalize();
                        this.velocity.x = direction.x * this.speed;
                        this.velocity.z = direction.z * this.speed;
                        this.mesh.group.lookAt(this.followTarget.x, this.mesh.group.position.y, this.followTarget.z);
                        isMoving = true;
                    }
                }
                break;

            case 'IDLING':
                if (this.stateTimer > 3.0 + Math.random() * 4.0) { // Every 3-7 seconds
                    this.stateTimer = 0;
                    if (Math.random() > 0.5) { // 50% chance to walk
                        const wanderAngle = Math.random() * Math.PI * 2;
                        const wanderDist = Math.random() * 1.5 + 0.5; // Walk 0.5 to 2 meters
                        this.wanderTarget = this.spawnPoint.clone().add(new THREE.Vector3(Math.cos(wanderAngle) * wanderDist, 0, Math.sin(wanderAngle) * wanderDist));
                    } else { // 50% chance to just look around
                        this.wanderTarget = null;
                        const lookAtPoint = this.spawnPoint.clone().add(new THREE.Vector3((Math.random()-0.5)*10, 0, (Math.random()-0.5)*10));
                        this.mesh.group.lookAt(lookAtPoint.x, this.mesh.group.position.y, lookAtPoint.z);
                    }
                }

                if (this.wanderTarget) {
                    if (this.wanderTarget && this.mesh.group.position.distanceTo(this.wanderTarget) > 0.2) {
                        const direction = this.wanderTarget.clone().sub(this.mesh.group.position).normalize();
                        this.velocity.x = direction.x * this.speed * 0.5; // Wander slowly
                        this.velocity.z = direction.z * this.speed * 0.5;
                        this.mesh.group.lookAt(this.wanderTarget.x, this.mesh.group.position.y, this.wanderTarget.z);
                        isMoving = true;
                    } else {
                        this.wanderTarget = null;
                    }
                }
                break;
        }
    }
    
    updateTarget() {
        this.lastTargetSearch -= game.deltaTime;
        if (this.lastTargetSearch > 0) return;
        this.lastTargetSearch = 0.5 + Math.random() * 0.5;

        // If already in combat or fleeing, don't proactively search for new targets
        if (this.currentState === 'ATTACKING' || this.currentState === 'FLEEING') {
            // But check if current target is dead or out of sight
            if(this.target && (!physics.hasLineOfSight(this.getVisionPoints(this.target).start, this.getVisionPoints(this.target).end) || this.target.isDead)) {
                this.target = null;
                this.isAggro = false;
                this.currentState = this.isAlly ? 'FOLLOWING' : 'IDLING';
            }
            return;
        }

        // Priority 5: Attack Hostiles & Priority 7: Defend Allies
        const potentialTargets = [physics.playerEntity, ...game.entities.npcs.filter(n => n !== this && !n.isDead)];
        let bestTarget = this.findBestTarget(potentialTargets);
        if (bestTarget) {
            this.aggro(bestTarget);
            return;
        }
        
        if (this.isAlly) {
            this.currentState = 'FOLLOWING';
            return;
        }

        // Priority 11: Investigate Player
        const playerDist = this.mesh.group.position.distanceTo(physics.playerCollider.position);
        if (playerDist < 3.0) {
            this.currentState = 'INVESTIGATING';
            this.stateTimer = 0;
            return;
        }

        // Priority 13: Idle (Default)
        this.currentState = 'IDLING';
    }

    findBestTarget(potentialTargets, perspectiveFactionKey = null) {
        let bestTarget = null;
        let minDistance = this.perceptionRadius;
        const checkingFaction = perspectiveFactionKey || this.getEffectiveFaction();

        for (const target of potentialTargets) {
            const targetEntity = target.isPlayer ? target : target;
            if (targetEntity === this) continue;
            if (this.isAlly && targetEntity.isPlayer) continue; 

            const targetFaction = targetEntity.isPlayer ? 'player_droid' : (targetEntity.getEffectiveFaction ? targetEntity.getEffectiveFaction() : targetEntity.faction);
            const targetCollider = targetEntity.movementCollider || targetEntity.collider;
            if (!targetCollider) continue;

            const distance = this.mesh.group.position.distanceTo(targetCollider.position);
            if (distance < minDistance) {
                // Absolute rule: Never target same faction, even if aggro. Allies should not fight allies.
                if (targetFaction === checkingFaction) continue;

                let relationship = this.personalRelationships[targetFaction]; // Personal relationships override factional ones.
                if (relationship === undefined) {
                    relationship = window.game.factionManager.getRelationship(checkingFaction, targetFaction);
                }

                if (relationship > GAME_GLOBAL_CONSTANTS.FACTIONS.HOSTILE_THRESHOLD) {
                    const { start, end } = this.getVisionPoints(targetEntity);
                    if (physics.hasLineOfSight(start, end)) {
                        minDistance = distance;
                        bestTarget = targetEntity;
                    }
                }
            }
        }
        return bestTarget;
    }

    updateAnimation(deltaTime) {
        if (this.isDead) return;

        const collider = this.movementCollider;
        const distanceMoved = collider.position.distanceTo(collider.lastPosition);
        collider.lastPosition.copy(collider.position);

        let animToSet = 'idle';
        // Use a small threshold to account for floating point inaccuracies
        if (distanceMoved > 0.001) {
            animToSet = 'walk';
        } else if (this.target && !this.target.isDead && (this.currentState === 'ATTACKING' || this.currentState === 'DEFENDING_ALLY')) {
            animToSet = 'aim';
        }

        // Only set animation if not in a special attack animation
        if (this.shootAnimTimer <= 0 && this.meleeAnimTimer <= 0) {
            window.setGonkAnimation(this.mesh, animToSet);
        }
        window.updateGonkAnimation(this.mesh, { deltaTime });
    }

    attack() {
        if (!this.target || (this.isAlly && this.target === physics.playerEntity)) return;

        // Use weapon-specific cooldown if available
        const cooldownMultiplier = this.weaponData?.attack_cooldown_mult || 1.0;
        this.attackTimer = this.attackCooldown * cooldownMultiplier;

        // Prevent NPCs with no weapon from attacking
        if (!this.itemData.properties.weapon) return;

        const weaponName = this.itemData.properties.weapon ? this.itemData.properties.weapon.split('/').pop().replace('.png', '') : 'unarmed';
        const category = window.weaponIcons.getCategoryFromName(weaponName);
        
        if (category === 'melee' || category === 'saber' || !this.weaponMesh) {
            this.performMeleeAttack();
        } else {
            this.performRangedAttack(weaponName);
        }
    }

    performMeleeAttack() {
        this.meleeHitFrameTriggered = false;
        window.setGonkAnimation(this.mesh, 'melee');
        this.meleeAnimTimer = 0.25; 
    }

    onMeleeHitFrame() {
        if (this.meleeHitFrameTriggered || this.isDead || !this.target) return;
        this.meleeHitFrameTriggered = true;

        const targetCollider = this.target.movementCollider || this.target.collider;
        if (!targetCollider) return;

        // FIX: Add a crucial range check for melee attacks.
        const attackRange = this.getAttackRange();
        const distanceToTarget = this.mesh.group.position.distanceTo(targetCollider.position);
        const effectiveRange = attackRange + (targetCollider.radius || 0);

        if (distanceToTarget <= effectiveRange) { 
            // Use weapon damage if available, otherwise fallback to NPC's base melee damage
            const damage = this.weaponData?.damage || this.config.melee_damage || 5;
            if(this.target.isPlayer) {
                game.takePlayerDamage(damage, this);
                if (window.audioSystem) audioSystem.playPlayerHurtSound('melee');
            } else if (this.target.takeDamage) {
                this.target.takeDamage(damage, this);
            }
        }
    }

    performRangedAttack(weaponName) {
        if (!this.weaponMesh) return;

        window.setGonkAnimation(this.mesh, 'shoot');
        this.shootAnimTimer = 0.2;

        const startPosition = new THREE.Vector3();
        this.weaponMesh.getWorldPosition(startPosition);

        if (window.audioSystem) audioSystem.playWeaponFireSound(weaponName, startPosition);

        const targetCollider = this.target.movementCollider || this.target.collider;
        if (!targetCollider) return;

        const { end } = this.getVisionPoints(this.target);
        const direction = new THREE.Vector3().subVectors(end, startPosition).normalize();
        
        // --- Accuracy Calculation (incorporates weapon stats) ---
        const baseAccuracy = this.config.accuracy || 70;
        const accuracyMultiplier = this.weaponData?.accuracy_mult || 1.0;
        const accuracy = baseAccuracy * accuracyMultiplier;
        const inaccuracy = (100 - accuracy) / 500; // Scale down for a reasonable spread angle
        const randomOffset = new THREE.Vector3(
            (Math.random() - 0.5) * inaccuracy,
            (Math.random() - 0.5) * inaccuracy,
            (Math.random() - 0.5) * inaccuracy
        );
        direction.add(randomOffset).normalize();


        startPosition.add(direction.clone().multiplyScalar(0.2)); // Offset to avoid self-collision

        const damage = this.weaponData?.damage || 5;
        const boltSpeedMultiplier = this.weaponData?.bolt_speed_mult || 1.0;

        const bolt = new BlasterBolt(startPosition, direction, {
            owner: this,
            ownerType: this.isAlly ? 'ally' : 'enemy',
            damage: damage,
            speedMultiplier: boltSpeedMultiplier
        });
        game.entities.projectiles.push(bolt);
    }
}