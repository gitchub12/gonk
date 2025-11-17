// BROWSERFIREFOXHIDE asset_loaders.js
// update: Corrected skybox asset lookup to properly handle keys with file extensions, fixing a texture loading error.
// update: The texture loader now properly encodes URIs to handle special characters (like spaces) in filenames, fixing multiple 404 errors.
// update: Added new module and health pickup paths for preloading.
// update: Corrected the path for the Gaffi Stick asset.
// update: Fixed bug in getNpcsByCriteria where `subgroup: 'all'` was incorrectly excluding NPCs. It now correctly includes all NPCs matching the threat and macroCategory.
// update: Ensured baseType, faction, and macroCategory are correctly cascaded from the NPC group onto individual NPC configs to fix random NPC spawning based on subgroup criteria.
// update: Corrected Zapper weapon asset paths to include the 'gmelee_zapper' subdirectory during preloading, fixing the texture loading failure.
// fix: Removed redundant loading of gmelee_zapper.png base file to fix a persistent 404 error and corrected the file name reference for Clones JSON loading to '2_clones.json'.
// fix: Re-added the missing loadFactionAttitudes method to resolve the game-breaking initialization error.
// fix: Added robust JSON parsing logic to loadNameData and loadCharacterData to prevent errors from embedded comments/invalid characters.

class AssetManager {
    constructor() {
        this.textures = new Map();
        this.materials = new Map();
        this.skyboxSets = new Map();
        this.weaponData = null;
        this.factionData = null;
        this.npcGroups = {};
        this.nameData = {};
        this.npcIcons = new Map(); // Add the missing npcIcons map
        this.audioBuffers = new Map();
        this.skinPathMap = new Map(); // Maps skin name (e.g., "ahsoka2") to full path
        this.pamphletTextureNames = [];
        this.moduleTexturePaths = [];
        this.pickupTexturePaths = [];
        this.factionAttitudes = null;
        this.playerStats = null;
    }

    async loadPlayerStats() {
        try {
            const response = await fetch('gonk_base_stats.json');
            const data = await response.json();
            this.playerStats = data.gonk_player;
        } catch (error) {
            console.error("Failed to load player stats:", error);
        }
    }

    async loadEssentialData() {
        this.discoverPamphletTextures();
        this.discoverPickupTextures();
        await Promise.all([
            this.loadWeaponData(),
            this.loadFactionData(),
            this.loadCharacterData(),
            this.loadNameData(),
            this.loadConversationData(),
            this.loadFactionAttitudes(), // FIX: This function call is now defined below
            this.preloadPlayerWeaponAssets(), // Preload zapper/pamphlet textures
            this.loadPlayerStats()
        ]);
        this.buildSkinPathMap();
    }

    getNpcsByCriteria(criteria) {
        const { threat, macroCategory, subgroup } = criteria;
        const matchingNpcs = [];

        // This mapping logic translates a subgroup string into a check against an NPC's config.
        const subgroupDefs = {
            'gamorrean': (cfg) => cfg.baseType === 'gamorrean',
            'gungan': (cfg) => cfg.baseType === 'gungan',
            'wookiee': (cfg) => cfg.baseType === 'wookiee',
            'ewok': (cfg) => cfg.baseType === 'halfpint',
            'jawa': (cfg) => cfg.baseType === 'quarterpint',
            'rebel_male': (cfg) => cfg.faction === 'rebels' && cfg.soundSet !== 'female',
            'rebel_female': (cfg) => cfg.faction === 'rebels' && cfg.soundSet === 'female',
            'human_male': (cfg) => cfg.baseType === 'human_male',
            'human_female': (cfg) => cfg.baseType === 'human_female',
            'droid_humanoid': (cfg) => cfg.baseType === 'droid_humanoid'
        };

        for (const [skinName, iconData] of this.npcIcons.entries()) {
            const config = iconData.config;
            if (!config) continue;

            // Check threat level and macro-category
            if (config.threat === threat && config.macroCategory === macroCategory) {
                // Check subgroup if specified
                if (subgroup && subgroup !== 'all') {
                    const subgroupCheck = subgroupDefs[subgroup.toLowerCase()];
                    if (subgroupCheck && subgroupCheck(config)) {
                        matchingNpcs.push(skinName);
                    } else if (!subgroupCheck && config.groupKey === subgroup) {
                        matchingNpcs.push(skinName);
                    }
                } else {
                    matchingNpcs.push(skinName);
                }
            }
        }
        return matchingNpcs;
    }

