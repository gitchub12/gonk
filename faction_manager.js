// BROWSERFIREFOXHIDE faction_manager.js
class FactionManager {
    constructor() {
        this.factions = {};
        this.traits = {};
        this.relationshipCache = {};
        this.previousRelationshipCache = {};
        this.updateInterval = 0.1; // seconds
        this.updateTimer = 0;
        this.killEvents = []; // To process kill pushes
        this.allyEvents = []; // To process ally recruitment pulls

        // New ally pull strength model (in "points" or grid units)
        this.allyPullStrength = [
            0,    // 0 allies
            30,   // 1 ally
            50,   // 2 allies
            65,   // 3 allies
            75,   // 4 allies
            82    // 5+ allies
        ];
    }

    initialize(factionConfig) {
        if (!factionConfig || !factionConfig.factions) {
            console.error("Faction config data is missing or malformed.");
            return;
        }

        const newHomePositions = {
            takers: { x: 5, y: 100 }, // no change
            imperials: { x: 8, y: 49 },
            rebels: { x: 90, y: 46 },      // -5y
            player_droid: { x: 55, y: 6 }, // +5y
            clones: { x: 40, y: 85 },      // -5x
            mandalorians: { x: 70, y: 85 }, // +5y
            aliens: { x: 85, y: 70 },
            sith: { x: 25, y: 30 },      // -5x
            droids: { x: 40, y: 0 }       // -5y
        };

        this.traits = factionConfig.traits || {};
        const factionKeys = Object.keys(factionConfig.factions);

        for (const key of factionKeys) {
            const data = factionConfig.factions[key];
            if (!data.homePosition) continue;
            data.homePosition = newHomePositions[key] || data.homePosition; // Override with new layout
            this.factions[key] = {
                ...data,
                key: key,
                currentPosition: new THREE.Vector2(data.homePosition.x, data.homePosition.y),
                velocity: new THREE.Vector2(0, 0),
                pushForces: data.pushForces || {}
            };
        }
        
        // Ensure pushForces are symmetrical and handle missing entries
        for (const keyA of factionKeys) {
            for (const keyB of factionKeys) {
                if (keyA === keyB) continue;
                const factionA = this.factions[keyA];
                const factionB = this.factions[keyB];

                if (!factionA.pushForces) factionA.pushForces = {};
                if (!factionB.pushForces) factionB.pushForces = {};

                // Ensure B has A's push force if A defines it and B does not
                if (factionA.pushForces[keyB] && !factionB.pushForces[keyA]) {
                    factionB.pushForces[keyA] = factionA.pushForces[keyB];
                } 
                // Ensure A has B's push force if B defines it and A does not
                else if (factionB.pushForces[keyA] && !factionA.pushForces[keyB]) {
                    factionA.pushForces[keyB] = factionB.pushForces[keyA];
                }
            }
        }


        this._updateRelationshipCache();
        this.previousRelationshipCache = JSON.parse(JSON.stringify(this.relationshipCache));

        console.log("Faction Manager Initialized with Physics Model.", this.factions);
    }

    _updateRelationshipCache() {
        this.relationshipCache = {};
        const factionKeys = Object.keys(this.factions);
        for (let i = 0; i < factionKeys.length; i++) {
            for (let j = i; j < factionKeys.length; j++) {
                const keyA = factionKeys[i];
                const keyB = factionKeys[j];
                const posA = this.factions[keyA].currentPosition;
                const posB = this.factions[keyB].currentPosition;
                const distance = posA.distanceTo(posB);

                // Score is now directly proportional to distance. Low score = friendly.
                const score = (distance / 100) * 100; // Use 100 as max distance for 1:1 score
                const finalScore = Math.max(0, Math.min(100, score));

                if (!this.relationshipCache[keyA]) this.relationshipCache[keyA] = {};
                if (!this.relationshipCache[keyB]) this.relationshipCache[keyB] = {};
                this.relationshipCache[keyA][keyB] = finalScore;
                this.relationshipCache[keyB][keyA] = finalScore;
            }
        }
    }

    applyKillRepulsion(killerFactionKey, victimFactionKey) {
        if (!killerFactionKey || !victimFactionKey) return;
        this.killEvents.push({ killer: killerFactionKey, victim: victimFactionKey });
    }

    registerAlly(npc) {
        if (!npc || !npc.faction) return;
        this.allyEvents.push({ originalFaction: npc.originalFaction });
    }

