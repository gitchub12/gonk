// BROWSERFIREFOXHIDE editor.js
// Standalone Level Editor Application

class EditorAssetManager {
    constructor(modelSystem) {
        this.modelSystem = modelSystem;
        this.npcSkins = [];
        this.npcIcons = new Map();
        this.furnitureJsons = new Map();
        this.assetIcons = new Map(); 
        this.textureLayers = ['subfloor', 'floor', 'water', 'floater', 'decor', 'ceiling', 'sky', 'wall', 'door', 'cover', 'tapestry', 'dangler', 'spawn'];
        this.layerTextures = {};
        this.textureLayers.forEach(type => this.layerTextures[type] = []);
    }

    async fetchDirectoryListing(path) {
        try {
            const response = await fetch(path);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            return Array.from(doc.querySelectorAll('a')).map(a => a.getAttribute('href')).filter(href => !href.startsWith('?') && !href.startsWith('/'));
        } catch (e) {
            console.error(`Failed to fetch or parse directory listing for "${path}":`, e);
            return [];
        }
    }

    async discoverAssets() {
        const skinFiles = await this.fetchDirectoryListing('/data/skins/');
        this.npcSkins = skinFiles.filter(f => f.endsWith('.png')).map(f => `/data/skins/${f}`);
        await this.generateNpcIcons();
        for (const layerType of this.textureLayers) {
            const path = `/data/pngs/${layerType}/`;
            const textureFiles = await this.fetchDirectoryListing(path);
            this.layerTextures[layerType] = textureFiles.filter(f => f.endsWith('.png')).map(f => `${path}${f}`);
        }
        try {
            const furnitureManifestResponse = await fetch('/data/furniture.json');
            const furnitureManifest = await furnitureManifestResponse.json();
            const modelPath = furnitureManifest._config.modelPath;
            const furnitureFiles = await this.fetchDirectoryListing(`/${modelPath}`);
            furnitureFiles.filter(f => f.endsWith('.json')).forEach(file => {
                const name = file.replace('.json', '');
                this.furnitureJsons.set(name, `/${modelPath}${file}`);
                this.assetIcons.set(name, this.createPlaceholderIcon(name));
            });
        } catch (e) { console.error("Failed to discover furniture assets:", e); }
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
        if (spawnLayer.has(coordKey)) return; // Don't limit to 9 anymore
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
                case 'paint': 
                    if (this.activeLayerName === 'spawns') this.placeSpawn(x, y);
                    else this.placeItem(x, y); 
                    break;
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
        if (newHoveredLine && newHoveredLine.type === 'H') {
            newHoveredLine.x += 1; // FORCE OFFSET AS PER USER REQUEST
        }
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
            case 'paint':
                if (this.activeLayerName === 'spawns') this.placeSpawn(x, y);
                else this.placeItem(x, y);
                break;
            case 'erase': this.eraseItem(x, y); break;
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

        for (let i = 0; i <= activeLayerIndex; i++) {
            const layerName = this.layerOrder[i]; const items = this.levelData[layerName];
            if (this.defaultTextures[layerName]) {
                const img = this.preloadedImages.get(this.defaultTextures[layerName]);
                if (img) for (let y = startY; y < endY; y++) for (let x = startX; x < endX; x++) this.ctx.drawImage(img, x * gs, y * gs, gs, gs);
            }
            if (items) {
                 for (const [coordKey] of items.entries()) {
                    if (this.lineLayers.includes(layerName)) continue;
                    const [x, y] = coordKey.split(',').map(Number);
                    if(x < startX || x > endX || y < startY || y > endY) continue;
                     if (layerName === 'floor' || layerName === 'subfloor') {
                        const img = this.preloadedImages.get(this.levelData[layerName].get(coordKey).key);
                        if(img) { this.ctx.drawImage(img, x*gs, y*gs, gs, gs); this.ctx.fillStyle = 'rgba(0,0,0,0.4)'; this.ctx.fillRect(x * gs, y * gs, gs, gs); }
                    }
                 }
            }
            if (this.lineLayers.includes(layerName)) {
                if (items) for(const [key] of items.entries()) {
                    const [type, xStr, yStr] = key.split('_'); const x = Number(xStr); const y = Number(yStr);
                    const img = this.preloadedImages.get(this.levelData[layerName].get(key).key);
                    if (img) { this.ctx.save(); if (type === 'V') this.ctx.translate((x + 1) * gs, y * gs); else { this.ctx.translate(x * gs, (y + 1) * gs); this.ctx.rotate(Math.PI / 2); } this.ctx.drawImage(img, -(gs*0.05), 0, gs*0.1, gs); this.ctx.restore(); }
                }
            } else if (items) for (const [coordKey, item] of items.entries()) {
                const [x, y] = coordKey.split(',').map(Number);
                if(layerName === 'floor' || layerName === 'subfloor') continue;
                let img = null;
                if (layerName === 'spawns') img = this.preloadedImages.get(item.key);
                else img = (item.type === 'npc' || item.type === 'asset') ? window[item.key + '_icon_img'] : this.preloadedImages.get(item.key);
                if (layerName === 'water' && i <= activeLayerIndex) this.ctx.globalAlpha = 0.3;
                if (img) {
                    this.ctx.save(); this.ctx.translate(x * gs + gs / 2, y * gs + gs / 2);
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
        this.ctx.lineWidth = 1 / this.zoom; this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        this.ctx.beginPath();
        for (let x = startX; x <= endX; x++) { this.ctx.moveTo(x * gs, startY * gs); this.ctx.lineTo(x * gs, endY * gs); }
        for (let y = startY; y <= endY; y++) { this.ctx.moveTo(startX * gs, y * gs); this.ctx.lineTo(endX * gs, y * gs); }
        this.ctx.stroke();
        this.ctx.strokeStyle = '#900'; this.ctx.lineWidth = 3 / this.zoom; this.ctx.strokeRect(0, 0, this.gridWidth * gs, this.gridHeight * gs);
        if (this.hoveredLine) {
            this.ctx.strokeStyle = 'rgba(100, 180, 255, 0.7)'; this.ctx.lineWidth = 6 / this.zoom; this.ctx.lineCap = 'round';
            this.ctx.beginPath();
            if (this.hoveredLine.type === 'V') { this.ctx.moveTo((this.hoveredLine.x + 1) * gs, this.hoveredLine.y * gs); this.ctx.lineTo((this.hoveredLine.x + 1) * gs, (this.hoveredLine.y + 1) * gs); } 
            else { this.ctx.moveTo(this.hoveredLine.x * gs, (this.hoveredLine.y + 1) * gs); this.ctx.lineTo((this.hoveredLine.x + 1) * gs, (this.hoveredLine.y + 1) * gs); }
            this.ctx.stroke(); this.ctx.lineCap = 'butt';
        }
        this.ctx.restore();
    }
    
    async saveLevel() {
        const levelObject = { settings: { width: this.gridWidth, height: this.gridHeight, defaults: this.defaultTextures }, layers: {} };
        for (const layerName of this.layerOrder) {
            const layerMap = this.levelData[layerName];
            if (layerMap.size > 0) levelObject.layers[layerName] = Array.from(layerMap.entries());
        }
        const jsonString = JSON.stringify(levelObject, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `level_${this.currentLevel}.json`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(a.href);
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

class EditorUI {
    constructor(editor) {
        this.editor = editor; this.assetManager = editor.assetManager;
        this.layerSelector = document.getElementById('layer-selector'); this.paletteContainer = document.getElementById('palette-container');
        this.gridWidthInput = document.getElementById('grid-width-input'); this.gridHeightInput = document.getElementById('grid-height-input');
        this.levelNumberInput = document.getElementById('level-number-input'); this.levelDisplay = document.getElementById('level-display');
        this.contextMenu = document.getElementById('context-menu');
        this.defaultTextureSelects = {}; this.layerButtons = {};
        ['subfloor', 'floor', 'water', 'floater', 'ceiling', 'sky'].forEach(id => {
            const el = document.getElementById(`default-${id}-select`); if(el) this.defaultTextureSelects[id] = el;
        });
        this.toolButtons = { paint: document.getElementById('tool-paint'), erase: document.getElementById('tool-erase'), rotate: document.getElementById('tool-rotate'), spawn: document.getElementById('tool-spawn')};
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
            const levelObject = {
                settings: { width: this.editor.gridWidth, height: this.editor.gridHeight, defaults: this.editor.defaultTextures },
                layers: {}
            };
            for (const layerName of this.editor.layerOrder) {
                const layerMap = this.editor.levelData[layerName];
                if (layerMap.size > 0) levelObject.layers[layerName] = Array.from(layerMap.entries());
            }
            localStorage.setItem('gonk_level_to_play', JSON.stringify(levelObject));
            window.open('index.html?play=true', '_blank');
        });
        this.gridWidthInput.addEventListener('change', () => { this.editor.gridWidth = parseInt(this.gridWidthInput.value) || 64; this.editor.modifyState(()=>{});});
        this.gridHeightInput.addEventListener('change', () => { this.editor.gridHeight = parseInt(this.gridHeightInput.value) || 64; this.editor.modifyState(()=>{});});
        for(const [layer, select] of Object.entries(this.defaultTextureSelects)) {
            select.addEventListener('change', () => { this.editor.defaultTextures[layer] = select.value; this.editor.modifyState(()=>{}); });
        }
        Object.entries(this.toolButtons).forEach(([toolName, button]) => button.addEventListener('click', () => this.setActiveTool(toolName)));
        this.populateDefaultTextureSettings(); this.setActiveLayer(this.editor.activeLayerName);
    }
    
    createLayerSelector() {
        this.layerSelector.innerHTML = '';
        const specialNpcButtons = [
            { label: 'Aliens', icon: '/data/pngs/icons for UI/aliensicon.png', group: 'Aliens' },
            { label: 'Droids', icon: '/data/pngs/icons for UI/droidicon.png', group: 'Droids' },
            { label: 'Stormies', icon: '/data/pngs/icons for UI/stormiesicon.png', group: 'Stormies' },
        ];
        this.editor.layerOrder.forEach(layerName => {
            if(layerName === 'npcs'){
                specialNpcButtons.forEach(npcInfo => {
                    const btn = this.createButton(layerName, npcInfo.label, npcInfo.icon);
                    btn.addEventListener('click', () => this.setActiveLayer(layerName, npcInfo.group));
                    this.layerSelector.appendChild(btn);
                });
            } else {
                const btn = this.createButton(layerName, layerName, null);
                btn.addEventListener('click', () => this.setActiveLayer(layerName));
                this.layerSelector.appendChild(btn);
            }
        });
    }

    createButton(layerName, label, overrideIcon) {
        const button = document.createElement('button');
        button.dataset.layer = layerName;
        button.title = label.charAt(0).toUpperCase() + label.slice(1);
        let iconSrc = overrideIcon;
        if (!iconSrc) {
            switch(layerName) {
                case 'assets': iconSrc = '/data/pngs/icons for UI/crate.png'; break;
                case 'spawns': iconSrc = '/data/pngs/spawn/hologonk_1.png'; break;
                default:
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
        this.editor.activeLayerName = layerName;
        document.querySelectorAll('#layer-selector button').forEach(btn => btn.classList.remove('active'));
        const buttons = this.layerButtons[layerName];
        if (buttons) {
            let targetButton = buttons[0];
            if(subGroup && buttons.length > 1) targetButton = buttons.find(b => b.title === subGroup) || buttons[0];
            if (targetButton) targetButton.classList.add('active');
        }
        this.setActiveTool(layerName === 'spawns' ? 'spawn' : 'paint');
        this.updatePalette(subGroup); 
        this.editor.render();
    }

    setActiveTool(toolName) {
        this.editor.activeTool = toolName;
        Object.values(this.toolButtons).forEach(btn => btn.classList.remove('active'));
        if (this.toolButtons[toolName]) this.toolButtons[toolName].classList.add('active');
        const cursors = { paint: 'crosshair', erase: 'not-allowed', rotate: 'grab', spawn: 'pointer' };
        this.editor.canvas.style.cursor = cursors[toolName] || 'default';
        if (toolName === 'spawn') this.editor.activeLayerName = 'spawns';
        this.updatePalette();
    }
    
    getLayerButtonOrder() { return Array.from(document.querySelectorAll('#layer-selector button')); }

    updateUIForNewLevel() {
        this.levelNumberInput.value = this.editor.currentLevel;
        this.levelDisplay.textContent = `Level: ${this.editor.currentLevel}`;
    }

    updatePalette(subGroup = null) {
        const activeLayer = this.editor.activeLayerName; const activeTool = this.editor.activeTool;
        const showPalette = activeTool === 'paint';
        document.querySelector('.content-group h4').style.display = showPalette ? 'block' : 'none';
        this.paletteContainer.style.display = showPalette ? 'grid' : 'none';
        document.getElementById('palette-controls').style.display = showPalette ? 'flex' : 'none';
        if (!showPalette) { this.editor.activeBrush = null; return; }

        if (activeLayer === 'spawns') {
            this.paletteContainer.innerHTML = '';
            this.editor.activeBrush = { type: 'spawn', key: '/data/pngs/spawn/hologonk_1.png' };
            return;
        }

        if (activeLayer === 'npcs') this.populateNpcPalette();
        else if (activeLayer === 'assets') this.populateAssetPalette();
        else this.populateTexturePalette();
        
        const defaultBrushItem = Array.from(this.paletteContainer.querySelectorAll('.palette-item')).find(item => item.querySelector('span').textContent.endsWith('_1'));
        if(defaultBrushItem) { defaultBrushItem.click(); }
        else if (this.paletteContainer.querySelector('.palette-item')) { this.paletteContainer.querySelector('.palette-item').click(); }
        else { this.editor.activeBrush = null; }

        if(subGroup) { const header = document.getElementById(`palette-header-${subGroup}`); if(header) header.scrollIntoView({behavior: "smooth", block: "start"}); }
    }
    
    showContextMenu(event, gridX, gridY) {
        this.hideContextMenu();
        const item = this.editor.levelData[this.editor.activeLayerName]?.get(`${gridX},${gridY}`);
        if (!item) return;
        const menuList = this.contextMenu.querySelector('ul'); menuList.innerHTML = '';
        let options = ['Properties', 'Delete'];
        if(item.key?.toLowerCase().includes('door')) options.unshift('Set Key Requirement', 'Set Level Exit');
        if(item.key?.toLowerCase().includes('wall')) options.unshift('Make Holographic');
        options.forEach(opt => {
            const li = document.createElement('li'); li.textContent = opt;
            li.addEventListener('click', () => { alert(`Action: ${opt} on ${item.key}`); this.hideContextMenu(); });
            menuList.appendChild(li);
        });
        this.contextMenu.style.left = `${event.clientX}px`; this.contextMenu.style.top = `${event.clientY}px`;
        this.contextMenu.style.display = 'block';
    }

    hideContextMenu() { this.contextMenu.style.display = 'none'; }
    
    _populatePalette(items, createItemFn) {
        this.paletteContainer.innerHTML = ''; if (!items || items.length === 0) { this.paletteContainer.innerHTML = `<p>No assets found</p>`; return; }
        items.forEach(createItemFn);
    }

    populateTexturePalette() {
        const selectedLayer = this.editor.activeLayerName; let textures = this.assetManager.layerTextures[selectedLayer];
        if (selectedLayer === 'walls') textures = [...this.assetManager.layerTextures['wall'],...this.assetManager.layerTextures['door'],...this.assetManager.layerTextures['cover']];
        this._populatePalette(textures, path => {
            const item = document.createElement('div'); item.className = 'palette-item';
            const img = new Image(); img.src = path; item.appendChild(img);
            const label = document.createElement('span'); label.textContent = path.split('/').pop().replace('.png', '').replace(/_/g, ' '); item.appendChild(label);
            item.addEventListener('click', () => { this.paletteContainer.querySelectorAll('.palette-item').forEach(p => p.classList.remove('active')); item.classList.add('active'); this.editor.activeBrush = { type: 'texture', key: path }; });
            this.paletteContainer.appendChild(item);
        });
    }

    populateAssetPalette() {
        this._populatePalette(Array.from(this.assetManager.assetIcons.entries()), ([name, iconUrl]) => {
            const item = document.createElement('div'); item.className = 'palette-item';
            const img = new Image(); img.src = iconUrl; item.appendChild(img);
            const label = document.createElement('span'); label.textContent = name; item.appendChild(label);
            item.addEventListener('click', () => { this.paletteContainer.querySelectorAll('.palette-item').forEach(p => p.classList.remove('active')); item.classList.add('active'); this.editor.activeBrush = { type: 'asset', key: name }; });
            this.paletteContainer.appendChild(item);
        });
    }

    populateDefaultTextureSettings() {
        for(const [layer, select] of Object.entries(this.defaultTextureSelects)) {
            select.innerHTML = ''; const textures = this.assetManager.layerTextures[layer] || [];
            const noneOption = document.createElement('option'); noneOption.value = ''; noneOption.textContent = 'None'; select.appendChild(noneOption);
            textures.forEach(path => { const option = document.createElement('option'); option.value = path; option.textContent = path.split('/').pop(); select.appendChild(option); });
            if (layer === 'floor') {
                const defaultFloorTexture = '/data/pngs/floor/floor_1.png';
                if (textures.includes(defaultFloorTexture)) { select.value = defaultFloorTexture; this.editor.defaultTextures['floor'] = defaultFloorTexture; }
                else if (textures.length > 0) { select.value = textures[0]; this.editor.defaultTextures['floor'] = textures[0]; }
            }
        }
    }

    updateSettingsUI() {
        this.gridWidthInput.value = this.editor.gridWidth; this.gridHeightInput.value = this.editor.gridHeight;
        for(const [layer, select] of Object.entries(this.defaultTextureSelects)) select.value = this.editor.defaultTextures[layer] || '';
    }

    populateNpcPalette() {
        this.paletteContainer.innerHTML = '';
        const npcGroups = { 'Aliens': [], 'Droids': [], 'Stormies': [] };
        const groupMap = { 'wookiee': 'Aliens', 'gungan': 'Aliens', 'stormtrooper': 'Stormies' };
        this.assetManager.npcIcons.forEach((iconDataUrl, skinName) => {
            const baseName = skinName.match(/^(bb8|r2d2)/) ? skinName.match(/^(bb8|r2d2)/)[0] : skinName.replace(/\d+$/, '');
            const group = groupMap[baseName] || 'Droids';
            npcGroups[group].push({ skinName, iconDataUrl });
        });
        for (const groupName in npcGroups) {
            if(npcGroups[groupName].length === 0) continue;
            const header = document.createElement('div'); header.className = 'palette-header'; header.textContent = groupName; header.id = `palette-header-${groupName}`; this.paletteContainer.appendChild(header);
            for (const { skinName, iconDataUrl } of npcGroups[groupName]) {
                const item = document.createElement('div'); item.className = 'palette-item';
                const img = new Image(); img.src = iconDataUrl; window[skinName + '_icon_img'] = img; item.appendChild(img);
                const label = document.createElement('span'); label.textContent = skinName; item.appendChild(label);
                item.addEventListener('click', () => {
                    this.paletteContainer.querySelectorAll('.palette-item').forEach(p => p.classList.remove('active'));
                    item.classList.add('active'); this.editor.activeBrush = { type: 'npc', key: skinName };
                });
                this.paletteContainer.appendChild(item);
            }
        }
    }
}

window.addEventListener('DOMContentLoaded', () => { new LevelEditor(); });