    async loadWeaponData() {
        try {
            const response = await fetch('data/npc_weapons.json');
            this.weaponData = await response.json();
        } catch (error) {
            console.error("Failed to load weapon data:", error);
        }
    }

    async loadFactionData() {
        try {
            const response = await fetch('data/faction_config.json');
            this.factionData = await response.json();
        } catch (error) {
            console.error("Failed to load faction config data:", error);
        }
    }

    async loadCharacterData() {
        // Overhaul to load all character JSONs, same as the editor's asset manager
        this.npcGroups = {
            _globals: {},
            _base_type_defaults: {}
        };

        const characterDataFiles = [
            '0_globals.json', '1_aliens.json', '2_clones.json', '3_rebels.json',
            '4_mandolorians.json', '5_sith.json', '6_imperials.json', '7_takers.json',
            '8_droids.json'
        ];

        for (const fileName of characterDataFiles) {
            try {
                const path = fileName === '0_globals.json'
                    ? `/data/${fileName}`
                    : `/data/factionJSONs/${fileName}`;
                const response = await fetch(path);
                const text = await response.text();
                // FIX: Use robust comment stripping, removing lines starting with # or //.
                const cleanText = text.split('\n')
                    .filter(line => !line.trim().startsWith('#') && !line.trim().startsWith('//'))
                    .join('\n');
                
                const data = JSON.parse(cleanText);

                if (data.defaults) this.npcGroups._globals = { ...this.npcGroups._globals, ...data.defaults };
                if (data.base_type_defaults) this.npcGroups._base_type_defaults = { ...this.npcGroups._base_type_defaults, ...data.base_type_defaults };
                
                Object.keys(data).filter(key => !['_comment', 'defaults', 'base_type_defaults'].includes(key)).forEach(key => {
                    this.npcGroups[key] = data[key];
                });
            } catch (e) {
                // FIX: Log error clearly and correctly reference the file name as a JSON file.
                console.error(`Failed to load or parse ${fileName} for game`, e);
            }
        }
        this.populateNpcConfigs(); // Populate the npcIcons map
    }

    // New method to populate the npcIcons map with config data for the game
    populateNpcConfigs() {
        for (const groupKey in this.npcGroups) {
            if (groupKey.startsWith('_')) continue;
            const group = this.npcGroups[groupKey];
            if (!group.textures) continue;

            for (const textureEntry of group.textures) {
                const textureFile = typeof textureEntry === 'string' ? textureEntry : textureEntry.file;
                const skinName = textureFile.replace('.png', '');
                const config = {
                    ...this.npcGroups._globals,
                    ...(this.npcGroups._base_type_defaults[groupKey] || {}),
                    ...(typeof textureEntry === 'object' ? textureEntry : { file: textureEntry }),
                    file: textureFile,
                    baseType: group.baseType,
                    faction: group.faction,
                    macroCategory: group.macroCategory,
                    groupKey: groupKey,
                    minecraftModel: group.minecraftModel || null // Include the 3D model type from group definition
                };
                this.npcIcons.set(skinName, { config });
            }
        }
    }

