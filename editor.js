// BROWSERFIREFOXHIDE editor.js
// update: Removed the fetch call for the deprecated `level_templatesdotjson` to prevent console warnings on startup.
// update: The editor's `placeItem` function now correctly reads the `soundSet` property from the asset manager and saves it to the NPC's data in the level file.
// update: Corrected name generation logic to prioritize macroCategory and handle case differences.
// update: Removed name generation call from placeItem. Editor now uses placeholders.
class LevelEditor {
    constructor() {
        this.canvas = document.getElementById('editorCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.modelSystem = new GonkModelSystem();
        this.assetManager = new EditorAssetManager(this.modelSystem);
        this.ui = new EditorUI(this);

        this.statusMsg = document.getElementById('status-message');
        this.gridSize = 32; this.gridWidth = 64; this.gridHeight = 64;
        this.zoom = 1.0; this.panX = 0; this.panY = 0;
        this.isPanning = false; this.isPainting = false; this.lastMouse = { x: 0, y: 0 };
        this.lastPlacedGrid = { x: null, y: null };
        this.dragPaintAxis = null;

        this.activeTool = 'paint';
        this.wallDrawMode = 'grid';
        this.vectorWallStart = null;
        this.activeBrushSize = 1;
        this.activeBrush = null;
        this.activeTemplate = {};
        this.isTemplateCloned = false;
        this.placementPreview = null;
        this.pillarPlacementMode = 'center';

        this.hoveredItem = null;
        this.hoveredDrawableLine = null;
        this.layerOrder = ['subfloor', 'floor', 'water', 'floater', 'decor', 'npcs', 'assets', 'pillar', 'wall', 'door', 'dock', 'screen', 'panel', 'dangler', 'ceiling', 'sky', 'skybox', 'elevation', 'spawns'];
        this.tileLayers = ['subfloor', 'floor', 'water', 'floater', 'decor', 'dangler', 'ceiling', 'sky', 'elevation'];
        this.objectLayers = ['npcs', 'assets', 'spawns', 'pillar'];
        this.lineLayers = ['wall', 'door', 'dock'];
        this.overlayLayers = ['screen', 'panel'];
        this.activeLayerName = 'floor';

        this.levelData = {}; this.layerOrder.forEach(layer => this.levelData[layer] = new Map());
        this.defaultTextures = {
            floor: { key: '/data/pngs/floor/floor_2.png', size: 1 },
            ceiling: { key: '/data/pngs/ceiling/ceiling_1.png', size: 1, wallside: 'cside_default', heightMultiplier: 1 },
            elevation: { wallside: 'eside_default'},
            skybox: { key: 'hyper' }
        };
        this.preloadedImages = new Map();
        this.currentLevel = 1; this.isLevelDirty = false;
        this.history = []; this.historyIndex = -1;
        this.levelTemplates = {};
        // this.nameData is now managed by EditorAssetManager

        this.init();
    }

    async init() {
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        this.canvas.addEventListener('mousedown', e => this.onMouseDown(e));
        document.addEventListener('mousemove', e => this.onMouseMove(e));
        document.addEventListener('mouseup', e => this.onMouseUp(e));
        this.canvas.addEventListener('wheel', e => this.onMouseWheel(e));
        document.addEventListener('keydown', e => this.onKeyDown(e));

        document.getElementById('tool-wall-mode').addEventListener('click', () => this.toggleWallMode());
        document.getElementById('tool-tile-size').addEventListener('click', () => this.cycleTileSize());

        await this.assetManager.discoverAssets();
        await this.preloadAllTextures();
        this.ui.init();
        this.loadLevelTemplates();
        await this.loadLevel(this.currentLevel, true);
    }

    loadLevelTemplates() {
        this.levelTemplates = {};
    }

    applyLevelTemplate(levelNum) {
        const levelData = {};
        this.layerOrder.forEach(layer => levelData[layer] = new Map());

        const templateKey = levelNum > 1 ? 'default-b' : 'initial';
        const template = this.levelTemplates[templateKey];
        if (!template) {
            this.statusMsg.textContent = `No template found for level ${levelNum}. Starting blank level.`;
            return levelData;
        }

        this.gridWidth = template.settings.width;
        this.gridHeight = template.settings.height;

        const evaluatedLayers = this.evaluateTemplate(template.layers, levelNum, this.gridWidth, this.gridHeight);
        for (const layerName in evaluatedLayers) {
            if (levelData.hasOwnProperty(layerName)) {
                for (const item of evaluatedLayers[layerName]) {
                    const coordKey = `${item.x},${item.y}`;
                    const itemData = { key: item.key, rotation: item.rotation, properties: item.properties, type: item.type };
                    if (item.id) itemData.id = item.id;
                    levelData[layerName].set(coordKey, itemData);
                }
            }
        }

        return levelData;
    }

    evaluateTemplate(layers, levelNum, width, height) {
        const evaluatedLayers = {};
        for (const layerName in layers) {
            evaluatedLayers[layerName] = layers[layerName].map(item => {
                const evalItem = { ...item };
                if (evalItem.relativePos) {
                    const x = eval(evalItem.relativePos.x.replace('width', width).replace('height', height));
                    const y = eval(evalItem.relativePos.y.replace('width', width).replace('height', height));
                    evalItem.x = Math.floor(x);
                    evalItem.y = Math.floor(y);
                    delete evalItem.relativePos;
                }
                if (evalItem.id) {
                    evalItem.id = evalItem.id.replace('{levelNum}', String(levelNum).padStart(2, '0'));
                }
                if (evalItem.properties?.target) {
                    evalItem.properties.target = evalItem.properties.target.replace('{levelNum+1}', String(levelNum + 1).padStart(2, '0'));
                }
                if (evalItem.properties?.linkFrom) {
                     evalItem.properties.linkFrom = evalItem.properties.linkFrom.replace('{levelNum-1}', String(levelNum - 1).padStart(2, '0'));
                }
                return evalItem;
            });
        }
        return evaluatedLayers;
    }

    toggleWallMode() {
        const button = document.getElementById('tool-wall-mode');
        const img = button.querySelector('img');
        if (this.wallDrawMode === 'grid') {
            this.wallDrawMode = 'vector';
            img.src = '/data/pngs/icons for UI/angleicon.png';
            this.statusMsg.textContent = 'Wall Mode: Vector';
        } else {
            this.wallDrawMode = 'grid';
            img.src = '/data/pngs/icons for UI/gridicon.png';
            this.statusMsg.textContent = 'Wall Mode: Grid';
            this.vectorWallStart = null;
        }

        const currentLayer = this.activeLayerName;
        if (!this.lineLayers.includes(currentLayer)) {
            this.ui.setActiveLayer('wall');
        }

        this.render();
    }

    cycleTileSize() {
        const button = document.getElementById('tool-tile-size');
        const img = button.querySelector('img');
        const sizes = [1, 2, 4, 8, 0.25, 0.5];
        const currentIdx = sizes.indexOf(this.activeBrushSize);
        this.activeBrushSize = sizes[(currentIdx + 1) % sizes.length];

        const icons = { 1: 'tilesize', 2: '2x', 4: '4x', 8: '8x', 0.5: 'onehalf', 0.25: 'onefourth' };
        img.src = `/data/pngs/icons for UI/${icons[this.activeBrushSize]}.png`;
        this.statusMsg.textContent = `Tile Size: ${this.activeBrushSize}x`;
        this.render();
    }

    setPillarPlacementMode(mode) {
        this.pillarPlacementMode = mode;
        this.render();
    }

    async preloadAllTextures() {
        const allPaths = new Set(['/data/pngs/icons for UI/crate.png', '/data/pngs/icons for UI/spawn_arrow.png', '/data/pngs/icons for UI/elevationicon.png', '/data/pngs/icons for UI/skyboxicon.png']);
        Object.values(this.assetManager.layerTextures).forEach(arr => arr.forEach(path => allPaths.add(path)));

        for (let i = 1; i <= 30; i++) {
            allPaths.add(`/data/pngs/elevation/${i}.png`);
        }

        const promises = [...allPaths].map(path => new Promise(resolve => {
            if (!path) { resolve(); return; }
            const img = new Image(); img.src = path;
            img.onload = () => { this.preloadedImages.set(path, img); resolve(); };
            img.onerror = () => { resolve(); }
        }));
        await Promise.all(promises);
    }

    cloneLevelData(data) { const clone = {}; for (const key in data) clone[key] = new Map(data[key]); return clone; }
    saveStateToHistory() { if (this.historyIndex < this.history.length - 1) this.history.splice(this.historyIndex + 1); this.history.push(this.cloneLevelData(this.levelData)); this.historyIndex++; }
    undo() { if (this.historyIndex > 0) { this.historyIndex--; this.levelData = this.cloneLevelData(this.history[this.historyIndex]); this.render(); this.statusMsg.textContent = 'Undo'; } }
    redo() { if (this.historyIndex < this.history.length - 1) { this.historyIndex++; this.levelData = this.cloneLevelData(this.history[this.historyIndex]); this.render(); this.statusMsg.textContent = 'Redo'; } }
    modifyState(modificationAction) { this.saveStateToHistory(); modificationAction(); this.isLevelDirty = true; this.render(); }
    resizeCanvas() { const container = document.getElementById('canvasContainer'); this.canvas.width = container.clientWidth; this.canvas.height = container.clientHeight; this.render(); }
    getMouseWorldCoords(e) { const rect = this.canvas.getBoundingClientRect(); const mouseX = (e.clientX + 9) - rect.left; const mouseY = e.clientY - rect.top; return { x: (mouseX - this.panX) / this.zoom, y: (mouseY - this.panY) / this.zoom }; }
    getGridCoordsFromEvent(e) { const { x: worldX, y: worldY } = this.getMouseWorldCoords(e); return { x: Math.floor(worldX / this.gridSize), y: Math.floor(worldY / this.gridSize) }; }
    getVertexCoordsFromEvent(e) { const { x: worldX, y: worldY } = this.getMouseWorldCoords(e); return { x: Math.round(worldX / this.gridSize), y: Math.round(worldY / this.gridSize) }; }

    eraseItem(itemToErase) {
        if (!itemToErase) return;
        this.modifyState(() => {
            const layer = this.levelData[itemToErase.layer];
            layer.delete(itemToErase.key);
            if(itemToErase.layer === 'dock' && itemToErase.data.properties?.autoSpawnFor) {
                 const spawnLayer = this.levelData.spawns;
                 spawnLayer.delete(itemToErase.data.properties.autoSpawnFor);
            }
        });
        this.statusMsg.textContent = `Erased item.`;
    }

    // This function remains in the editor UI for placeholder generation
    generateDefaultNamePlaceholderForNpc(skinName) {
        const nameData = this.assetManager.nameData;
        if (!nameData || Object.keys(nameData).length === 0 || !skinName) return 'XF XL';

        const iconInfo = this.assetManager.npcIcons.get(skinName);
        if (!iconInfo || !iconInfo.config) {
            console.warn(`No iconInfo or config found for ${skinName} in generateDefaultNamePlaceholderForNpc`);
            return 'XF XL';
        }
        // Prioritize macroCategory for name type
        const categoryKey = iconInfo.config.baseType || iconInfo.config.macroCategory || 'other';
        const categoryLower = categoryKey.toLowerCase();

        // Mapping for Name Lists (same as in npc_behavior.js)
        const nameListMap = {
            'stormtrooper': 'stormtrooper', 'stormtroopers': 'stormtrooper',
            'darth': 'darth', 'sith': 'darth', // Explicitly map sith to darth names
            'mandalorian': 'mando', 'mandalorians': 'mando',
            'gungan': 'gungan', 'gamorrean': 'gamorrean', 'wookiee': 'wookiee',
            'taker': 'taker', 'takers': 'taker',
            'human_female': 'female', 'human_male': 'male',
            'humanoid': 'humanoid', 'humans': 'humanoid',
            'ewok': 'ewok', 'halfpint': 'ewok',
            'clone': 'clone', 'clones': 'clone',
            'droid_humanoid': 'droid', 'bb8': 'droid', 'r2d2': 'droid', 'gonk': 'droid',
            'mousedroid': 'droid', 'probe': 'droid', 'r5d4': 'droid', 'irongolem': 'droid',
            'droids': 'droid',
            'aliens': 'humanoid',
            'moncalamari': 'other', 'bossk': 'other', 'aliens_generic': 'other',
            'quarterpint': 'other', 'hutt': 'other'
        };

        let listKey = nameListMap[categoryLower] || 'humanoid'; // Default if no specific mapping

        if (categoryLower === 'sith') {
            listKey = 'darth';
        }

        // Special case for Wookiee name placeholders
        if (listKey === 'wookiee') {
            return 'wookieeF wookieeR';
        }

        // Return placeholder string
        return `${listKey}F ${listKey}L`;
    }


    setPillarPlacementMode(mode) {
        this.pillarPlacementMode = mode;
        this.render();
    }

    placeItem(gridX, gridY, customSize, itemData, layerNameOverride) {
        const activeLayerName = layerNameOverride || this.activeLayerName;
        // If placing a random NPC, the brush is already the itemData
        const brush = itemData ? { ...itemData } : this.activeBrush;
        if (!brush || !brush.key) return;

        const size = customSize || this.activeBrushSize;

        const modification = () => {
            const item = {
                // Handle random_npc brush type
                ...(brush.type === 'random_npc' && {
                    type: 'random_npc',
                    key: `R${brush.properties.threat}_${brush.properties.macroCategory}_${brush.properties.subgroup || 'all'}`,
                    properties: { ...brush.properties }
                }),
                type: brush.type,
                key: brush.key,
                rotation: 0,
                properties: { ...(brush.properties || {}) }
            };

            if (activeLayerName === 'elevation') {
                const elevationLevel = item.properties.elevation || this.ui.elevationLevel;
                const wallsideTexture = item.properties.wallsideTexture || this.ui.elevationBrushTextures.wallside;
                item.key = `/data/pngs/elevation/${elevationLevel}.png`;
                item.properties.elevation = elevationLevel;
                item.properties.wallsideTexture = wallsideTexture;

                const floorKey = `${gridX},${gridY}`;
                this.levelData['floor'].set(floorKey, {
                    type: 'texture', key: `/data/pngs/elevation/${elevationLevel}.png`,
                    rotation: 0, properties: {}
                });
            }

            if (activeLayerName === 'pillar') {
                item.properties.height = item.properties.height || this.ui.pillarHeight;
                item.properties.placement = this.pillarPlacementMode;
            }

            const overlapSize = size < 1 ? 1 : size;
            this.deleteOverlappingTiles(gridX, gridY, overlapSize, this.levelData[activeLayerName]);

            if (size !== 1) item.size = size;

            if (activeLayerName === 'npcs') {
                const iconInfo = this.assetManager.npcIcons.get(brush.key);
                if (iconInfo && iconInfo.config) {
                    item.properties.alphaTexture = true;
                }
                if (!item.properties.name) {
                    item.properties.name = this.generateDefaultNamePlaceholderForNpc(brush.key);
                }
                 const opacitySlider = document.getElementById('npc-opacity-slider');
                 if (opacitySlider && parseInt(opacitySlider.value) < 100) {
                     item.properties.transparent = true;
                 } else {
                     delete item.properties.transparent;
                 }
            }

            this.levelData[activeLayerName].set(`${gridX},${gridY}`, item);
        };

        if(!layerNameOverride) {
            this.modifyState(modification);
            this.statusMsg.textContent = `Placed ${brush.key.split('/').pop()}`;
        } else {
            modification();
        }
    }


    deleteOverlappingTiles(x, y, size, layer) {
        if (!layer) return;
        const newBox = { x1: x, y1: y, x2: x + size, y2: y + size };
        const keysToDelete = [];
        for (const [key, item] of layer.entries()) {
            const [ix, iy] = key.split(',').map(Number);
            const isize = item.size < 1 ? 1 : (item.size || 1);
            const existingBox = { x1: ix, y1: iy, x2: ix + isize, y2: iy + isize };
            if (newBox.x1 < existingBox.x2 && newBox.x2 > existingBox.x1 && newBox.y1 < existingBox.y2 && newBox.y2 > existingBox.y1) {
                keysToDelete.push(key);
            }
        }
        for (const key of keysToDelete) {
            layer.delete(key);
        }
    }

    getOverlayDirection(e, line) {
        const { x: worldX, y: worldY } = this.getMouseWorldCoords(e);
        if (line.type === 'H') {
            const lineWorldY = (line.y + 1) * this.gridSize;
            return worldY < lineWorldY ? 1 : -1;
        } else {
            const lineWorldX = (line.x + 1) * this.gridSize;
            return worldX < lineWorldX ? 1 : -1;
        }
    }

    deleteIntersectingLines(p1, p2) {
        const layers = ['wall', 'door', 'dock'];
        const keysToDelete = { wall: [], door: [], dock: [] };

        for (const layerName of layers) {
            const layerMap = this.levelData[layerName];
            for (const [key, item] of layerMap.entries()) {
                let p3, p4;
                if (item.type === 'vector') {
                    p3 = { x: item.points[0], y: item.points[1] };
                    p4 = { x: item.points[2], y: item.points[3] };
                } else {
                    const [type, xStr, zStr] = key.split('_');
                    const x = Number(xStr); const z = Number(zStr);
                    if (type === 'H') {
                        p3 = { x: x, y: z + 1 }; p4 = { x: x + 1, y: z + 1 };
                    } else {
                        p3 = { x: x + 1, y: z }; p4 = { x: x + 1, y: z + 1 };
                    }
                }
                if (this.segmentsOverlap(p1, p2, p3, p4)) {
                    keysToDelete[layerName].push(key);
                }
            }
        }

        for (const layerName of layers) {
            for (const key of keysToDelete[layerName]) {
                this.levelData[layerName].delete(key);
            }
        }
    }

    handlePaintAction(e) {
        const activeLayerName = this.activeLayerName;

        if (this.placementPreview && this.placementPreview.layer === activeLayerName) {
            this.modifyState(() => {
                const { line, layer } = this.placementPreview;
                const key = `${line.type}_${line.x}_${line.y}`;
                this.levelData[layer].delete(key);
                const itemData = { type: 'texture', key: this.activeBrush.key, properties: { direction: this.placementPreview.direction } };
                this.levelData[layer].set(key, itemData);
            });
            this.placementPreview = null;
            this.statusMsg.textContent = `Placed overlay.`;
            return;
        }

        if (this.overlayLayers.includes(activeLayerName)) {
            if (this.hoveredDrawableLine && this.activeBrush) {
                this.placementPreview = { layer: activeLayerName, line: this.hoveredDrawableLine, direction: this.getOverlayDirection(e, this.hoveredDrawableLine) };
                this.statusMsg.textContent = 'Select direction, click again to place. (ESC to cancel)';
                this.render();
            }
            return;
        }

        if (this.lineLayers.includes(activeLayerName) && this.wallDrawMode === 'vector') {
            const {x: vX, y: vY} = this.getVertexCoordsFromEvent(e);
            this.placeVectorWallVertex(vX, vY);
        } else if (this.lineLayers.includes(activeLayerName) && this.wallDrawMode === 'grid') {
             if (!this.hoveredDrawableLine) return;
             if(this.dragPaintAxis && this.hoveredDrawableLine.type !== this.dragPaintAxis) return;

             const {type, x, y} = this.hoveredDrawableLine;
             this.modifyState(() => {
                let p1, p2;
                if (type === 'H') { p1 = {x:x, y:y+1}; p2 = {x:x+1, y:y+1}; }
                else { p1 = {x:x+1, y:y}; p2 = {x:x+1, y:y+1}; }
                this.deleteIntersectingLines(p1, p2);

                const currentCoord = `${type}_${x}_${y}`;
                const itemData = {
                    type: 'texture',
                    key: this.activeBrush.key,
                    properties: { ...this.activeBrush.properties }
                };
                this.levelData[activeLayerName].set(currentCoord, itemData);

                if(activeLayerName === 'dock') {
                     itemData.properties.target = `TO LEVEL ${String(this.currentLevel+1).padStart(2,'0')}A`;
                     this.placeAutoSpawnForDock(this.hoveredDrawableLine, currentCoord);
                 }
             });
        } else {
            const { x: gridX, y: gridY } = this.getGridCoordsFromEvent(e);
            this.placeItem(gridX, gridY);
        }
    }

    placeAutoSpawnForDock(dockLine, dockKey) {
        let spawnX, spawnY, rotation;
        const { type, x, y } = dockLine;

        if (type === 'H') {
            spawnX = x;
            spawnY = y + (y < this.gridHeight / 2 ? 1 : -1);
            rotation = y < this.gridHeight / 2 ? 2 : 0;
        } else {
            spawnY = y;
            spawnX = x + (x < this.gridWidth / 2 ? 1 : -1);
            rotation = x < this.gridWidth / 2 ? 1 : 3;
        }

        const spawnKey = `${spawnX},${spawnY}`;
        const spawnLayer = this.levelData['spawns'];
        if (spawnLayer.has(spawnKey)) return;

        const dockData = this.levelData['dock'].get(dockKey);
        if(dockData && dockData.properties) {
            dockData.properties.autoSpawnFor = spawnKey;
        }

        spawnLayer.set(spawnKey, {
            id: `FROM LEVEL ${String(this.currentLevel + 1).padStart(2, '0')}`,
            rotation: rotation,
            key: '/data/pngs/spawn/hologonk_1.png',
            properties: {}
        });
    }

    placeVectorWallVertex(vX, vY) {
        if (!this.activeBrush || !this.lineLayers.includes(this.activeLayerName)) return;
        if (!this.vectorWallStart) {
            this.vectorWallStart = { x: vX, y: vY };
            this.statusMsg.textContent = 'Vector wall started.';
            this.render();
        } else {
            if (this.vectorWallStart.x === vX && this.vectorWallStart.y === vY) return;
            const p1 = this.vectorWallStart;
            const p2 = { x: vX, y: vY };
            this.modifyState(() => {
                this.deleteIntersectingLines(p1, p2);
                const itemKey = `VEC_${Date.now()}_${Math.random()}`;
                const itemData = {
                    type: 'vector',
                    points: [p1.x, p1.y, p2.x, p2.y],
                    key: this.activeBrush.key,
                    properties: { ...this.activeBrush.properties }
                };

                this.levelData[this.activeLayerName].set(itemKey, itemData);

                if(this.activeLayerName === 'dock') {
                    itemData.properties.target = `TO LEVEL ${String(this.currentLevel+1).padStart(2,'0')}A`;
                    const midX = Math.round((p1.x + p2.x) / 2);
                    const midY = Math.round((p1.y + p2.y) / 2);
                    const isHorizontal = Math.abs(p2.x - p1.x) > Math.abs(p2.y - p1.y);
                    const spawnLine = isHorizontal ? {type: 'H', x: midX, y: midY} : {type: 'V', x: midX, y: midY};
                    this.placeAutoSpawnForDock(spawnLine, itemKey);
                }

                this.statusMsg.textContent = `Placed vector segment.`;
            });
            this.vectorWallStart = { x: vX, y: vY };
        }
    }

    cloneTemplateFromGrid(gridX, gridY) {
        this.activeTemplate = { items: [] };
        const items = this.findAllItemsAt(gridX, gridY);

        for (const itemRef of items) {
            const item = { ...itemRef.data };
            const [ix, iy] = itemRef.key.split(',').map(Number);
            item.relX = ix - gridX;
            item.relY = iy - gridY;
            item.layer = itemRef.layer;
            this.activeTemplate.items.push(item);
        }

        // Clone surrounding walls/overlays
        const lineLayers = [...this.lineLayers, ...this.overlayLayers];
        const sides = [
            { key: `H_${gridX}_${gridY - 1}`, relX: 0, relY: -1, type: 'H' },
            { key: `H_${gridX}_${gridY}`,     relX: 0, relY: 0,  type: 'H' },
            { key: `V_${gridX - 1}_${gridY}`, relX: -1, relY: 0, type: 'V' },
            { key: `V_${gridX}_${gridY}`,     relX: 0, relY: 0,  type: 'V' }
        ];

        for (const layer of lineLayers) {
            for (const side of sides) {
                if (this.levelData[layer].has(side.key)) {
                    const itemData = this.levelData[layer].get(side.key);
                    this.activeTemplate.items.push({
                        ...itemData,
                        layer: layer,
                        relX: side.relX,
                        relY: side.relY,
                        lineType: side.type
                    });
                }
            }
        }

        this.isTemplateCloned = true;
        this.statusMsg.textContent = `Template cloned. Click to stamp, or right-click to cancel.`;
    }

    placeTemplate(gridX, gridY) {
        if (!this.isTemplateCloned || !this.activeTemplate.items) return;

        this.modifyState(() => {
            const size = this.activeBrushSize;
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const tileX = gridX + x;
                    const tileY = gridY + y;

                    for (const item of this.activeTemplate.items) {
                        if (item.lineType) { // It's a wall/line
                            const newKey = `${item.lineType}_${tileX + item.relX}_${tileY + item.relY}`;
                            this.levelData[item.layer].set(newKey, item);
                        } else { // It's a tile/object
                            const newX = tileX + item.relX;
                            const newY = tileY + item.relY;
                            this.levelData[item.layer].set(`${newX},${newY}`, item);
                        }
                    }
                }
            }
        });
        this.statusMsg.textContent = `Stamped template.`;
    }

    placeSpawn(gridX, gridY) {
        if (this.activeLayerName !== 'spawns') return;
        const coordKey = `${gridX},${gridY}`;
        const spawnLayer = this.levelData['spawns'];
        if (spawnLayer.has(coordKey)) return;

        const existingSpawns = Array.from(spawnLayer.values()).map(s => s.id || '');
        let nextChar = 'A';
        while (existingSpawns.includes(`L${String(this.currentLevel).padStart(2, '0')}-SP-${nextChar}`)) {
            nextChar = String.fromCharCode(nextChar.charCodeAt(0) + 1);
        }

        this.modifyState(() => {
            spawnLayer.set(coordKey, {
                id: `L${String(this.currentLevel).padStart(2, '0')}-SP-${nextChar}`,
                rotation: 0,
                key: '/data/pngs/spawn/hologonk_1.png',
                properties: {}
            });
            this.statusMsg.textContent = `Placed spawn point ${spawnLayer.get(coordKey).id}.`;
        });
    }

    rotateItem(gridX, gridY) {
        const itemRef = this.findItemOnLayer(this.activeLayerName, gridX, gridY);
        if (itemRef) {
            const item = this.levelData[itemRef.layer].get(itemRef.key);
            if (item) {
                this.modifyState(() => {
                    item.rotation = ((item.rotation || 0) + 1) % 4;
                    this.statusMsg.textContent = `Rotated item at ${itemRef.key}.`;
                });
            }
        }
    }

    resetLayer() { if (this.levelData[this.activeLayerName].size > 0 && confirm(`Clear all items from the '${this.activeLayerName}' layer?`)) { this.modifyState(() => { this.levelData[this.activeLayerName].clear(); this.statusMsg.textContent = `Layer '${this.activeLayerName}' cleared.`; }); } }
    resetMap() { if (confirm('Clear the entire map? This cannot be undone.')) { this.modifyState(() => { this.layerOrder.forEach(layer => this.levelData[layer].clear()); this.statusMsg.textContent = 'Entire map cleared.'; }); } }

    onKeyDown(e) {
        if (e.ctrlKey) {
            if (e.key === 'z') { e.preventDefault(); this.undo(); }
            if (e.key === 'y') { e.preventDefault(); this.redo(); }
        }

        if (e.key === 'Escape') {
            if (this.vectorWallStart) { this.vectorWallStart = null; this.statusMsg.textContent = 'Vector wall drawing cancelled.'; this.render(); }
            if (this.placementPreview) { this.placementPreview = null; this.statusMsg.textContent = 'Overlay placement cancelled.'; this.render(); }
        }

        const panSpeed = 200 / this.zoom; let dx = 0, dy = 0;
        if (e.key === 'w') dy = panSpeed; if (e.key === 's') dy = -panSpeed;
        if (e.key === 'a') dx = panSpeed; if (e.key === 'd') dx = -panSpeed;
        if (dx !== 0 || dy !== 0) { this.panX += dx; this.panY += dy; this.render(); }
    }

    onMouseDown(e) {
        if (e.target.closest('#leftPanel, .floating-toolbar, .top-right-ui, #properties-panel, #utility-layers')) return; // Added #utility-layers

        if (this.activeLayerName === 'pillar' && e.button === 0) {
            const { x: worldX, y: worldY } = this.getMouseWorldCoords(e);
            const gs = this.gridSize;
            const gridX = Math.floor(worldX / gs);
            const gridY = Math.floor(worldY / gs);
            const fracX = worldX / gs - gridX;
            const fracY = worldY / gs - gridY;

            let newMode = 'center';
            if (fracX < 0.33 && fracY < 0.33) newMode = 'topLeft';
            else if (fracX > 0.66 && fracY < 0.33) newMode = 'topRight';
            else if (fracX < 0.33 && fracY > 0.66) newMode = 'bottomLeft';
            else if (fracX > 0.66 && fracY > 0.66) newMode = 'bottomRight';

            this.setPillarPlacementMode(newMode);

            const placementSelect = document.getElementById('pillar-placement-select');
            if (placementSelect) {
                placementSelect.value = newMode;
            }
        }

        this.lastMouse = { x: e.clientX, y: e.clientY };
        this.lastPlacedGrid = { x: null, y: null };

        if (e.button === 1) { this.isPanning = true; return; }

        if (e.button === 2) {
            e.preventDefault();
            if (this.activeTool === 'template' && this.isTemplateCloned) {
                this.isTemplateCloned = false;
                this.activeBrush = null;
                this.statusMsg.textContent = 'Template selection cleared.';
                this.ui.updatePalette();
                return;
            }
            const item = this.findHoveredItem(e);
            if (item) this.ui.showPropertiesPanel(item.key, item.data, item.layer);
            return;
        }

        if (e.button === 0) {
            this.isPainting = true;
            if(this.lineLayers.includes(this.activeLayerName) && this.wallDrawMode === 'grid' && this.hoveredDrawableLine) {
                this.dragPaintAxis = this.hoveredDrawableLine.type;
            }

            const { x: gridX, y: gridY } = this.getGridCoordsFromEvent(e);
            switch(this.activeTool) {
                case 'paint': this.handlePaintAction(e); break;
                case 'template': this.handleTemplateToolClick(gridX, gridY); break;
                case 'erase': const itemToErase = this.findHoveredItem(e); if(itemToErase) this.eraseItem(itemToErase); break;
                case 'rotate': this.rotateItem(gridX, gridY); break;
                case 'spawn': this.placeSpawn(gridX, gridY); break;
                case 'fill': this.bucketFill(gridX, gridY); break;
            }
        }
    }

    handleTemplateToolClick(gridX, gridY) {
        if (!this.isTemplateCloned) {
            this.cloneTemplateFromGrid(gridX, gridY);
        } else {
            this.placeTemplate(gridX, gridY);
        }
    }

    onMouseUp(e) {
        if (e.button === 1) this.isPanning = false;
        if (e.button === 0) {
            this.isPainting = false;
            this.lastPlacedGrid = { x: null, y: null };
            this.dragPaintAxis = null;
        }
    }

    onMouseMove(e) {
        if (this.isPanning) {
            const dx = e.clientX - this.lastMouse.x; const dy = e.clientY - this.lastMouse.y;
            this.panX += dx; this.panY += dy; this.lastMouse = { x: e.clientX, y: e.clientY };
            this.render(); return;
        }
        this.lastMouse = { x: e.clientX, y: e.clientY };
        const { x: gridX, y: gridY } = this.getGridCoordsFromEvent(e);
        document.getElementById('coords').textContent = `X: ${gridX}, Y: ${gridY}`;

        let needsRender = false;

        const oldHoveredItem = this.hoveredItem;
        this.hoveredItem = this.findHoveredItem(e);
        if (JSON.stringify(oldHoveredItem) !== JSON.stringify(this.hoveredItem)) needsRender = true;

        const oldDrawableLine = this.hoveredDrawableLine;
        this.updateHoveredDrawableLine(e);
        if (JSON.stringify(oldDrawableLine) !== JSON.stringify(this.hoveredDrawableLine)) needsRender = true;

        if (this.vectorWallStart) needsRender = true;
        if (this.placementPreview) { this.placementPreview.direction = this.getOverlayDirection(e, this.placementPreview.line); needsRender = true; }
        if (this.activeTool === 'template' && this.isTemplateCloned) needsRender = true;

        if (this.activeLayerName === 'pillar') {
            needsRender = true;
        }

        if (needsRender) this.render();

        if(this.isPainting) {
            if (gridX !== this.lastPlacedGrid.x || gridY !== this.lastPlacedGrid.y) {
                 switch(this.activeTool) {
                    case 'paint': if (!this.overlayLayers.includes(this.activeLayerName)) this.handlePaintAction(e); break;
                    case 'erase': const itemToErase = this.findHoveredItem(e); if(itemToErase) this.eraseItem(itemToErase); break;
                    case 'template': this.placeTemplate(gridX, gridY); break;
                }
                this.lastPlacedGrid = { x: gridX, y: gridY };
            }
        }
    }

    updateHoveredDrawableLine(e) {
        const drawableLayers = [...this.lineLayers, ...this.overlayLayers];
        if (!drawableLayers.includes(this.activeLayerName) || this.wallDrawMode !== 'grid') {
            this.hoveredDrawableLine = null;
            return;
        }

        const { x: worldX, y: worldY } = this.getMouseWorldCoords(e);
        const gs = this.gridSize;
        const gridX = Math.floor(worldX / gs);
        const gridY = Math.floor(worldY / gs);
        const fracX = worldX / gs - gridX;
        const fracY = worldY / gs - gridY;

        const lineTolerance = 0.4;
        const diagonalTolerance = 0.1;

        const dists = [
            { dist: fracY, line: { type: 'H', x: gridX, y: gridY - 1 } },
            { dist: 1 - fracY, line: { type: 'H', x: gridX, y: gridY } },
            { dist: fracX, line: { type: 'V', x: gridX - 1, y: gridY } },
            { dist: 1 - fracX, line: { type: 'V', x: gridX, y: gridY } }
        ];

        const closestH = (dists[0].dist < dists[1].dist) ? dists[0] : dists[1];
        const closestV = (dists[2].dist < dists[3].dist) ? dists[2] : dists[3];

        if (closestH.dist > lineTolerance && closestV.dist > lineTolerance) { this.hoveredDrawableLine = null; return; }
        if (Math.abs(closestH.dist - closestV.dist) < diagonalTolerance && closestH.dist < lineTolerance && closestV.dist < lineTolerance) { this.hoveredDrawableLine = null; return; }

        if (this.dragPaintAxis === 'H') this.hoveredDrawableLine = closestH.dist < lineTolerance ? closestH.line : null;
        else if (this.dragPaintAxis === 'V') this.hoveredDrawableLine = closestV.dist < lineTolerance ? closestV.line : null;
        else this.hoveredDrawableLine = (closestH.dist < closestV.dist) ? closestH.line : closestV.line;
    }

    onMouseWheel(e) {
        e.preventDefault();

        if (this.activeLayerName === 'elevation' && e.ctrlKey) {
            const step = e.deltaY > 0 ? -1 : 1;
            this.ui.updateElevationLevel(this.ui.elevationLevel + step);
        } else if (this.activeLayerName === 'ceiling' && e.ctrlKey) {
            const step = e.deltaY > 0 ? -1 : 1;
            this.ui.updateCeilingHeight(this.ui.ceilingHeight + step);
        } else if (this.activeLayerName === 'pillar' && e.ctrlKey) {
            const step = e.deltaY > 0 ? 1 : -1;
            this.ui.updatePillarHeight(this.ui.pillarHeight + step);
        }
        else {
            const zoomSpeed = 1.1; const oldZoom = this.zoom;
            this.zoom *= (e.deltaY < 0 ? zoomSpeed : 1 / zoomSpeed);
            this.zoom = Math.max(0.1, Math.min(10, this.zoom));
            const mouseX = e.clientX - this.canvas.getBoundingClientRect().left; const mouseY = e.clientY - this.canvas.getBoundingClientRect().top;
            this.panX = mouseX - (mouseX - this.panX) * (this.zoom / oldZoom); this.panY = mouseY - (mouseY - this.panY) * (this.zoom / oldZoom);
        }
        document.getElementById('zoom').textContent = `Zoom: ${Math.round(this.zoom * 100)}%`;
        this.render();
    }

    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.save();
        this.ctx.translate(this.panX, this.panY);
        this.ctx.scale(this.zoom, this.zoom);
        const activeLayerIndex = this.layerOrder.indexOf(this.activeLayerName);

        for (const layerName of this.layerOrder) {
            if (layerName === 'skybox') continue;

            const isTransparent = this.layerOrder.indexOf(layerName) > activeLayerIndex;

            this.ctx.save();
            let baseOpacity = (layerName === 'water') ? 0.6 : 1.0;
            this.ctx.globalAlpha = isTransparent ? baseOpacity * 0.35 : baseOpacity;

            const isLineLayer = this.lineLayers.includes(layerName) || this.overlayLayers.includes(layerName);

            if (layerName === 'spawns') this.renderSpawnLayer(this.levelData[layerName]);
            else if (isLineLayer) this.renderLineLayer(layerName, this.levelData[layerName]);
            else if (layerName === 'elevation') this.renderElevationLayer(this.levelData[layerName]);
            else this.renderTileLayer(layerName, this.levelData[layerName]);

            this.ctx.restore();
        }

        this.drawGridAndBorders();
        this.drawHoverAndVectorUI();
        this.drawPillarPlacementPreview();

        if (this.activeTool === 'template' && this.isTemplateCloned) {
            this.drawTemplatePreview();
        }

        if (this.activeLayerName === 'pillar') {
            this.drawPillarPlacementPreview();
        }

        this.ctx.restore();
    }

    drawTemplatePreview() {
        if (!this.activeTemplate.items) return;
        const { x: gridX, y: gridY } = this.getGridCoordsFromEvent({ clientX: this.lastMouse.x, clientY: this.lastMouse.y });
        const gs = this.gridSize;
        this.ctx.save();
        this.ctx.globalAlpha = 0.5;
        this.ctx.strokeStyle = '#61afef';
        this.ctx.lineWidth = 4 / this.zoom;
        this.ctx.strokeRect(gridX * gs, gridY*gs, gs * this.activeBrushSize, gs * this.activeBrushSize);
        this.ctx.restore();
    }

    drawGridAndBorders() { const gs = this.gridSize; this.ctx.lineWidth = 1 / this.zoom; this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'; this.ctx.beginPath(); for (let x = 0; x <= this.gridWidth; x++) { this.ctx.moveTo(x * gs, 0); this.ctx.lineTo(x * gs, this.gridHeight * gs); } for (let y = 0; y <= this.gridHeight; y++) { this.ctx.moveTo(0, y * gs); this.ctx.lineTo(this.gridWidth * gs, y * gs); } this.ctx.stroke(); this.ctx.strokeStyle = '#900'; this.ctx.lineWidth = 3 / this.zoom; this.ctx.strokeRect(0, 0, this.gridWidth * gs, this.gridHeight * gs); }

    drawPillarPlacementPreview() {
        if (this.activeLayerName !== 'pillar') return;

        const { x: gridX, y: gridY } = this.getGridCoordsFromEvent({ clientX: this.lastMouse.x, clientY: this.lastMouse.y });
        const gs = this.gridSize;
        const radius = 4 / this.zoom;

        const placements = {
            'center': { x: (gridX + 0.5) * gs, y: (gridY + 0.5) * gs },
            'topLeft': { x: gridX * gs, y: gridY * gs },
            'topRight': { x: (gridX + 1) * gs, y: gridY * gs },
            'bottomLeft': { x: gridX * gs, y: (gridY + 1) * gs },
            'bottomRight': { x: (gridX + 1) * gs, y: (gridY + 1) * gs }
        };

        for (const [mode, pos] of Object.entries(placements)) {
            this.ctx.beginPath();
            this.ctx.arc(pos.x, pos.y, radius, 0, 2 * Math.PI);
            if (mode === this.pillarPlacementMode) {
                this.ctx.fillStyle = 'rgba(255, 255, 0, 0.9)';
                this.ctx.fill();
            }
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
            this.ctx.stroke();
        }
    }

    drawHoverAndVectorUI() {
        const gs = this.gridSize;
        const drawableLayers = [...this.lineLayers, ...this.overlayLayers];
        if (this.hoveredDrawableLine && this.wallDrawMode === 'grid' && drawableLayers.includes(this.activeLayerName)) {
            this.ctx.strokeStyle = 'rgba(100, 180, 255, 0.7)'; this.ctx.lineWidth = 6 / this.zoom; this.ctx.lineCap = 'round';
            this.ctx.beginPath();
            if (this.hoveredDrawableLine.type === 'V') {
                this.ctx.moveTo((this.hoveredDrawableLine.x + 1) * gs, this.hoveredDrawableLine.y * gs); this.ctx.lineTo((this.hoveredDrawableLine.x + 1) * gs, (this.hoveredDrawableLine.y + 1) * gs);
            } else {
                this.ctx.moveTo(this.hoveredDrawableLine.x * gs, (this.hoveredDrawableLine.y + 1) * gs); this.ctx.lineTo((this.hoveredDrawableLine.x + 1) * gs, (this.hoveredDrawableLine.y + 1) * gs);
            }
            this.ctx.stroke(); this.ctx.lineCap = 'butt';
        }

        if (this.lineLayers.includes(this.activeLayerName) && this.wallDrawMode === 'vector') {
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.25)'; const pixelSize = 2 / this.zoom;
            for (let y = 0; y <= this.gridHeight; y++) for (let x = 0; x <= this.gridWidth; x++) this.ctx.fillRect(x * gs - pixelSize / 2, y * gs - pixelSize / 2, pixelSize, pixelSize);
            if (this.vectorWallStart) { const mousePos = this.getVertexCoordsFromEvent({clientX: this.lastMouse.x, clientY: this.lastMouse.y}); this.ctx.strokeStyle = 'rgba(100, 180, 255, 0.7)'; this.ctx.lineWidth = 4 / this.zoom; this.ctx.setLineDash([5 / this.zoom, 5 / this.zoom]); this.ctx.beginPath(); this.ctx.moveTo(this.vectorWallStart.x * gs, this.vectorWallStart.y * gs); this.ctx.lineTo(mousePos.x * gs, mousePos.y * gs); this.ctx.stroke(); this.ctx.setLineDash([]); }
        }

        if (this.placementPreview) this.drawOverlayPreview(this.placementPreview);
    }

    drawOverlayPreview(preview) {
        if (!this.activeBrush || !this.preloadedImages.get(this.activeBrush.key)) return;
        const img = this.preloadedImages.get(this.activeBrush.key);
        const gs = this.gridSize;
        const { line, direction } = preview;
        const wallThickness = Math.max(2, gs * 0.1);

        this.ctx.save();
        this.ctx.globalAlpha *= 0.7;

        if (line.type === 'V') {
            const posX = (line.x + 1) * gs - (direction * (wallThickness / 2 + 0.1));
            this.ctx.drawImage(img, posX - wallThickness / 2, line.y * gs, wallThickness, gs);
        } else { // 'H'
            const posY = (line.y + 1) * gs - (direction * (wallThickness / 2 + 0.1));
            this.ctx.drawImage(img, line.x * gs, posY - wallThickness / 2, gs, wallThickness);
        }

        this.ctx.restore();
        this.drawOverlayNubbin(line.type, line.x, line.y, direction, preview.layer === 'screen' ? 'yellow' : 'green', 1.0);
    }

    drawOverlayNubbin(lineType, x, y, direction, color, alpha = 0.5) {
        const gs = this.gridSize;
        const nubbinSize = Math.max(4 / this.zoom, 4);

        let centerX, centerY, angle;
        if (lineType === 'H') {
            centerX = (x + 0.5) * gs;
            centerY = (y + 1) * gs;
            angle = direction === 1 ? 0 : Math.PI;
        } else {
            centerX = (x + 1) * gs;
            centerY = (y + 0.5) * gs;
            angle = direction === 1 ? Math.PI * 0.5 : Math.PI * 1.5;
        }

        this.ctx.save();
        this.ctx.translate(centerX, centerY);
        this.ctx.rotate(angle);
        this.ctx.fillStyle = color;
        this.ctx.globalAlpha = alpha;
        this.ctx.beginPath();
        this.ctx.moveTo(0, nubbinSize);
        this.ctx.lineTo(nubbinSize, -nubbinSize);
        this.ctx.lineTo(-nubbinSize, -nubbinSize);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.restore();
    }

    renderLineLayer(layerName, items) {
        if (!items) return;
        const gs = this.gridSize;
        const wallThickness = Math.max(2, gs * 0.1);

        for(const [key, item] of items.entries()) {
            if (key.startsWith('VEC_')) {
                this.renderVectorWall(item);
            } else {
                this.renderGridWall(key, item, gs, wallThickness, layerName);
            }
        }
    }

    renderGridWall(key, item, gs, wallThickness, layerName) {
        const [type, xStr, zStr] = key.split('_');
        const x = Number(xStr);
        const z = Number(zStr);
        const img = this.preloadedImages.get(item.key);

        let visualThickness = wallThickness;
        if (item.properties?.level2) visualThickness *= 1.5;
        if (item.properties?.level3) visualThickness *= 1.5;

        this.ctx.save();
        if (img && !this.overlayLayers.includes(layerName)) {
            this.ctx.fillStyle = this.ctx.createPattern(img, 'repeat');
            if (type === 'V') {
                this.ctx.translate((x + 1) * gs, z * gs);
                this.ctx.fillRect(-visualThickness / 2, 0, visualThickness, gs);
            } else {
                this.ctx.translate(x * gs, (z + 1) * gs);
                this.ctx.fillRect(0, -visualThickness / 2, gs, visualThickness);
            }
        } else if (img && this.overlayLayers.includes(layerName)) {
            this.ctx.globalAlpha *= 0.8;
            const direction = item.properties?.direction || 1;
            if (type === 'V') {
                const posX = (x + 1) * gs - (direction * (wallThickness / 2 + 0.1));
                this.ctx.drawImage(img, posX - wallThickness / 2, z * gs, wallThickness, gs);
            } else {
                const posY = (z + 1) * gs - (direction * (wallThickness / 2 + 0.1));
                this.ctx.drawImage(img, x * gs, posY - wallThickness / 2, gs, wallThickness);
            }
        }
        else {
            this.ctx.strokeStyle = '#FFF'; this.ctx.lineWidth = 2 / this.zoom; this.ctx.beginPath();
            if (type === 'V') { this.ctx.moveTo((x + 1) * gs, z * gs); this.ctx.lineTo((x + 1) * gs, (z + 1) * gs); }
            else { this.ctx.moveTo(x * gs, (z + 1) * gs); this.ctx.lineTo((x + 1) * gs, (z + 1) * gs); }
            this.ctx.stroke();
        }
        this.ctx.restore();

        const colorMap = { 'wall': 'rgba(255, 0, 0, 0.8)', 'door': 'rgba(255, 255, 0, 0.8)', 'dock': 'rgba(0, 150, 255, 0.9)'};
        this.ctx.strokeStyle = colorMap[layerName] || 'rgba(255,255,255,0.5)';
        if (!this.overlayLayers.includes(layerName)) {
             this.ctx.lineWidth = 1 / this.zoom;
             this.ctx.beginPath();
             if (type === 'V') { this.ctx.moveTo((x + 1) * gs, z * gs); this.ctx.lineTo((x + 1) * gs, (z + 1) * gs); } else { this.ctx.moveTo(x * gs, (z + 1) * gs); this.ctx.lineTo((x + 1) * gs, (z + 1) * gs); }
             this.ctx.stroke();
        }

        const hasScreen = this.levelData['screen']?.has(key);
        const hasPanel = this.levelData['panel']?.has(key);
        let nubbinColor = null;
        if(hasScreen && hasPanel) { nubbinColor = '#00FFFF';
        } else if (hasScreen) { nubbinColor = '#FFFF00';
        } else if (hasPanel) { nubbinColor = '#00FF00';
        }
        if (nubbinColor) {
            const overlayItem = this.levelData[hasScreen ? 'screen' : 'panel'].get(key);
            const direction = overlayItem.properties?.direction || 1;
            this.drawOverlayNubbin(type, x, z, direction, nubbinColor);
        }
    }

    renderVectorWall(item) {
        const [x1_grid, y1_grid, x2_grid, y2_grid] = item.points;
        const x1 = x1_grid * this.gridSize, y1 = y1_grid * this.gridSize;
        const x2 = x2_grid * this.gridSize, y2 = y2_grid * this.gridSize;
        const img = this.preloadedImages.get(item.key);

        let wallThickness = Math.max(4, this.gridSize * 0.15) / this.zoom;
        if (item.properties?.level2) wallThickness *= 1.5;
        if (item.properties?.level3) wallThickness *= 1.5;

        const dx = x2 - x1, dy = y2 - y1;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        this.ctx.save(); this.ctx.translate(x1, y1); this.ctx.rotate(angle);
        if (img) { const pattern = this.ctx.createPattern(img, 'repeat'); this.ctx.fillStyle = pattern; } else { this.ctx.fillStyle = '#FFF'; }
        this.ctx.fillRect(0, -wallThickness / 2, length, wallThickness); this.ctx.restore();
        this.ctx.save(); this.ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)'; this.ctx.lineWidth = 1 / this.zoom; this.ctx.beginPath(); this.ctx.moveTo(x1, y1); this.ctx.lineTo(x2, y2); this.ctx.stroke(); this.ctx.restore();
    }

    renderTileLayer(layerName, items) {
        if (!items) return;
        const gs = this.gridSize;
        const occupied = new Set();
        for(const [key, item] of items.entries()){
            const [x, y] = key.split(',').map(Number);
            const size = item.size < 1 ? 1 : (item.size || 1);
            for(let yo=0; yo<size; yo++){
                for(let xo=0; xo<size; xo++){
                    occupied.add(`${x+xo},${y+yo}`);
                }
            }
        }

        const defaultTexInfo = this.defaultTextures[layerName];
        if (defaultTexInfo && defaultTexInfo.key) {
            const img = this.preloadedImages.get(defaultTexInfo.key);
            if (img) {
                const size = defaultTexInfo.size || 1;
                for (let y = 0; y < this.gridHeight; y += size) {
                    for (let x = 0; x < this.gridWidth; x += size) {
                         if (!occupied.has(`${x},${y}`)) {
                           this.ctx.drawImage(img, x * gs, y * gs, gs * size, gs * size);
                        }
                    }
                }
            }
        }

        for (const [coordKey, item] of items.entries()) {
            const [x, y] = coordKey.split(',').map(Number);
            const size = item.size || 1;
            let img = null;
            if (item.type === 'npc' || item.type === 'asset') {
                img = window[item.key + '_icon_img'];
            } else if (item.type === 'pillar') {
                const props = item.properties || {};
                const width = props.width || 11;
                const placement = props.placement || 'center';
                const radius = (gs * (width / 100)) / 2;

                let cx = (x + 0.5) * gs;
                let cy = (y + 0.5) * gs;

                if (placement === 'topLeft') {
                    cx = x * gs;
                    cy = y * gs;
                } else if (placement === 'topRight') {
                    cx = (x + 1) * gs;
                    cy = y * gs;
                } else if (placement === 'bottomLeft') {
                    cx = x * gs;
                    cy = (y + 1) * gs;
                } else if (placement === 'bottomRight') {
                    cx = (x + 1) * gs;
                    cy = (y + 1) * gs;
                }

                this.ctx.fillStyle = 'blue';
                this.ctx.beginPath();
                this.ctx.arc(cx, cy, radius, 0, 2 * Math.PI, false);
                this.ctx.fill();

                const height = props.height || 3;
                this.ctx.fillStyle = 'white';
                this.ctx.font = `bold ${gs * 0.25}px monospace`;
                this.ctx.textAlign = 'left';
                this.ctx.textBaseline = 'bottom';
                this.ctx.fillText(height, x * gs + 2, (y + 1) * gs - 2);

                continue;
            } else if (item.type === 'random_npc') {
                const factionColors = { Aliens: '#008000', Takers: '#C0C0C0', Droids: '#0066cc', Humans: '#b05c00', Mandalorians: '#FFC72C', Sith: '#990000', Imperials: '#444444', Clones: '#ff8c00' };
                const color = factionColors[item.properties.macroCategory] || '#555';
                
                this.ctx.fillStyle = color;
                this.ctx.fillRect(x * gs, y * gs, gs, gs);
                this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
                this.ctx.lineWidth = 2 / this.zoom;
                this.ctx.strokeRect(x * gs, y * gs, gs, gs);

                this.ctx.fillStyle = 'white';
                this.ctx.font = `bold ${gs * 0.6}px monospace`;
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText(`R${item.properties.threat}`, x * gs + gs / 2, y * gs + gs / 2);

                continue;
            } else {
                img = this.preloadedImages.get(item.key);
            }

            this.ctx.save();
            if (item.properties?.transparent) {
                this.ctx.globalAlpha *= 0.6;
            }

            if (img) {
                this.ctx.save();
                this.ctx.translate(x * gs, y * gs);

                if (size < 1 && !this.objectLayers.includes(layerName)) {
                    const repeat = 1 / size;
                    const tileSize = gs / repeat;
                    for (let yo = 0; yo < repeat; yo++) {
                        for (let xo = 0; xo < repeat; xo++) {
                            this.ctx.drawImage(img, xo * tileSize, yo * tileSize, tileSize, tileSize);
                        }
                    }
                } else {
                    let drawSize = gs * size;
                    let centerX = drawSize / 2;
                    let centerY = drawSize / 2;
                    if (layerName === 'npcs') {
                        drawSize *= 0.75;
                         centerX = (gs * size) / 2;
                         centerY = (gs * size) - (drawSize / 2);
                    }
                    this.ctx.translate(centerX, centerY);
                    if (item.rotation) this.ctx.rotate(item.rotation * Math.PI / 2);
                    this.ctx.drawImage(img, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
                }
                this.ctx.restore();
            }
            this.ctx.restore();
        }
    }

    renderElevationLayer(items) {
        if (!items) return;
        const gs = this.gridSize;

        for (const [coordKey, item] of items.entries()) {
            const [x, y] = coordKey.split(',').map(Number);
            const size = item.size || 1;
            const elevationLevel = item.properties.elevation;
            const wallTextureName = item.properties.wallsideTexture;
            const wallImg = this.preloadedImages.get(wallTextureName);
            const elevationImg = this.preloadedImages.get(item.key);

            if (elevationImg) {
                this.ctx.drawImage(elevationImg, x * gs, y * gs, gs * size, gs * size);
            } else {
                 this.ctx.fillStyle = '#404';
                 this.ctx.fillRect(x * gs, y * gs, gs * size, gs * size);
            }

            if (wallImg) {
                 const neighborOffsets = [
                     { x: size, z: 0, dir: 'right', rot: Math.PI / 2 },
                     { x: -1, z: 0, dir: 'left', rot: -Math.PI / 2 },
                     { x: 0, z: size, dir: 'down', rot: Math.PI },
                     { x: 0, z: -1, dir: 'up', rot: 0 },
                 ];

                 for(const offset of neighborOffsets) {
                     let neighborElevation = 0;
                     const neighbor = this.levelData.elevation.get(`${x + offset.x},${y + offset.z}`);
                     if (neighbor && neighbor.properties && neighbor.properties.elevation) {
                         neighborElevation = neighbor.properties.elevation;
                     }
                     if (neighborElevation < elevationLevel) {
                         const wallHeight = (elevationLevel - neighborElevation) * gs * 0.25;
                         this.ctx.save();
                         this.ctx.globalAlpha *= 0.8;
                         this.ctx.translate(x * gs + gs/2, y * gs + gs/2);
                         this.ctx.rotate(offset.rot);
                         this.ctx.drawImage(wallImg, -gs/2, 0, gs, wallHeight);
                         this.ctx.restore();
                     }
                 }
            }
        }
    }

    renderSpawnLayer(items) {
        if (!items) return;
        const gs = this.gridSize;
        const arrowImg = this.preloadedImages.get('/data/pngs/icons for UI/spawn_arrow.png');

        for (const [coordKey, item] of items.entries()) {
            const [x, y] = coordKey.split(',').map(Number);
            const img = this.preloadedImages.get(item.key);

            if (img) { this.ctx.drawImage(img, x * gs, y * gs, gs, gs); }
            if (arrowImg) { this.ctx.save(); this.ctx.translate(x * gs + gs / 2, y * gs + gs / 2); this.ctx.rotate(item.rotation * Math.PI / 2); this.ctx.drawImage(arrowImg, -gs / 2, -gs / 2, gs, gs); this.ctx.restore(); }
        }
    }

    findAllItemsAt(gridX, gridY) {
        const foundItems = [];
        const topDownLayerOrder = ['sky', 'ceiling', 'dangler', 'spawns', 'npcs', 'assets', 'pillar', 'wall', 'door', 'dock', 'screen', 'panel', 'floater', 'decor', 'floor', 'water', 'subfloor', 'elevation'];

        for (const layerName of topDownLayerOrder) {
            const item = this.findItemOnLayer(layerName, gridX, gridY);
            if (item) {
                foundItems.push(item);
            }
        }
        return foundItems;
    }

    findHoveredItem(e) {
        const { x: gridX, y: gridY } = this.getGridCoordsFromEvent(e);

        // Tier 1: Always check the active layer first. If something is there, select it.
        const itemOnActiveLayer = this.findItemOnLayer(this.activeLayerName, gridX, gridY);
        if (itemOnActiveLayer) {
            return itemOnActiveLayer;
        }

        // Tier 2: If the active layer is empty at this spot, find all items and prioritize interactive ones.
        const allItems = this.findAllItemsAt(gridX, gridY);
        if (allItems.length === 0) {
            return null;
        }

        const importantLayers = ['spawns', 'npcs', 'dock'];
        const importantItem = allItems.find(item => importantLayers.includes(item.layer));

        // Return the important item if found, otherwise return the topmost item.
        return importantItem || allItems[0];
    }

    findItemOnLayer(layerName, gridX, gridY) {
        const layer = this.levelData[layerName];
        if (!layer) return null;

        if (this.tileLayers.includes(layerName) || this.objectLayers.includes(layerName)) {
            for (const [key, item] of layer.entries()) {
                const [ix, iy] = key.split(',').map(Number);
                const size = item.size < 1 ? 1 : (item.size || 1);
                if (gridX >= ix && gridX < ix + size && gridY >= iy && gridY < iy + size) {
                    return { layer: layerName, key, data: item };
                }
            }
        } else if (this.lineLayers.includes(layerName) || this.overlayLayers.includes(layerName)) {
             const { x: worldX, y: worldY } = this.getMouseWorldCoords({ clientX: this.lastMouse.x, clientY: this.lastMouse.y });
             const hoveredGridLine = this.getHoveredGridLine(worldX, worldY);
             if (hoveredGridLine) {
                 const lineKey = `${hoveredGridLine.line.type}_${hoveredGridLine.line.x}_${hoveredGridLine.line.y}`;
                 if (layer.has(lineKey)) {
                     return { layer: layerName, key: lineKey, data: layer.get(lineKey), line: hoveredGridLine.line };
                 }
             }
        }
        return null;
    }


    getHoveredGridLine(worldX, worldY) {
        const gs = this.gridSize; const gridX = Math.floor(worldX / gs); const gridY = Math.floor(worldY / gs);
        const fracX = worldX / gs - gridX; const fracY = worldY / gs - gridY;
        const tolerance = 0.4;
        const dists = [
            { dist: fracY, line: { type: 'H', x: gridX, y: gridY - 1 } },
            { dist: 1 - fracY, line: { type: 'H', x: gridX, y: gridY } },
            { dist: fracX, line: { type: 'V', x: gridX - 1, y: gridY } },
            { dist: 1 - fracX, line: { type: 'V', x: gridX, y: gridY } }
        ].filter(d => d.dist < tolerance).sort((a,b) => a.dist - b.dist);
        return dists.length > 0 ? dists[0] : null;
    }

    hasWallBetween(x1, y1, x2, y2) { const walls = this.levelData['wall']; if (!walls) return false; if (x1 !== x2) { const wallX = Math.min(x1, x2); if (walls.has(`V_${wallX}_${y1}`)) return true; } else { const wallY = Math.min(y1, y2); if (walls.has(`H_${x1}_${wallY}`)) return true; } const cx1 = (x1 + 0.5) * this.gridSize, cy1 = (y1 + 0.5) * this.gridSize; const cx2 = (x2 + 0.5) * this.gridSize, cy2 = (y2 + 0.5) * this.gridSize; for (const [key, wall] of walls.entries()) { if (!key.startsWith('VEC_')) continue; const [wx1, wy1, wx2, wy2] = wall.points.map(p => p * this.gridSize); if (this.lineSegmentsIntersect(cx1, cy1, cx2, cy2, wx1, wy1, wx2, wy2)) return true; } return false; }

    bucketFill(startX, startY) {
        if (!this.activeBrush || !this.tileLayers.includes(this.activeLayerName)) return;
        const layer = this.levelData[this.activeLayerName];
        if (layer.has(`${startX},${startY}`)) return;

        this.modifyState(() => {
            const q = [[startX, startY]];
            const visited = new Set([`${startX},${startY}`]);

            while (q.length > 0) {
                const [x, y] = q.shift();

                const neighbors = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
                for (const [nx, ny] of neighbors) {
                    const key = `${nx},${ny}`;
                    if (nx < 0 || nx >= this.gridWidth || ny < 0 || ny >= this.gridHeight || visited.has(key) || this.hasWallBetween(x, y, nx, ny)) continue;

                    let isOccupied = false;
                    for(const [itemKey, item] of layer.entries()){
                        const [ix, iy] = itemKey.split(',').map(Number);
                        const isize = item.size || 1;
                        if(nx >= ix && nx < ix+isize && ny >= iy && ny < iy+isize){ isOccupied = true; break;}
                    }
                    if(isOccupied) continue;

                    visited.add(key);
                    q.push([nx, ny]);
                }
            }

            const placedCoords = new Set();
            for (const coord of visited) {
                const [x, y] = coord.split(',').map(Number);
                if (placedCoords.has(`${x},${y}`)) continue;

                const size = this.activeBrushSize;
                let canPlaceFullSize = true;
                const blockCoords = [];
                if (size > 1) {
                    for(let yo=0; yo < size; yo++) {
                        for(let xo=0; xo < size; xo++){
                            const curCoord = `${x+xo},${y+yo}`;
                            if(!visited.has(curCoord) || this.levelData[this.activeLayerName].has(curCoord)) {
                                canPlaceFullSize = false; break;
                            }
                            blockCoords.push(curCoord);
                        }
                        if(!canPlaceFullSize) break;
                    }
                } else {
                    blockCoords.push(coord);
                }

                if(canPlaceFullSize){
                    this.placeItem(x, y, size);
                    blockCoords.forEach(c => placedCoords.add(c));
                } else {
                    this.placeItem(x, y, 1);
                }
            }
            this.statusMsg.textContent = `Fill completed.`;
        });
    }

    segmentsOverlap(p1, p2, p3, p4) { const EPS = 1e-9; const o = (p, q, r) => { const v = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y); return Math.abs(v) < EPS ? 0 : (v > 0 ? 1 : 2); }; if (o(p1, p2, p3) === 0 && o(p1, p2, p4) === 0) { return Math.max(p1.x, p3.x) < Math.min(p2.x, p4.x) - EPS || Math.max(p1.y, p3.y) < Math.min(p2.y, p4.y) - EPS; } return false; }
    lineSegmentsIntersect(x1, y1, x2, y2, x3, y3, x4, y4) { const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4); if (den === 0) return false; const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den; const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / den; return t > 0 && t < 1 && u > 0 && u < 1; }
    pointToSegmentDistance(px, py, x1, y1, x2, y2) { const l2 = (x2 - x1)**2 + (y2 - y1)**2; if (l2 === 0) return Math.hypot(px-x1, py-y1); let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2; t = Math.max(0, Math.min(1, t)); const projX = x1 + t * (x2 - x1); const projY = y1 + t * (y2 - y1); return Math.hypot(px-projX, py-y1); }

    getLevelDataObject() {
        const levelObject = { settings: { width: this.gridWidth, height: this.gridHeight, defaults: this.defaultTextures }, layers: {} };
        for (const layerName of this.layerOrder) {
            const layerMap = this.levelData[layerName];
            if (layerMap.size > 0) {
                if (this.tileLayers.includes(layerName)) {
                    const defaultKey = this.defaultTextures[layerName]?.key;
                    // Explicitly filter out any tile that uses the default texture for that layer.
                    const customTiles = Array.from(layerMap.entries()).filter(([key, item]) => {
                        return item.key !== defaultKey;
                    });
                    if (customTiles.length > 0) {
                        levelObject.layers[layerName] = customTiles;
                    }
                } else {
                    levelObject.layers[layerName] = Array.from(layerMap.entries());
                }
            }
        }
        return levelObject;
    }

    async saveLevel() {
        const levelDataToSave = this.getLevelDataObject();
        const jsonString = JSON.stringify(levelDataToSave, null, 2);
        const path = `data/levels/level_${this.currentLevel}.json`;
        const existingFile = await fetch(path).then(res => res.ok).catch(() => false);
        if (existingFile && !confirm(`A file for level ${this.currentLevel} already exists. Overwrite?`)) { this.statusMsg.textContent = `Save cancelled.`; return; }
        const blob = new Blob([jsonString], { type: 'application/json' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `level_${this.currentLevel}.json`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(a.href); this.isLevelDirty = false; this.history = [this.cloneLevelData(this.levelData)]; this.historyIndex = 0; this.statusMsg.textContent = `Level ${this.currentLevel} saved.`;
    }

    saveCharacterData() {
        if (!this.assetManager.isCharacterDataDirty) {
            this.statusMsg.textContent = "No changes to character data to save.";
            return;
        }
        const jsonString = JSON.stringify(this.assetManager.npcGroups, null, 4);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `character_definitions_updated.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
        this.assetManager.isCharacterDataDirty = false;
        this.ui.updateSaveCharacterButtonState(false);
        this.statusMsg.textContent = `Updated character data saved. Please replace the master file.`;
    }

    async loadLevel(levelNum, isInitialLoad = false) {
        if (!isInitialLoad && this.isLevelDirty && !confirm('Discard unsaved changes?')) return;
        this.currentLevel = levelNum;
        const path = `/data/levels/level_${levelNum}.json`;
        try {
            const response = await fetch(path);
            if (!response.ok) throw new Error('Level not found.');
            const data = await response.json();
            this.applyLoadedData(data);
            this.statusMsg.textContent = `Level ${levelNum} loaded.`;
        } catch (err) {
            console.warn(err); this.statusMsg.textContent = `No saved file for Level ${levelNum}. Starting new level from template.`;
            const templateData = this.applyLevelTemplate(levelNum);
            this.applyLoadedData(templateData);
        }
        this.isLevelDirty = false; this.history = [this.cloneLevelData(this.levelData)]; this.historyIndex = 0; this.ui.updateUIForNewLevel(); this.render();
    }

    applyLoadedData(data) {
        this.gridWidth = data.settings?.width || 64; this.gridHeight = data.settings?.height || 64;
        this.defaultTextures = data.settings?.defaults || this.defaultTextures; this.ui.updateSettingsUI();
        this.layerOrder.forEach(layer => this.levelData[layer].clear());
        const loadedLayers = data.layers || data || {};
        for (const layerName in loadedLayers) {
            if (this.levelData.hasOwnProperty(layerName)) {
                this.levelData[layerName] = new Map(loadedLayers[layerName]);
            }
        }
    }
}

window.addEventListener('DOMContentLoaded', () => { new LevelEditor(); });