class LevelManager {
    constructor() {
        this.currentLevel = 0;
        this.nameData = null;
    }

    async loadLevel(levelId) {
        if(window.loadingScreenManager) window.loadingScreenManager.show();
        const playtestDataString = localStorage.getItem('gonk_level_to_play');
        try {
            // Shift ship control for the level we're leaving (not level 1, the home base)
            if (this.currentLevel && this.currentLevel !== 1 && window.mapScreen) {
                const previousLevel = this.currentLevel;
                window.mapScreen.shiftShipControl(previousLevel);
            }

            if (window.game) {
                if (window.game.npcs) {
                    for (const npc of window.game.npcs) {
                        npc.hasSpoken = false;
                    }
                }
                if (window.game.state && window.game.state.allies) {
                    for (const ally of window.game.state.allies) {
                        if (ally.npc) {
                            ally.npc.hasSpoken = false;
                        }
                    }
                }
            }
            this.currentLevel = levelId;
            let levelData;

            if(window.loadingScreenManager) window.loadingScreenManager.updateStatus(`Loading Level ${levelId} Data...`);
            let rawText;
            if (playtestDataString) {
                rawText = playtestDataString;
            } else {
                const response = await fetch(`data/levels/level_${levelId}.json`);
                if (!response.ok) throw new Error(`Level file not found for level_${levelId}.json`);
                rawText = await response.text();
            }
            const cleanText = rawText.split('\n').filter(line => !line.trim().startsWith('//') && !line.trim().startsWith('#')).join('\n');
            levelData = JSON.parse(cleanText);

            if (!this.nameData) {
                const nameDataResponse = await fetch('data/npc_names.json');
                if (!nameDataResponse.ok) throw new Error('Failed to load npc_names.json');
                this.nameData = await nameDataResponse.json();
            }

            if (levelData.layers.npcs) {
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
                        npcLayerMap.set(key, chosenNpcItem);
                    } else {
                        console.warn(`No NPCs found for random placement criteria:`, criteria);
                        npcLayerMap.delete(key);
                    }
                }

                npcLayerMap.forEach((item, key) => {
                    if (item.type !== 'npc') return;

                    const skinName = item.key;
                    const npcConfig = assetManager.npcIcons.get(skinName)?.config;

                    if (!npcConfig) {
                        console.warn(`Cannot assign name: No config found for NPC skin '${skinName}'.`);
                        return;
                    }

                    const subgroup = item.properties.subgroup || npcConfig.groupKey;

                    const npcForNaming = {
                        name: item.properties.name,
                        subgroup: subgroup,
                        faction: npcConfig.faction
                    };

                    item.properties.name = generateNpcName(npcForNaming, this.nameData);
                });


                levelData.layers.npcs = Array.from(npcLayerMap.entries());
            }

            await assetManager.loadLevelAssets(levelData);
            if(window.loadingScreenManager) window.loadingScreenManager.updateStatus('Preloading Weapon Models...');
            await weaponIcons.preloadWeapons(levelData);

            if(window.loadingScreenManager) window.loadingScreenManager.updateStatus('Building Level Geometry...');
            levelRenderer.buildLevelFromData(levelData);
            if (levelData.layers.assets) {
                levelRenderer.buildFurniture(levelData.layers.assets);
            }
            if (levelData.layers.npcs) {
                await levelRenderer.createNPCs(levelData.layers.npcs);
            }

            if (window.game) {
                game.respawnAllies();
            }

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