    processFactionDynamics(deltaTime, allies, simulatedAllies) {
        this.updateTimer += deltaTime;
        if (this.updateTimer < this.updateInterval) {
            return;
        }
        // Cap deltaTime to prevent physics explosion when tab is inactive
        const timeStep = Math.min(this.updateTimer, 0.1); 
        this.updateTimer = 0;

        this.previousRelationshipCache = JSON.parse(JSON.stringify(this.relationshipCache));

        // This part is now just for the UI simulation sliders
        const allyCounts = {};
        // Re-add processing for active allies in the party
        for (const ally of allies) {
            const originalFaction = ally.npc.originalFaction;
            if (originalFaction) allyCounts[originalFaction] = (allyCounts[originalFaction] || 0) + 1;
        }

        for (const factionKey in simulatedAllies) {
            allyCounts[factionKey] = (allyCounts[factionKey] || 0) + simulatedAllies[factionKey];
        }

        // Process real in-game ally recruitment events
        for (const event of this.allyEvents) {
            allyCounts[event.originalFaction] = (allyCounts[event.originalFaction] || 0) + 1;
        }
        this.allyEvents = [];


        // --- Process Kill Events ---
        for (const event of this.killEvents) {
            const killerFaction = this.factions[event.killer];
            // Apply repulsion impulse to the victim faction's current position
            if (killerFaction && killerFaction.key === 'player_droid') {
                const victimFaction = this.factions[event.victim];
                if (victimFaction && !victimFaction.isStatic) {
                    const pushVector = new THREE.Vector2().subVectors(victimFaction.currentPosition, killerFaction.currentPosition);
                    const impulse = pushVector.normalize().multiplyScalar(GAME_GLOBAL_CONSTANTS.FACTIONS.KILL_PUSH);
                    victimFaction.velocity.add(impulse);
                }
            }
        }
        this.killEvents = [];

        // --- Calculate Net Forces ---
        const factionKeys = Object.keys(this.factions);
        const forces = {};
        factionKeys.forEach(key => forces[key] = new THREE.Vector2(0, 0));

        // --- Mutual Push Forces (calculated once per pair) ---
        for (let i = 0; i < factionKeys.length; i++) {
            for (let j = i + 1; j < factionKeys.length; j++) {
                const keyA = factionKeys[i];
                const keyB = factionKeys[j];
                const factionA = this.factions[keyA];
                const factionB = this.factions[keyB];

                if (factionA.isStatic && factionB.isStatic) continue;

                const pushConfig = factionA.pushForces ? factionA.pushForces[keyB] : null;
                if (!pushConfig || !pushConfig.strength || !pushConfig.radius) continue;

                const vecAtoB = new THREE.Vector2().subVectors(factionB.currentPosition, factionA.currentPosition);
                const distance = vecAtoB.length();

                if (distance > 0.01 && distance < pushConfig.radius) {
                    const normalizedDistance = distance / pushConfig.radius;
                    const pushStrength = pushConfig.strength * Math.pow(1 - normalizedDistance, 2);
                    const pushForce = vecAtoB.normalize().multiplyScalar(pushStrength);

                    // Apply push force to the faction's current position/velocity
                    if (!factionB.isStatic) forces[keyB].add(pushForce);
                    if (!factionA.isStatic) forces[keyA].sub(pushForce);
                }
            }
        }

        // --- Home Pull & Alliance Pull Calculation ---
        for (const key of factionKeys) {
            const faction = this.factions[key];
            if (faction.isStatic) continue;

            const homePosition = new THREE.Vector2(faction.homePosition.x, faction.homePosition.y);
            const homeRadius = faction.homeRadius || 0;

            // ALWAYS apply "rubber band" force towards home. This ensures factions return.
            const displacementFromHome = new THREE.Vector2().subVectors(homePosition, faction.currentPosition);
            const distanceFromHome = displacementFromHome.length();
            if (distanceFromHome > homeRadius) {
                // Simple linear pull force based on distance and elasticity
                const homeForce = displacementFromHome.clone().multiplyScalar(faction.elasticity * (GAME_GLOBAL_CONSTANTS.FACTIONS.HOME_PULL_STRENGTH || 0.05));
                forces[key].add(homeForce);
            }

            // Apply alliance pull force towards the player
            const numAllies = allyCounts[key] || 0;
            if (numAllies > 0) {
                const playerPos = this.factions['player_droid'].currentPosition;
                const distanceToPlayer = faction.currentPosition.distanceTo(playerPos);

                // Add a "dead zone" of 10 units around the player
                if (distanceToPlayer > 10) {
                    const pullIndex = Math.min(numAllies, this.allyPullStrength.length - 1);
                    const pullMagnitude = this.allyPullStrength[pullIndex] * (GAME_GLOBAL_CONSTANTS.FACTIONS.ALLIANCE_PULL_MULTIPLIER || 1.0);
                    const pullDirection = new THREE.Vector2().subVectors(playerPos, faction.currentPosition).normalize();
                    forces[key].add(pullDirection.multiplyScalar(pullMagnitude * 0.01)); // Scale down for force calculation
                }
            }
        }

        // --- Apply Forces and Update Positions ---
        for (const key of factionKeys) {
            const faction = this.factions[key];
            if (faction.isStatic) continue;

            const netForce = forces[key];
            const physicsTimeStep = timeStep * GAME_GLOBAL_CONSTANTS.FACTIONS.PHYSICS_SPEED;
            if (netForce.lengthSq() < GAME_GLOBAL_CONSTANTS.FACTIONS.MIN_FORCE_THRESHOLD) {
                faction.velocity.multiplyScalar(1 - (1 - GAME_GLOBAL_CONSTANTS.FACTIONS.DAMPING_FACTOR) * 5);
                if (faction.velocity.lengthSq() < 0.01) {
                    faction.velocity.set(0, 0);
                }
            } else {
                const acceleration = netForce.divideScalar(faction.mass);
                faction.velocity.add(acceleration.multiplyScalar(physicsTimeStep));
            }

            faction.velocity.multiplyScalar(GAME_GLOBAL_CONSTANTS.FACTIONS.DAMPING_FACTOR);
            faction.currentPosition.add(faction.velocity.clone().multiplyScalar(physicsTimeStep));

            const center = new THREE.Vector2(50, 50);
            const home = new THREE.Vector2(faction.homePosition.x, faction.homePosition.y);
            const vecFromCenter = new THREE.Vector2().subVectors(faction.currentPosition, center);
            const vecHomeFromCenter = new THREE.Vector2().subVectors(home, center);
            const maxDist = vecHomeFromCenter.length() + 40; // Increased from +10 to +40
            if (vecFromCenter.length() > maxDist) {
                vecFromCenter.normalize().multiplyScalar(maxDist);
                faction.currentPosition.copy(center).add(vecFromCenter);
                faction.velocity.set(0,0);
            }
        }

        this._updateRelationshipCache();
    }

