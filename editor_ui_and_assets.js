// BROWSERFIREFOXHIDE editor_ui_and_assets.js
// update: The asset manager now correctly reads and stores the `soundSet` property from charactersdotjson, fixing the NPC hurt sound data pipeline.
// update: Rewrote the skybox palette UI to use a clearer "None/Static/Animated" selection method.
class EditorAssetManager {
    constructor(modelSystem) {
        this.modelSystem = modelSystem;
        this.npcGroups = {}; // This will be populated by discoverAssets
        this.npcIcons = new Map();
        this.isCharacterDataDirty = false;
        this.furnitureJsons = new Map();
        this.assetIcons = new Map();
        this.nameData = {};
        this.npcWeaponData = {};
        this.weaponPaths = [];
        this.textureLayers = [
            'subfloor', 'floor', 'water', 'floater', 'decor', 'ceiling', 'ceilingsides', 'sky', 
            'wall', 'door', 'dock', 'screen', 'panel', 'dangler', 'spawn', 'loadscreens',
            'skybox', 'elevation', 'elevationsides', 'pillar'
        ];
        this.layerTextures = {};
        this.textureLayers.forEach(type => this.layerTextures[type] = []);
        this.skyboxStaticFiles = [];
        this.skyboxAnimationFolders = [];
        this.musicLibrary = {}; // { category: [trackPath, ...], ... }
        this.musicCategories = [];
    }

    async fetchDirectoryListing(path, extensions = ['.png'], allowDirectories = false) {
        try {
            const response = await fetch(path);
            if (!response.ok) return [];
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            return Array.from(doc.querySelectorAll('a'))
                .map(a => a.getAttribute('href'))
                .filter(href => {
                    if (!href || href.startsWith('?') || href.startsWith('../')) return false;
                    const isDir = href.endsWith('/');
                    if (allowDirectories && isDir) return true;
                    return !isDir && extensions.some(ext => href.endsWith(ext));
                });
        } catch (e) {
            console.warn(`Could not fetch directory listing for "${path}".`);
            return [];
        }
    }

    async discoverAssets() {
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
                // Fetch as text first to strip out comments (lines starting with #)
                let text = await response.text();

                // Attempt to fix unterminated strings, a common manual JSON editing error.
                if (text.includes('Unterminated string in JSON')) {
                    text = text.replace(/:\s*"([^"\n]*)$/gm, ' "$1",');
                }

                const cleanText = text.split('\n').filter(line => !line.trim().startsWith('#')).join('\n');
                const data = JSON.parse(cleanText);

                if (data.defaults) { // From 0_globals.json
                    this.npcGroups._globals = { ...this.npcGroups._globals, ...data.defaults };
                }
                if (data.base_type_defaults) { // From other files
                    this.npcGroups._base_type_defaults = { ...this.npcGroups._base_type_defaults, ...data.base_type_defaults };
                }
                // Add the main character groups, skipping special keys
                Object.keys(data).filter(key => !['_comment', 'defaults', 'base_type_defaults'].includes(key)).forEach(key => {
                    this.npcGroups[key] = data[key];
                });
            } catch (e) {
                console.error(`Failed to load or parse ${fileName}`, e);
            }
        }

        // Load name data here to make it globally available
        try {
            const response = await fetch('/data/npc_names.json');
            this.nameData = await response.json();
            // The JSON file has a _comment key, which should be removed.
            if (this.nameData._comment) {
                delete this.nameData._comment;
            }
        } catch(e) {
            console.error("Failed to load npc_names.json", e);
        }

        // Load NPC weapon data
        try {
            const response = await fetch('/data/npc_weapons.json');
            const text = await response.text();
            const cleanText = text.split('\n').filter(line => !line.trim().startsWith('#')).join('\n');
            this.npcWeaponData = JSON.parse(cleanText);
        } catch(e) {
            console.error("Failed to load npc_weapons.json", e);
        }

        for (const layerType of this.textureLayers) {
            if (layerType === 'skybox') {
                const skyboxPath = `/data/pngs/skybox/`;
                const serverItems = await this.fetchDirectoryListing(skyboxPath, ['.png', '.jpg', '.jpeg'], true);
                this.skyboxAnimationFolders = serverItems.filter(item => item.endsWith('/')).map(item => item.slice(0, -1));
                this.skyboxStaticFiles = serverItems.filter(item => !item.endsWith('/'));
                continue;
            }

            let pathsToSearch = [`/data/pngs/${layerType}/`];
            if (layerType === 'wall') {
                pathsToSearch.push('/data/pngs/wall/wall2/', '/data/pngs/wall/wall3/');
            }
            for(const path of pathsToSearch) {
                 const textureFiles = await this.fetchDirectoryListing(path, ['.png']);
                 this.layerTextures[layerType].push(...textureFiles.map(file => `${path}${file}`));
            }
        }

        await this.generateNpcIcons();

        // FIX: Scan all subdirectories within NPConlyweapons to correctly discover all weapon assets.
        const weaponRoot = '/data/NPConlyweapons/';
        const weaponCategories = ['longarm', 'melee', 'pistol', 'rifle', 'saber', 'unique'];
        const allWeaponPaths = [];
        for (const category of weaponCategories) {
            const categoryPath = `${weaponRoot}${category}/`;
            try {
                const files = await this.fetchDirectoryListing(categoryPath, ['.png']);
                files.forEach(file => {
                    allWeaponPaths.push(`${categoryPath}${file}`);
                });
            } catch (e) { console.warn(`Could not discover NPC weapons in ${categoryPath}`); }
        }
        this.weaponPaths = allWeaponPaths;

        try {
            const furnitureManifest = await (await fetch('/furniture_config.json')).json();
            const modelPath = furnitureManifest._config.modelPath; // e.g., "data/furniture/"
            for (const modelKey in furnitureManifest.models) {
                const modelDef = furnitureManifest.models[modelKey];
                const modelJsonPath = `/${modelPath}${modelDef.file}`;
                this.furnitureJsons.set(modelKey, modelJsonPath);

                // Attempt to find a real icon instead of a placeholder
                const iconPath = `/data/furniture/textures/items/${modelKey}pic.png`;

                // Use a full GET request as HEAD can be unreliable on dev servers
                const res = await fetch(iconPath);
                if (res.ok) {
                    this.assetIcons.set(modelKey, iconPath);
                } else {
                    this.assetIcons.set(modelKey, this.createPlaceholderIcon(modelKey));
                }
            }
        } catch (e) { console.error("Failed to discover furniture assets:", e); }

        // Discover music categories and tracks
        await this.discoverMusic();

        return true;
    }

    async discoverMusic() {
        const musicRoot = '/data/sounds/MUSIC/';
        try {
            const response = await fetch(musicRoot);
            if (!response.ok) {
                console.warn(`Music directory not found: ${musicRoot}`);
                return;
            }
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const links = Array.from(doc.querySelectorAll('a')).map(a => a.getAttribute('href'));

            for (const href of links) {
                if (href.endsWith('/') && !href.startsWith('..') && !href.startsWith('?')) {
                    const categoryName = href.slice(0, -1);
                    await this.discoverTracksInCategory(categoryName, musicRoot);
                }
            }
            this.musicCategories = Object.keys(this.musicLibrary);
            console.log(`Discovered ${this.musicCategories.length} music categories.`);
        } catch (e) {
            console.warn(`Could not scan music root directory: ${musicRoot}`, e);
        }
    }

    async discoverTracksInCategory(category, musicRoot) {
        const categoryPath = `${musicRoot}${category}/`;
        try {
            const response = await fetch(categoryPath);
            if (!response.ok) return;

            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const links = Array.from(doc.querySelectorAll('a')).map(a => a.getAttribute('href'));

            const tracks = [];
            for (const href of links) {
                if (href.endsWith('.mp3') || href.endsWith('.ogg') || href.endsWith('.wav')) {
                    tracks.push(`${categoryPath}${href}`);
                }
            }

            if (tracks.length > 0) {
                this.musicLibrary[category] = tracks;
            }
        } catch (e) {
            console.warn(`Could not scan music category: ${categoryPath}`, e);
        }
    }

    createPlaceholderIcon(name) {
        const canvas = document.createElement('canvas');
        canvas.width = 64; canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#555'; ctx.fillRect(0, 0, 64, 64);
        ctx.fillStyle = '#fff'; ctx.font = '10px Arial'; ctx.textAlign = 'center';
        ctx.textBaseline = 'middle'; ctx.fillText(name, 32, 32);
        return canvas.toDataURL();
    }

    detectArmType(image) {
        if (image.width < 64 || image.height < 64) return 'steve';

        if (!image.canvas) {
            const canvas = document.createElement('canvas');
            canvas.width = image.width;
            canvas.height = image.height;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            ctx.drawImage(image, 0, 0);
            image.canvas = canvas;
            image.canvasContext = ctx;
        }

        const ctx = image.canvasContext;
        const scale = image.width / 64;
        const pixelX = 54 * scale;
        const pixelY = 20 * scale;

        try {
            const pixelData = ctx.getImageData(pixelX, pixelY, 1, 1).data;
            return pixelData[3] === 0 ? 'alex' : 'steve';
        } catch (e) {
            console.warn("Could not detect arm type due to canvas security restrictions.", e);
            return 'steve';
        }
    }

    async generateNpcIcons() {
        const iconPromises = [];
        const skinPathPrefix = '/data/skins/';
        for (const groupKey in this.npcGroups) {
            if(groupKey === "_comment") continue;
            const group = this.npcGroups[groupKey];
            if (!group.path || !group.textures) continue;

            for (const textureEntry of group.textures) {
                const isStringEntry = typeof textureEntry === 'string';
                let textureFile = isStringEntry ? textureEntry : textureEntry.file;
                let armType = isStringEntry ? 'steve' : (textureEntry.armType || 'unknown'); // FIX: Correctly read snake_case properties from JSON
                const defaultWeapon = isStringEntry ? null : textureEntry.default_weapon;
                const soundSet = isStringEntry ? null : textureEntry.soundSet;

                if (!textureFile) continue;

                const skinName = textureFile.replace('.png', '');
                const fullPath = `${skinPathPrefix}${group.path}${textureFile}`;

                const promise = new Promise(resolve => {
                    const loader = new THREE.TextureLoader();
                    loader.load(fullPath, async (loadedTexture) => {
                        if (armType === 'unknown') {
                            armType = this.detectArmType(loadedTexture.image);
                            if(isStringEntry) {
                                const index = group.textures.indexOf(textureEntry);
                                if (index !== -1) {
                                    group.textures[index] = { file: textureFile, armType: armType };
                                }
                            } else {
                                textureEntry.armType = armType;
                            }
                            this.isCharacterDataDirty = true;
                            if (window.editorUI) window.editorUI.updateSaveCharacterButtonState(true);
                        }

                        const iconDataUrl = await window.generateNpcIconDataUrl(loadedTexture);
                        if (iconDataUrl) {
                            this.npcIcons.set(skinName, { 
                        icon: iconDataUrl,
                        group: groupKey,
                        // --- Start of Data Consolidation ---
                        // Combine global, base type, and individual texture properties
                        config: {
                            ...this.npcGroups._globals, // Universal defaults
                            ...(this.npcGroups._base_type_defaults[group.baseType] || {}), // Base type defaults
                            ...(typeof textureEntry === 'object' ? textureEntry : { file: textureEntry }), // Individual overrides
                            // Ensure critical properties are set
                            file: textureFile,
                            armType: armType,
                            soundSet: soundSet,
                            default_weapon: defaultWeapon,
                            baseType: group.baseType,
                            faction: group.faction,
                            macroCategory: group.macroCategory
                        }
                        // --- End of Data Consolidation ---
                            });
                            const img = new Image();
                            img.src = iconDataUrl;
                            window[skinName + '_icon_img'] = img;
                        }
                        resolve();
                    }, undefined, () => resolve());
                });
                iconPromises.push(promise);
            }
        }
        await Promise.all(iconPromises);
    }
}

