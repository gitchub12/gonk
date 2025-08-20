// BROWSERFIREFOXHIDE editor.js
// Slimmed down to only contain the core LevelEditor class. UI and Asset logic is now in editor_ui_and_assets.js.

class LevelEditor {
    constructor() {
        this.canvas = document.getElementById('editorCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.modelSystem = new GonkModelSystem();
        // UI and AssetManager are now in a separate file but instantiated here
        this.assetManager = new EditorAssetManager(this.modelSystem);
        this.ui = new EditorUI(this);

        this.statusMsg = document.getElementById('status-message');
        this.gridSize = 32; this.gridWidth = 64; this.gridHeight = 64;
        this.zoom = 1.0; this.panX = 0; this.panY = 0;
        this.isPanning = false; this.isPainting = false;
        this.activeTool = 'paint'; this.activeBrush = null; this.lastUsedBrush = {};
        this.hoveredLine = null;
        this.layerOrder = ['subfloor', 'floor', 'npcs', 'assets', 'spawns', 'walls', 'tapestry', 'dangler', 'water', 'floater', 'decor', 'ceiling', 'sky'];
        this.activeLayerName = 'floor';
        this.lineLayers = ['walls', 'tapestry'];
        this.levelData = {}; this.layerOrder.forEach(layer => this.levelData[layer] = new Map());
        this.defaultTextures = {}; this.preloadedImages = new Map();
        this.currentLevel = 1; this.isLevelDirty = false;
        this.history = []; this.historyIndex = -1;
        this.init();
    }

    async init() {
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        document.addEventListener('mousedown', e => this.onMouseDown(e));
        document.addEventListener('mousemove', e => this.onMouseMove(e));
        document.addEventListener('mouseup', e => this.onMouseUp(e));
        this.canvas.addEventListener('wheel', e => this.onMouseWheel(e));
        this.canvas.addEventListener('contextmenu', e => e.preventDefault());
        document.addEventListener('keydown', e => this.onKeyDown(e));
        await this.assetManager.discoverAssets();
        await this.preloadAllTextures();
        this.ui.init();
        await this.loadLevel(this.currentLevel, true);
    }
    
    async preloadAllTextures() {
        const allPaths = new Set(['/data/pngs/icons for UI/crate.png']);
        Object.values(this.assetManager.layerTextures).forEach(arr => arr.forEach(path => allPaths.add(path)));
        const promises = [...allPaths].map(path => new Promise(resolve => {
            const img = new Image();
            img.src = path;
            img.onload = () => { this.preloadedImages.set(path, img); resolve(); };
            img.onerror = () => { console.error(`Failed to preload image: ${path}`); resolve(); }
        }));
        await Promise.all(promises);
    }
    
    cloneLevelData(data) {
        const clone = {};
        for (const key in data) clone[key] = new Map(data[key]);
        return clone;
    }

    saveStateToHistory() {
        if (this.historyIndex < this.history.length - 1) this.history.splice(this.historyIndex + 1);
        this.history.push(this.cloneLevelData(this.levelData));
        this.historyIndex++;
    }

    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.levelData = this.cloneLevelData(this.history[this.historyIndex]);
            this.render(); this.statusMsg.textContent = 'Undo';
        }
    }

    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.levelData = this.cloneLevelData(this.history[this.historyIndex]);
            this.render(); this.statusMsg.textContent = 'Redo';
        }
    }

    modifyState(modificationAction) {
        this.saveStateToHistory();
        modificationAction();
        this.isLevelDirty = true;
        this.render();
    }

    resizeCanvas() {
        const container = document.getElementById('canvasContainer');
        this.canvas.width = container.clientWidth; this.canvas.height = container.clientHeight;
        this.render();
    }
    
    getGridCoordsFromEvent(e) {
        const { x: worldX, y: worldY } = this.getMouseWorldCoords(e);
        return { x: Math.floor(worldX / this.gridSize), y: Math.floor(worldY / this.gridSize) };
    }
    
    getMouseWorldCoords(e) {
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left, mouseY = e.clientY - rect.top;
        return { x: (mouseX - this.panX) / this.zoom, y: (mouseY - this.panY) / this.zoom };
    }
    
    eraseItem(gridX, gridY) {
        let itemErased = false;
        const action = () => {
            const activeLayer = this.activeLayerName;
            if (this.lineLayers.includes(activeLayer)) {
                if (!this.hoveredLine) return;
                const lineKey = `${this.hoveredLine.type}_${this.hoveredLine.x}_${this.hoveredLine.y}`;
                if (this.levelData[activeLayer].delete(lineKey)) itemErased = true;
            } else {
                const coordKey = `${gridX},${gridY}`;
                if (this.levelData[activeLayer].delete(coordKey)) itemErased = true;
            }
        };
        this.modifyState(action);
        if(itemErased) this.statusMsg.textContent = `Erased item.`;
    }

    placeItem(gridX, gridY) {
        if (!this.activeBrush) return;
        this.modifyState(() => {
            const activeLayer = this.activeLayerName;
            let currentCoord = `${gridX},${gridY}`;
            if (this.lineLayers.includes(activeLayer)) {
                if (!this.hoveredLine) return;
                currentCoord = `${this.hoveredLine.type}_${this.hoveredLine.x}_${this.hoveredLine.y}`;
                if (this.isPainting && this.lastPlacedCoord === currentCoord) return;
                this.levelData[activeLayer].set(currentCoord, {type: this.activeBrush.type, key: this.activeBrush.key});
            } else {
                if (this.isPainting && this.lastPlacedCoord === currentCoord) return;
                if ((['npcs', 'assets', 'spawns'].includes(activeLayer) && this.levelData[activeLayer].has(currentCoord)) || (this.activeBrush.type === 'npc' && activeLayer !== 'npcs') || (this.activeBrush.type === 'asset' && activeLayer !== 'assets')) return;
                if (this.activeBrush.type === 'texture' && this.activeBrush.key.split('/')[3] !== activeLayer) return;
                this.levelData[activeLayer].set(currentCoord, { type: this.activeBrush.type, key: this.activeBrush.key, rotation: 0 });
            }
            this.statusMsg.textContent = `Placed ${this.activeBrush.key.split('/').pop()}`;
        });
    }
    
    placeSpawn(gridX, gridY) {
        if (this.activeLayerName !== 'spawns') return;
        const coordKey = `${gridX},${gridY}`;
        const spawnLayer = this.levelData['spawns'];
        if (spawnLayer.has(coordKey)) return;
        this.modifyState(() => {
            spawnLayer.set(coordKey, { number: spawnLayer.size + 1, rotation: 0, key: '/data/pngs/spawn/hologonk_1.png' });
            this.statusMsg.textContent = `Placed spawn point #${spawnLayer.size}.`;
        });
    }

    rotateItem(gridX, gridY) {
        const activeLayer = this.activeLayerName;
        const coordKey = `${gridX},${gridY}`;
        const item = this.levelData[activeLayer].get(coordKey);
        if (item && !this.lineLayers.includes(activeLayer)) {
            this.modifyState(() => {
                item.rotation = (item.rotation + 1) % 4;
                this.statusMsg.textContent = `Rotated item at ${coordKey}.`;
            });
        }
    }

    resetLayer() {
        if (this.levelData[this.activeLayerName].size > 0 && confirm(`Are you sure you want to clear all items from the '${this.activeLayerName}' layer?`)) {
            this.modifyState(() => {
                this.levelData[this.activeLayerName].clear();
                this.statusMsg.textContent = `Layer '${this.activeLayerName}' has been cleared.`;
            });
        }
    }

    resetMap() {
        if (confirm('Are you sure you want to clear the entire map? This cannot be undone.')) {
            this.modifyState(() => {
                this.layerOrder.forEach(layer => this.levelData[layer].clear());
                this.statusMsg.textContent = 'Entire map has been cleared.';
            });
        }
    }

    onKeyDown(e) {
        if (e.ctrlKey) {
            if (e.key === 'z') { e.preventDefault(); this.undo(); }
            if (e.key === 'y') { e.preventDefault(); this.redo(); }
        }
    }

    onMouseDown(e) {
        if (e.target.closest('#leftPanel, .floating-toolbar, .top-right-ui')) return;
        this.ui.hideContextMenu();
        if (e.button === 1) { this.isPanning = true; this.lastMouse = { x: e.clientX, y: e.clientY }; return; }
        const { x, y } = this.getGridCoordsFromEvent(e);
        if (e.button === 2) { this.ui.showContextMenu(e, x, y); return; }
        if (e.button === 0) {
            this.isPainting = true;
            switch(this.activeTool) {
                case 'paint': this.placeItem(x, y); break;
                case 'erase': this.eraseItem(x, y); break;
                case 'rotate': this.rotateItem(x, y); break;
                case 'spawn': this.placeSpawn(x, y); break;
            }
        }
    }

    onMouseUp(e) { if (e.button === 1) this.isPanning = false; if (e.button === 0) this.isPainting = false; }
    
    updateHoveredLine(e) {
        if (!this.lineLayers.includes(this.activeLayerName)) {
            if (this.hoveredLine) { this.hoveredLine = null; this.render(); }
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
            { id: 'top',    type: 'H', dist: fracY,     line: { type: 'H', x: gridX, y: gridY - 1 } },
            { id: 'bottom', type: 'H', dist: 1 - fracY, line: { type: 'H', x: gridX, y: gridY } },
            { id: 'left',   type: 'V', dist: fracX,     line: { type: 'V', x: gridX - 1, y: gridY } },
            { id: 'right',  type: 'V', dist: 1 - fracX, line: { type: 'V', x: gridX, y: gridY } }
        ];
        const closestH = dists.filter(d => d.type === 'H').sort((a,b) => a.dist - b.dist)[0];
        const closestV = dists.filter(d => d.type === 'V').sort((a,b) => a.dist - b.dist)[0];
        let newHoveredLine = null;
        if (closestH.dist < tolerance && closestV.dist < tolerance) newHoveredLine = null;
        else if (closestH.dist < tolerance && closestH.dist < closestV.dist) newHoveredLine = closestH.line;
        else if (closestV.dist < tolerance && closestV.dist < closestH.dist) newHoveredLine = closestV.line;
        if (JSON.stringify(this.hoveredLine) !== JSON.stringify(newHoveredLine)) {
            this.hoveredLine = newHoveredLine; this.render();
        }
    }

    onMouseMove(e) {
        const { x, y } = this.getGridCoordsFromEvent(e);
        document.getElementById('coords').textContent = `X: ${x}, Y: ${y}`;
        if (this.isPanning) {
            const dx = e.clientX - this.lastMouse.x; const dy = e.clientY - this.lastMouse.y;
            this.panX += dx; this.panY += dy; this.lastMouse = { x: e.clientX, y: e.clientY };
            this.render(); return;
        } 
        this.updateHoveredLine(e);
        if(this.isPainting) switch(this.activeTool) {
            case 'paint': this.placeItem(x, y); break;
            case 'erase': this.eraseItem(x, y); break;
            case 'spawn': this.placeSpawn(x,y); break;
        }
    }

    onMouseWheel(e) {
        e.preventDefault();
        if (e.ctrlKey) {
            const allButtons = this.ui.getLayerButtonOrder();
            const currentButton = document.querySelector(`#layer-selector button.active`);
            let currentIndex = allButtons.findIndex(btn => btn === currentButton);
            if (currentIndex === -1) currentIndex = 0;
            let nextIndex = currentIndex + (e.deltaY > 0 ? -1 : 1);
            nextIndex = (nextIndex + allButtons.length) % allButtons.length;
            allButtons[nextIndex].click();
            return;
        }
        const zoomSpeed = 1.1; const oldZoom = this.zoom;
        this.zoom *= (e.deltaY < 0 ? zoomSpeed : 1 / zoomSpeed);
        this.zoom = Math.max(0.1, Math.min(10, this.zoom));
        const mouseX = e.clientX - this.canvas.getBoundingClientRect().left; const mouseY = e.clientY - this.canvas.getBoundingClientRect().top;
        this.panX = mouseX - (mouseX - this.panX) * (this.zoom / oldZoom); this.panY = mouseY - (mouseY - this.panY) * (this.zoom / oldZoom);
        document.getElementById('zoom').textContent = `Zoom: ${Math.round(this.zoom * 100)}%`;
        this.render();
    }

    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.save();
        this.ctx.translate(this.panX, this.panY); this.ctx.scale(this.zoom, this.zoom);
        const gs = this.gridSize;
        const activeLayerIndex = this.layerOrder.indexOf(this.activeLayerName);
        const visStartX = Math.floor(-this.panX / this.zoom / gs); const visEndX = Math.ceil((this.canvas.width - this.panX) / this.zoom / gs);
        const visStartY = Math.floor(-this.panY / this.zoom / gs); const visEndY = Math.ceil((this.canvas.height - this.panY) / this.zoom / gs);
        const startX = Math.max(0, visStartX); const endX = Math.min(this.gridWidth, visEndX);
        const startY = Math.max(0, visStartY); const endY = Math.min(this.gridHeight, visEndY);

        for (let i = 0; i < this.layerOrder.length; i++) {
            const layerName = this.layerOrder[i];
            const isLayerVisible = (i <= activeLayerIndex);
            
            // Always render walls for context, but make them transparent if layer is not active
            if (layerName === 'walls' && i > activeLayerIndex) {
                this.ctx.globalAlpha = 0.25;
                this.renderWallLayer(this.levelData[layerName], startX, startY, endX, endY);
                this.ctx.globalAlpha = 1.0;
                continue;
            }

            if (isLayerVisible) {
                if (this.lineLayers.includes(layerName)) {
                    this.renderWallLayer(this.levelData[layerName], startX, startY, endX, endY);
                } else {
                    this.renderTileLayer(layerName, this.levelData[layerName], startX, startY, endX, endY, isLayerVisible);
                }
            }
        }
        
        // Draw Grid and Borders
        this.ctx.lineWidth = 1 / this.zoom; this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        this.ctx.beginPath();
        for (let x = startX; x <= endX; x++) { this.ctx.moveTo(x * gs, startY * gs); this.ctx.lineTo(x * gs, endY * gs); }
        for (let y = startY; y <= endY; y++) { this.ctx.moveTo(startX * gs, y * gs); this.ctx.lineTo(endX * gs, y * gs); }
        this.ctx.stroke();
        this.ctx.strokeStyle = '#900'; this.ctx.lineWidth = 3 / this.zoom; this.ctx.strokeRect(0, 0, this.gridWidth * gs, this.gridHeight * gs);
        
        // Draw Hover Highlight
        if (this.hoveredLine) {
            this.ctx.strokeStyle = 'rgba(100, 180, 255, 0.7)'; this.ctx.lineWidth = 6 / this.zoom; this.ctx.lineCap = 'round';
            this.ctx.beginPath();
            if (this.hoveredLine.type === 'V') { this.ctx.moveTo((this.hoveredLine.x + 1) * gs, this.hoveredLine.y * gs); this.ctx.lineTo((this.hoveredLine.x + 1) * gs, (this.hoveredLine.y + 1) * gs); } 
            else { this.ctx.moveTo(this.hoveredLine.x * gs, (this.hoveredLine.y + 1) * gs); this.ctx.lineTo((this.hoveredLine.x + 1) * gs, (this.hoveredLine.y + 1) * gs); }
            this.ctx.stroke(); this.ctx.lineCap = 'butt';
        }
        this.ctx.restore();
    }

    renderWallLayer(items, startX, startY, endX, endY) {
        if (!items) return;
        const gs = this.gridSize;
        for(const [key, item] of items.entries()) {
            const [type, xStr, zStr] = key.split('_');
            const x = Number(xStr); const z = Number(zStr);
            this.ctx.save();
            this.ctx.beginPath();
            if (type === 'V') {
                this.ctx.moveTo((x + 1) * gs, z * gs);
                this.ctx.lineTo((x + 1) * gs, (z + 1) * gs);
            } else {
                this.ctx.moveTo(x * gs, (z + 1) * gs);
                this.ctx.lineTo((x + 1) * gs, (z + 1) * gs);
            }
            this.ctx.strokeStyle = item.key.includes('/door/') ? 'cyan' : 'white';
            this.ctx.lineWidth = 4 / this.zoom;
            this.ctx.stroke();
            this.ctx.restore();
        }
    }

    renderTileLayer(layerName, items, startX, startY, endX, endY, isLayerVisible) {
        const gs = this.gridSize;
        if (this.defaultTextures[layerName]) {
            const img = this.preloadedImages.get(this.defaultTextures[layerName]);
            if (img) for (let y = startY; y < endY; y++) for (let x = startX; x < endX; x++) this.ctx.drawImage(img, x * gs, y * gs, gs, gs);
        }

        if (!items) return;

        for (const [coordKey, item] of items.entries()) {
            const [x, y] = coordKey.split(',').map(Number);
            if(x < startX || x > endX || y < startY || y > endY) continue;
            
            let img = null;
            if (layerName === 'spawns') img = this.preloadedImages.get(item.key);
            else img = (item.type === 'npc' || item.type === 'asset') ? window[item.key + '_icon_img'] : this.preloadedImages.get(item.key);
            
            if (layerName === 'water') this.ctx.globalAlpha = 0.3;
            
            if (img) {
                this.ctx.save();
                this.ctx.translate(x * gs + gs / 2, y * gs + gs / 2);
                if (item.rotation) this.ctx.rotate(item.rotation * Math.PI / 2);

                if (layerName === 'npcs') this.ctx.drawImage(img, -(gs*0.375), -(gs*0.125), gs * 0.75, gs * 0.75); 
                else if (layerName === 'spawns') {
                    this.ctx.drawImage(img, -gs / 2, -gs / 2, gs, gs);
                    this.ctx.font = `bold ${gs * 0.5}px Arial`; this.ctx.fillStyle = 'white'; this.ctx.textAlign = 'center'; this.ctx.textBaseline = 'middle';
                    this.ctx.shadowColor = 'black'; this.ctx.shadowBlur = 4;
                    const spawnNumber = Array.from(this.levelData['spawns'].keys()).indexOf(coordKey) + 1;
                    this.ctx.fillText(spawnNumber, 0, 0);
                    this.ctx.strokeStyle = 'white'; this.ctx.lineWidth = 3 / this.zoom; this.ctx.shadowBlur = 0;
                    this.ctx.beginPath(); this.ctx.moveTo(0, -gs * 0.2); this.ctx.lineTo(0, -gs * 0.4);
                    this.ctx.moveTo(-gs*0.1, -gs*0.3); this.ctx.lineTo(0, -gs*0.4); this.ctx.lineTo(gs*0.1, -gs*0.3); this.ctx.stroke();
                }
                else this.ctx.drawImage(img, -gs / 2, -gs / 2, gs, gs);

                this.ctx.restore();
            }

            if (layerName === 'water') this.ctx.globalAlpha = 1.0;
        }
    }
    
    async saveLevel() {
        const levelObject = { settings: { width: this.gridWidth, height: this.gridHeight, defaults: this.defaultTextures }, layers: {} };
        for (const layerName of this.layerOrder) {
            const layerMap = this.levelData[layerName];
            if (layerMap.size > 0) levelObject.layers[layerName] = Array.from(layerMap.entries());
        }
        const jsonString = JSON.stringify(levelObject, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `level_${this.currentLevel}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
        this.isLevelDirty = false;
        this.history = [this.cloneLevelData(this.levelData)]; this.historyIndex = 0;
        this.statusMsg.textContent = `Level ${this.currentLevel} saved successfully!`;
    }

    async loadLevel(levelNum, isInitialLoad = false) {
        if (!isInitialLoad && this.isLevelDirty && !confirm('You have unsaved changes. Discard them and load a new level?')) return;
        const path = `/data/levels/level_${levelNum}.json`;
        try {
            const response = await fetch(path);
            if (!response.ok) throw new Error('Level not found');
            const data = await response.json(); this.applyLoadedData(data);
            this.statusMsg.textContent = `Level ${levelNum} loaded successfully!`;
        } catch (err) {
            if (isInitialLoad || confirm(`Level ${levelNum} not found. Create a new level?`)) {
                this.layerOrder.forEach(layer => this.levelData[layer].clear());
                this.statusMsg.textContent = `Started new Level ${levelNum}.`;
            } else { this.ui.levelNumberInput.value = this.currentLevel; return; }
        }
        this.currentLevel = levelNum; this.isLevelDirty = false;
        this.history = [this.cloneLevelData(this.levelData)]; this.historyIndex = 0;
        this.ui.updateUIForNewLevel(); this.render();
    }

    applyLoadedData(data) {
        this.gridWidth = data.settings?.width || 64; this.gridHeight = data.settings?.height || 64;
        this.defaultTextures = data.settings?.defaults || {}; this.ui.updateSettingsUI();
        this.layerOrder.forEach(layer => this.levelData[layer].clear());
        const loadedLayers = data.layers || {};
        for (const layerName in loadedLayers) if (this.levelData.hasOwnProperty(layerName)) this.levelData[layerName] = new Map(loadedLayers[layerName]);
    }
}

window.addEventListener('DOMContentLoaded', () => {
    new LevelEditor();
});