    async loadNameData() {
        try {
            const response = await fetch('/data/npc_names.json');
            const text = await response.text();
            // FIX: Use robust comment stripping, removing lines starting with # or //.
            const cleanText = text.split('\n')
                .filter(line => !line.trim().startsWith('#') && !line.trim().startsWith('//'))
                .join('\n');

            this.nameData = JSON.parse(cleanText);

            if (this.nameData._comment) {
                delete this.nameData._comment;
            }
        } catch(e) {
            // FIX: The error is here, ensure the logging is clean.
            console.error("Failed to load npc_names.json for game", e);
        }
    }

    async loadConversationData() {
        const conversationFiles = [
            'conversations_h1.json',
            'conversations_i1.json',
            'conversations_m1.json',
            'conversations_nonbasic.json'
        ];

        for (const fileName of conversationFiles) {
            try {
                const response = await fetch(`/data/${fileName}`);
                const data = await response.json();
                if (window.conversationController) {
                    window.conversationController.loadPhrases(data);
                }
            } catch (e) {
                console.error(`Failed to load or parse ${fileName} for conversations`, e);
            }
        }
    }
    
    async loadFactionAttitudes() {
        try {
            const response = await fetch('data/faction_attitudes.json');
            this.factionAttitudes = await response.json();
        } catch (error) {
            console.error("Failed to load faction attitudes data:", error);
        }
    }

    discoverPamphletTextures() {
        for (let i = 1; i <= 135; i++) {
            const textureName = `pamphlet_${String(i).padStart(4, '0')}`;
            this.pamphletTextureNames.push(textureName);
        }
    }
    
    // ADDED: Discover fixed pickup/module textures
    discoverPickupTextures() {
        const moduleKeys = [
            'force_mindtrick', 'force_shield', 'melee_damageup', 
            'move_jump', 'move_speed', 'ranged_firerateup', 
            'toughness_armorup', 'toughness_healthup', 'equipment_plus4weaponslots'
        ];
        const pickupKeys = [
            'heatlhsmall',
            'wiresmall'
        ];
        
        this.moduleTexturePaths = moduleKeys.map(key => `data/pngs/MODULES/${key}.png`);
        this.pickupTexturePaths = pickupKeys.map(key => `data/pngs/PICKUPS/${key}.png`);
    }

    async discoverPlayerWeapons() {
        const weaponRoot = '/data/gonkonlyweapons/';
        // FIX: Use the new directory structure. Hilts are weapons, blades are not.
        // This prevents scanning 'saberbladeunderlayer' and causing 404s.
        const categories = ['longarm', 'melee', 'pistol', 'rifle', 'saberhiltoverlayer', 'unique'];
        const allWeaponPaths = [];

        for (const category of categories) {
            const categoryPath = `${weaponRoot}${category}/`;
            try {
                const files = await this.fetchDirectoryListing(categoryPath, ['.png']);
                files.forEach(file => {
                    if (!file.endsWith('.png')) return; // Only include actual .png files
                    allWeaponPaths.push(`${categoryPath}${file}`);
                });
            } catch (e) { console.warn(`Could not discover weapons in ${categoryPath}`); }
        }
        return allWeaponPaths;
    }


    getRandomPamphletTextureName() {
        if (this.pamphletTextureNames.length === 0) return 'pamphlet_0001'; // Fallback
        const randomIndex = Math.floor(Math.random() * this.pamphletTextureNames.length);
        return this.pamphletTextureNames[randomIndex];
    }