class EditorUI {
    constructor(editor) {
        this.editor = editor; this.assetManager = editor.assetManager;
        this.layerSelector = document.getElementById('layer-selector'); this.paletteContainer = document.getElementById('palette-container');
        this.templateBuilderContainer = document.getElementById('template-builder-container');
        this.gridWidthInput = document.getElementById('grid-width-input'); this.gridHeightInput = document.getElementById('grid-height-input');
        this.levelNumberInput = document.getElementById('level-number-input'); this.levelDisplay = document.getElementById('level-display');
        this.elevationDisplay = document.getElementById('elevation-level-display');
        this.ceilingDisplay = document.getElementById('ceiling-height-display');
        this.pillarDisplay = document.getElementById('pillar-height-display');
        this.propertiesPanel = document.getElementById('properties-panel');
        this.propContent = document.getElementById('prop-content');
        this.currentPropItem = null;
        this.defaultTextureSelects = {}; 
        this.layerButtons = {};

        const defaultLayers = ['water', 'floater', 'sky'];
        defaultLayers.forEach(id => {
            const el = document.getElementById(`default-${id}-select`); 
            if(el) this.defaultTextureSelects[id] = el;
        });
        const ceilingHeightEl = document.getElementById('default-ceiling-height');
        if(ceilingHeightEl) this.defaultTextureSelects['ceilingHeight'] = ceilingHeightEl;

        this.elevationBrushTextures = { wallside: null };
        this.elevationLevel = 1;
        this.ceilingHeight = 1;
        this.pillarHeight = 3;

        this.toolButtons = { 
            template: document.getElementById('tool-template'), paint: document.getElementById('tool-paint'), 
            erase: document.getElementById('tool-erase'), rotate: document.getElementById('tool-rotate'), 
            spawn: document.getElementById('tool-spawn'), fill: document.getElementById('tool-fill') 
        };
        // This is a global reference for the asset manager to call
        window.editorUI = this;
    }

    init() {
        document.querySelectorAll('.tab-button').forEach(tab => tab.addEventListener('click', () => {
            document.querySelectorAll('.tab-button, .tab-content').forEach(t => t.classList.remove('active'));
            tab.classList.add('active'); document.getElementById(`${tab.dataset.tab}-content`).classList.add('active');
        }));
        this.createLayerSelector();
        this.createNpcPalette(); // Create the new NPC palette
        document.getElementById('load-level-btn').addEventListener('click', () => this.editor.loadLevel(parseInt(this.levelNumberInput.value) || 1));
        document.getElementById('save-level-btn').addEventListener('click', () => this.editor.saveLevel());
        document.getElementById('save-characters-btn').addEventListener('click', () => this.editor.saveCharacterData());
        document.getElementById('reset-layer-btn').addEventListener('click', () => this.editor.resetLayer());
        document.getElementById('reset-map-btn').addEventListener('click', () => this.editor.resetMap());
        document.getElementById('playtest-button').addEventListener('click', () => {
            if (this.editor.levelData['spawns'].size === 0) {
                alert('Cannot play level: No spawn point has been placed.');
                return;
            }
            const levelObject = this.editor.getLevelDataObject();
            localStorage.setItem('gonk_level_to_play', JSON.stringify(levelObject));
            window.open('../index.html', 'GonkPlayWindow');
        });

        this.gridWidthInput.addEventListener('change', () => { this.editor.gridWidth = parseInt(this.gridWidthInput.value) || 64; this.editor.modifyState(()=>{});});
        this.gridHeightInput.addEventListener('change', () => { this.editor.gridHeight = parseInt(this.gridHeightInput.value) || 64; this.editor.modifyState(()=>{});});

        for(const [layer, select] of Object.entries(this.defaultTextureSelects)) {
            const sizeSelect = document.getElementById(`default-${layer}-size`);
            const updateDefaultTexture = () => {
                this.editor.defaultTextures.ceiling = this.editor.defaultTextures.ceiling || {};
                 if(layer === 'ceilingHeight') { this.editor.defaultTextures.ceiling.heightMultiplier = parseInt(select.value) || 1; } 
                 else { this.editor.defaultTextures[layer] = this.editor.defaultTextures[layer] || {}; this.editor.defaultTextures[layer].key = select.value; }
                if(sizeSelect) this.editor.defaultTextures[layer].size = parseInt(sizeSelect.value) || 1;
                this.editor.modifyState(()=>{}); this.editor.render();
            };
            select.addEventListener('change', updateDefaultTexture);
            if (sizeSelect) sizeSelect.addEventListener('change', updateDefaultTexture);
        }

        Object.entries(this.toolButtons).forEach(([toolName, button]) => {
             if (button) {
                button.addEventListener('click', () => this.setActiveTool(toolName));
            }
        });

        this.propertiesPanel.addEventListener('click', e => e.stopPropagation());

        this.populateDefaultTextureSettings(); 
        this.setActiveLayer(this.editor.activeLayerName);
    }

    updateSaveCharacterButtonState(isDirty) {
        const button = document.getElementById('save-characters-btn');
        if (!button) return;
        if (isDirty) {
            button.classList.add('dirty');
            button.textContent = '* Save characters.json *';
        } else {
            button.classList.remove('dirty');
            button.textContent = 'Save characters.json';
        }
    }

