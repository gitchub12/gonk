// BROWSERFIREFOXHIDE editor.js 
// Corrected pluralization bug in placeAutoSpawnForDock and added spawn logic for vector docks.

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
        
        this.activeTool = 'paint';
        this.wallDrawMode = 'grid';
        this.vectorWallStart = null;
        this.activeTileSize = 1;
        this.activeBrush = null;
        
        this.hoveredItem = null; // An existing item on the map
        this.hoveredDrawableLine = null; // A potential place to draw a new line
        this.layerOrder = ['subfloor', 'floor', 'water', 'floater', 'decor', 'npcs', 'assets', 'wall', 'door', 'dock', 'spawns', 'tapestry', 'dangler', 'ceiling', 'sky'];
        this.tileLayers = ['subfloor', 'floor', 'water', 'floater', 'decor', 'dangler', 'ceiling', 'sky'];
        this.objectLayers = ['npcs', 'assets', 'spawns'];
        this.lineLayers = ['wall', 'door', 'dock', 'tapestry'];
        this.activeLayerName = 'floor';
        
        this.levelData = {}; this.layerOrder.forEach(layer => this.levelData[layer] = new Map());
        this.defaultTextures = {};
        this.preloadedImages = new Map();
        this.currentLevel = 1; this.isLevelDirty = false;
        this.history = []; this.historyIndex = -1;
        this.levelTemplates = {};
        
        this.init();
    }

    async init() {
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        this.canvas.addEventListener('mousedown', e => this.onMouseDown(e));
        document.addEventListener('mousemove', e => this.onMouseMove(e));
        document.addEventListener('mouseup', e => this.onMouseUp(e));
        this.canvas.addEventListener('wheel', e => this.onMouseWheel(e));
        document.addEventListener('contextmenu', e => e.preventDefault());
        document.addEventListener('keydown', e => this.onKeyDown(e));
        
        document.getElementById('tool-wall-mode').addEventListener('click', () => this.toggleWallMode());
        document.getElementById('tool-tile-size').addEventListener('click', () => this.cycleTileSize());

        await this.assetManager.discoverAssets();
        await this.preloadAllTextures();
        this.ui.init();
        await this.loadLevelTemplates();
        await this.loadLevel(this.currentLevel, true);
    }
    
    async loadLevelTemplates() {
        try {
            const response = await fetch('/data/level_templates.json');
            if (!response.ok) throw new Error('Level templates not found');
            const data = await response.json();
            this.levelTemplates = data.templates;
        } catch (err) {
            console.error('Failed to load level templates:', err);
        }
    }

    applyLevelTemplate(levelNum) {
        const levelData = {};
        this.layerOrder.forEach(layer => levelData[layer] = new Map());

        const templateKey = levelNum > 1 ? 'default-b' : 'initial';
        const template = this.levelTemplates[templateKey];
        if (!template) {
            this.statusMsg.textContent = `No template found for level ${levelNum}.`;
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
        this.render();
    }
    
    cycleTileSize() {
        const button = document.getElementById('tool-tile-size');
        const img = button.querySelector('img');
        const sizes = [1, 2, 4];
        const currentIdx = sizes.indexOf(this.activeTileSize);
        this.activeTileSize = sizes[(currentIdx + 1) % sizes.length];
        
        const icons = { 1: 'tilesize', 2: '2x', 4: '4x' };
        img.src = `/data/pngs/icons for UI/${icons[this.activeTileSize]}.png`;
        this.statusMsg.textContent = `Tile Size: ${this.activeTileSize}x${this.activeTileSize}`;
        this.render();
    }

    async preloadAllTextures() {
        const allPaths = new Set(['/data/pngs/icons for UI/crate.png', '/data/pngs/icons for UI/spawn_arrow.png']);
        Object.values(this.assetManager.layerTextures).forEach(arr => arr.forEach(path => allPaths.add(path)));
        const promises = [...allPaths].map(path => new Promise(resolve => {
            const img = new Image(); img.src = path;
            img.onload = () => { this.preloadedImages.set(path, img); resolve(); };
            img.onerror = () => { console.error(`Failed to preload image: ${path}`); resolve(); }
        }));
        await Promise.all(promises);
    }
    
    cloneLevelData(data) { const clone = {}; for (const key in data) clone[key] = new Map(data[key]); return clone; }
    saveStateToHistory() { if (this.historyIndex < this.history.length - 1) this.history.splice(this.historyIndex + 1); this.history.push(this.cloneLevelData(this.levelData)); this.historyIndex++; }
    undo() { if (this.historyIndex > 0) { this.historyIndex--; this.levelData = this.cloneLevelData(this.history[this.historyIndex]); this.render(); this.statusMsg.textContent = 'Undo'; } }
    redo() { if (this.historyIndex < this.history.length - 1) { this.historyIndex++; this.levelData = this.cloneLevelData(this.history[this.historyIndex]); this.render(); this.statusMsg.textContent = 'Redo'; } }
    modifyState(modificationAction) { this.saveStateToHistory(); modificationAction(); this.isLevelDirty = true; this.render(); }
    resizeCanvas() { const container = document.getElementById('canvasContainer'); this.canvas.width = container.clientWidth; this.canvas.height = container.clientHeight; this.render(); }
    getMouseWorldCoords(e) { const rect = this.canvas.getBoundingClientRect(); const mouseX = e.clientX - rect.left; const mouseY = e.clientY - rect.top; return { x: (mouseX - this.panX) / this.zoom, y: (mouseY - this.panY) / this.zoom }; }
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

    placeItem(gridX, gridY) {
        if (!this.activeBrush || (this.activeBrush.type === 'texture' && !this.activeBrush.key)) return;
        const activeLayerName = this.activeLayerName;
        const size = this.tileLayers.includes(activeLayerName) ? this.activeTileSize : 1;
        this.modifyState(() => {
            const layer = this.levelData[activeLayerName];
            if (size > 1) {
                for (let yo = 0; yo < size; yo++) for (let xo = 0; xo < size; xo++) layer.delete(`${gridX + xo},${gridY + yo}`);
            }
            const item = { type: this.activeBrush.type, key: this.activeBrush.key, rotation: 0 };
            if (size > 1) item.size = size;
            layer.set(`${gridX},${gridY}`, item);
            this.statusMsg.textContent = `Placed ${this.activeBrush.key.split('/').pop()}`;
        });
    }

    handlePaintAction(e) {
        const activeLayerName = this.activeLayerName;

        if (this.lineLayers.includes(activeLayerName) && this.wallDrawMode === 'vector') {
            const {x: vX, y: vY} = this.getVertexCoordsFromEvent(e);
            this.placeVectorWallVertex(vX, vY);
        } else if (this.lineLayers.includes(activeLayerName) && this.wallDrawMode === 'grid') {
             if (!this.hoveredDrawableLine) return;
             const currentCoord = `${this.hoveredDrawableLine.type}_${this.hoveredDrawableLine.x}_${this.hoveredDrawableLine.y}`;
             this.modifyState(() => {
                 const itemData = { type: 'texture', key: this.activeBrush.key, properties: {} };
                 if(activeLayerName === 'dock') {
                     itemData.properties.target = `TO LEVEL ${String(this.currentLevel+1).padStart(2,'0')}A`;
                     this.placeAutoSpawnForDock(this.hoveredDrawableLine, currentCoord);
                 }
                 this.levelData[activeLayerName].set(currentCoord, itemData);
             });
        } else { // Tile and Object layers
            const { x: gridX, y: gridY } = this.getGridCoordsFromEvent(e);
            this.placeItem(gridX, gridY);
        }
    }

    placeAutoSpawnForDock(dockLine, dockKey) {
        let spawnX, spawnY, rotation;
        const { type, x, y } = dockLine;

        if (type === 'H') { // Horizontal dock
            spawnX = x;
            spawnY = y + (y < this.gridHeight / 2 ? 1 : -1);
            rotation = y < this.gridHeight / 2 ? 2 : 0;
        } else { // Vertical dock
            spawnY = y;
            spawnX = x + (x < this.gridWidth / 2 ? 1 : -1);
            rotation = x < this.gridWidth / 2 ? 1 : 3;
        }
        
        const spawnKey = `${spawnX},${spawnY}`;
        const spawnLayer = this.levelData['spawns'];
        if (spawnLayer.has(spawnKey)) return;

        // Note: The dock hasn't been added to the map yet because this is inside the modifyState callback.
        // We get it from the arguments, not by reading from the map.
        const dockData = this.levelData['dock'].get(dockKey);
        if(dockData && dockData.properties) {
            dockData.properties.autoSpawnFor = spawnKey;
        }
       
        spawnLayer.set(spawnKey, {
            id: `FROM LEVEL ${String(this.currentLevel + 1).padStart(2, '0')}`,
            rotation: rotation,
            key: '/data/pngs/spawn/hologonk_1.png',
            properties: { autoPlaced: true, parentDock: dockKey }
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
            this.modifyState(() => {
                const itemData = { 
                    type: 'vector', 
                    points: [this.vectorWallStart.x, this.vectorWallStart.y, vX, vY], 
                    key: this.activeBrush.key,
                    properties: {}
                };
                const itemKey = `VEC_${Date.now()}_${Math.random()}`;
                if(this.activeLayerName === 'dock') {
                    itemData.properties.target = `TO LEVEL ${String(this.currentLevel+1).padStart(2,'0')}A`;
                    // For vector docks, place the spawn near the midpoint
                    const midX = Math.round((this.vectorWallStart.x + vX) / 2);
                    const midY = Math.round((this.vectorWallStart.y + vY) / 2);
                    // Determine if it's more horizontal or vertical to guess spawn position
                    const isHorizontal = Math.abs(vX - this.vectorWallStart.x) > Math.abs(vY - this.vectorWallStart.y);
                    const spawnLine = isHorizontal ? {type: 'H', x: midX, y: midY} : {type: 'V', x: midX, y: midY};
                    this.placeAutoSpawnForDock(spawnLine, itemKey);
                }
                this.levelData[this.activeLayerName].set(itemKey, itemData);
                this.statusMsg.textContent = `Placed vector segment.`;
            });
            this.vectorWallStart = { x: vX, y: vY };
        }
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
                key: '/data/pngs/spawn/hologonk_1.png'
            });
            this.statusMsg.textContent = `Placed spawn point ${spawnLayer.get(coordKey).id}.`;
        });
    }

    rotateItem(gridX, gridY) { const item = this.levelData[this.activeLayerName].get(`${gridX},${gridY}`); if (item) { this.modifyState(() => { item.rotation = (item.rotation + 1) % 4; this.statusMsg.textContent = `Rotated item at ${gridX},${gridY}.`; }); } }
    resetLayer() { if (this.levelData[this.activeLayerName].size > 0 && confirm(`Clear all items from the '${this.activeLayerName}' layer?`)) { this.modifyState(() => { this.levelData[this.activeLayerName].clear(); this.statusMsg.textContent = `Layer '${this.activeLayerName}' cleared.`; }); } }
    resetMap() { if (confirm('Clear the entire map? This cannot be undone.')) { this.modifyState(() => { this.layerOrder.forEach(layer => this.levelData[layer].clear()); this.statusMsg.textContent = 'Entire map cleared.'; }); } }
    onKeyDown(e) { 
        if (e.ctrlKey) { 
            if (e.key === 'z') { e.preventDefault(); this.undo(); } 
            if (e.key === 'y') { e.preventDefault(); this.redo(); } 
        } 
        
        if (e.key === 'Escape' && this.vectorWallStart) { 
            this.vectorWallStart = null; this.statusMsg.textContent = 'Vector wall drawing cancelled.'; this.render(); 
        }

        const panSpeed = 10 / this.zoom;
        let dx = 0, dy = 0;
        if (e.key === 'w') dy = panSpeed;
        if (e.key === 's') dy = -panSpeed;
        if (e.key === 'a') dx = panSpeed;
        if (e.key === 'd') dx = -panSpeed;
        if (dx !== 0 || dy !== 0) {
            this.panX += dx;
            this.panY += dy;
            this.render();
        }
    }

    onMouseDown(e) {
        if (e.target.closest('#leftPanel, .floating-toolbar, .top-right-ui, #properties-panel, #context-menu')) return;
        this.ui.hideContextMenu();
        this.lastMouse = { x: e.clientX, y: e.clientY };
        
        if (e.button === 1) { this.isPanning = true; return; }
        
        if (e.button === 2) { 
            e.preventDefault();
            const item = this.findHoveredItem(e);
            if (item) {
                this.ui.showContextMenu(e, item.key, item.data, item.layer);
            }
            return; 
        }

        if (e.button === 0) {
            this.isPainting = true;
            const { x: gridX, y: gridY } = this.getGridCoordsFromEvent(e);
            switch(this.activeTool) {
                case 'paint': this.handlePaintAction(e); break;
                case 'erase': 
                    const itemToErase = this.findHoveredItem(e);
                    if(itemToErase) this.eraseItem(itemToErase);
                    break;
                case 'rotate': this.rotateItem(gridX, gridY); break;
                case 'spawn': this.placeSpawn(gridX, gridY); break;
                case 'fill': this.bucketFill(gridX, gridY); break;
            }
        }
    }

    onMouseUp(e) { if (e.button === 1) this.isPanning = false; if (e.button === 0) this.isPainting = false; }
    
    onMouseMove(e) {
        if (this.isPanning) {
            const dx = e.clientX - this.lastMouse.x; const dy = e.clientY - this.lastMouse.y;
            this.panX += dx; this.panY += dy; this.lastMouse = { x: e.clientX, y: e.clientY };
            this.render(); return;
        }
        this.lastMouse = { x: e.clientX, y: e.clientY };
        const { x, y } = this.getGridCoordsFromEvent(e);
        document.getElementById('coords').textContent = `X: ${x}, Y: ${y}`;
        
        let needsRender = false;
        
        const oldHoveredItem = this.hoveredItem;
        this.hoveredItem = this.findHoveredItem(e);
        if (JSON.stringify(oldHoveredItem) !== JSON.stringify(this.hoveredItem)) needsRender = true;

        const oldDrawableLine = this.hoveredDrawableLine;
        this.updateHoveredDrawableLine(e);
        if (JSON.stringify(oldDrawableLine) !== JSON.stringify(this.hoveredDrawableLine)) needsRender = true;
        
        if (this.vectorWallStart) needsRender = true;
        if (needsRender) this.render();

        if(this.isPainting) switch(this.activeTool) {
            case 'paint': this.handlePaintAction(e); break;
            case 'erase':
                const itemToErase = this.findHoveredItem(e);
                if(itemToErase) this.eraseItem(itemToErase);
                break;
        }
    }

    updateHoveredDrawableLine(e) {
        if (!this.lineLayers.includes(this.activeLayerName) || this.wallDrawMode !== 'grid') {
            this.hoveredDrawableLine = null;
            return;
        }
        const { x: worldX, y: worldY } = this.getMouseWorldCoords(e);
        const gs = this.gridSize;
        const gridX = Math.floor(worldX / gs);
        const gridY = Math.floor(worldY / gs);
        const fracX = worldX / gs - gridX;
        const fracY = worldY / gs - gridY;
        const tolerance = 0.25;

        const dists = [
            { id: 'top', type: 'H', dist: fracY, line: { type: 'H', x: gridX, y: gridY - 1 } },
            { id: 'bottom', type: 'H', dist: 1 - fracY, line: { type: 'H', x: gridX, y: gridY } },
            { id: 'left', type: 'V', dist: fracX, line: { type: 'V', x: gridX - 1, y: gridY } },
            { id: 'right', type: 'V', dist: 1 - fracX, line: { type: 'V', x: gridX, y: gridY } }
        ];

        const closestH = dists.filter(d => d.type === 'H').sort((a,b) => a.dist - b.dist)[0];
        const closestV = dists.filter(d => d.type === 'V').sort((a,b) => a.dist - b.dist)[0];
        
        let newHoveredLine = null;
        if (closestH.dist < tolerance && closestV.dist < tolerance) {
            newHoveredLine = null;
        } else if (closestH.dist < tolerance && closestH.dist < closestV.dist) {
            newHoveredLine = closestH.line;
        } else if (closestV.dist < tolerance && closestV.dist < closestH.dist) {
            newHoveredLine = closestV.line;
        }
        this.hoveredDrawableLine = newHoveredLine;
    }

    onMouseWheel(e) {
        e.preventDefault();
        const zoomSpeed = 1.1; const oldZoom = this.zoom;
        this.zoom *= (e.deltaY < 0 ? zoomSpeed : 1 / zoomSpeed);
        this.zoom = Math.max(0.1, Math.min(10, this.zoom));
        const mouseX = e.clientX - this.canvas.getBoundingClientRect().left; const mouseY = e.clientY - this.canvas.getBoundingClientRect().top;
        this.panX = mouseX - (mouseX - this.panX) * (this.zoom / oldZoom); this.panY = mouseY - (mouseY - this.panY) * (this.zoom / oldZoom);
        document.getElementById('zoom').textContent = `Zoom: ${Math.round(this.zoom * 100)}%`;
        this.render();
    }

    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); this.ctx.save();
        this.ctx.translate(this.panX, this.panY); this.ctx.scale(this.zoom, this.zoom);
        const activeLayerIndex = this.layerOrder.indexOf(this.activeLayerName);
        for (let i = 0; i < this.layerOrder.length; i++) {
            const layerName = this.layerOrder[i];
            const isLineLayer = this.lineLayers.includes(layerName);
            const isTransparent = i > activeLayerIndex && !['wall', 'door', 'dock'].includes(layerName);
            if (isTransparent) this.ctx.globalAlpha = 0.35;
            
            if(layerName === 'spawns') this.renderSpawnLayer(this.levelData[layerName]);
            else if (isLineLayer) this.renderLineLayer(layerName, this.levelData[layerName]);
            else this.renderTileLayer(layerName, this.levelData[layerName]);
            
            if (isTransparent) this.ctx.globalAlpha = 1.0;
        }
        this.drawGridAndBorders();
        this.drawHoverAndVectorUI();
        this.ctx.restore();
    }
    
    drawGridAndBorders() { const gs = this.gridSize; this.ctx.lineWidth = 1 / this.zoom; this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'; this.ctx.beginPath(); for (let x = 0; x <= this.gridWidth; x++) { this.ctx.moveTo(x * gs, 0); this.ctx.lineTo(x * gs, this.gridHeight * gs); } for (let y = 0; y <= this.gridHeight; y++) { this.ctx.moveTo(0, y * gs); this.ctx.lineTo(this.gridWidth * gs, y * gs); } this.ctx.stroke(); this.ctx.strokeStyle = '#900'; this.ctx.lineWidth = 3 / this.zoom; this.ctx.strokeRect(0, 0, this.gridWidth * gs, this.gridHeight * gs); }
    
    drawHoverAndVectorUI() {
        const gs = this.gridSize;
        if (this.hoveredDrawableLine && this.wallDrawMode === 'grid' && this.lineLayers.includes(this.activeLayerName)) {
            this.ctx.strokeStyle = 'rgba(100, 180, 255, 0.7)'; this.ctx.lineWidth = 6 / this.zoom; this.ctx.lineCap = 'round';
            this.ctx.beginPath();
            if (this.hoveredDrawableLine.type === 'V') {
                this.ctx.moveTo((this.hoveredDrawableLine.x + 1) * gs, this.hoveredDrawableLine.y * gs); this.ctx.lineTo((this.hoveredDrawableLine.x + 1) * gs, (this.hoveredDrawableLine.y + 1) * gs);
            } else {
                this.ctx.moveTo(this.hoveredDrawableLine.x * gs, (this.hoveredDrawableLine.y + 1) * gs); this.ctx.lineTo((this.hoveredDrawableLine.x + 1) * gs, (this.hoveredDrawableLine.y + 1) * gs);
            }
            this.ctx.stroke();
            this.ctx.lineCap = 'butt';
        }
        
        if (this.lineLayers.includes(this.activeLayerName) && this.wallDrawMode === 'vector') {
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
            const pixelSize = 2 / this.zoom;
            for (let y = 0; y <= this.gridHeight; y++) for (let x = 0; x <= this.gridWidth; x++) this.ctx.fillRect(x * gs - pixelSize / 2, y * gs - pixelSize / 2, pixelSize, pixelSize);
            if (this.vectorWallStart) { const mousePos = this.getVertexCoordsFromEvent({clientX: this.lastMouse.x, clientY: this.lastMouse.y}); this.ctx.strokeStyle = 'rgba(100, 180, 255, 0.7)'; this.ctx.lineWidth = 4 / this.zoom; this.ctx.setLineDash([5 / this.zoom, 5 / this.zoom]); this.ctx.beginPath(); this.ctx.moveTo(this.vectorWallStart.x * gs, this.vectorWallStart.y * gs); this.ctx.lineTo(mousePos.x * gs, mousePos.y * gs); this.ctx.stroke(); this.ctx.setLineDash([]); }
        }
    }

    renderLineLayer(layerName, items) { if (!items) return; const gs = this.gridSize; const wallThickness = Math.max(2, gs * 0.1); for(const [key, item] of items.entries()) { if (key.startsWith('VEC_')) this.renderVectorWall(item); else this.renderGridWall(key, item, gs, wallThickness, layerName); } }
    
    renderGridWall(key, item, gs, wallThickness, layerName) {
        const [type, xStr, zStr] = key.split('_'); const x = Number(xStr); const z = Number(zStr);
        const img = this.preloadedImages.get(item.key);
        this.ctx.save();
        if (img) { const pattern = this.ctx.createPattern(img, 'repeat'); this.ctx.fillStyle = pattern; if (type === 'V') { this.ctx.translate((x + 1) * gs, z * gs); this.ctx.fillRect(-wallThickness / 2, 0, wallThickness, gs); } else { this.ctx.translate(x * gs, (z + 1) * gs); this.ctx.fillRect(0, -wallThickness / 2, gs, wallThickness); }
        } else { this.ctx.strokeStyle = '#FFF'; this.ctx.lineWidth = 2 / this.zoom; this.ctx.beginPath(); if (type === 'V') { this.ctx.moveTo((x + 1) * gs, z * gs); this.ctx.lineTo((x + 1) * gs, (z + 1) * gs); } else { this.ctx.moveTo(x * gs, (z + 1) * gs); this.ctx.lineTo((x + 1) * gs, (z + 1) * gs); } this.ctx.stroke(); }
        this.ctx.restore();

        const colorMap = { 'wall': 'rgba(255, 0, 0, 0.8)', 'door': 'rgba(255, 255, 0, 0.8)', 'dock': 'rgba(0, 150, 255, 0.9)'};
        this.ctx.strokeStyle = colorMap[layerName] || 'rgba(255,255,255,0.5)';
        this.ctx.lineWidth = 1 / this.zoom;
        this.ctx.beginPath();
        if (type === 'V') { this.ctx.moveTo((x + 1) * gs, z * gs); this.ctx.lineTo((x + 1) * gs, (z + 1) * gs); } else { this.ctx.moveTo(x * gs, (z + 1) * gs); this.ctx.lineTo((x + 1) * gs, (z + 1) * gs); }
        this.ctx.stroke();
    }

    renderVectorWall(item) {
        const [x1, y1, x2, y2] = item.points.map(p => p * this.gridSize);
        const img = this.preloadedImages.get(item.key);
        const wallThickness = Math.max(4, this.gridSize * 0.15) / this.zoom;
        const dx = x2 - x1, dy = y2 - y1;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        this.ctx.save();
        this.ctx.translate(x1, y1); this.ctx.rotate(angle);
        if (img) { this.ctx.fillStyle = this.ctx.createPattern(img, 'repeat'); } else { this.ctx.fillStyle = '#FFF'; }
        this.ctx.fillRect(0, -wallThickness / 2, length, wallThickness);
        this.ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)'; // Differentiate vector walls
        this.ctx.lineWidth = 1 / this.zoom;
        this.ctx.beginPath(); this.ctx.moveTo(0, 0); this.ctx.lineTo(length, 0); this.ctx.stroke();
        this.ctx.restore();
    }
    
    renderTileLayer(layerName, items) {
        const gs = this.gridSize;
        const defaultTexInfo = this.defaultTextures[layerName];
        if (defaultTexInfo && defaultTexInfo.key) {
            const img = this.preloadedImages.get(defaultTexInfo.key);
            if (img) {
                const size = defaultTexInfo.size || 1;
                for (let y = 0; y < this.gridHeight; y += size) {
                    for (let x = 0; x < this.gridWidth; x += size) {
                        if (!items.has(`${x},${y}`)) {
                           this.ctx.drawImage(img, x * gs, y * gs, gs * size, gs * size);
                        }
                    }
                }
            }
        }
        if (!items) return;
        for (const [coordKey, item] of items.entries()) {
            const [x, y] = coordKey.split(',').map(Number);
            const size = item.size || 1;
            let img = (item.type === 'npc' || item.type === 'asset') ? window[item.key + '_icon_img'] : this.preloadedImages.get(item.key);
            const originalAlpha = this.ctx.globalAlpha;
            if (layerName === 'water') this.ctx.globalAlpha *= 0.6;
            if (layerName === 'floater') this.ctx.globalAlpha *= 0.8;
            if (img) {
                this.ctx.save();
                this.ctx.translate(x * gs + (gs * size) / 2, y * gs + (gs * size) / 2);
                if (item.rotation) this.ctx.rotate(item.rotation * Math.PI / 2);
                const drawSize = gs * size;
                this.ctx.drawImage(img, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
                this.ctx.restore();
            }
            this.ctx.globalAlpha = originalAlpha;
        }
    }

    renderSpawnLayer(items) {
        if (!items) return;
        const gs = this.gridSize;
        const arrowImg = this.preloadedImages.get('/data/pngs/icons for UI/spawn_arrow.png');

        for (const [coordKey, item] of items.entries()) {
            const [x, y] = coordKey.split(',').map(Number);
            const img = this.preloadedImages.get(item.key);
            
            if (img) { // Draw spawn icon
                this.ctx.drawImage(img, x * gs, y * gs, gs, gs);
            }
            if (arrowImg) { // Draw direction arrow
                this.ctx.save();
                this.ctx.translate(x * gs + gs / 2, y * gs + gs / 2);
                this.ctx.rotate(item.rotation * Math.PI / 2);
                this.ctx.drawImage(arrowImg, -gs / 2, -gs / 2, gs, gs);
                this.ctx.restore();
            }
        }
    }

    findHoveredItem(e) {
        const { x: worldX, y: worldY } = this.getMouseWorldCoords(e);
        const { x: gridX, y: gridY } = this.getGridCoordsFromEvent(e);

        if ([...this.tileLayers, ...this.objectLayers].includes(this.activeLayerName)) {
            const layer = this.levelData[this.activeLayerName];
            for (const [key, item] of layer.entries()) {
                const [ix, iy] = key.split(',').map(Number);
                const size = item.size || 1;
                if (gridX >= ix && gridX < ix + size && gridY >= iy && gridY < iy + size) {
                    return { layer: this.activeLayerName, key, data: item };
                }
            }
        }
       
        let closestLine = null, minDistance = Infinity;
        for (const layerName of this.lineLayers) {
            const layerItems = this.levelData[layerName];
            if (!layerItems) continue;

            const hoveredGridLine = this.getHoveredGridLine(worldX, worldY);
            if(hoveredGridLine) {
                 const lineKey = `${hoveredGridLine.line.type}_${hoveredGridLine.line.x}_${hoveredGridLine.line.y}`;
                 if(layerItems.has(lineKey)) {
                     const dist = hoveredGridLine.dist * this.gridSize;
                     if (dist < minDistance) {
                        minDistance = dist;
                        closestLine = { layer: layerName, key: lineKey, data: layerItems.get(lineKey), line: hoveredGridLine.line };
                     }
                 }
            }

            for (const [key, item] of layerItems.entries()) {
                 if (!key.startsWith('VEC_')) continue;
                 const [x1, y1, x2, y2] = item.points.map(p => p * this.gridSize);
                 const dist = this.pointToSegmentDistance(worldX, worldY, x1, y1, x2, y2);
                 if (dist < 10 / this.zoom && dist < minDistance) {
                     minDistance = dist;
                     closestLine = { layer: layerName, key, data: item };
                 }
            }
        }
        return closestLine;
    }

    getHoveredGridLine(worldX, worldY) {
        const gs = this.gridSize; const gridX = Math.floor(worldX / gs); const gridY = Math.floor(worldY / gs);
        const fracX = worldX / gs - gridX; const fracY = worldY / gs - gridY;
        const tolerance = 0.25;
        const dists = [
            { type: 'H', dist: fracY, line: { type: 'H', x: gridX, y: gridY - 1 } },
            { type: 'H', dist: 1 - fracY, line: { type: 'H', x: gridX, y: gridY } },
            { type: 'V', dist: fracX, line: { type: 'V', x: gridX - 1, y: gridY } },
            { type: 'V', dist: 1 - fracX, line: { type: 'V', x: gridX, y: gridY } }
        ].filter(d => d.dist < tolerance).sort((a,b) => a.dist - b.dist);
        return dists.length > 0 ? dists[0] : null;
    }

    hasWallBetween(x1, y1, x2, y2) { const walls = this.levelData['wall']; if (!walls) return false; if (x1 !== x2) { const wallX = Math.min(x1, x2); if (walls.has(`V_${wallX}_${y1}`)) return true; } else { const wallY = Math.min(y1, y2); if (walls.has(`H_${x1}_${wallY}`)) return true; } const cx1 = (x1 + 0.5) * this.gridSize, cy1 = (y1 + 0.5) * this.gridSize; const cx2 = (x2 + 0.5) * this.gridSize, cy2 = (y2 + 0.5) * this.gridSize; for (const [key, wall] of walls.entries()) { if (!key.startsWith('VEC_')) continue; const [wx1, wy1, wx2, wy2] = wall.points.map(p => p * this.gridSize); if (this.lineSegmentsIntersect(cx1, cy1, cx2, cy2, wx1, wy1, wx2, wy2)) return true; } return false; }
    
    bucketFill(startX, startY) {
        if (!this.activeBrush || !this.tileLayers.includes(this.activeLayerName)) return;
        const layer = this.levelData[this.activeLayerName];
        if (layer.has(`${startX},${startY}`)) return;
        this.modifyState(() => {
            const q = [
                [startX, startY]
            ];
            const visited = new Set([`${startX},${startY}`]);
            let count = 0;
            while (q.length > 0) {
                const [x, y] = q.shift();
                layer.set(`${x},${y}`, { type: this.activeBrush.type, key: this.activeBrush.key, rotation: 0 });
                count++;
                const neighbors = [
                    [x + 1, y],
                    [x - 1, y],
                    [x, y + 1],
                    [x, y - 1]
                ];
                for (const [nx, ny] of neighbors) {
                    const key = `${nx},${ny}`;
                    if (nx < 0 || nx >= this.gridWidth || ny < 0 || ny >= this.gridHeight || visited.has(key) || layer.has(key)) continue;
                    if (!this.hasWallBetween(x, y, nx, ny)) {
                        visited.add(key);
                        q.push([nx, ny]);
                    }
                }
            }
            this.statusMsg.textContent = `Fill completed. ${count} tiles placed.`;
        });
    }

    lineSegmentsIntersect(x1, y1, x2, y2, x3, y3, x4, y4) { const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4); if (den === 0) return false; const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den; const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / den; return t > 0 && t < 1 && u > 0 && u < 1; }
    pointToSegmentDistance(px, py, x1, y1, x2, y2) { const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1); if (l2 === 0) return Math.sqrt((px-x1)*(px-x1) + (py-y1)*(py-y1)); let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2; t = Math.max(0, Math.min(1, t)); const projX = x1 + t * (x2 - x1); const projY = y1 + t * (y2 - y1); return Math.sqrt((px-projX)*(px-projX) + (py-projY)*(py-projY)); }
    
    getLevelDataObject() { 
        const levelObject = { settings: { width: this.gridWidth, height: this.gridHeight, defaults: this.defaultTextures }, layers: {} };
        for (const layerName of this.layerOrder) { 
            const layerMap = this.levelData[layerName]; 
            if (layerMap.size > 0) levelObject.layers[layerName] = Array.from(layerMap.entries()); 
        } 
        return levelObject; 
    }
    
    async saveLevel() { 
        const levelDataToSave = this.getLevelDataObject();
        const jsonString = JSON.stringify(levelDataToSave, null, 2); 
        const path = `data/levels/level_${this.currentLevel}.json`;
        const existingFile = await fetch(path).then(res => res.ok).catch(() => false);
        if (existingFile && !confirm(`A file for level ${this.currentLevel} already exists. Overwrite?`)) {
            this.statusMsg.textContent = `Save cancelled.`;
            return;
        }
        const blob = new Blob([jsonString], { type: 'application/json' }); 
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `level_${this.currentLevel}.json`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(a.href); this.isLevelDirty = false; this.history = [this.cloneLevelData(this.levelData)]; this.historyIndex = 0; this.statusMsg.textContent = `Level ${this.currentLevel} saved.`; 
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
            console.error(err);
            this.statusMsg.textContent = `Error loading Level ${levelNum}. Check console. Starting new level from template.`; 
            const templateData = this.applyLevelTemplate(levelNum); 
            this.applyLoadedData(templateData); 
        } 
        this.isLevelDirty = false; 
        this.history = [this.cloneLevelData(this.levelData)]; 
        this.historyIndex = 0; 
        this.ui.updateUIForNewLevel(); 
        this.render(); 
    }

    applyLoadedData(data) {
        let actualData = data;
        if (data.__ahk_meta__) {
            actualData = data;
        } else {
            console.warn("Level data is missing __ahk_meta__ field. Using raw data.");
        }
        this.gridWidth = actualData.settings?.width || 64; 
        this.gridHeight = actualData.settings?.height || 64; 
        this.defaultTextures = actualData.settings?.defaults || {}; 
        this.ui.updateSettingsUI(); 
        this.layerOrder.forEach(layer => this.levelData[layer].clear()); 
        const loadedLayers = actualData.layers || {}; 
        for (const layerName in loadedLayers) {
            if (this.levelData.hasOwnProperty(layerName)) {
                this.levelData[layerName] = new Map(loadedLayers[layerName]);
            }
        }
    }
}

window.addEventListener('DOMContentLoaded', () => { new LevelEditor(); });