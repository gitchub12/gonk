// BROWSERFIREFOXHIDE editor_ui_and_assets.js 
// Corrected singular/plural mismatch in UI layer groups.

class EditorAssetManager {
    constructor(modelSystem) {
        this.modelSystem = modelSystem;
        this.npcSkins = [];
        this.npcIcons = new Map();
        this.furnitureJsons = new Map();
        this.assetIcons = new Map(); 
        this.textureLayers = ['subfloor', 'floor', 'water', 'floater', 'decor', 'ceiling', 'sky', 'wall', 'door', 'dock', 'tapestry', 'dangler', 'spawn'];
        this.layerTextures = {};
        this.textureLayers.forEach(type => this.layerTextures[type] = []);
    }

    async fetchDirectoryListing(path) {
        try {
            const response = await fetch(path);
            if (!response.ok) return []; // Silently fail if directory doesn't exist
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            return Array.from(doc.querySelectorAll('a'))
                .map(a => a.getAttribute('href'))
                .filter(href => href.endsWith('.png'));
        } catch (e) {
            console.warn(`Could not fetch or parse directory listing for "${path}":`, e);
            return [];
        }
    }

    async discoverAssets() {
        // Discover Textures dynamically from folders
        for (const layerType of this.textureLayers) {
            const path = `/data/pngs/${layerType}/`;
            const textureFiles = await this.fetchDirectoryListing(path);
            this.layerTextures[layerType] = textureFiles.map(file => `${path}${file}`);
        }
        
        // Discover NPC Skins dynamically
        const skinPath = '/data/skins/';
        const skinFiles = await this.fetchDirectoryListing(skinPath);
        this.npcSkins = skinFiles.map(f => `${skinPath}${f}`);
        await this.generateNpcIcons();
        
        // Discover Furniture/Assets from its manifest
        try {
            const furnitureManifestResponse = await fetch('/data/furniture.json');
            const furnitureManifest = await furnitureManifestResponse.json();
            const modelPath = furnitureManifest._config.modelPath;

            for (const modelKey in furnitureManifest.models) {
                const modelDef = furnitureManifest.models[modelKey];
                const fileName = modelDef.file;
                this.furnitureJsons.set(modelKey, `/${modelPath}${fileName}`);
                this.assetIcons.set(modelKey, this.createPlaceholderIcon(modelKey));
            }
        } catch (e) { 
            console.error("Failed to discover furniture assets from manifest:", e); 
        }
        
        return true;
    }

    createPlaceholderIcon(name) {
        const canvas = document.createElement('canvas');
        canvas.width = 64; canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#555'; ctx.fillRect(0, 0, 64, 64);
        ctx.fillStyle = '#fff'; ctx.font = '10px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(name, 32, 32);
        return canvas.toDataURL();
    }

    async generateNpcIcons() {
        const iconPromises = this.npcSkins.map(skinPath => new Promise(resolve => {
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.src = skinPath;
            img.onload = () => {
                const skinName = skinPath.split('/').pop().replace('.png', '');
                let baseName = skinName.startsWith('bb8') || skinName.startsWith('r2d2') ? skinName.match(/^(bb8|r2d2)/)[0] : skinName.replace(/\d+$/, '');
                let modelDef = this.modelSystem.models[baseName] || this.modelSystem.models['humanoid'];
                const iconUV = modelDef.iconUV || { x: 8, y: 8, size: 8 };
                const iconCanvas = document.createElement('canvas');
                iconCanvas.width = 64; iconCanvas.height = 64;
                const ctx = iconCanvas.getContext('2d');
                ctx.imageSmoothingEnabled = false;
                const scale = img.width / 64;
                const faceX = iconUV.x * scale, faceY = iconUV.y * scale, faceSize = iconUV.size * scale;
                const hasHatLayer = modelDef === this.modelSystem.models['humanoid'];
                const hatX = 40 * scale, hatY = 8 * scale, hatSize = 8 * scale;
                ctx.drawImage(img, faceX, faceY, faceSize, faceSize, 0, 0, 64, 64);
                if(hasHatLayer) ctx.drawImage(img, hatX, hatY, hatSize, hatSize, 0, 0, 64, 64);
                this.npcIcons.set(skinName, iconCanvas.toDataURL());
                resolve();
            };
            img.onerror = () => { console.warn(`Failed to load skin image: ${skinPath}`); resolve(); };
        }));
        await Promise.all(iconPromises);
    }
}