    getRelationship(factionA_key, factionB_key) {
        if (!factionA_key || !factionB_key) return 50;
        if (factionA_key === factionB_key) return 0; // 0 is max friendly
        return this.relationshipCache[factionA_key]?.[factionB_key] || 50;
    }

    getRelationshipTrend(factionA, factionB) {
        const previous = this.previousRelationshipCache[factionA]?.[factionB];
        const current = this.relationshipCache[factionA]?.[factionB];

        if (previous === undefined || current === undefined) return 'stable';
        if (current < previous) return 'improving'; // Lower score is better
        if (current > previous) return 'worsening'; // Higher score is worse
        return 'stable';
    }

    getRelationshipAttitude(factionA_key, factionB_key) {
        const relationshipScore = this.getRelationship(factionA_key, factionB_key);
        const attitudes = window.assetManager.factionAttitudes?.attitudes;

        if (!attitudes) {
            // Fallback if the data isn't loaded, assuming higher score is more hostile
            if (relationshipScore >= 75) return 'h1';
            if (relationshipScore >= 25) return 'm1';
            return 'i1';
        }

        // Sort attitudes by threshold descending to check from highest to lowest
        const sortedAttitudes = [...attitudes].sort((a, b) => b.threshold - a.threshold);

        for (const attitude of sortedAttitudes) {
            if (relationshipScore >= attitude.threshold) {
                return attitude.name;
            }
        }

        // Default fallback to the attitude with the lowest threshold
        return sortedAttitudes[sortedAttitudes.length - 1]?.name || 'i1';
    }

    getAllFactionNames() { return this.factions ? Object.keys(this.factions) : []; }

    getNpcFaction(npc) {
        const skinName = npc.itemData.key;
        for (const groupKey in window.assetManager.npcGroups) {
            const group = window.assetManager.npcGroups[groupKey];
            if (group.textures && group.textures.some(t => (typeof t === 'string' ? t : t.file).replace('.png', '') === skinName)) {
                return group.faction;
            }
        }
        return 'aliens';
    }

    getTraits(baseType) {
        return this.traits[baseType] || {};
    }

    updateGlobalRelationship(factionA, factionB, amount) {
        // This function is deprecated and now a no-op. All relationship changes are physics-based.
        console.warn("updateGlobalRelationship is deprecated. Use shiftFactionBase or applyFactionPhysics.");
    }

    shiftFactionBase(target_faction, towards_faction, amount) {
        const target = this.factions[target_faction];
        const towards = this.factions[towards_faction];
        if (target && towards && !target.isStatic) {
            const direction = new THREE.Vector2().subVectors(towards.homePosition, target.homePosition).normalize();
            target.homePosition.x += direction.x * amount;
            target.homePosition.y += direction.y * amount;
        }
        // NOTE: The visual shift will occur on the next physics step due to home pull force.
    }

    applyFactionPhysics(target_faction, towards_faction, force_amount) {
        const target = this.factions[target_faction];
        const towards = this.factions[towards_faction];
        if (target && towards && !target.isStatic) {
            const direction = new THREE.Vector2().subVectors(towards.currentPosition, target.currentPosition).normalize();
            const impulse = direction.multiplyScalar(force_amount);
            target.velocity.add(impulse);
        }
    }
}