// BROWSERFIREFOXHIDE levelManager.js
// update: Merged previous changes into the full file. A call to game.respawnAllies() is now made after the level is built to ensure allies spawn correctly with the player in the new level.
class LevelManager {
    constructor() {
        this.currentLevel = 0;
    }

    async loadLevel(levelId) {
        if(window.loadingScreenManager) window.loadingScreenManager.show();
        const playtestDataString = localStorage.getItem('gonk_level_to_play');
        try {
            this.currentLevel = levelId;
            let levelData;

            if(window.loadingScreenManager) window.loadingScreenManager.updateStatus(`Loading Level ${levelId} Data...`);
            if (playtestDataString) {
                levelData = JSON.parse(playtestDataString);
            } else {
                const response = await fetch(`data/levels/level_${levelId}.json`);
                if (!response.ok) throw new Error(`Level file not found for level_${levelId}.json`);
                levelData = await response.json();
            }

            // --- Random NPC Resolution (Step 1) ---
            // First, resolve all random placeholders into specific NPC keys.
            if (levelData.layers.npcs) {
                // FIX: The loaded data is an array of [key, value] pairs. Convert it to a Map for processing.
                const npcLayerMap = new Map(levelData.layers.npcs);
                const randomNpcItems = [];
                npcLayerMap.forEach((item, key) => {
                    if (item.type === 'random_npc') {
                        randomNpcItems.push({ key, item });
                    }
                });

                for (const { key, item } of randomNpcItems) {
                    const criteria = {
                        threat: item.properties.threat,
                        macroCategory: item.properties.macroCategory,
                        subgroup: item.properties.subgroup
                    };
                    const possibleNpcs = assetManager.getNpcsByCriteria(criteria);

                    if (possibleNpcs.length > 0) {
                        const chosenNpcKey = possibleNpcs[Math.floor(Math.random() * possibleNpcs.length)];
                        const chosenNpcItem = { ...item, type: 'npc', key: chosenNpcKey };
                        
                        // --- NAME GENERATION FIX ---
                        // The placeholder name needs to be generated *after* a specific NPC config is known.
                        chosenNpcItem.properties.name = levelRenderer.generateDefaultNamePlaceholderForNpc(chosenNpcKey);

                        // FIX: Update the Map, not the original array.
                        npcLayerMap.set(key, chosenNpcItem);
                    } else {
                        console.warn(`No NPCs found for random placement criteria:`, criteria);
                        npcLayerMap.delete(key);
                    }
                }
                // FIX: Convert the resolved Map back into an array for the asset loader.
                levelData.layers.npcs = Array.from(npcLayerMap.entries());
            }

            // --- Asset Loading (Step 2) ---
            // Now that all NPCs are known, load all level assets including the newly chosen NPC skins.
            await assetManager.loadLevelAssets(levelData);
            if(window.loadingScreenManager) window.loadingScreenManager.updateStatus('Preloading Weapon Models...');
            await weaponIcons.preloadWeapons(levelData);

            // --- Level Building (Step 3) ---
            if(window.loadingScreenManager) window.loadingScreenManager.updateStatus('Building Level Geometry...');
            levelRenderer.buildLevelFromData(levelData);
            if (levelData.layers.npcs) {
                // Now, create all NPCs from the fully resolved layer
                await levelRenderer.createNPCs(levelData.layers.npcs);
            }

            if (window.game) {
                game.respawnAllies();
            }

            // TODO: Implement furniture loading system. The previous `furnitureLoader` was not defined.
            // const furnitureObjects = await furnitureLoader.loadFromManifest('data/furniture.json');
            // for (const furniture of furnitureObjects) {
            //     game.scene.add(furniture);
            // }
        } catch (error) {
            console.error(`Failed to load or build level ${levelId}:`, error);
            levelRenderer.createFallbackFloor();
        } finally {
            if (playtestDataString) {
                localStorage.removeItem('gonk_level_to_play');
            }
            if(window.loadingScreenManager) window.loadingScreenManager.finishLoading();
        }
    }
}

window.levelManager = new LevelManager();