    async preloadPlayerWeaponAssets() {
        const discoveredWeapons = await this.discoverPlayerWeapons();
        const texturePaths = new Set([
            ...discoveredWeapons,
            // ADDED: Pickup textures
            ...this.moduleTexturePaths,
            ...this.pickupTexturePaths,
            // Preload the new glow texture
            'data/pngs/effects/glow.png',
            // Preload the saber blade texture since it's not discovered as a weapon
            'data/gonkonlyweapons/saberbladeunderlayer/gsaberbladethick.png'
        ]);
        
        // Preload all pamphlet textures
        for(const pamphletName of this.pamphletTextureNames) {
            texturePaths.add(`data/gonkonlyweapons/pamphlets/${pamphletName}.png`);
        }

        // ADDED: Zapper animation frames (explicitly construct the correct paths)
        const zapperFrames = ['a', 'b', 'c', 'd', 'e'];
        const zapperPathBase = `data/gonkonlyweapons/melee/gmelee_zapper/gmelee_zapper_`;
        zapperFrames.forEach(frame => texturePaths.add(zapperPathBase + frame + '.png'));

        // FIX: Remove the redundant path loading, which causes the persistent 404
        texturePaths.delete('data/gonkonlyweapons/gmelee_zapper/.png'); 
        
        const promises = Array.from(texturePaths).map(path => this.loadTexture(path));
        await Promise.all(promises);
        
        // Initialize the shared material now that the texture is loaded
        if (window.initializeGlowMaterial) {
            window.initializeGlowMaterial();
        }
    }

    buildSkinPathMap() {
        if (!this.npcGroups) return;
        const skinPathPrefix = '/data/skins/';
        for (const groupKey in this.npcGroups) {
             if (groupKey === '_comment') continue;
            const group = this.npcGroups[groupKey];
            if (!group.path || !group.textures) continue;

            for (const textureEntry of group.textures) {
                const fileName = (typeof textureEntry === 'string' ? textureEntry : textureEntry.file);
                if (!fileName) continue;
                const skinName = fileName.replace('.png', '');
                const fullPath = `${skinPathPrefix}${group.path}${fileName}`;
                this.skinPathMap.set(skinName, fullPath);
            }
        }
    }

    async loadLevelAssets(levelData) {
        const texturePaths = new Set();
        const npcTexturePromises = [];
        await this.discoverAndRegisterSkyboxes();

        for (const layerName in levelData.layers) {
            if (layerName === 'skybox' || layerName === 'assets') continue;

            const layer = new Map(levelData.layers[layerName]);
            for (const item of layer.values()) {
                if (layerName === 'npcs') {
                    const fullPath = this.skinPathMap.get(item.key);
                    if (fullPath) {
                        // Load NPC skins immediately with their full key to avoid conflicts.
                        npcTexturePromises.push(this.loadTexture(fullPath, item.key));
                    }
                } else {
                     if (item.key) texturePaths.add(item.key);
                }
                if (item.properties) {
                    if (item.properties.wallsideTexture) texturePaths.add(item.properties.wallsideTexture);
                    if (item.properties.level2) texturePaths.add(item.properties.level2);
                    if (item.properties.level3) texturePaths.add(item.properties.level3);
                }
            }
        }

        if (levelData.settings && levelData.settings.defaults) {
            const defaults = levelData.settings.defaults;
            for (const key in defaults) {
                if (key === 'skybox') { // Special handling for default skybox
                    if (defaults[key] && defaults[key].key) {
                        const skyboxInfo = this.skyboxSets.get(defaults[key].key);
                        if (skyboxInfo && skyboxInfo.type === 'static') {
                            texturePaths.add(skyboxInfo.path);
                        }
                        // Note: random_static and animation types load dynamically, not here
                    }
                } else { // Handle other defaults normally
                    if (defaults[key] && defaults[key].key) texturePaths.add(defaults[key].key);
                }
                if (defaults[key] && defaults[key].wallside) texturePaths.add(defaults[key].wallside);
            }
        }

        const currentSkyboxItem = levelData.layers.skybox ? new Map(levelData.layers.skybox).get('0,0') : (levelData.settings?.defaults.skybox || null);
        if (currentSkyboxItem && currentSkyboxItem.key) {
            const skyboxKey = currentSkyboxItem.key.split('.')[0];
            const skyboxType = currentSkyboxItem.properties?.type || 'static';
            const skyboxInfo = this.skyboxSets.get(skyboxKey);
            if (skyboxInfo && skyboxType === 'static' && skyboxInfo.type === 'static') {
                texturePaths.add(skyboxInfo.path);
            }
            // Note: random_static and animation types load dynamically in createSkybox, not here
        }

        const texturePromises = Array.from(texturePaths).map(path => this.loadTexture(path));
        await Promise.all([...texturePromises, ...npcTexturePromises]);
    }