class EditorUI {
    constructor(editor) {
        this.editor = editor; this.assetManager = editor.assetManager;
        this.layerSelector = document.getElementById('layer-selector'); this.paletteContainer = document.getElementById('palette-container');
        this.gridWidthInput = document.getElementById('grid-width-input'); this.gridHeightInput = document.getElementById('grid-height-input');
        this.levelNumberInput = document.getElementById('level-number-input'); this.levelDisplay = document.getElementById('level-display');
        this.contextMenu = document.getElementById('context-menu');
        this.propertiesPanel = document.getElementById('properties-panel');
        this.propContent = document.getElementById('prop-content');
        this.currentPropItem = null;
        this.defaultTextureSelects = {}; this.layerButtons = {};
        ['subfloor', 'floor', 'water', 'floater', 'ceiling', 'sky'].forEach(id => {
            const el = document.getElementById(`default-${id}-select`); if(el) this.defaultTextureSelects[id] = el;
        });
        this.toolButtons = { 
            paint: document.getElementById('tool-paint'), 
            erase: document.getElementById('tool-erase'), 
            rotate: document.getElementById('tool-rotate'), 
            spawn: document.getElementById('tool-spawn'),
            fill: document.getElementById('tool-fill') 
        };
    }

    init() {
        document.querySelectorAll('.tab-button').forEach(tab => tab.addEventListener('click', () => {
            document.querySelectorAll('.tab-button, .tab-content').forEach(t => t.classList.remove('active'));
            tab.classList.add('active'); document.getElementById(`${tab.dataset.tab}-content`).classList.add('active');
        }));
        this.createLayerSelector();
        document.getElementById('load-level-btn').addEventListener('click', () => this.editor.loadLevel(parseInt(this.levelNumberInput.value) || 1));
        document.getElementById('save-level-btn').addEventListener('click', () => this.editor.saveLevel());
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
                this.editor.defaultTextures[layer] = {
                    key: select.value,
                    size: parseInt(sizeSelect.value) || 1
                };
                this.editor.modifyState(()=>{});
                this.editor.render();
            };
            select.addEventListener('change', updateDefaultTexture);
            if (sizeSelect) sizeSelect.addEventListener('change', updateDefaultTexture);
        }
        
        Object.entries(this.toolButtons).forEach(([toolName, button]) => {
            if (button) button.addEventListener('click', () => this.setActiveTool(toolName));
        });

        document.getElementById('save-prop-btn').addEventListener('click', e => { e.stopPropagation(); this.saveProperties(); });
        document.getElementById('cancel-prop-btn').addEventListener('click', e => { e.stopPropagation(); this.hidePropertiesPanel(); });
        this.contextMenu.addEventListener('click', e => e.stopPropagation()); 
        this.propertiesPanel.addEventListener('click', e => e.stopPropagation());

        this.populateDefaultTextureSettings(); this.setActiveLayer(this.editor.activeLayerName);
    }
    
    createLayerSelector() {
        this.layerSelector.innerHTML = '';
        const specialNpcButtons = [
            { label: 'Aliens', icon: '/data/pngs/icons for UI/aliensicon.png', group: 'Aliens' },
            { label: 'Droids', icon: '/data/pngs/icons for UI/droidicon.png', group: 'Droids' },
            { label: 'Stormies', icon: '/data/pngs/icons for UI/stormiesicon.png', group: 'Stormies' },
        ];
        const layerGroups = {
            'Ground': ['subfloor', 'floor', 'water'],
            'Scenery': ['floater', 'decor', 'dangler'],
            'Structure': ['wall', 'door', 'dock', 'tapestry'], // <-- CORRECTED TO SINGULAR
            'Entities': ['npcs', 'assets', 'spawns'],
            'Skybox': ['ceiling', 'sky']
        };

        for(const groupName in layerGroups){
            const groupDiv = document.createElement('div');
            groupDiv.className = 'layer-group';

            layerGroups[groupName].forEach(layerName => {
                 if(layerName === 'npcs'){
                    specialNpcButtons.forEach(npcInfo => {
                        const btn = this.createButton(layerName, npcInfo.label, npcInfo.icon);
                        btn.addEventListener('click', () => this.setActiveLayer(layerName, npcInfo.group));
                        groupDiv.appendChild(btn);
                    });
                } else {
                    const btn = this.createButton(layerName, layerName, null);
                    btn.addEventListener('click', () => this.setActiveLayer(layerName));
                    groupDiv.appendChild(btn);
                }
            });
            this.layerSelector.appendChild(groupDiv);
        }
    }

    createButton(layerName, label, overrideIcon) {
        const button = document.createElement('button');
        button.dataset.layer = layerName;
        button.title = label.charAt(0).toUpperCase() + label.slice(1);
        let iconSrc = overrideIcon;
        if (!iconSrc) {
            const iconMap = {
                'assets': '/data/pngs/icons for UI/crate.png',
                'spawns': '/data/pngs/spawn/hologonk_1.png',
                'wall': '/data/pngs/icons for UI/wallsicon.png',
                'door': '/data/pngs/icons for UI/dooricon.png',
                'dock': '/data/pngs/icons for UI/dockicon.png',
            };
            if(iconMap[layerName]) {
                iconSrc = iconMap[layerName];
            } else {
                const textures = this.assetManager.layerTextures[layerName] || [];
                if (textures.length > 0) iconSrc = textures[0];
            }
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
        const editorTabButton = document.querySelector('.tab-button[data-tab="editor"]');
        if (!editorTabButton.classList.contains('active')) {
            editorTabButton.click();
        }

        this.editor.activeLayerName = layerName;
        document.querySelectorAll('#layer-selector button').forEach(btn => btn.classList.remove('active'));
        const buttons = this.layerButtons[layerName];
        if (buttons) {
            let targetButton = buttons.find(b => b.title.toLowerCase() === (subGroup || layerName).toLowerCase()) || buttons[0];
            if (targetButton) targetButton.classList.add('active');
        }
        this.setActiveTool(layerName === 'spawns' ? 'spawn' : 'paint');
        this.updatePalette(subGroup); 
        this.editor.render();
    }

    setActiveTool(toolName) {
        this.editor.activeTool = toolName;
        Object.values(this.toolButtons).forEach(btn => { if(btn) btn.classList.remove('active'); });
        if (this.toolButtons[toolName]) this.toolButtons[toolName].classList.add('active');
        const cursors = { paint: 'crosshair', erase: 'not-allowed', rotate: 'grab', spawn: 'pointer', fill: 'copy' };
        this.editor.canvas.style.cursor = cursors[toolName] || 'default';
        this.updatePalette();
    }
    
    updateUIForNewLevel() {
        this.levelNumberInput.value = this.editor.currentLevel;
        this.levelDisplay.textContent = `Level: ${this.editor.currentLevel}`;
    }

    updatePalette(subGroup = null) {
        const activeLayer = this.editor.activeLayerName; const activeTool = this.editor.activeTool;
        const showPalette = activeTool === 'paint' || activeTool === 'fill';
        document.querySelector('.content-group h4').style.display = showPalette ? 'block' : 'none';
        this.paletteContainer.style.display = showPalette ? 'grid' : 'none';
        document.getElementById('palette-controls').style.display = showPalette ? 'flex' : 'none';
        if (!showPalette) { this.editor.activeBrush = null; return; }

        if (activeLayer === 'npcs') this.populateNpcPalette();
        else if (activeLayer === 'assets') this.populateAssetPalette();
        else this.populateTexturePalette();
        
        const firstItem = this.paletteContainer.querySelector('.palette-item');
        if (firstItem) { firstItem.click(); } else { this.editor.activeBrush = null; }

        if(subGroup) { const header = document.getElementById(`palette-header-${subGroup}`); if(header) header.scrollIntoView({behavior: "smooth", block: "start"}); }
    }
    
    showContextMenu(event, itemKey, itemData, layerName) {
        this.hideContextMenu();
        const menuList = this.contextMenu.querySelector('ul');
        menuList.innerHTML = '';
        
        const hasProps = ['docks', 'spawns'].includes(layerName);
        
        if (hasProps) {
            const propLi = document.createElement('li');
            propLi.textContent = 'Properties';
            propLi.addEventListener('click', e => { 
                e.stopPropagation();
                this.showPropertiesPanel(itemKey, itemData, layerName); 
                this.hideContextMenu(); 
            });
            menuList.appendChild(propLi);
        }

        const deleteLi = document.createElement('li');
        deleteLi.textContent = 'Delete';
        deleteLi.addEventListener('click', e => { 
            e.stopPropagation();
            this.editor.eraseItem({layer: layerName, key: itemKey, data: itemData});
            this.hideContextMenu();
        });
        menuList.appendChild(deleteLi);

        this.contextMenu.style.left = `${event.clientX}px`;
        this.contextMenu.style.top = `${event.clientY}px`;
        this.contextMenu.style.display = 'block';
    }

    hideContextMenu() { this.contextMenu.style.display = 'none'; }
    
    showPropertiesPanel(itemKey, itemData, layerName) {
        this.currentPropItem = { key: itemKey, data: itemData, layer: layerName };
        this.propContent.innerHTML = '';
        
        let propHtml = '';
        if (layerName === 'dock') { // Corrected to singular
            const currentTarget = itemData.properties?.target || '';
            propHtml = `
                <div class="prop-group"><h3>Dock Properties</h3>
                    <label for="dock-target">Target:</label>
                    <input type="text" id="dock-target" value="${currentTarget}" placeholder="e.g., TO LEVEL 02A">
                </div>`;
        } else if (layerName === 'spawns') {
            const currentId = itemData.id || '';
            const currentRotation = itemData.rotation || 0;
            propHtml = `
                <div class="prop-group"><h3>Spawn Point Properties</h3>
                    <label for="spawn-id">ID:</label>
                    <input type="text" id="spawn-id" value="${currentId}" placeholder="e.g., FROM LEVEL 01">
                    <label for="spawn-rotation">Facing Direction:</label>
                    <select id="spawn-rotation">
                        <option value="0" ${currentRotation === 0 ? 'selected' : ''}>Up (0)</option>
                        <option value="1" ${currentRotation === 1 ? 'selected' : ''}>Right (90)</option>
                        <option value="2" ${currentRotation === 2 ? 'selected' : ''}>Down (180)</option>
                        <option value="3" ${currentRotation === 3 ? 'selected' : ''}>Left (270)</option>
                    </select>
                </div>`;
        }
        
        this.propContent.innerHTML = propHtml;
        this.propertiesPanel.style.display = 'block';
    }

    hidePropertiesPanel() {
        this.propertiesPanel.style.display = 'none';
        this.currentPropItem = null;
    }

    saveProperties() {
        if (!this.currentPropItem) return;
        
        const { key, data, layer } = this.currentPropItem;
        const itemToModify = this.editor.levelData[layer].get(key);

        if (!itemToModify) {
            console.error("Could not find item to modify in level data.");
            this.hidePropertiesPanel();
            return;
        }

        this.editor.modifyState(() => {
            if (layer === 'dock') { // Corrected to singular
                const newTarget = document.getElementById('dock-target').value;
                if (!itemToModify.properties) itemToModify.properties = {};
                itemToModify.properties.target = newTarget;
            } else if (layer === 'spawns') {
                const newId = document.getElementById('spawn-id').value;
                const newRotation = parseInt(document.getElementById('spawn-rotation').value, 10);
                itemToModify.id = newId;
                itemToModify.rotation = newRotation;
            }
        });
        this.hidePropertiesPanel();
    }
    
    _populatePalette(items, createItemFn) {
        this.paletteContainer.innerHTML = ''; if (!items || items.length === 0) { this.paletteContainer.innerHTML = `<p>No assets found</p>`; return; }
        items.forEach(createItemFn);
    }

    populateTexturePalette() {
        const selectedLayer = this.editor.activeLayerName;
        let textures = this.assetManager.layerTextures[selectedLayer];
        this._populatePalette(textures, path => {
            const item = document.createElement('div'); item.className = 'palette-item';
            const img = new Image(); img.src = path; item.appendChild(img);
            const label = document.createElement('span'); label.textContent = path.split('/').pop().replace('.png', '').replace(/_/g, ' '); item.appendChild(label);
            item.addEventListener('click', () => { this.paletteContainer.querySelectorAll('.palette-item').forEach(p => p.classList.remove('active')); item.classList.add('active'); this.editor.activeBrush = { type: 'texture', key: path }; });
            this.paletteContainer.appendChild(item);
        });
    }

    populateAssetPalette() { this._populatePalette(Array.from(this.assetManager.assetIcons.entries()), ([name, iconUrl]) => { const item = document.createElement('div'); item.className = 'palette-item'; const img = new Image(); img.src = iconUrl; item.appendChild(img); const label = document.createElement('span'); label.textContent = name; item.appendChild(label); item.addEventListener('click', () => { this.paletteContainer.querySelectorAll('.palette-item').forEach(p => p.classList.remove('active')); item.classList.add('active'); this.editor.activeBrush = { type: 'asset', key: name }; }); this.paletteContainer.appendChild(item); }); }

    populateDefaultTextureSettings() {
        for(const [layer, select] of Object.entries(this.defaultTextureSelects)) {
            select.innerHTML = ''; const textures = this.assetManager.layerTextures[layer] || [];
            const noneOption = document.createElement('option'); noneOption.value = ''; noneOption.textContent = 'None'; select.appendChild(noneOption);
            textures.forEach(path => { const option = document.createElement('option'); option.value = path; option.textContent = path.split('/').pop(); select.appendChild(option); });
            if (this.editor.defaultTextures[layer]) { select.value = this.editor.defaultTextures[layer].key; }
        }
    }

    updateSettingsUI() {
        this.gridWidthInput.value = this.editor.gridWidth;
        this.gridHeightInput.value = this.editor.gridHeight;
        for (const [layer, defaultInfo] of Object.entries(this.editor.defaultTextures)) {
            const select = this.defaultTextureSelects[layer];
            const sizeSelect = document.getElementById(`default-${layer}-size`);
            if (select) select.value = defaultInfo.key || '';
            if (sizeSelect) sizeSelect.value = defaultInfo.size || '1';
        }
    }

    populateNpcPalette() { this.paletteContainer.innerHTML = ''; const npcGroups = { 'Aliens': [], 'Droids': [], 'Stormies': [] }; const groupMap = { 'wookiee': 'Aliens', 'gungan': 'Aliens', 'stormtrooper': 'Stormies' }; this.assetManager.npcIcons.forEach((iconDataUrl, skinName) => { const baseName = skinName.match(/^(bb8|r2d2)/) ? skinName.match(/^(bb8|r2d2)/)[0] : skinName.replace(/\d+$/, ''); const group = groupMap[baseName] || 'Droids'; npcGroups[group].push({ skinName, iconDataUrl }); }); for (const groupName in npcGroups) { if(npcGroups[groupName].length === 0) continue; const header = document.createElement('div'); header.className = 'palette-header'; header.textContent = groupName; header.id = `palette-header-${groupName}`; this.paletteContainer.appendChild(header); for (const { skinName, iconDataUrl } of npcGroups[groupName]) { const item = document.createElement('div'); item.className = 'palette-item'; const img = new Image(); img.src = iconDataUrl; window[skinName + '_icon_img'] = img; item.appendChild(img); const label = document.createElement('span'); label.textContent = skinName; item.appendChild(label); item.addEventListener('click', () => { this.paletteContainer.querySelectorAll('.palette-item').forEach(p => p.classList.remove('active')); item.classList.add('active'); this.editor.activeBrush = { type: 'npc', key: skinName }; }); this.paletteContainer.appendChild(item); } } }
}