    createNpcPalette() {
        const npcPaletteContainer = document.getElementById('npc-palette-container');
        npcPaletteContainer.innerHTML = '';

        const macroCategories = {
            'Takers': { icon: '/data/pngs/icons for UI/factions/takersicon.png', layer: 'npcs' },
            'Imperials': { icon: '/data/pngs/icons for UI/stormiesicon.png', layer: 'npcs' },
            'Sith': { icon: '/data/pngs/icons for UI/factions/darthsicon.png', layer: 'npcs' },
            'Clones': { icon: '/data/pngs/factions/clones/i1/clone_1.png', layer: 'npcs' },
            'spawns': { icon: '/data/pngs/spawn/hologonk_1.png', layer: 'spawns' },
            'Droids': { icon: '/data/pngs/icons for UI/droidicon.png', layer: 'npcs' },
            'Mandalorians': { icon: '/data/pngs/factions/mandalorians/i1/mando_1.png', layer: 'npcs' },
            'Aliens': { icon: '/data/pngs/icons for UI/aliensicon.png', layer: 'npcs' },
            'Rebels': { icon: '/data/pngs/icons for UI/humanicon.png', layer: 'npcs' }
        };

        const npcGridOrder = [
            'Takers', 'Clones', 'Mandalorians',
            'Imperials', 'spawns', 'Aliens',
            'Sith', 'Droids', 'Rebels'
        ];

        npcGridOrder.forEach(catName => {
            const info = macroCategories[catName];
            const btn = this.createButton(info.layer, catName, info.icon);
            btn.dataset.macroCategory = catName;
            btn.addEventListener('click', () => this.setActiveLayer(info.layer, catName));
            npcPaletteContainer.appendChild(btn);
        });
    }

    createLayerSelector() {
        this.layerSelector.innerHTML = '';
        const layerGroups = {
            'Ground': ['subfloor', 'floor', 'water'], 'Scenery': ['floater', 'decor', 'dangler', 'pillar'],
            'Structure': ['wall', 'door', 'dock', 'screen', 'panel'], 'Entities': ['assets'],
            'Sky & Ceiling': ['ceiling', 'sky', 'skybox'], 'Heightmap': ['elevation']
        };

        for(const groupName in layerGroups){
            const groupDiv = document.createElement('div');
            groupDiv.className = 'layer-group';
            this.layerSelector.appendChild(groupDiv);

            layerGroups[groupName].forEach(layerName => {
                const btn = this.createButton(layerName, layerName, null);
                btn.addEventListener('click', () => this.setActiveLayer(layerName));
                groupDiv.appendChild(btn);
            });
        }
    }

    createButton(layerName, label, overrideIcon) {
        const button = document.createElement('button');
        button.dataset.layer = layerName;
        button.title = label.charAt(0).toUpperCase() + label.slice(1);
        let iconSrc = overrideIcon;
        if (!iconSrc) {
            const iconMap = {
                'assets': '/data/pngs/icons for UI/crate.png', 'spawns': '/data/pngs/spawn/hologonk_1.png',
                'wall': '/data/pngs/icons for UI/wallsicon.png', 'door': '/data/pngs/icons for UI/dooricon.png',
                'dock': '/data/pngs/icons for UI/dockicon.png', 'panel': '/data/pngs/icons for UI/panelicon.png',
                'screen': '/data/pngs/icons for UI/screenicon.png', 'elevation': '/data/pngs/icons for UI/elevationicon.png',
                'skybox': '/data/pngs/icons for UI/skyboxicon.png', 'ceiling': '/data/pngs/icons for UI/ceilingicon.png',
                'pillar': '/data/pngs/icons for UI/pillaricon.png'
            };
            iconSrc = iconMap[layerName] || (this.assetManager.layerTextures[layerName]?.[0]);
        }
        if (iconSrc) {
            const img = document.createElement('img'); img.src = iconSrc; button.appendChild(img);
        }
        const labelSpan = document.createElement('span'); labelSpan.className = 'layer-label';
        labelSpan.textContent = label.charAt(0).toUpperCase() + label.slice(1); button.appendChild(labelSpan);
        if(!this.layerButtons[layerName]) this.layerButtons[layerName] = [];
        this.layerButtons[layerName].push(button);
        return button;
    }

    setActiveLayer(layerName, subGroup = null) {
        document.querySelector('.tab-button[data-tab="editor"]').click();
        if (this.editor.placementPreview) {
             this.editor.placementPreview = null;
             this.editor.statusMsg.textContent = 'Overlay placement cancelled.';
        }
        this.editor.activeBrush = null;
        this.editor.isTemplateCloned = false; // Reset template tool on layer change
        this.elevationDisplay.style.display = layerName === 'elevation' ? 'block' : 'none';
        this.ceilingDisplay.style.display = layerName === 'ceiling' ? 'block' : 'none';
        if (this.pillarDisplay) this.pillarDisplay.style.display = layerName === 'pillar' ? 'block' : 'none';
        this.editor.activeLayerName = layerName;
        document.querySelectorAll('#layer-selector button').forEach(btn => btn.classList.remove('active'));
        const buttons = this.layerButtons[layerName];
        if (buttons) {
            let targetButton = buttons.find(b => b.dataset.macroCategory === subGroup) || buttons[0];
            if (targetButton) targetButton.classList.add('active');
        }
        this.setActiveTool(layerName === 'spawns' ? 'spawn' : 'paint');
        this.updatePalette(subGroup);
    }

    setActiveTool(toolName) {
        this.editor.activeTool = toolName;
        this.editor.isTemplateCloned = false; // Reset template tool on any tool change
        Object.values(this.toolButtons).forEach(btn => { if(btn) btn.classList.remove('active'); });
        if (this.toolButtons[toolName]) this.toolButtons[toolName].classList.add('active');
        const cursors = { paint: 'default', erase: 'not-allowed', rotate: 'grab', spawn: 'pointer', fill: 'copy', template: 'copy' };
        this.editor.canvas.style.cursor = cursors[toolName] || 'default';
        this.updatePalette(document.querySelector('#layer-selector button.active')?.dataset.macroCategory);
    }

    updateUIForNewLevel() {
        this.levelNumberInput.value = this.editor.currentLevel;
        this.levelDisplay.textContent = `Level: ${this.editor.currentLevel}`;
    }

    updateElevationLevel(newLevel) {
        this.elevationLevel = Math.max(1, Math.min(30, newLevel));
        const paletteInput = document.getElementById('elevation-level-input');
        if (paletteInput) paletteInput.value = this.elevationLevel;
        if (this.elevationDisplay) this.elevationDisplay.textContent = this.elevationLevel;
        const wallSelect = document.getElementById('elevation-wall-select');
        if (wallSelect) {
            this.editor.activeBrush = { 
                type: 'elevation', key: `/data/pngs/elevation/${this.elevationLevel}.png`,
                properties: { elevation: this.elevationLevel, wallsideTexture: wallSelect.value }
            };
            this.editor.render();
        }
    }

    updateCeilingHeight(newHeight) {
        this.ceilingHeight = Math.max(1, Math.min(10, newHeight));
        const paletteInput = document.getElementById('ceiling-height-input');
        if (paletteInput) paletteInput.value = this.ceilingHeight;
        if (this.ceilingDisplay) this.ceilingDisplay.textContent = `${this.ceilingHeight}x Height`;
        const activeItem = document.querySelector('#ceiling-base-palette .palette-item.active');
        const wallsideSelect = document.getElementById('ceiling-wallside-select');
        if (activeItem && wallsideSelect) {
             this.editor.activeBrush = { 
                type: 'ceiling', key: activeItem.dataset.key,
                properties: { heightMultiplier: this.ceilingHeight, wallsideTexture: wallsideSelect.value }
            };
            this.editor.render();
        }
    }

    updatePillarHeight(newHeight) {
        this.pillarHeight = Math.max(1, Math.min(30, newHeight));
        const paletteInput = document.getElementById('pillar-height-input');
        if (paletteInput) paletteInput.value = this.pillarHeight;
        if (this.pillarDisplay) this.pillarDisplay.textContent = `Height: ${this.pillarHeight}`;

        const activeItem = document.querySelector('#pillar-base-palette .palette-item.active');
        if (activeItem) {
            const width = parseInt(document.getElementById('pillar-width-slider').value, 10);
            const placement = document.getElementById('pillar-placement-select').value;
            this.editor.setPillarPlacementMode(placement);
            this.editor.activeBrush = {
                type: 'pillar',
                key: activeItem.dataset.key,
                properties: {
                    width: width,
                    height: this.pillarHeight
                }
            };
            this.editor.render();
        }
    }