    async loadTexture(path, key = null) {
        if (!path) return;
        // Check for common prefix in pickup/module paths to extract a clean key
        let textureName = key;
        if (!textureName) {
            if (path.includes('data/pngs/MODULES/')) {
                 textureName = path.split('/').pop().replace(/\.[^/.]+$/, "");
            } else if (path.includes('data/pngs/PICKUPS/')) {
                textureName = path.split('/').pop().replace(/\.[^/.]+$/, "");
            } else if (path.includes('data/pngs/effects/')) {
                textureName = path.split('/').pop().replace(/\.[^/.]+$/, "");
            } else if (path.includes('data/weapons/saber/')) {
                textureName = path.split('/').pop().replace(/\.[^/.]+$/, "");
            } else if (path.includes('data/weapons/saber/')) {
                textureName = path.split('/').pop().replace(/\.[^/.]+$/, "");
            } else {
                textureName = path.split('/').pop().replace(/\.[^/.]+$/, "");
            }
        }
        
        if (this.textures.has(textureName)) return this.textures.get(textureName);

        try {
            const encodedPath = encodeURI(path);
            const texture = await new THREE.TextureLoader().loadAsync(encodedPath);
            texture.magFilter = THREE.NearestFilter;
            texture.minFilter = THREE.NearestFilter;
            texture.encoding = THREE.sRGBEncoding;
            this.textures.set(textureName, texture);
            this.createMaterialFromTexture(textureName, texture);
            return texture;
        } catch (error) {
            console.warn(`Failed to load texture: ${path}`, error);
            return null;
        }
    }

    createMaterialFromTexture(name, texture) {
        const material = new THREE.MeshStandardMaterial({
            map: texture,
            transparent: true,
            alphaTest: 0.01,
            roughness: 1.0,
            metalness: 0.0,
        });
        this.materials.set(name, material);
    }

    getTexture(name) { return this.textures.get(name); }
    getMaterial(name) { return this.materials.has(name) ? this.materials.get(name).clone() : null; }
    getMaterialFromPath(path) {
        if (!path) return null;
        const name = path.split('/').pop().replace(/\.[^/.]+$/, "");
        return this.getMaterial(name);
    }

    async fetchDirectoryListing(path, extensions = [], allowDirectories = false) {
        try {
            // FIX: Removed unnecessary console logging to prevent spam
            const response = await fetch(path);
            if (!response.ok) return [];
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const links = Array.from(doc.querySelectorAll('a'))
                .map(a => a.getAttribute('href'))
                .filter(href => href && !href.startsWith('?') && !href.startsWith('../'));
            
            const filteredLinks = links.filter(href => (allowDirectories && href.endsWith('/')) || extensions.some(ext => href.endsWith(ext)));
            // FIX: Removed unnecessary console logging to prevent spam
            return filteredLinks;
        } catch (e) {
            console.warn(`Could not fetch directory listing for "${path}".`);
            return [];
        }
    }

