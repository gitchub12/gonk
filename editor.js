// BROWSERFIREFOXHIDE editor.js
// Rewritten to fix tiling, tapestry controls, erase tool, and texture rendering.

class LevelEditor {
    constructor() {
        this.canvas = document.getElementById('editorCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.assetManager = new EditorAssetManager(window.gonkModels);
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
        this.tapestryDirection = 0; // 0 for default, 1 for reversed

        this.hoveredLine = null;
        this.layerOrder = ['subfloor', 'floor', 'water', 'floater', 'decor', 'npcs', 'assets', 'spawns', 'walls', 'tapestry', 'dangler', 'ceiling', 'sky'];
        this.tileLayers = ['subfloor', 'floor', 'water', 'floater', 'decor', 'dangler', 'ceiling', 'sky'];
        this.lineLayers = ['walls', 'tapestry'];
        this.activeLayerName = 'floor';

        this.levelData = {}; this.layerOrder.forEach(layer => this.levelData[layer] = new Map());
        this.preloadedImages = new Map();
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

        document.getElementById('tool-wall-mode').addEventListener('click', () => this.toggleWallMode());
        document.getElementById('tool-tile-size').addEventListener('click', () => this.cycleTileSize());

        await this.assetManager.discoverAssets();
        await this.preloadAllTextures();
        this.ui.init();
        await this.loadLevel(this.currentLevel, true);
    }

    toggleWallMode() {
        const button = document.getElementById('tool-wall-mode');
        const img = button.querySelector('img');
        if (this.wallDrawMode === 'grid') { this.wallDrawMode = 'vector'; img.src = '/data/pngs/icons for UI/angleicon.png'; } 
        else { this.wallDrawMode = 'grid'; img.src = '/data/pngs/icons for UI/gridicon.png'; this.vectorWallStart = null; }
        this.render();
    }

    cycleTileSize() {
        const sizes = [1, 2, 4, 0.5, 0.25];
        const labels = ['1x', '2x', '4x', '½x', '¼x'];
        const currentIdx = sizes.indexOf(this.activeTileSize);
        const nextIdx = (currentIdx + 1) % sizes.length;
        this.activeTileSize = sizes[nextIdx];

        const button = document.getElementById('tool-tile-size');
        const label = button.querySelector('.tool-label');
        label.textContent = labels[nextIdx];
        this.render();
    }

    async preloadAllTextures() {
        const allPaths = new Set();
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
    undo() { if (this.historyIndex > 0) { this.historyIndex--; this.levelData = this.cloneLevelData(this.history[this.historyIndex]); this.render(); } }
    redo() { if (this.historyIndex < this.history.length - 1) { this.historyIndex++; this.levelData = this.cloneLevelData(this.history[this.historyIndex]); this.render(); } }
    modifyState(modificationAction) { this.saveStateToHistory(); modificationAction(); this.isLevelDirty = true; this.render(); }
    resizeCanvas() { const container = document.getElementById('canvasContainer'); this.canvas.width = container.clientWidth; this.canvas.height = container.clientHeight; this.render(); }
    getMouseWorldCoords(e) { const rect = this.canvas.getBoundingClientRect(); return { x: (e.clientX - rect.left - this.panX) / this.zoom, y: (e.clientY - rect.top - this.panY) / this.zoom }; }
    getGridCoordsFromEvent(e) { const { x, y } = this.getMouseWorldCoords(e); return { x: Math.floor(x / this.gridSize), y: Math.floor(y / this.gridSize) }; }
    getVertexCoordsFromEvent(e) { const { x, y } = this.getMouseWorldCoords(e); return { x: Math.round(x / this.gridSize), y: Math.round(y / this.gridSize) }; }

    eraseItem(gridX, gridY) {
        this.modifyState(() => {
            this.levelData[this.activeLayerName].delete(`${gridX},${gridY}`);
        });
    }

    handlePaintAction(e) {
        const { x: gridX, y: gridY } = this.getGridCoordsFromEvent(e);
        if (this.lineLayers.includes(this.activeLayerName) && this.wallDrawMode === 'vector') {
            const {x: vX, y: vY} = this.getVertexCoordsFromEvent(e);
            this.placeVectorWallVertex(vX, vY);
        } else if (this.activeLayerName === 'tapestry' && this.wallDrawMode === 'grid') {
             if (!this.hoveredLine) return;
             const key = `${this.hoveredLine.type}_${this.hoveredLine.x}_${this.hoveredLine.y}`;
             this.modifyState(() => { this.levelData.tapestry.set(key, {key: this.activeBrush.key, direction: this.tapestryDirection }); });
        } else if (this.lineLayers.includes(this.activeLayerName) && this.wallDrawMode === 'grid') {
            if (!this.hoveredLine) return;
            const key = `${this.hoveredLine.type}_${this.hoveredLine.x}_${this.hoveredLine.y}`;
            this.modifyState(() => { this.levelData[this.activeLayerName].set(key, {key: this.activeBrush.key}); });
        } else {
            this.modifyState(() => { this.levelData[this.activeLayerName].set(`${gridX},${gridY}`, { type: this.activeBrush.type, key: this.activeBrush.key, rotation: 0, size: this.activeTileSize }); });
        }
    }

    handleContextMenuAction(action, item, gridX, gridY) {
        this.modifyState(() => {
            switch(action) {
                case 'Set Health':
                    const health = prompt('Enter new health value:', item.health || '');
                    if (health && !isNaN(health)) item.health = parseInt(health, 10);
                    break;
                case 'Set Weapon':
                    const weapon = prompt('Enter weapon key (e.g., rifle_e11):', item.weapon || '');
                    if (weapon) item.weapon = weapon;
                    break;
                case 'Delete':
                     this.levelData[this.activeLayerName].delete(`${gridX},${gridY}`);
                     break;
                default:
                    alert(`Action: ${action} on ${item.key}`);
            }
        });
    }

    placeVectorWallVertex(vX, vY) { if (!this.vectorWallStart) { this.vectorWallStart = { x: vX, y: vY }; } else { if (this.vectorWallStart.x === vX && this.vectorWallStart.y === vY) return; this.modifyState(() => { const wall = { type: 'vector', points: [this.vectorWallStart.x, this.vectorWallStart.y, vX, vY], key: this.activeBrush.key }; this.levelData[this.activeLayerName].set(`VEC_${Date.now()}`, wall); }); this.vectorWallStart = { x: vX, y: vY }; } this.render(); }
    placeSpawn(gridX, gridY) { this.modifyState(() => { this.levelData.spawns.set(`${gridX},${gridY}`, { rotation: 0, key: '/data/pngs/spawn/hologonk_1.png' }); }); }
    rotateItem(gridX, gridY) {
        if (this.activeLayerName === 'tapestry') {
            this.tapestryDirection = 1 - this.tapestryDirection;
            this.render();
            return;
        }
        const item = this.levelData[this.activeLayerName].get(`${gridX},${gridY}`); if (item && !this.lineLayers.includes(this.activeLayerName)) { this.modifyState(() => { item.rotation = (item.rotation + 1) % 4; }); }
    }
    resetLayer() { if (confirm(`Clear all items from '${this.activeLayerName}'?`)) { this.modifyState(() => { this.levelData[this.activeLayerName].clear(); }); } }
    resetMap() { if (confirm('Clear entire map?')) { this.modifyState(() => { this.layerOrder.forEach(layer => this.levelData[layer].clear()); }); } }

    onKeyDown(e) {
        if (e.ctrlKey) { if (e.key === 'z' || e.key === 'Z') { e.preventDefault(); this.undo(); } if (e.key === 'y' || e.key === 'Y') { e.preventDefault(); this.redo(); } }
        if (e.key === 'Escape' && this.vectorWallStart) { this.vectorWallStart = null; this.render(); }
        if ((e.key === 'r' || e.key === 'R') && (this.activeLayerName === 'tapestry' || this.activeLayerName === 'walls')) {
            this.tapestryDirection = 1 - this.tapestryDirection;
            this.statusMsg.textContent = `Tapestry will be placed on ${this.tapestryDirection === 1 ? "far" : "near"} side.`;
            this.render();
        }
    }

    onMouseDown(e) {
        if (e.target.closest('#leftPanel, .floating-toolbar, .top-right-ui')) return;
        this.ui.hideContextMenu(); this.lastMouse = { x: e.clientX, y: e.clientY };
        if (e.button === 1) { this.isPanning = true; return; }
        const { x: gridX, y: gridY } = this.getGridCoordsFromEvent(e);
        if (e.button === 2) { this.ui.showContextMenu(e, gridX, gridY); return; }
        if (e.button === 0) {
            this.isPainting = true;
            switch(this.activeTool) {
                case 'paint': this.handlePaintAction(e); break;
                case 'erase': this.eraseItem(gridX, gridY); break;
                case 'rotate': this.rotateItem(gridX, gridY); break;
                case 'spawn': this.placeSpawn(gridX, gridY); break;
                case 'fill': this.bucketFill(gridX, gridY); break;
            }
        }
    }

    onMouseUp(e) { this.isPainting = false; this.isPanning = false; }
    onMouseMove(e) {
        if (this.isPanning) { const dx = e.clientX - this.lastMouse.x, dy = e.clientY - this.lastMouse.y; this.panX += dx; this.panY += dy; this.lastMouse = { x: e.clientX, y: e.clientY }; this.render(); return; }
        this.lastMouse = { x: e.clientX, y: e.clientY };
        const oldHoveredLine = this.hoveredLine; this.updateHoveredLine(e);
        if (JSON.stringify(oldHoveredLine) !== JSON.stringify(this.hoveredLine)) { this.render(); }
        if(this.isPainting && this.activeTool === 'erase') { const { x, y } = this.getGridCoordsFromEvent(e); this.eraseItem(x, y); }
    }

    updateHoveredLine(e) { this.hoveredLine = null; if (this.wallDrawMode !== 'grid') return; if (!this.lineLayers.includes(this.activeLayerName) && this.activeLayerName !== 'walls') return; const { x: worldX, y: worldY } = this.getMouseWorldCoords(e); const gs = this.gridSize; const gridX = Math.floor(worldX / gs); const gridY = Math.floor(worldY / gs); const fracX = worldX / gs - gridX; const fracY = worldY / gs - gridY; const tolerance = 0.25; const dists = [ { type: 'H', dist: fracY, line: { type: 'H', x: gridX, y: gridY - 1 } }, { type: 'H', dist: 1 - fracY, line: { type: 'H', x: gridX, y: gridY } }, { type: 'V', dist: fracX, line: { type: 'V', x: gridX - 1, y: gridY } }, { type: 'V', dist: 1 - fracX, line: { type: 'V', x: gridX, y: gridY } } ]; const closestH = dists.filter(d => d.type === 'H').sort((a,b) => a.dist - b.dist)[0]; const closestV = dists.filter(d => d.type === 'V').sort((a,b) => a.dist - b.dist)[0]; if (closestH.dist < tolerance && closestH.dist < closestV.dist) this.hoveredLine = closestH.line; else if (closestV.dist < tolerance) this.hoveredLine = closestV.line; }
    onMouseWheel(e) { e.preventDefault(); const zoomSpeed = 1.1; const oldZoom = this.zoom; this.zoom *= (e.deltaY < 0 ? zoomSpeed : 1 / zoomSpeed); this.zoom = Math.max(0.1, Math.min(10, this.zoom)); const mouseX = e.clientX - this.canvas.getBoundingClientRect().left; const mouseY = e.clientY - this.canvas.getBoundingClientRect().top; this.panX = mouseX - (mouseX - this.panX) * (this.zoom / oldZoom); this.panY = mouseY - (mouseY - this.panY) * (this.zoom / oldZoom); document.getElementById('zoom').textContent = `Zoom: ${Math.round(this.zoom * 100)}%`; this.render(); }

    render() {
        this.ctx.imageSmoothingEnabled = false;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); this.ctx.save(); this.ctx.translate(this.panX, this.panY); this.ctx.scale(this.zoom, this.zoom);
        for (const layerName of this.layerOrder) {
            if (this.lineLayers.includes(layerName)) this.renderWallLayer(this.levelData[layerName], 'fill');
            else this.renderTileLayer(this.levelData[layerName]);
        }
        this.drawGridAndBorders();
        this.renderWallLayer(this.levelData['walls'], 'lines');
        this.renderWallLayer(this.levelData['tapestry'], 'lines');
        this.drawHoverAndVectorUI(); this.ctx.restore();
    }

    drawGridAndBorders() { const gs = this.gridSize; this.ctx.lineWidth = 1 / this.zoom; this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'; this.ctx.beginPath(); for (let x = 0; x <= this.gridWidth; x++) { this.ctx.moveTo(x * gs, 0); this.ctx.lineTo(x * gs, this.gridHeight * gs); } for (let y = 0; y <= this.gridHeight; y++) { this.ctx.moveTo(0, y * gs); this.ctx.lineTo(this.gridWidth * gs, y * gs); } this.ctx.stroke(); this.ctx.strokeStyle = '#900'; this.ctx.lineWidth = 3 / this.zoom; this.ctx.strokeRect(0, 0, this.gridWidth * gs, this.gridHeight * gs); }
    drawHoverAndVectorUI() { if (this.hoveredLine && (this.activeLayerName === 'walls' || this.activeLayerName === 'tapestry')) { this.drawTapestryArrow(); } }
    drawTapestryArrow() { const gs = this.gridSize; const {type, x, y} = this.hoveredLine; let midX, midY, angle; if (type === 'V') { midX = (x + 1) * gs; midY = y * gs + gs / 2; angle = this.tapestryDirection === 0 ? -Math.PI / 2 : Math.PI / 2; } else { midX = x * gs + gs / 2; midY = (y + 1) * gs; angle = this.tapestryDirection === 0 ? 0 : Math.PI; } const arrowSize = 8 / this.zoom; this.ctx.save(); this.ctx.translate(midX, midY); this.ctx.rotate(angle); this.ctx.fillStyle = 'rgba(255, 255, 0, 0.9)'; this.ctx.beginPath(); this.ctx.moveTo(0, 0); this.ctx.lineTo(-arrowSize, -arrowSize/2); this.ctx.lineTo(-arrowSize, arrowSize/2); this.ctx.closePath(); this.ctx.fill(); this.ctx.restore(); }

    renderWallLayer(items, pass) { if (!items) return; for(const [key, item] of items.entries()) { this.ctx.globalAlpha = 1.0; if (key.startsWith('VEC_')) this.renderVectorWall(item, pass); else this.renderGridWall(key, item, pass); } }
    renderGridWall(key, item, pass) { const gs = this.gridSize; const wallThickness = 4; const [type, x, y] = key.split('_'); const isDoor = item.key.includes('/door/'); if (pass === 'fill') { const img = this.preloadedImages.get(item.key); if (img) { this.ctx.save(); this.ctx.fillStyle = this.ctx.createPattern(img, 'repeat'); if (type === 'V') { this.ctx.fillRect((+x + 1) * gs - wallThickness/2, +y * gs, wallThickness, gs); } else { this.ctx.fillRect(+x * gs, (+y + 1) * gs - wallThickness/2, gs, wallThickness); } this.ctx.restore(); } } else if (pass === 'lines') { this.ctx.strokeStyle = isDoor ? '#0AF' : '#F00'; this.ctx.lineWidth = 2 / this.zoom; this.ctx.beginPath(); if (type === 'V') { this.ctx.moveTo((+x + 1) * gs, +y * gs); this.ctx.lineTo((+x + 1) * gs, (+y + 1) * gs); } else { this.ctx.moveTo(+x * gs, (+y + 1) * gs); this.ctx.lineTo((+x + 1) * gs, (+y + 1) * gs); } this.ctx.stroke(); } }
    renderVectorWall(item, pass) { const [x1, y1, x2, y2] = item.points.map(p => p * this.gridSize); if (pass==='fill') { /* ... */ } else if (pass === 'lines') { const isDoor = item.key.includes('/door/'); this.ctx.strokeStyle = isDoor ? '#0AF' : '#F00'; this.ctx.lineWidth = 2 / this.zoom; this.ctx.beginPath(); this.ctx.moveTo(x1, y1); this.ctx.lineTo(x2, y2); this.ctx.stroke(); } }

    renderTileLayer(items) {
        const gs = this.gridSize; if (!items) return;
        for (const [coordKey, item] of items.entries()) {
            const [x, y] = coordKey.split(',').map(Number);
            const size = item.size || 1;
            const img = this.preloadedImages.get(item.key);
            if (img) {
                if (size < 1) {
                    const repeats = 1 / size;
                    const subSize = gs * size;
                    for (let ty = 0; ty < repeats; ty++) {
                        for (let tx = 0; tx < repeats; tx++) {
                            this.ctx.drawImage(img, (x * gs) + (tx * subSize), (y * gs) + (ty * subSize), subSize, subSize);
                        }
                    }
                } else {
                    const drawSize = gs * size;
                    this.ctx.drawImage(img, x * gs, y * gs, drawSize, drawSize);
                }
            }
        }
    }

    bucketFill(startX, startY) { if (!this.activeBrush) return; this.modifyState(() => { const layer = this.levelData[this.activeLayerName]; if (layer.has(`${startX},${startY}`)) return; const q = [[startX, startY]]; const visited = new Set([`${startX},${startY}`]); while (q.length > 0) { const [x, y] = q.shift(); layer.set(`${x},${y}`, { type: this.activeBrush.type, key: this.activeBrush.key, rotation: 0, size: this.activeTileSize }); const neighbors = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]; for (const [nx, ny] of neighbors) { const key = `${nx},${ny}`; if (nx < 0 || nx >= this.gridWidth || ny < 0 || ny >= this.gridHeight || visited.has(key) || layer.has(key) || this.hasWallBetween(x, y, nx, ny)) continue; visited.add(key); q.push([nx, ny]); } } }); }
    hasWallBetween(x1, y1, x2, y2) { const walls = this.levelData['walls']; if (!walls) return false; if (x1 !== x2) { const wallX = Math.min(x1, x2); if (walls.has(`V_${wallX}_${y1}`)) return true; } else { const wallY = Math.min(y1, y2); if (walls.has(`H_${x1}_${wallY}`)) return true; } const cx1 = (x1 + 0.5) * this.gridSize, cy1 = (y1 + 0.5) * this.gridSize, cx2 = (x2 + 0.5) * this.gridSize, cy2 = (y2 + 0.5) * this.gridSize; for (const [key, wall] of walls.entries()) { if (!key.startsWith('VEC_')) continue; const [wx1, wy1, wx2, wy2] = wall.points.map(p => p * this.gridSize); if (this.lineSegmentsIntersect(cx1, cy1, cx2, cy2, wx1, wy1, wx2, wy2)) return true; } return false; }
    lineSegmentsIntersect(x1,y1,x2,y2,x3,y3,x4,y4) { const d=(x1-x2)*(y3-y4)-(y1-y2)*(x3-x4); if(d===0) return false; const t=((x1-x3)*(y3-y4)-(y1-y3)*(x3-x4))/d; const u=-((x1-x2)*(y1-y3)-(y1-y2)*(x1-x3))/d; return t>0&&t<1&&u>0&&u<1; }
    pointToSegmentDistance(px,py,x1,y1,x2,y2) { const l2=(x2-x1)**2+(y2-y1)**2; if(l2===0) return Math.sqrt((px-x1)**2+(py-y1)**2); let t=((px-x1)*(x2-x1)+(py-y1)*(y2-y1))/l2; t=Math.max(0,Math.min(1,t)); const projX=x1+t*(x2-x1), projY=y1+t*(y2-y1); return Math.sqrt((px-projX)**2+(py-projY)**2); }
    getLevelDataObject() { const levelObject = { settings: { width: this.gridWidth, height: this.gridHeight, defaults: this.defaultTextures }, layers: {} }; for (const layerName of this.layerOrder) { const layerMap = this.levelData[layerName]; if (layerMap.size > 0) levelObject.layers[layerName] = Array.from(layerMap.entries()); } return levelObject; }
    async saveLevel() { const jsonString = JSON.stringify(this.getLevelDataObject(), null, 2); const blob = new Blob([jsonString], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `level_${this.currentLevel}.json`; a.click(); a.remove(); URL.revokeObjectURL(a.href); this.isLevelDirty = false; this.history = [this.cloneLevelData(this.levelData)]; this.historyIndex = 0; }
    async loadLevel(levelNum, isInitialLoad = false) { if (!isInitialLoad && this.isLevelDirty && !confirm('Discard unsaved changes?')) return; const path = `/data/levels/level_${levelNum}.json`; try { const response = await fetch(path); if (!response.ok) throw new Error('Level not found'); const data = await response.json(); this.applyLoadedData(data); } catch (err) { if (isInitialLoad || confirm(`Level ${levelNum} not found. Create new level?`)) { this.layerOrder.forEach(layer => this.levelData[layer].clear()); } else { this.ui.levelNumberInput.value = this.currentLevel; return; } } this.currentLevel = levelNum; this.isLevelDirty = false; this.history = [this.cloneLevelData(this.levelData)]; this.historyIndex = 0; this.ui.updateUIForNewLevel(); this.render(); }
    applyLoadedData(data) { this.gridWidth = data.settings?.width || 64; this.gridHeight = data.settings?.height || 64; this.defaultTextures = data.settings?.defaults || {}; this.ui.updateSettingsUI(); this.layerOrder.forEach(layer => this.levelData[layer].clear()); const loadedLayers = data.layers || {}; for (const layerName in loadedLayers) if (this.levelData.hasOwnProperty(layerName)) this.levelData[layerName] = new Map(loadedLayers[layerName]); }
}
window.addEventListener('DOMContentLoaded', () => { new LevelEditor(); });