    updatePalette(subGroup = null) {
        const activeTool = this.editor.activeTool;
        this.templateBuilderContainer.style.display = 'none'; // Obsolete, always hide
        const showPalette = ['paint', 'fill', 'template'].includes(activeTool);
        document.querySelector('.content-group h4').style.display = showPalette ? 'block' : 'none';
        this.paletteContainer.style.display = 'block';
        document.getElementById('palette-controls').style.display = ['paint', 'fill'].includes(activeTool) ? 'flex' : 'none';

        if (activeTool === 'template') {
            document.querySelector('.content-group h4').textContent = 'Clone/Stamp Tool';
            this.paletteContainer.innerHTML = `<p style="padding: 10px; text-align: center;">Click on a map tile to clone its contents. Right-click to clear selection.</p>`;
            return;
        }
        document.querySelector('.content-group h4').textContent = 'Asset Palette';

        ['#elevation-extras', '#ceiling-extras', '#wall-extras', '#npc-extras'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
        if (!showPalette) { this.paletteContainer.innerHTML = ''; this.editor.activeBrush = null; return; }

        if (this.editor.activeLayerName === 'npcs') this.populateNpcPalette(subGroup);
        else if (this.editor.activeLayerName === 'assets') this.populateAssetPalette();
        else if (this.editor.activeLayerName === 'pillar') this.populatePillarPalette();
        else if (this.editor.activeLayerName === 'elevation') this.populateElevationPalette();
        else if (this.editor.activeLayerName === 'ceiling') this.populateCeilingPalette();
        else if (this.editor.lineLayers.includes(this.editor.activeLayerName)) this.populateStackedWallPalette(this.editor.activeLayerName);
        else if (this.editor.activeLayerName === 'skybox') this.populateSkyboxPalette();
        else this.populateTexturePalette();

        if (this.editor.activeBrush) {
            const currentItem = document.querySelector(`.palette-item[data-key="${this.editor.activeBrush.key}"]`);
            if (currentItem) currentItem.classList.add('active');
        } else {
            const firstItem = document.querySelector('.palette-item');
            if (firstItem) firstItem.click(); else this.editor.activeBrush = null;
        }
        if(subGroup) { const header = document.querySelector(`.palette-header[data-group-key="${subGroup}"]`); if(header) header.scrollIntoView({behavior: "smooth", block: "start"}); }
    }

    showPropertiesPanel(itemKey, itemData, layerName) {
        this.currentPropItem = { key: itemKey, data: itemData, layer: layerName };
        this.propContent.innerHTML = '';

        const npcConfig = this.assetManager.npcIcons.get(itemData.key)?.config || {};
        // Handle random NPC placeholders
        if (itemData.type === 'random_npc') {
            document.getElementById('prop-title').textContent = `Random NPC Properties`;
            this.propContent.innerHTML = `<p>This is a placeholder for a random NPC with threat level ${itemData.properties.threat} from the '${itemData.properties.macroCategory}' category. Subgroup: ${itemData.properties.subgroup || 'Any'}. The specific NPC will be chosen when the level is loaded in-game.</p>`;
            return;
        }
        const npcName = itemData.properties?.name || itemData.key.replace('.png', '');
        const title = `${npcName.replace(/_/g, ' ')} Properties`;

        let propHtml = '';

        if (layerName === 'npcs') {
            const iconInfo = this.assetManager.npcIcons.get(itemData.key);
            const portraitSrc = iconInfo ? iconInfo.icon : '';

            document.getElementById('prop-title').innerHTML = `
                <!-- NPC Portrait and Title -->
                <img src="${portraitSrc}" style="width: 48px; height: 48px; vertical-align: middle; margin-right: 10px; image-rendering: pixelated; border: 1px solid #666;">
                ${title}
            `;

            const props = itemData.properties || {};
            
            // Default name generation fix
            // FIX: Prioritize macroCategory, as baseType can sometimes be the same string (e.g. "clone")
            // and overwrite the intended category. This is the root cause of the editor naming bug.
            const nameCategory = (npcConfig.baseType || npcConfig.macroCategory || 'other').toLowerCase();
            const defaultName = props.name || `${nameCategory}F ${nameCategory}L`;

            // Generate inputs for all properties, starting with common ones.
            const allProps = {
                name: defaultName,
                weapon: props.weapon || npcConfig.default_weapon || '',
                health: props.health || npcConfig.health,
                ...npcConfig, // Add all other config properties
                ...props      // Overwrite with any instance-specific properties
            };

            // Hide the weapon group for now, it will be populated below
            document.getElementById('npc-weapon-group').style.display = 'grid';

            // Populate default weapon display
            const defaultWeaponDisplay = document.getElementById('npc-default-weapon-display'); // This element does not exist in the provided HTML. Assuming it's a typo and should be handled gracefully.
            const defaultWeaponPath = npcConfig.default_weapon || '';
            if (defaultWeaponPath) {
                const defaultWeaponName = defaultWeaponPath.split('/').pop().replace('.png', '').replace(/_/g, ' ');
                defaultWeaponDisplay.textContent = defaultWeaponName.charAt(0).toUpperCase() + defaultWeaponName.slice(1);
            } else {
                defaultWeaponDisplay.textContent = 'None';
            }

            // Populate override weapon dropdown
            const overrideWeaponSelect = document.getElementById('prop-weapon-override');
            overrideWeaponSelect.innerHTML = '<option value="none">None (Use Default)</option>'; // Option to use default

            // Add all NPC weapons to the dropdown
            this.assetManager.weaponPaths.forEach(path => {
                const weaponName = path.split('/').pop().replace('.png', '').replace(/_/g, ' ');
                const option = document.createElement('option');
                option.value = path;
                option.textContent = weaponName.charAt(0).toUpperCase() + weaponName.slice(1);
                overrideWeaponSelect.appendChild(option);
            });

            // Set current selection
            const currentWeapon = itemData.properties?.weapon;
            if (currentWeapon) {
                // Check if the current weapon is one of the available paths
                const foundOption = Array.from(overrideWeaponSelect.options).find(opt => opt.value === currentWeapon);
                if (foundOption) {
                    overrideWeaponSelect.value = currentWeapon;
                } else {
                    // If the weapon is set but not in the list (e.g., a custom weapon or old path),
                    // try to match by filename. If still not found, default to 'none'.
                    const currentWeaponFilename = currentWeapon.split('/').pop();
                    const foundOptionByFilename = Array.from(overrideWeaponSelect.options).find(opt => opt.value.endsWith(currentWeaponFilename));
                    if (foundOptionByFilename) {
                        overrideWeaponSelect.value = foundOptionByFilename.value;
                    } else {
                        overrideWeaponSelect.value = 'none';
                    }
                }
            } else {
                overrideWeaponSelect.value = 'none'; // If no specific weapon is set, default to 'None (Use Default)'
            }

            // Filter out properties we don't want to show in the editor, including the 'weapon' property now handled by the dedicated fields.
            const hiddenProps = ['file', 'armType', 'soundSet', 'baseType', 'faction', 'macroCategory', 'minecraftModel', 'permanent_ally', 'special_moves', 'speed_multiplier', 'y_offset', 'model', 'default_weapon', 'weapon'];
            const combatProps = ['threat', 'melee_damage', 'attack_cooldown', 'attack_range', 'accuracy', 'aggro'];
            const movementProps = ['speed', 'jump_strength', 'flyspeed'];
            const capacityProps = ['weight_lift', 'force_sensitivity', 'technical_understanding'];

            // Generate inputs for all other properties
            for (const propKey in allProps) {
                if (hiddenProps.includes(propKey)) continue; // Skip hidden and the now-handled 'weapon' property

                const value = allProps[propKey];
                let propClass = 'physical'; // Default
                if (combatProps.includes(propKey)) propClass = 'combat';
                else if (movementProps.includes(propKey)) propClass = 'movement';
                else if (capacityProps.includes(propKey)) propClass = 'capacity';

                propHtml += `<div class="prop-group ${propClass}" data-prop-key="${propKey}">`;
                propHtml += `<label for="prop-${propKey}">${propKey.replace(/_/g, ' ')}:</label>`;

                if (typeof value === 'number') {
                    propHtml += `<input type="number" id="prop-${propKey}" value="${value}" step="0.01">`;
                } else if (propKey === 'name') {
                    propHtml += `<input type="text" id="prop-name" value="${value || ''}">`;
                } else {
                    propHtml += `<input type="text" id="prop-${propKey}" value="${value || ''}">`;
                }
                propHtml += `</div>`;
            }
            this.propContent.innerHTML = propHtml; // Set the propHtml after generating all other properties
        } else if (layerName === 'dock') {
            document.getElementById('prop-title').textContent = title;
            propHtml = `<div class="prop-group"><label for="dock-target">Target:</label><input type="text" id="dock-target" value="${itemData.properties?.target || ''}" placeholder="e.g., TO LEVEL 02A"></div>`;
        } else if (layerName === 'spawns') {
            document.getElementById('prop-title').textContent = title;
            propHtml = `<div class="prop-group"><label for="spawn-id">ID:</label><input type="text" id="spawn-id" value="${itemData.id || ''}" placeholder="e.g., FROM LEVEL 01"></div><div class="prop-group"><label for="spawn-rotation">Facing:</label><select id="spawn-rotation"><option value="0" ${itemData.rotation === 0 ? 'selected' : ''}>Up</option><option value="1" ${itemData.rotation === 1 ? 'selected' : ''}>Right</option><option value="2" ${itemData.rotation === 2 ? 'selected' : ''}>Down</option><option value="3" ${itemData.rotation === 3 ? 'selected' : ''}>Left</option></select></div>`;
        } else if (layerName === 'pillar') {
            document.getElementById('prop-title').textContent = title;
            propHtml = `<div class="prop-group"><label for="pillar-width">Width:</label><input type="number" id="pillar-width" value="${itemData.properties?.width || 11}" min="1" max="100" step="1"></div><div class="prop-group"><label for="pillar-height">Height:</label><input type="number" id="pillar-height" value="${itemData.properties?.height || 3}" min="1" max="10" step="1"></div><div class="prop-group"><label for="pillar-placement">Placement:</label><select id="pillar-placement"><option value="center" ${!itemData.properties?.placement || itemData.properties?.placement === 'center' ? 'selected' : ''}>Center</option><option value="topLeft" ${itemData.properties?.placement === 'topLeft' ? 'selected' : ''}>Top-Left</option><option value="topRight" ${itemData.properties?.placement === 'topRight' ? 'selected' : ''}>Top-Right</option><option value="bottomLeft" ${itemData.properties?.placement === 'bottomLeft' ? 'selected' : ''}>Bottom-Left</option><option value="bottomRight" ${itemData.properties?.placement === 'bottomRight' ? 'selected' : ''}>Bottom-Right</option></select></div>`;
        }
        // If not an NPC, hide the weapon group
        if (layerName !== 'npcs') document.getElementById('npc-weapon-group').style.display = 'none';

        // Handle dock properties
        if (layerName === 'dock') {
            document.getElementById('prop-title').textContent = 'Dock Properties';
            const targetValue = itemData.properties?.target || '';
            propHtml = `
                <div class="prop-group">
                    <label for="dock-target">Target Level:</label>
                    <input type="text" id="dock-target" value="${targetValue}" placeholder="e.g., TO LEVEL 02A">
                </div>
            `;
            this.propContent.innerHTML = propHtml;
        }

        // Handle spawn point properties
        if (layerName === 'spawns') {
            document.getElementById('prop-title').textContent = 'Spawn Point Properties';
            const spawnId = itemData.id || '';
            const spawnRotation = itemData.rotation || 0;
            propHtml = `
                <div class="prop-group">
                    <label for="spawn-id">Spawn ID:</label>
                    <input type="text" id="spawn-id" value="${spawnId}" placeholder="e.g., FROM LEVEL 01">
                </div>
                <div class="prop-group">
                    <label for="spawn-rotation">Rotation (0-3):</label>
                    <input type="number" id="spawn-rotation" value="${spawnRotation}" min="0" max="3" step="1">
                </div>
                <div class="prop-group" style="grid-column: 1 / -1;">
                    <p style="font-size: 0.9em; color: #aaa;">Rotation: 0=Down, 1=Left, 2=Up, 3=Right</p>
                </div>
            `;
            this.propContent.innerHTML = propHtml;
        }

        const buttons = this.propertiesPanel.querySelector('.prop-buttons');
        buttons.innerHTML = `
            <button id="save-prop-btn">Save</button>
            ${layerName === 'npcs' || layerName === 'dock' || layerName === 'spawns' ? '' : '<button id="delete-prop-btn" style="background-color: #dc3545;">Delete</button>'}
            <button id="delete-prop-btn" style="background-color: #dc3545;">Delete</button>
            <button id="cancel-prop-btn" style="background-color: #6c757d;">Cancel</button>
        `;
        buttons.querySelector('#save-prop-btn').addEventListener('click', e => { e.stopPropagation(); this.saveProperties(); });
        buttons.querySelector('#delete-prop-btn').addEventListener('click', e => { e.stopPropagation(); this.editor.eraseItem(this.currentPropItem); this.hidePropertiesPanel(); });
        buttons.querySelector('#cancel-prop-btn').addEventListener('click', e => { e.stopPropagation(); this.hidePropertiesPanel(); });

        this.propertiesPanel.style.display = 'block';
    } // End showPropertiesPanel

    saveProperties() {
        if (!this.currentPropItem) return;
        const { key, data, layer } = this.currentPropItem;
        const itemToModify = this.editor.levelData[layer].get(key);
        if (!itemToModify) { this.hidePropertiesPanel(); return; }
        itemToModify.properties = itemToModify.properties || {};

        this.editor.modifyState(() => {
            if (layer === 'npcs') {
                const propGroups = this.propContent.querySelectorAll('.prop-group');
                propGroups.forEach(group => {
                    const propKey = group.dataset.propKey;
                    const input = group.querySelector('input, select');
                    if (input) {
                        const value = (input.type === 'number') ? parseFloat(input.value) : input.value;
                        // Only save the property if it's not empty or is a number
                        if (value || typeof value === 'number') {
                            itemToModify.properties[propKey] = value;
                        }
                    }
                });

                // Handle the new weapon override dropdown
                const overrideWeaponSelect = document.getElementById('prop-weapon-override');
                if (overrideWeaponSelect) {
                    const selectedWeapon = overrideWeaponSelect.value;
                    if (selectedWeapon === 'none') {
                        delete itemToModify.properties.weapon; // Remove the property to use the default
                    } else {
                        itemToModify.properties.weapon = selectedWeapon;
                    }
                }
            } else if (layer === 'dock') { itemToModify.properties.target = document.getElementById('dock-target').value; } 
            else if (layer === 'spawns') { itemToModify.id = document.getElementById('spawn-id').value; itemToModify.rotation = parseInt(document.getElementById('spawn-rotation').value, 10); }
            else if (layer === 'pillar') { 
                itemToModify.properties.width = parseInt(document.getElementById('pillar-width').value, 10);
                itemToModify.properties.height = parseInt(document.getElementById('pillar-height').value, 10);
                itemToModify.properties.placement = document.getElementById('pillar-placement').value;
            }
        });
        this.hidePropertiesPanel();
    }

    hidePropertiesPanel() {
        this.propertiesPanel.style.display = 'none';
        this.currentPropItem = null;
        // Hide the weapon group when the panel is hidden
        const npcWeaponGroup = document.getElementById('npc-weapon-group');
        if (npcWeaponGroup) {
            npcWeaponGroup.style.display = 'none';
        }
    }

    populateTexturePalette() {
        this.paletteContainer.style.display = 'grid';
        const textures = this.assetManager.layerTextures[this.editor.activeLayerName] || [];
        const groups = {};
        textures.forEach(path => { if(!path) return; const dir = path.split('/')[path.split('/').length - 2]; if (!groups[dir]) groups[dir] = []; groups[dir].push(path); });
        this.paletteContainer.innerHTML = '';
        for (const dir in groups) {
            const header = document.createElement('div'); header.className = 'palette-header'; header.textContent = dir.charAt(0).toUpperCase() + dir.slice(1); this.paletteContainer.appendChild(header);
            for (const path of groups[dir]) {
                const item = document.createElement('div'); item.className = 'palette-item'; item.dataset.key = path;
                const img = new Image(); img.src = path; item.appendChild(img);
                const label = document.createElement('span'); label.textContent = path.split('/').pop().replace('.png', '').replace(/_/g, ' '); item.appendChild(label);
                item.addEventListener('click', () => { this.paletteContainer.querySelectorAll('.palette-item').forEach(p => p.classList.remove('active')); item.classList.add('active'); this.editor.activeBrush = { type: 'texture', key: path }; this.editor.render(); });
                this.paletteContainer.appendChild(item);
            }
        }
    }

    populateAssetPalette() { 
        this.paletteContainer.style.display = 'grid';
        const items = Array.from(this.assetManager.assetIcons.entries());
        this.paletteContainer.innerHTML = !items || items.length === 0 ? `<p>No assets found</p>` : '';
        items.forEach(([name, iconUrl]) => { 
            const item = document.createElement('div'); item.className = 'palette-item'; item.dataset.key = name;
            const img = new Image(); img.src = iconUrl; window[name + '_icon_img'] = img; item.appendChild(img); 
            const label = document.createElement('span'); label.textContent = name; item.appendChild(label); 
            item.addEventListener('click', () => { this.paletteContainer.querySelectorAll('.palette-item').forEach(p => p.classList.remove('active')); item.classList.add('active'); this.editor.activeBrush = { type: 'asset', key: name }; this.editor.render(); }); 
            this.paletteContainer.appendChild(item); 
        }); 
    }

    populateNpcPalette(macroCategory) {
        this.paletteContainer.innerHTML = '';
        this.paletteContainer.style.display = 'grid';
        if (!macroCategory) return;

        const factionColors = {
            Aliens: '#008000', Takers: '#C0C0C0', Droids: '#0066cc', Rebels: '#b05c00',
            Mandalorians: '#FFC72C', Sith: '#990000', Imperials: '#444444', Clones: '#ff8c00'
        };
        const factionColor = factionColors[macroCategory] || '#555';

        const controlsContainer = document.createElement('div');
        controlsContainer.id = 'npc-extras';
        controlsContainer.style.gridColumn = '1 / -1';
        controlsContainer.innerHTML = `
            <div class="horizontal-group" style="padding: 5px 0; justify-content: space-around;">
                <label for="npc-alpha-select" style="width: auto;">Texture Cutout:</label>
                <select id="npc-alpha-select"><option value="false">No</option><option value="true">Yes</option></select>
            </div>
            <div class="horizontal-group" style="padding: 5px 0; justify-content: space-around;">
                <label for="npc-opacity-slider" style="width: auto;">Ghost Opacity: <span id="npc-opacity-val">100</span>%</label>
                <input type="range" id="npc-opacity-slider" min="10" max="100" value="100" step="5">
            </div>`;
        this.paletteContainer.appendChild(controlsContainer);
        controlsContainer.style.display = 'block';

        const opacitySlider = document.getElementById('npc-opacity-slider');
        if (opacitySlider) {
            opacitySlider.addEventListener('input', (e) => {
                document.getElementById('npc-opacity-val').textContent = e.target.value;
            });
        }

        for (const groupKey in this.assetManager.npcGroups) {
            const groupData = this.assetManager.npcGroups[groupKey];
            if (groupData.macroCategory !== macroCategory) continue;

            const subGroupHeader = document.createElement('div');
            subGroupHeader.className = 'palette-header';
            subGroupHeader.textContent = groupData.name;
            this.paletteContainer.appendChild(subGroupHeader);

            const subGroupRandomContainer = document.createElement('div');
            subGroupRandomContainer.className = 'random-npc-container';
            this.paletteContainer.appendChild(subGroupRandomContainer);

            for (let i = 1; i <= 5; i++) {
                const r_item = document.createElement('div');
                r_item.className = 'palette-item random-npc-item';
                r_item.style.backgroundColor = factionColor;
                r_item.dataset.key = `R${i}_${groupKey}`;
                const r_label = document.createElement('span');
                r_label.textContent = `R${i}`;
                r_item.appendChild(r_label);

                r_item.addEventListener('click', () => {
                    this.paletteContainer.querySelectorAll('.palette-item').forEach(p => p.classList.remove('active'));
                    r_item.classList.add('active');
                    const brushProps = {
                        type: 'random_npc',
                        key: `R${i}_${groupKey}`,
                        properties: {
                            threat: i,
                            macroCategory: macroCategory,
                            subgroup: groupKey
                        }
                    };
                    this.editor.activeBrush = brushProps;
                    this.editor.render();
                });
                subGroupRandomContainer.appendChild(r_item);
            }

            groupData.textures.forEach(textureEntry => {
                const textureFile = typeof textureEntry === 'string' ? textureEntry : textureEntry.file;
                const skinName = textureFile.replace('.png', '');
                const iconInfo = this.assetManager.npcIcons.get(skinName);
                if (!iconInfo) return;

                const item = document.createElement('div');
                item.className = 'palette-item';
                item.dataset.key = skinName;
                const img = window[skinName + '_icon_img']?.cloneNode() || new Image();
                if (!img.src) img.src = iconInfo.icon;
                item.appendChild(img);
                const label = document.createElement('span');
                label.textContent = skinName.replace(/_/g, ' ');
                item.appendChild(label);
                item.addEventListener('click', () => {
                    this.paletteContainer.querySelectorAll('.palette-item').forEach(p => p.classList.remove('active'));
                    item.classList.add('active');
                    this.editor.activeBrush = { type: 'npc', key: skinName, properties: { baseType: iconInfo.config.baseType } };
                    this.editor.render();
                });
                this.paletteContainer.appendChild(item);
            });
        }
    }

    populateDefaultPalette(layerName, textures) {
        const container = document.getElementById(`default-${layerName}-palette`);
        if (!container) return;

        container.innerHTML = ''; // Clear previous items

        const createItem = (key, isNone = false) => {
            const item = document.createElement('div');
            item.className = 'palette-item';
            if(key) item.dataset.key = key;

            if (isNone) {
                item.innerHTML = '<span>None</span>';
            } else {
                const img = new Image();
                img.src = key;
                item.appendChild(img);
            }
            
            item.addEventListener('click', () => {
                // Remove active class from all items in this palette
                container.querySelectorAll('.palette-item').forEach(p => p.classList.remove('active'));
                item.classList.add('active');

                // Update the editor's default texture object
                this.editor.defaultTextures[layerName] = this.editor.defaultTextures[layerName] || {};
                this.editor.defaultTextures[layerName].key = isNone ? null : key;
                
                // Trigger a state change and re-render
                this.editor.modifyState(()=>{});
                this.editor.render();
            });
            return item;
        };

        // Add a "None" option
        container.appendChild(createItem(null, true));

        // Add items for each texture
        textures.forEach(path => {
            if(path) container.appendChild(createItem(path));
        });

        // Set the initial active item
        const currentDefault = this.editor.defaultTextures[layerName]?.key;
        const activeItem = currentDefault ? container.querySelector(`[data-key="${currentDefault}"]`) : container.firstChild;
        if (activeItem) {
            activeItem.classList.add('active');
        }
    }

    populateDefaultTextureSettings() {
        // Keep dropdowns for layers that still use them
        const dropdownLayers = [];
        for(const layer of dropdownLayers) {
            const select = this.defaultTextureSelects[layer];
            if (!select) continue;
            select.innerHTML = ''; 
            select.add(new Option('None', '')); 
            (this.assetManager.layerTextures[layer] || []).forEach(p => { 
                if(p) select.add(new Option(p.split('/').pop(), p)); 
            }); 
            if (this.editor.defaultTextures[layer]) {
                select.value = this.editor.defaultTextures[layer].key; 
            }
        }

        // Use new palette UI for other defaults
        this.populateDefaultPalette('subfloor', this.assetManager.layerTextures['subfloor'] || []);
        this.populateDefaultPalette('floor', this.assetManager.layerTextures['floor'] || []);
        this.populateDefaultPalette('ceiling', this.assetManager.layerTextures['ceiling'] || []);
        this.populateDefaultPalette('water', this.assetManager.layerTextures['water'] || []);
        this.populateDefaultPalette('floater', this.assetManager.layerTextures['floater'] || []);
        this.populateDefaultPalette('sky', this.assetManager.layerTextures['sky'] || []);
        
        // Special handling for skybox which has static and animated types
        const skyboxTextures = [
            ...this.assetManager.skyboxStaticFiles,
            ...this.assetManager.skyboxAnimationFolders
        ];
        this.populateDefaultPalette('skybox', skyboxTextures);


        const ceilingWallSelect = document.getElementById('default-ceiling-wall-select');
        if (ceilingWallSelect) {
            (this.assetManager.layerTextures['ceilingsides'] || []).forEach(p => { if(p) ceilingWallSelect.add(new Option(p.split('/').pop(), p)); });
            const dv = this.editor.defaultTextures.ceiling?.wallside;
            if (dv) ceilingWallSelect.value = dv;
            ceilingWallSelect.addEventListener('change', (e) => {
                this.editor.defaultTextures.ceiling = this.editor.defaultTextures.ceiling || {};
                this.editor.defaultTextures.ceiling.wallside = e.target.value;
                this.editor.modifyState(() => {});
            });
        }

        // Populate music settings
        this.populateMusicSettings();
    }

    populateMusicSettings() {
        const musicTypeSelect = document.getElementById('music-type-select');
        const musicCategoryContainer = document.getElementById('music-category-container');
        const musicTrackContainer = document.getElementById('music-track-container');
        const musicCategorySelect = document.getElementById('music-category-select');
        const musicTrackSelect = document.getElementById('music-track-select');

        if (!musicTypeSelect || !musicCategorySelect || !musicTrackSelect) return;

        // Populate category dropdown
        musicCategorySelect.innerHTML = '';
        this.assetManager.musicCategories.forEach(cat => {
            musicCategorySelect.add(new Option(cat, cat));
        });

        // Populate track dropdown (all tracks from all categories)
        const populateTrackSelect = () => {
            musicTrackSelect.innerHTML = '';
            for (const category of this.assetManager.musicCategories) {
                const tracks = this.assetManager.musicLibrary[category] || [];
                tracks.forEach(trackPath => {
                    let trackName = decodeURIComponent(trackPath.split('/').pop());
                    trackName = trackName.replace(/\.mp3|\.ogg|\.wav/gi, '');
                    musicTrackSelect.add(new Option(`${category}/${trackName}`, trackPath));
                });
            }
        };
        populateTrackSelect();

        // Handle type switching
        const updateMusicContainers = () => {
            const type = musicTypeSelect.value;
            musicCategoryContainer.style.display = type === 'category' ? 'flex' : 'none';
            musicTrackContainer.style.display = type === 'track' ? 'flex' : 'none';
        };

        musicTypeSelect.addEventListener('change', () => {
            updateMusicContainers();
            this.updateMusicSetting();
        });

        musicCategorySelect.addEventListener('change', () => this.updateMusicSetting());
        musicTrackSelect.addEventListener('change', () => this.updateMusicSetting());

        // Initialize display
        updateMusicContainers();

        // Load existing music settings if present
        const musicSettings = this.editor.defaultTextures.music;
        if (musicSettings) {
            if (musicSettings.type === 'category') {
                musicTypeSelect.value = 'category';
                musicCategorySelect.value = musicSettings.value || '';
            } else if (musicSettings.type === 'track') {
                musicTypeSelect.value = 'track';
                musicTrackSelect.value = musicSettings.value || '';
            } else {
                musicTypeSelect.value = 'random';
            }
            updateMusicContainers();
        }
    }

    updateMusicSetting() {
        const musicTypeSelect = document.getElementById('music-type-select');
        const musicCategorySelect = document.getElementById('music-category-select');
        const musicTrackSelect = document.getElementById('music-track-select');

        const type = musicTypeSelect.value;

        if (type === 'random') {
            // Remove music setting (use default random behavior)
            delete this.editor.defaultTextures.music;
        } else if (type === 'category') {
            this.editor.defaultTextures.music = {
                type: 'category',
                value: musicCategorySelect.value
            };
        } else if (type === 'track') {
            this.editor.defaultTextures.music = {
                type: 'track',
                value: musicTrackSelect.value
            };
        }

        this.editor.modifyState(() => {});
    }

    updateSettingsUI() {
        this.gridWidthInput.value = this.editor.gridWidth; this.gridHeightInput.value = this.editor.gridHeight;
        for (const [layer, defaultInfo] of Object.entries(this.editor.defaultTextures)) {
            const select = this.defaultTextureSelects[layer]; const sizeSelect = document.getElementById(`default-${layer}-size`);
            if (select) select.value = defaultInfo.key || ''; if (sizeSelect) sizeSelect.value = defaultInfo.size || '1';
        }
        const cws = document.getElementById('default-ceiling-wall-select'); if (cws && this.editor.defaultTextures.ceiling) cws.value = this.editor.defaultTextures.ceiling.wallside || '';
        const chs = this.defaultTextureSelects['ceilingHeight']; if(chs && this.editor.defaultTextures.ceiling) chs.value = this.editor.defaultTextures.ceiling.heightMultiplier || '1';

        // Update music settings UI
        const musicTypeSelect = document.getElementById('music-type-select');
        const musicCategorySelect = document.getElementById('music-category-select');
        const musicTrackSelect = document.getElementById('music-track-select');
        const musicCategoryContainer = document.getElementById('music-category-container');
        const musicTrackContainer = document.getElementById('music-track-container');

        if (musicTypeSelect) {
            const musicSettings = this.editor.defaultTextures.music;
            if (musicSettings) {
                if (musicSettings.type === 'category') {
                    musicTypeSelect.value = 'category';
                    if (musicCategorySelect) musicCategorySelect.value = musicSettings.value || '';
                    if (musicCategoryContainer) musicCategoryContainer.style.display = 'flex';
                    if (musicTrackContainer) musicTrackContainer.style.display = 'none';
                } else if (musicSettings.type === 'track') {
                    musicTypeSelect.value = 'track';
                    if (musicTrackSelect) musicTrackSelect.value = musicSettings.value || '';
                    if (musicCategoryContainer) musicCategoryContainer.style.display = 'none';
                    if (musicTrackContainer) musicTrackContainer.style.display = 'flex';
                } else {
                    musicTypeSelect.value = 'random';
                    if (musicCategoryContainer) musicCategoryContainer.style.display = 'none';
                    if (musicTrackContainer) musicTrackContainer.style.display = 'none';
                }
            } else {
                musicTypeSelect.value = 'random';
                if (musicCategoryContainer) musicCategoryContainer.style.display = 'none';
                if (musicTrackContainer) musicTrackContainer.style.display = 'none';
            }
        }
    }

    populateElevationPalette() {
        this.paletteContainer.innerHTML = ''; this.paletteContainer.style.display = 'block';
        const controlsContainer = document.createElement('div'); controlsContainer.id = 'elevation-extras';
        controlsContainer.innerHTML = `<div class="content-group"><h4>Elevation Details</h4><div class="horizontal-group"><label for="elevation-level-input">Height:</label><input type="number" id="elevation-level-input" value="1" min="1" max="30" step="1"></div><div class="horizontal-group"><label for="elevation-wall-select">Wallside:</label><select id="elevation-wall-select"></select></div></div>`;
        this.paletteContainer.appendChild(controlsContainer);
        const wallSelect = document.getElementById('elevation-wall-select'); const levelInput = document.getElementById('elevation-level-input');
        levelInput.addEventListener('change', () => this.updateElevationLevel(parseInt(levelInput.value, 10)));
        wallSelect.addEventListener('change', () => this.updateElevationLevel(this.elevationLevel));
        this.populateSelect(wallSelect, this.assetManager.layerTextures['elevationsides'] || [], '/data/pngs/elevationsides/eside_default.png');
        this.updateElevationLevel(1);
    }

    populateCeilingPalette() {
        this.paletteContainer.innerHTML = ''; this.paletteContainer.style.display = 'block';
        const controlsContainer = document.createElement('div'); controlsContainer.id = 'ceiling-extras';
        controlsContainer.innerHTML = `<div class="content-group"><h4>Ceiling Details</h4>
            <div class="horizontal-group">
                <label for="ceiling-height-input">Height Multiplier:</label>
                <input type="number" id="ceiling-height-input" value="1" min="1" max="10" step="1">
            </div>
            <div class="horizontal-group">
                <label for="ceiling-wallside-select">Wallside:</label>
                <select id="ceiling-wallside-select"></select>
            </div>
            <div id="ceiling-base-palette" class="palette"></div>
        </div>`;
        this.paletteContainer.appendChild(controlsContainer);

        const heightInput = document.getElementById('ceiling-height-input');
        const wallsideSelect = document.getElementById('ceiling-wallside-select');
        const basePaletteContainer = document.getElementById('ceiling-base-palette');

        const updateBrush = () => this.updateCeilingHeight(parseInt(heightInput.value, 10));
        heightInput.addEventListener('change', updateBrush);
        wallsideSelect.addEventListener('change', updateBrush);

        this.populateSelect(wallsideSelect, this.assetManager.layerTextures['ceilingsides'] || [], '/data/pngs/ceilingsides/cside_default.png');

        const baseTextures = this.assetManager.layerTextures['ceiling'] || [];
        basePaletteContainer.innerHTML = '';
        baseTextures.forEach(path => {
            const item = document.createElement('div'); item.className = 'palette-item'; item.dataset.key = path;
            const img = new Image(); img.src = path; item.appendChild(img);
            const label = document.createElement('span'); label.textContent = path.split('/').pop().replace('.png', ''); item.appendChild(label);
            item.addEventListener('click', () => { 
                basePaletteContainer.querySelectorAll('.palette-item').forEach(p => p.classList.remove('active')); 
                item.classList.add('active'); 
                updateBrush(); 
            });
            basePaletteContainer.appendChild(item);
        });

        const firstItem = basePaletteContainer.querySelector('.palette-item');
        if (firstItem) {
            firstItem.classList.add('active');
            updateBrush();
        } else {
            this.editor.activeBrush = null;
        }
    }

    populateStackedWallPalette(layerName) {
        this.paletteContainer.innerHTML = ''; this.paletteContainer.style.display = 'block'; 
        const controlsContainer = document.createElement('div'); controlsContainer.id = 'wall-extras';
        controlsContainer.innerHTML = `<div class="content-group"><h4>Wall Details (3x Height)</h4><div class="horizontal-group"><label for="wall-level2-select" style="color:#f00;">Level 2:</label><select id="wall-level2-select"></select></div><div class="horizontal-group"><label for="wall-level3-select" style="color:#f00;">Level 3:</label><select id="wall-level3-select"></select></div></div><div class="content-group"><h4>Base Texture (Level 1)</h4><div id="wall-base-palette" class="palette"></div></div>`;
        this.paletteContainer.appendChild(controlsContainer);
        const level2Select = document.getElementById('wall-level2-select'); const level3Select = document.getElementById('wall-level3-select'); const basePaletteContainer = document.getElementById('wall-base-palette');
        const wall2Textures = this.assetManager.layerTextures['wall'].filter(p => p.includes('/wall2/')); const wall3Textures = this.assetManager.layerTextures['wall'].filter(p => p.includes('/wall3/'));

        this.populateSelect(level2Select, wall2Textures, '/data/pngs/wall/wall2/w2_default.png', true); 
        this.populateSelect(level3Select, wall3Textures, '/data/pngs/wall/wall3/wall3_default.png', true);

        const baseTextures = this.assetManager.layerTextures[layerName].filter(p => !p.includes('/wall2/') && !p.includes('/wall3/'));
        basePaletteContainer.innerHTML = '';
        baseTextures.forEach(path => {
            const item = document.createElement('div'); item.className = 'palette-item'; item.dataset.key = path;
            const img = new Image(); img.src = path; item.appendChild(img);
            const label = document.createElement('span'); label.textContent = path.split('/').pop().replace('.png', ''); item.appendChild(label);
            item.addEventListener('click', () => { basePaletteContainer.querySelectorAll('.palette-item').forEach(p => p.classList.remove('active')); item.classList.add('active'); updateBrush(); });
            basePaletteContainer.appendChild(item);
        });
        const updateBrush = () => {
            const activeBaseItem = basePaletteContainer.querySelector('.palette-item.active'); if (!activeBaseItem) return;
            this.editor.activeBrush = { type: 'texture', key: activeBaseItem.dataset.key, properties: { level2: level2Select.value !== 'none' ? level2Select.value : undefined, level3: level3Select.value !== 'none' ? level3Select.value : undefined } };
            this.editor.render();
        };
        level2Select.addEventListener('change', updateBrush); level3Select.addEventListener('change', updateBrush);
        const firstItem = basePaletteContainer.querySelector('.palette-item');
        if (firstItem) { firstItem.classList.add('active'); updateBrush(); } else { this.editor.activeBrush = null; }
    }

    populateSkyboxPalette() {
        this.paletteContainer.innerHTML = '';
        this.paletteContainer.style.display = 'block';

        const currentSkybox = this.editor.levelData.skybox.get('0,0');
        const currentType = currentSkybox ? (currentSkybox.properties?.type || (currentSkybox.key ? 'static' : 'none')) : 'none';
        const currentKey = currentSkybox ? currentSkybox.key : '';

        const controlsContainer = document.createElement('div');
        controlsContainer.id = 'skybox-extras';
        controlsContainer.innerHTML = `
            <div class="content-group">
                <h4>Skybox Selection</h4>
                <div class="horizontal-group" style="justify-content: space-around; padding: 10px 0; flex-wrap: wrap;">
                    <label><input type="radio" name="skybox-type" value="none" ${currentType === 'none' ? 'checked' : ''}> None</label>
                    <label><input type="radio" name="skybox-type" value="static" ${currentType === 'static' ? 'checked' : ''}> Static</label>
                    <label><input type="radio" name="skybox-type" value="random_static" ${currentType === 'random_static' ? 'checked' : ''}> Random Static</label>
                    <label><input type="radio" name="skybox-type" value="animation" ${currentType === 'animation' ? 'checked' : ''}> Animated</label>
                </div>
                <div id="skybox-static-container" class="horizontal-group" style="display: none;">
                    <label for="skybox-static-select">Image:</label>
                    <select id="skybox-static-select"></select>
                </div>
                <div id="skybox-random-container" class="horizontal-group" style="display: none;">
                    <label for="skybox-random-select">Folder:</label>
                    <select id="skybox-random-select"></select>
                </div>
                <div id="skybox-animated-container" class="horizontal-group" style="display: none;">
                    <label for="skybox-animated-select">Animation:</label>
                    <select id="skybox-animated-select"></select>
                </div>
            </div>`;
        this.paletteContainer.appendChild(controlsContainer);

        const staticContainer = document.getElementById('skybox-static-container');
        const randomContainer = document.getElementById('skybox-random-container');
        const animatedContainer = document.getElementById('skybox-animated-container');
        const staticSelect = document.getElementById('skybox-static-select');
        const randomSelect = document.getElementById('skybox-random-select');
        const animatedSelect = document.getElementById('skybox-animated-select');
        const radios = controlsContainer.querySelectorAll('input[name="skybox-type"]');

        this.populateSelect(staticSelect, this.assetManager.skyboxStaticFiles.map(f => f), '', true);
        this.populateSelect(randomSelect, this.assetManager.skyboxAnimationFolders, '', true);
        this.populateSelect(animatedSelect, this.assetManager.skyboxAnimationFolders, '', true);

        const updateSkybox = (type, key) => {
            this.editor.modifyState(() => {
                this.editor.levelData.skybox.clear();
                if (type === 'none') {
                    // Add an explicit 'none' entry. The game's createSkybox function
                    // will see the null key and correctly remove the skybox.
                    this.editor.levelData.skybox.set('0,0', { key: null, properties: { type: 'none' } });
                } else if (key) {
                    const skyboxData = { key: key, properties: { type: type } };
                    this.editor.levelData.skybox.set('0,0', skyboxData);
                }
            });
        };

        const onTypeChange = () => {
            const selectedType = controlsContainer.querySelector('input[name="skybox-type"]:checked').value;
            staticContainer.style.display = selectedType === 'static' ? 'flex' : 'none';
            randomContainer.style.display = selectedType === 'random_static' ? 'flex' : 'none';
            animatedContainer.style.display = selectedType === 'animation' ? 'flex' : 'none';
            let key = '';
            if (selectedType === 'static') key = staticSelect.value;
            else if (selectedType === 'random_static') key = randomSelect.value;
            else if (selectedType === 'animation') key = animatedSelect.value;
            updateSkybox(selectedType, key);
        };

        radios.forEach(radio => radio.addEventListener('change', onTypeChange));
        staticSelect.addEventListener('change', () => updateSkybox('static', staticSelect.value));
        randomSelect.addEventListener('change', () => updateSkybox('random_static', randomSelect.value));
        animatedSelect.addEventListener('change', () => updateSkybox('animation', animatedSelect.value));

        // Set initial state
        if (currentType === 'static') {
            staticSelect.value = currentKey;
        } else if (currentType === 'random_static') {
            randomSelect.value = currentKey;
        } else if (currentType === 'animation') {
            animatedSelect.value = currentKey;
        }
        onTypeChange();
    }

    populateSelect(selectEl, textures, defaultPath, allowNone = false) {
        selectEl.innerHTML = ''; if (allowNone) selectEl.add(new Option('None', ''));
        textures.forEach(path => { if(path) selectEl.add(new Option(path.split('/').pop(), path)); });
        if(defaultPath) selectEl.value = defaultPath;
    }

    populatePillarPalette() {
        this.paletteContainer.innerHTML = '';
        this.paletteContainer.style.display = 'block';

        const controlsContainer = document.createElement('div');
        controlsContainer.id = 'pillar-extras';
        controlsContainer.innerHTML = `
            <div class="content-group">
                <h4>Pillar Properties</h4>
                <div class="horizontal-group">
                    <label for="pillar-width-slider">Width: <span id="pillar-width-val">11</span>%</label>
                    <input type="range" id="pillar-width-slider" min="1" max="100" value="11" step="1">
                </div>
                <div class="horizontal-group">
                    <label for="pillar-height-input">Height:</label>
                    <input type="number" id="pillar-height-input" value="${this.pillarHeight}" min="1" max="30" step="1">
                </div>
                <div class="horizontal-group">
                    <label for="pillar-placement-select">Placement:</label>
                    <select id="pillar-placement-select">
                        <option value="center">Center</option>
                        <option value="topLeft">Top-Left</option>
                        <option value="topRight">Top-Right</option>
                        <option value="bottomLeft">Bottom-Left</option>
                        <option value="bottomRight">Bottom-Right</option>
                    </select>
                </div>
            </div>
            <div id="pillar-base-palette" class="palette"></div>
        `;
        this.paletteContainer.appendChild(controlsContainer);

        const widthSlider = document.getElementById('pillar-width-slider');
        const widthVal = document.getElementById('pillar-width-val');
        const heightInput = document.getElementById('pillar-height-input');
        const placementSelect = document.getElementById('pillar-placement-select');
        const basePaletteContainer = document.getElementById('pillar-base-palette');

        const updateBrush = () => {
            const activeBaseItem = basePaletteContainer.querySelector('.palette-item.active');
            if (!activeBaseItem) return;

            const width = parseInt(widthSlider.value, 10);
            const height = parseInt(heightInput.value, 10);
            const placement = placementSelect.value;

            widthVal.textContent = width;
            this.pillarHeight = height;
            if (this.pillarDisplay) this.pillarDisplay.textContent = `Height: ${this.pillarHeight}`;

            this.editor.setPillarPlacementMode(placement);

            this.editor.activeBrush = {
                type: 'pillar',
                key: activeBaseItem.dataset.key,
                properties: {
                    width: width,
                    height: height
                }
            };
            this.editor.render();
        };

        widthSlider.addEventListener('input', updateBrush);
        heightInput.addEventListener('change', updateBrush);
        placementSelect.addEventListener('change', updateBrush);

        const textures = this.assetManager.layerTextures['pillar'] || [];
        const groups = {};
        textures.forEach(path => { if(!path) return; const dir = path.split('/')[path.split('/').length - 2]; if (!groups[dir]) groups[dir] = []; groups[dir].push(path); });
        
        for (const dir in groups) {
            const header = document.createElement('div'); header.className = 'palette-header'; header.textContent = dir.charAt(0).toUpperCase() + dir.slice(1); basePaletteContainer.appendChild(header);
            for (const path of groups[dir]) {
                const item = document.createElement('div'); item.className = 'palette-item'; item.dataset.key = path;
                const img = new Image(); img.src = path; item.appendChild(img);
                const label = document.createElement('span'); label.textContent = path.split('/').pop().replace('.png', '').replace(/_/g, ' '); item.appendChild(label);
                item.addEventListener('click', () => {
                    basePaletteContainer.querySelectorAll('.palette-item').forEach(p => p.classList.remove('active'));
                    item.classList.add('active');
                    updateBrush();
                });
                basePaletteContainer.appendChild(item);
            }
        }

        const firstItem = basePaletteContainer.querySelector('.palette-item');
        if (firstItem) {
            firstItem.click();
        } else {
            this.editor.activeBrush = null;
        }
    }
}