    async discoverAndRegisterSkyboxes() {
        if (this.skyboxSets.size > 0) return;
        try {
            const skyboxPath = '/data/pngs/skybox/';
            const items = await this.fetchDirectoryListing(skyboxPath, [], true);

            for (const item of items) {
                const isDir = item.endsWith('/');
                const name = isDir ? item.slice(0, -1) : item.replace(/\.(png|jpg)$/, '');
                if (isDir) {
                    // Folders can be used for either animation or random_static
                    // Store both types with the same path - the usage context determines behavior
                    this.skyboxSets.set(name, { type: 'folder', path: `${skyboxPath}${item}` });
                } else if (item.endsWith('.png') || item.endsWith('.jpg')) {
                    this.skyboxSets.set(name, { type: 'static', path: `${skyboxPath}${item}` });
                }
            }
        } catch (error) {
            console.warn("Could not discover skyboxes via directory listing.", error);
        }

        // Fallback: manually register known skybox files if discovery failed
        if (this.skyboxSets.size === 0) {
            console.log("Using fallback skybox registration...");
            const skyboxPath = 'data/pngs/skybox/';
            const knownSkyboxes = [
                'fishdark3.png', 'fishdark.png', 'fish.png',
                'blue_twilight_redclouds.png', 'bluenight_clouds.png', 'purpleaurora.png',
                'qwantani_night.png', 'rostock_laage_airport.png',
                'hangar.png', 'hangarihi.png', 'rebelhangarup.png',
                '0002.png', 'Gemini_Generated_Image_k4f4kkk4f4kkk4f4.png',
                'M3_Cinematic_Realism_equirectangular-jpg_interior_of_a_large_1593670413_455229.png',
                'M3_Photoreal_equirectangular-jpg_wide_open_plaza_in_847306475_455207.png',
                'M3_Sky_Dome_equirectangular-jpg_clear_blue_sky_bright_1478788763_455173.png'
            ];
            for (const file of knownSkyboxes) {
                const name = file.replace(/\.(png|jpg)$/, '');
                this.skyboxSets.set(name, { type: 'static', path: `${skyboxPath}${file}` });
            }
            console.log(`Registered ${this.skyboxSets.size} fallback skyboxes`);
        }
    }

    async loadAnimatedSkybox(key) {
        const skyboxInfo = this.skyboxSets.get(key);
        if (!skyboxInfo || skyboxInfo.type !== 'folder') return null;

        try {
            const loader = new THREE.TextureLoader();
            const textures = [];
            const files = await this.fetchDirectoryListing(skyboxInfo.path);
            const imageFiles = files.filter(f => f.endsWith('.png') || f.endsWith('.jpg')).sort();

            for (const file of imageFiles) {
                try {
                    const texture = await loader.loadAsync(`${skyboxInfo.path}${file}`);
                    textures.push(texture);
                } catch (e) {
                    console.warn(`Could not load skybox frame ${file}`);
                }
            }

            textures.forEach(tex => { tex.encoding = THREE.sRGBEncoding; });
            return textures.length > 0 ? textures : null;
        } catch (error) {
            console.error(`Failed to load animated skybox ${key}:`, error);
            return null;
        }
    }

    async loadRandomStaticSkybox(key) {
        const skyboxInfo = this.skyboxSets.get(key);
        if (!skyboxInfo || skyboxInfo.type !== 'folder') return null;

        try {
            const files = await this.fetchDirectoryListing(skyboxInfo.path);
            const imageFiles = files.filter(f => f.endsWith('.png') || f.endsWith('.jpg'));

            if (imageFiles.length === 0) {
                console.warn(`No images found in skybox folder ${key}`);
                return null;
            }

            // Pick a random image from the folder
            const randomFile = imageFiles[Math.floor(Math.random() * imageFiles.length)];
            const fullPath = `${skyboxInfo.path}${randomFile}`;

            console.log(`Selected random skybox: ${randomFile} from ${key}`);
            return fullPath;
        } catch (error) {
            console.error(`Failed to load random static skybox ${key}:`, error);
            return null;
        }
    }

    async loadAudio(path, key) {
        if (this.audioBuffers.has(key)) {
            return this.audioBuffers.get(key);
        }
        return new Promise((resolve, reject) => {
            const loader = new THREE.AudioLoader();
            loader.load(path, (buffer) => {
                this.audioBuffers.set(key, buffer);
                resolve(buffer);
            }, undefined, (err) => {
                console.error(`Failed to load audio: ${path}`, err);
                reject(err);
            });
        });
    }
}