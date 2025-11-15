// BROWSERFIREFOXHIDE npc_behavior_death.js
function handleNpcDeath(npc, killer = null) {
    console.log(`handleNpcDeath called for ${npc.name} (ID: ${npc.mesh.group.uuid}) at ${performance.now()}`);
    if (npc.isDead) return;
    npc.isDead = true;
    npc.currentState = 'DEAD';
    npc.movementCollider.velocity.set(0, 0, 0);
    // window.setGonkAnimation(npc.mesh, 'death'); // Removed explicit death animation
    physics.createRagdoll(npc.mesh); // Apply ragdoll immediately
    game.scene.remove(npc.mesh.group); // Remove the original mesh immediately

    if (npc.isAlly && killer) {
        let closestTarget = null;
        let minDistance = Infinity;

        // Find the player
        const player = window.physics.playerCollider;
        const distanceToPlayer = npc.mesh.group.position.distanceTo(player.position);
        if (distanceToPlayer < minDistance) {
            minDistance = distanceToPlayer;
            closestTarget = window.game.playerEntity;
        }

        // Find the closest ally
        for (const ally of window.game.state.allies) {
            if (ally.npc && !ally.npc.isDead && ally.npc !== npc) {
                const distanceToAlly = npc.mesh.group.position.distanceTo(ally.npc.mesh.group.position);
                if (distanceToAlly < minDistance) {
                    minDistance = distanceToAlly;
                    closestTarget = ally.npc;
                }
            }
        }

        if (closestTarget) {
            killer.aggro(closestTarget);
        }
    }

    // --- Drop Pickups ---
    const dropPosition = npc.mesh.group.position.clone();
    dropPosition.y = physics.getGroundHeight(dropPosition.x, dropPosition.z) + 0.2;

    const threat = npc.config.threat || 1;
    let noDropChance;
    if (threat >= 5) {
        noDropChance = 0;
    } else {
        noDropChance = 0.9 - (threat - 1) * 0.2;
    }

    if (Math.random() >= noDropChance) {
        const allWeaponData = window.assetManager.weaponData;
        let droppableWeapons = [];
        let randomWeaponTotalWeight = 0;
        if (allWeaponData) {
            for (const weaponKey in allWeaponData) {
                if (weaponKey.startsWith('_')) continue;
                const weapon = allWeaponData[weaponKey];
                const dropFactionsRaw = weapon['drop_faction[4	]'] || weapon['drop_faction[2	]'] || weapon['drop_faction[3	]'] || weapon.drop_faction;
                if (dropFactionsRaw) {
                    const factions = String(dropFactionsRaw).split('	').map(f => f.trim().toLowerCase());
                    if (factions.includes(npc.faction.toLowerCase())) {
                        const dropWeight = weapon.drop_weight || 0;
                        if (dropWeight > 0) {
                            droppableWeapons.push({ key: weaponKey, weight: dropWeight });
                            randomWeaponTotalWeight += dropWeight;
                        }
                    }
                }
            }
        }

        const hasEquippedWeapon = npc.itemData.properties.weapon && npc.itemData.properties.weapon !== 'none';
        const equippedWeaponWeight = hasEquippedWeapon ? 250 : 0;
        const healthWeight = 20;
        const wireWeight = 20;
        const moduleWeight = 10;

        const totalWeight = randomWeaponTotalWeight + equippedWeaponWeight + healthWeight + wireWeight + moduleWeight;
        if (totalWeight > 0) {
            let roll = Math.random() * totalWeight;
            const originalRoll = roll;

            // Check for equipped weapon drop
            if (hasEquippedWeapon) {
                roll -= equippedWeaponWeight;
                if (roll <= 0) {
                    const weaponKey = npc.itemData.properties.weapon.split('/').pop().replace('.png', '');
                    console.log(`Roll ${originalRoll.toFixed(2)} of ${totalWeight.toFixed(2)}: Item dropped ${weaponKey}.png`);
                    const weaponData = allWeaponData[weaponKey]; // Get weapon data to retrieve drop_weight
                    const equippedWeaponDropWeight = weaponData?.drop_weight || 0;
                    window.game.entities.droppedWeapons.push(new WeaponPickup(weaponKey, dropPosition.clone(), equippedWeaponDropWeight));
                    return; // Return after dropping one item.
                }
            }

            // Check for health pickup
            roll -= healthWeight;
            if (roll <= 0) {
                console.log(`Roll ${originalRoll.toFixed(2)} of ${totalWeight.toFixed(2)}: Item dropped healthsmall.png`);
                game.entities.pickups.push(new Pickup('health', 'healthsmall.png', dropPosition.clone()));
                return;
            }

            // Check for wire pickup
            roll -= wireWeight;
            if (roll <= 0) {
                console.log(`Roll ${originalRoll.toFixed(2)} of ${totalWeight.toFixed(2)}: Item dropped wiresmall.png`);
                game.entities.pickups.push(new Pickup('wire', 'wiresmall.png', dropPosition.clone()));
                return;
            }

            // Check for module pickup
            roll -= moduleWeight;
            if (roll <= 0) {
                const moduleOptions = [
                    'force_mindtrick', 'force_shield', 'melee_damageup',
                    'move_jump', 'move_speed', 'ranged_firerateup',
                    'toughness_armorup', 'toughness_healthup'
                ];
                const randomModule = moduleOptions[Math.floor(Math.random() * moduleOptions.length)];
                console.log(`Roll ${originalRoll.toFixed(2)} of ${totalWeight.toFixed(2)}: Item dropped ${randomModule}.png`);
                game.entities.pickups.push(new Pickup('module', randomModule, dropPosition.clone()));
                return;
            }

            // Check for random weapon drop
            if (droppableWeapons.length > 0) {
                for (const weapon of droppableWeapons) {
                    roll -= weapon.weight;
                    if (roll <= 0) {
                        console.log(`Roll ${originalRoll.toFixed(2)} of ${totalWeight.toFixed(2)}: Item dropped ${weapon.key}.png`);
                        window.game.entities.droppedWeapons.push(new WeaponPickup(weapon.key, dropPosition.clone(), weapon.weight));
                        return;
                    }
                }
            }
        }
    }
    
    // --- End Weapon Drop ---


    if (npc.config.baseType === 'gamorrean' && window.audioSystem) {
        audioSystem.playPositionalSoundFromList('gamorreandeath', npc.mesh.group.position, 0.9);
    } else if (npc.config.baseType === 'wookiee' && window.audioSystem) {
        audioSystem.playPositionalSoundFromList('wookdeath', npc.mesh.group.position, 0.9);
    } else if (window.audioSystem) {
        const maleTypes = ['human_male', 'humanoid', 'clone', 'mandalorian', 'stormtrooper', 'darth', 'taker'];
        const soundSet = npc.itemData.properties?.soundSet;

        if (soundSet === 'female') {
            audioSystem.playPositionalSoundFromList('femaledeath', npc.mesh.group.position, 0.9);
        } else if (maleTypes.includes(npc.config.baseType) && soundSet !== 'female') {
            audioSystem.playMaleDeathSound(npc.mesh.group.position, 0.9);
        }
    }

    if (killer && window.game.factionManager) {
        const killerFaction = (killer === physics.playerEntity || killer.isPlayer) ? 'player_droid' : killer.faction;
        if(killerFaction === 'player_droid') game.handlePlayerKill(npc);

        // Call the faction manager to apply an impulse to the victim's faction position
        window.game.factionManager.applyKillRepulsion(killerFaction, npc.faction);

        // If killed by player or an ally, trigger the sad animation for the victim's faction
        if ((killerFaction === 'player_droid' || killer.isAlly) && window.factionAvatarManager) {
            window.factionAvatarManager.triggerSpecialAnimation(npc.faction, 's1');
        }
    }

    if (npc.isAlly) game.handleAllyDeath(npc); // Handle ally death immediately after mesh removal
}