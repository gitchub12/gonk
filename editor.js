// BROWSERFIREFOXHIDE editor.js
// Standalone Level Editor Application

class EditorAssetManager {
    constructor(modelSystem) {
        this.modelSystem = modelSystem;
        this.npcSkins = [];
        this.npcIcons = new Map();
        this.furnitureJsons = new Map();
        this.assetIcons = new Map(); 
        this.textureLayers = ['subfloor', 'floor', 'water', 'floater', 'decor', 'ceiling', 'sky', 'wall', 'door', 'cover', 'tapestry', 'dangler'];
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
        
        const textureFiles = await this.fetchDirectoryListing('/data/pngs/');
        const texturePngs = textureFiles.filter(f => f.endsWith('.png'));
        for (const layerType of this.textureLayers) {
            this.layerTextures[layerType] = texturePngs
                .filter(f => f.toLowerCase().startsWith(layerType))
                .map(f => `/data/pngs/${f}`);
        }
        
        const furnitureFiles = await this.fetchDirectoryListing('/data/furniture/models/');
        furnitureFiles.filter(f => f.endsWith('.json')).forEach(file => {
            const name = file.replace('.json', '');
            this.furnitureJsons.set(name, `/data/furniture/models/${file}`);
            this.assetIcons.set(name, this.createPlaceholderIcon(name));
        });
        return true;
    }

    createPlaceholderIcon(name) {
        const canvas = document.createElement('canvas');
        canvas.width = 64; canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#555';
        ctx.fillRect(0, 0, 64, 64);
        ctx.fillStyle = '#fff';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(name, 32, 32);
        return canvas.toDataURL();
    }

    async generateNpcIcons() {
        const iconPromises = this.npcSkins.map(skinPath => {
            return new Promise(resolve => {
                const img = new Image();
                img.crossOrigin = "Anonymous";
                img.src = skinPath;
                img.onload = () => {
                    const skinName = skinPath.split('/').pop().replace('.png', '');
                    let baseName = skinName.startsWith('bb8') || skinName.startsWith('r2d2') ? skinName.match(/^(bb8|r2d2)/)[0] : skinName.replace(/\d+$/, '');
                    let modelDef = this.modelSystem.models[baseName] || this.modelSystem.models['humanoid'];
                    const iconUV = modelDef.iconUV || { x: 8, y: 8, size: 8 };
                    const iconCanvas = document.createElement('canvas');
                    const iconSize = 64;
                    iconCanvas.width = iconSize;
                    iconCanvas.height = iconSize;
                    const ctx = iconCanvas.getContext('2d');
                    ctx.imageSmoothingEnabled = false;
                    const scale = img.width / 64;
                    const faceX = iconUV.x * scale, faceY = iconUV.y * scale, faceSize = iconUV.size * scale;
                    const hasHatLayer = modelDef === this.modelSystem.models['humanoid'];
                    const hatX = 40 * scale, hatY = 8 * scale, hatSize = 8 * scale;
                    ctx.drawImage(img, faceX, faceY, faceSize, faceSize, 0, 0, iconSize, iconSize);
                    if(hasHatLayer) ctx.drawImage(img, hatX, hatY, hatSize, hatSize, 0, 0, iconSize, iconSize);
                    const canvasData = ctx.getImageData(0, 0, iconSize, iconSize).data;
                    let isBlank = true;
                    for (let i = 3; i < canvasData.length; i += 4) { if (canvasData[i] > 0) { isBlank = false; break; } }
                    if (isBlank) {
                        ctx.clearRect(0, 0, iconSize, iconSize);
                        const { width: imgWidth, height: imgHeight } = img;
                        const ar = imgWidth / imgHeight;
                        let dw = iconSize, dh = iconSize / ar;
                        if (dh > iconSize) { dh = iconSize; dw = iconSize * ar; }
                        ctx.drawImage(img, (iconSize - dw) / 2, (iconSize - dh) / 2, dw, dh);
                    }
                    this.npcIcons.set(skinName, iconCanvas.toDataURL());
                    resolve();
                };
                img.onerror = () => { console.warn(`Failed to load skin image: ${skinPath}`); resolve(); };
            });
        });
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
        this.gridSize = 32;
        this.gridWidth = 64;
        this.gridHeight = 64;
        this.zoom = 1.0;
        this.panX = 0;
        this.panY = 0;
        this.isPanning = false;
        this.isPainting = false;
        this.lastPlacedCoord = '';
        this.activeTool = 'paint'; // 'paint', 'erase', 'rotate', 'spawn'
        this.activeBrush = null;
        this.lastUsedBrush = {};
        this.hoveredLine = null;
        this.layerOrder = ['subfloor', 'floor', 'npcs', 'assets', 'spawns', 'walls', 'tapestry', 'dangler', 'water', 'floater', 'decor', 'ceiling', 'sky'];
        this.lineLayers = ['walls', 'tapestry'];
        this.levelData = {};
        this.layerOrder.forEach(layer => this.levelData[layer] = new Map());
        this.defaultTextures = {};
        this.preloadedImages = new Map();
        this.init();
    }

    async init() {
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        this.canvas.addEventListener('mousedown', e => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', e => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', e => this.onMouseUp(e));
        this.canvas.addEventListener('wheel', e => this.onMouseWheel(e));
        this.canvas.addEventListener('contextmenu', e => e.preventDefault());
        await this.assetManager.discoverAssets();
        await this.preloadAllTextures();
        this.ui.init();
        this.render();
    }
    
    async preloadAllTextures() {
        const allPaths = new Set(['/data/pngs/hologonk.png']);
        Object.values(this.assetManager.layerTextures).forEach(arr => arr.forEach(path => allPaths.add(path)));
        const promises = [];
        allPaths.forEach(path => {
            promises.push(new Promise(resolve => {
                const img = new Image();
                img.src = path;
                img.onload = () => { this.preloadedImages.set(path, img); resolve(); };
                img.onerror = () => { console.error(`Failed to preload image: ${path}`); resolve(); }
            }));
        });
        await Promise.all(promises);
    }

    resizeCanvas() {
        const container = document.getElementById('canvasContainer');
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
        this.render();
    }
    
    getGridCoordsFromEvent(e) {
        const { x: worldX, y: worldY } = this.getMouseWorldCoords(e);
        return { x: Math.floor(worldX / this.gridSize), y: Math.floor(worldY / this.gridSize) };
    }
    
    getMouseWorldCoords(e) {
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        return { x: (mouseX - this.panX) / this.zoom, y: (mouseY - this.panY) / this.zoom };
    }
    
    eraseItem(gridX, gridY) {
        const activeLayer = this.ui.getActiveLayer();
        if (this.lineLayers.includes(activeLayer)) {
            if (!this.hoveredLine) return;
            const lineKey = `${this.hoveredLine.type}_${this.hoveredLine.x}_${this.hoveredLine.y}`;
            if (this.levelData[activeLayer].has(lineKey)) {
                this.levelData[activeLayer].delete(lineKey);
                this.statusMsg.textContent = `Erased item from ${activeLayer}.`;
                this.render();
            }
        } else {
            const coordKey = `${gridX},${gridY}`;
            if (this.levelData[activeLayer].has(coordKey)) {
                this.levelData[activeLayer].delete(coordKey);
                this.statusMsg.textContent = `Erased item from ${coordKey} on ${activeLayer}.`;
                this.render();
            }
        }
    }

    placeItem(gridX, gridY) {
        if (!this.activeBrush) return;
        const activeLayer = this.ui.getActiveLayer();
        let currentCoord = `${gridX},${gridY}`;
        
        if (this.lineLayers.includes(activeLayer)) {
            if (!this.hoveredLine) return;
            currentCoord = `${this.hoveredLine.type}_${this.hoveredLine.x}_${this.hoveredLine.y}`;
            if (this.isPainting && this.lastPlacedCoord === currentCoord) return;
            
            const itemType = this.activeBrush.key.split('/').pop().match(/^[a-zA-Z]+/)[0].toLowerCase();
            const allowedTypes = { walls: ['wall', 'door', 'cover'], tapestry: ['tapestry'] };
            if (!allowedTypes[activeLayer].includes(itemType)) return;

            this.levelData[activeLayer].set(currentCoord, {type: this.activeBrush.type, key: this.activeBrush.key});
        } 
        else {
            if (this.isPainting && this.lastPlacedCoord === currentCoord) return;
            if (['npcs', 'assets', 'spawns'].includes(activeLayer) && this.levelData[activeLayer].has(currentCoord)) return;

            if (this.activeBrush.type === 'npc' && activeLayer !== 'npcs') return;
            if (this.activeBrush.type === 'asset' && activeLayer !== 'assets') return;
            if (this.activeBrush.type === 'texture') {
                const textureType = this.activeBrush.key.split('/').pop().match(/^[a-zA-Z]+/)[0].toLowerCase();
                if (textureType !== activeLayer) return;
            }
            this.levelData[activeLayer].set(currentCoord, { type: this.activeBrush.type, key: this.activeBrush.key, rotation: 0 });
        }
        
        this.lastPlacedCoord = currentCoord;
        this.lastUsedBrush[activeLayer] = this.activeBrush;
        this.statusMsg.textContent = `Placed ${this.activeBrush.key.split('/').pop()}`;
        this.render();
    }
    
    placeSpawn(gridX, gridY) {
        if (this.ui.getActiveLayer() !== 'spawns') return;
        const coordKey = `${gridX},${gridY}`;
        const spawnLayer = this.levelData['spawns'];
        if (spawnLayer.has(coordKey) || spawnLayer.size >= 9) return;
        
        spawnLayer.set(coordKey, {
            number: spawnLayer.size + 1,
            rotation: 0
        });
        this.render();
        this.statusMsg.textContent = `Placed spawn point #${spawnLayer.size}.`;
    }

    rotateItem(gridX, gridY) {
        const activeLayer = this.ui.getActiveLayer();
        if (this.lineLayers.includes(activeLayer)) return;
        const coordKey = `${gridX},${gridY}`;
        const item = this.levelData[activeLayer].get(coordKey);
        if (item) {
            item.rotation = (item.rotation + 1) % 4;
            this.render();
            this.statusMsg.textContent = `Rotated item at ${coordKey}.`;
        }
    }

    resetLayer() {
        const activeLayer = this.ui.getActiveLayer();
        if (window.confirm(`Are you sure you want to clear all items from the '${activeLayer}' layer?`)) {
            this.levelData[activeLayer].clear();
            this.render();
            this.statusMsg.textContent = `Layer '${activeLayer}' has been cleared.`;
        }
    }

    resetMap() {
        if (window.confirm('Are you sure you want to clear the entire map? This cannot be undone.')) {
            this.layerOrder.forEach(layer => this.levelData[layer].clear());
            this.render();
            this.statusMsg.textContent = 'Entire map has been cleared.';
        }
    }

    onMouseDown(e) {
        if (e.button === 1) { // Middle mouse for panning
             this.isPanning = true; this.lastMouse = { x: e.clientX, y: e.clientY };
             return;
        }
        const { x, y } = this.getGridCoordsFromEvent(e);
        
        if (e.button === 2) { // Right mouse for erase
            this.eraseItem(x, y);
            return;
        }
        
        if (e.button === 0) { // Left mouse for active tool
            this.isPainting = true;
            this.lastPlacedCoord = '';
            
            switch(this.activeTool) {
                case 'paint': this.placeItem(x, y); break;
                case 'erase': this.eraseItem(x, y); break;
                case 'rotate': this.rotateItem(x, y); break;
                case 'spawn': this.placeSpawn(x, y); break;
            }
        }
    }

    onMouseUp(e) { 
        if (e.button === 1) this.isPanning = false;
        if (e.button === 0) this.isPainting = false;
    }
    
    updateHoveredLine(e) {
        const activeLayer = this.ui.getActiveLayer();
        if (!this.lineLayers.includes(activeLayer)) {
            if (this.hoveredLine) { this.hoveredLine = null; this.render(); }
            this.canvas.style.cursor = 'default';
            return;
        }
        
        this.canvas.style.cursor = 'crosshair';
        const { x: worldX, y: worldY } = this.getMouseWorldCoords(e);
        const gridX = Math.floor(worldX / this.gridSize);
        const gridY = Math.floor(worldY / this.gridSize);
        const fracX = worldX / this.gridSize - gridX;
        const fracY = worldY / this.gridSize - gridY;
    
        const tolerance = 0.15; // 15% of cell size
        let closestLine = null;
    
        const dists = [
            { dist: fracY,           line: { type: 'H', x: gridX, y: gridY - 1 } },
            { dist: 1 - fracY,       line: { type: 'H', x: gridX, y: gridY } },
            { dist: fracX,           line: { type: 'V', x: gridX - 1, y: gridY } },
            { dist: 1 - fracX,       line: { type: 'V', x: gridX, y: gridY } }
        ];
    
        dists.sort((a, b) => a.dist - b.dist);
    
        if (dists[0].dist < tolerance) {
            closestLine = dists[0].line;
        }
    
        if (JSON.stringify(this.hoveredLine) !== JSON.stringify(closestLine)) {
            this.hoveredLine = closestLine;
            this.render();
        }
    }

    onMouseMove(e) {
        const { x, y } = this.getGridCoordsFromEvent(e);
        document.getElementById('coords').textContent = `X: ${x}, Y: ${y}`;

        if (this.isPanning) {
            const dx = e.clientX - this.lastMouse.x;
            const dy = e.clientY - this.lastMouse.y;
            this.panX += dx; this.panY += dy;
            this.lastMouse = { x: e.clientX, y: e.clientY };
            this.render();
            return;
        } 
        
        this.updateHoveredLine(e);

        if(this.isPainting) {
            switch(this.activeTool) {
                case 'paint': this.placeItem(x, y); break;
                case 'erase': this.eraseItem(x, y); break;
            }
        }
    }

    onMouseWheel(e) {
        e.preventDefault();
        const zoomSpeed = 1.1; const oldZoom = this.zoom;
        this.zoom *= (e.deltaY < 0 ? zoomSpeed : 1 / zoomSpeed);
        this.zoom = Math.max(0.1, Math.min(10, this.zoom));
        const mouseX = e.clientX - this.canvas.getBoundingClientRect().left;
        const mouseY = e.clientY - this.canvas.getBoundingClientRect().top;
        this.panX = mouseX - (mouseX - this.panX) * (this.zoom / oldZoom);
        this.panY = mouseY - (mouseY - this.panY) * (this.zoom / oldZoom);
        document.getElementById('zoom').textContent = `Zoom: ${Math.round(this.zoom * 100)}%`;
        this.render();
    }

    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.save();
        this.ctx.translate(this.panX, this.panY);
        this.ctx.scale(this.zoom, this.zoom);
        const gs = this.gridSize;
        const activeLayerName = this.ui.getActiveLayer();
        const activeLayerIndex = this.layerOrder.indexOf(activeLayerName);

        const visStartX = Math.floor(-this.panX / this.zoom / gs);
        const visEndX = Math.ceil((this.canvas.width - this.panX) / this.zoom / gs);
        const visStartY = Math.floor(-this.panY / this.zoom / gs);
        const visEndY = Math.ceil((this.canvas.height - this.panY) / this.zoom / gs);
        const startX = Math.max(0, visStartX); const endX = Math.min(this.gridWidth, visEndX);
        const startY = Math.max(0, visStartY); const endY = Math.min(this.gridHeight, visEndY);

        for (let i = 0; i <= activeLayerIndex; i++) {
            const layerName = this.layerOrder[i];
            const items = this.levelData[layerName];
            
            const defaultTexturePath = this.defaultTextures[layerName];
            if (defaultTexturePath) {
                const img = this.preloadedImages.get(defaultTexturePath);
                if (img) {
                    for (let y = startY; y < endY; y++) for (let x = startX; x < endX; x++) this.ctx.drawImage(img, x * gs, y * gs, gs, gs);
                }
            }
            if (layerName === 'floor' || layerName === 'subfloor') {
                this.ctx.fillStyle = 'rgba(0,0,0,0.4)';
                for (const [coordKey] of items.entries()) {
                    const [x, y] = coordKey.split(',').map(Number);
                    this.ctx.fillRect(x * gs, y * gs, gs, gs);
                }
            }

            if (this.lineLayers.includes(layerName)) {
                if (items) for(const [key, item] of items.entries()) {
                    const [type, xStr, yStr] = key.split('_');
                    const x = Number(xStr); const y = Number(yStr);
                    const img = this.preloadedImages.get(item.key);
                    if (img) {
                        this.ctx.save();
                        if (type === 'V') this.ctx.translate((x + 1) * gs, y * gs);
                        else { this.ctx.translate(x * gs, (y + 1) * gs); this.ctx.rotate(Math.PI / 2); }
                        const width = gs * 0.1;
                        this.ctx.drawImage(img, -width / 2, 0, width, gs);
                        this.ctx.restore();
                    }
                }
            } else { // Tile-based layers
                 if (items) for (const [coordKey, item] of items.entries()) {
                    const [x, y] = coordKey.split(',').map(Number);
                    let img = null;
                    if (layerName === 'spawns') img = this.preloadedImages.get('/data/pngs/hologonk.png');
                    else img = (item.type === 'npc' || item.type === 'asset') ? window[item.key + '_icon_img'] : this.preloadedImages.get(item.key);
                    
                    if (layerName === 'water' && i <= activeLayerIndex) { this.ctx.globalAlpha = 0.3; }
                    
                    if (img) {
                        this.ctx.save();
                        this.ctx.translate(x * gs + gs / 2, y * gs + gs / 2);
                        if (item.rotation) this.ctx.rotate(item.rotation * Math.PI / 2);
                        this.ctx.translate(-(x * gs + gs / 2), -(y * gs + gs / 2));
                        
                        if (layerName === 'npcs') {
                            const iconSize = gs * 0.75;
                            const xPos = (x * gs) + (gs - iconSize) / 2;
                            const yPos = (y * gs) + (gs - iconSize);
                            this.ctx.drawImage(img, xPos, yPos, iconSize, iconSize);
                        } else {
                            this.ctx.drawImage(img, x * gs, y * gs, gs, gs);
                        }
                        this.ctx.restore();
                    }

                    if (layerName === 'spawns') {
                        this.ctx.save();
                        this.ctx.translate(x * gs + gs / 2, y * gs + gs / 2);
                        // Draw number
                        const fontSize = gs * 0.5;
                        this.ctx.font = `bold ${fontSize}px Arial`;
                        this.ctx.fillStyle = 'white'; this.ctx.textAlign = 'center'; this.ctx.textBaseline = 'middle';
                        this.ctx.shadowColor = 'black'; this.ctx.shadowBlur = 4;
                        this.ctx.fillText(item.number, 0, 0);

                        // Draw facing arrow
                        this.ctx.rotate(item.rotation * Math.PI / 2);
                        this.ctx.strokeStyle = 'white'; this.ctx.lineWidth = 3 / this.zoom;
                        this.ctx.beginPath();
                        this.ctx.moveTo(0, -gs * 0.2); this.ctx.lineTo(0, -gs * 0.4);
                        this.ctx.moveTo(-gs*0.1, -gs*0.3); this.ctx.lineTo(0, -gs*0.4); this.ctx.lineTo(gs*0.1, -gs*0.3);
                        this.ctx.stroke();
                        this.ctx.restore();
                    }
                    if (layerName === 'water') this.ctx.globalAlpha = 1.0;
                }
            }
        }
        
        this.ctx.lineWidth = 1 / this.zoom; this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        this.ctx.beginPath();
        for (let x = startX; x <= endX; x++) { this.ctx.moveTo(x * gs, startY * gs); this.ctx.lineTo(x * gs, endY * gs); }
        for (let y = startY; y <= endY; y++) { this.ctx.moveTo(startX * gs, y * gs); this.ctx.lineTo(endX * gs, y * gs); }
        this.ctx.stroke();
        
        this.ctx.strokeStyle = '#900'; this.ctx.lineWidth = 3 / this.zoom;
        this.ctx.strokeRect(0, 0, this.gridWidth * gs, this.gridHeight * gs);
        
        if (this.hoveredLine) {
            this.ctx.strokeStyle = 'rgba(100, 180, 255, 0.7)'; this.ctx.lineWidth = 6 / this.zoom; this.ctx.lineCap = 'round';
            this.ctx.beginPath();
            if (this.hoveredLine.type === 'V') {
                this.ctx.moveTo((this.hoveredLine.x + 1) * gs, this.hoveredLine.y * gs);
                this.ctx.lineTo((this.hoveredLine.x + 1) * gs, (this.hoveredLine.y + 1) * gs);
            } else {
                this.ctx.moveTo(this.hoveredLine.x * gs, (this.hoveredLine.y + 1) * gs);
                this.ctx.lineTo((this.hoveredLine.x + 1) * gs, (this.hoveredLine.y + 1) * gs);
            }
            this.ctx.stroke(); this.ctx.lineCap = 'butt';
        }

        if (this.zoom >= 1.5) {
            ['npcs', 'assets'].forEach(layerName => {
                const items = this.levelData[layerName];
                if (items) {
                    const fontSize = 12 / this.zoom;
                    this.ctx.font = `bold ${fontSize}px Arial`; this.ctx.textAlign = 'center'; this.ctx.textBaseline = 'middle';
                    for (const [coordKey, item] of items.entries()) {
                        const [x, y] = coordKey.split(',').map(Number);
                        const labelText = item.key;
                        const textMetrics = this.ctx.measureText(labelText);
                        const padding = 2 / this.zoom;
                        const bgWidth = textMetrics.width + (padding * 2), bgHeight = fontSize + (padding * 2);
                        const labelX = (x + 0.5) * gs;
                        const labelY = (y + 1) * gs + (bgHeight / 2) + (4 / this.zoom);
                        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
                        this.ctx.fillRect(labelX - bgWidth / 2, labelY - bgHeight / 2, bgWidth, bgHeight);
                        this.ctx.fillStyle = 'white';
                        this.ctx.fillText(labelText, labelX, labelY);
                    }
                }
            });
        }
        this.ctx.restore();
    }

    saveLevel() {
        const levelObject = { settings: { width: this.gridWidth, height: this.gridHeight, defaults: this.defaultTextures }, layers: {} };
        for (const layerName of this.layerOrder) {
            const layerMap = this.levelData[layerName];
            if (layerMap.size > 0) {
                levelObject.layers[layerName] = Array.from(layerMap.entries());
            }
        }
        const jsonString = JSON.stringify(levelObject, null, 4);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'level_data.json';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url); this.statusMsg.textContent = 'Level saved successfully!';
    }

    loadLevel() {
        const input = document.createElement('input'); input.type = 'file'; input.accept = '.json,application/json';
        input.onchange = e => {
            const file = e.target.files[0]; if (!file) return;
            const reader = new FileReader();
            reader.onload = event => {
                try { this.applyLoadedData(JSON.parse(event.target.result)); }
                catch (err) { console.error("Error parsing level data:", err); this.statusMsg.textContent = 'Error: Failed to parse level file.'; }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    applyLoadedData(data) {
        this.gridWidth = data.settings?.width || 64; this.gridHeight = data.settings?.height || 64;
        this.defaultTextures = data.settings?.defaults || {}; this.ui.updateSettingsUI();
        this.layerOrder.forEach(layer => this.levelData[layer].clear());
        const loadedLayers = data.layers || {};
        for (const layerName in loadedLayers) {
            if (this.levelData.hasOwnProperty(layerName)) {
                this.levelData[layerName] = new Map(loadedLayers[layerName]);
            }
        }
        this.statusMsg.textContent = 'Level loaded successfully!';
        this.render();
    }
}

class EditorUI {
    constructor(editor) {
        this.editor = editor;
        this.assetManager = editor.assetManager;
        this.layerSelect = document.getElementById('layer-select');
        this.paletteContainer = document.getElementById('palette-container');
        this.gridWidthInput = document.getElementById('grid-width-input');
        this.gridHeightInput = document.getElementById('grid-height-input');
        this.defaultTextureSelects = {};
        ['subfloor', 'floor', 'water', 'floater', 'ceiling', 'sky'].forEach(id => {
            const el = document.getElementById(`default-${id}-select`);
            if(el) this.defaultTextureSelects[id] = el;
        });
        this.toolButtons = {
            paint: document.getElementById('tool-paint'),
            erase: document.getElementById('tool-erase'),
            rotate: document.getElementById('tool-rotate'),
            spawn: document.getElementById('tool-spawn'),
        };
    }

    init() {
        document.querySelectorAll('.tab-button').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.tab-button, .tab-content').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                document.getElementById(`${tab.dataset.tab}-content`).classList.add('active');
            });
        });
        this.layerSelect.addEventListener('change', () => { this.updatePalette(); this.editor.render(); });
        document.getElementById('save-level-btn').addEventListener('click', () => this.editor.saveLevel());
        document.getElementById('load-level-btn').addEventListener('click', () => this.editor.loadLevel());
        document.getElementById('reset-layer-btn').addEventListener('click', () => this.editor.resetLayer());
        document.getElementById('reset-map-btn').addEventListener('click', () => this.editor.resetMap());
        this.gridWidthInput.addEventListener('change', (e) => { this.editor.gridWidth = parseInt(e.target.value) || 64; this.editor.render(); });
        this.gridHeightInput.addEventListener('change', (e) => { this.editor.gridHeight = parseInt(e.target.value) || 64; this.editor.render(); });
        for(const [layer, select] of Object.entries(this.defaultTextureSelects)) {
            select.addEventListener('change', (e) => { this.editor.defaultTextures[layer] = e.target.value; this.editor.render(); });
        }
        
        Object.entries(this.toolButtons).forEach(([toolName, button]) => {
            button.addEventListener('click', () => this.setActiveTool(toolName));
        });

        this.populateDefaultTextureSettings();
        this.updatePalette();
    }
    
    setActiveTool(toolName) {
        this.editor.activeTool = toolName;
        Object.values(this.toolButtons).forEach(btn => btn.classList.remove('active'));
        this.toolButtons[toolName].classList.add('active');
        const cursors = { paint: 'crosshair', erase: 'not-allowed', rotate: 'grab', spawn: 'pointer' };
        this.editor.canvas.style.cursor = cursors[toolName] || 'default';
        this.updatePalette();
    }

    getActiveLayer() { return this.layerSelect.value; }

    updatePalette() {
        const activeLayer = this.getActiveLayer();
        const activeTool = this.editor.activeTool;
        
        const showPalette = activeTool === 'paint' && !['spawns'].includes(activeLayer);
        document.getElementById('palette-container').style.display = showPalette ? 'grid' : 'none';
        document.getElementById('palette-controls').style.display = showPalette ? 'flex' : 'none';

        if (!showPalette) return;

        if (activeLayer === 'npcs') this.populateNpcPalette();
        else if (activeLayer === 'assets') this.populateAssetPalette();
        else this.populateTexturePalette();
    }
    
    _populatePalette(items, createItemFn) {
        this.paletteContainer.innerHTML = '';
        if (!items || items.length === 0) {
            this.paletteContainer.innerHTML = `<p style="font-size:12px; opacity: 0.7;">No assets found for '${this.getActiveLayer()}' layer.</p>`;
            return;
        }
        items.forEach(createItemFn);
    }

    populateTexturePalette() {
        const selectedLayer = this.getActiveLayer();
        let textures = this.editor.assetManager.layerTextures[selectedLayer];
        if (selectedLayer === 'walls') textures = [...this.editor.assetManager.layerTextures['wall'],...this.editor.assetManager.layerTextures['door'],...this.editor.assetManager.layerTextures['cover']];

        this._populatePalette(textures, path => {
            const item = document.createElement('div'); item.className = 'palette-item';
            if (this.editor.activeBrush && this.editor.activeBrush.key === path) item.classList.add('active');
            const img = new Image(); img.src = path; item.appendChild(img);
            const label = document.createElement('span');
            label.textContent = path.split('/').pop().replace('.png', '').replace(/_/g, ' ');
            item.appendChild(label);
            item.addEventListener('click', () => {
                this.paletteContainer.querySelectorAll('.palette-item').forEach(p => p.classList.remove('active'));
                item.classList.add('active');
                this.editor.activeBrush = { type: 'texture', key: path };
            });
            this.paletteContainer.appendChild(item);
        });
    }

    populateAssetPalette() {
        const assets = Array.from(this.assetManager.assetIcons.entries());
        this._populatePalette(assets, ([name, iconUrl]) => {
            const item = document.createElement('div'); item.className = 'palette-item';
            if (this.editor.activeBrush && this.editor.activeBrush.key === name) item.classList.add('active');
            const img = new Image(); img.src = iconUrl; item.appendChild(img);
            const label = document.createElement('span'); label.textContent = name; item.appendChild(label);
            item.addEventListener('click', () => {
                this.paletteContainer.querySelectorAll('.palette-item').forEach(p => p.classList.remove('active'));
                item.classList.add('active');
                this.editor.activeBrush = { type: 'asset', key: name };
            });
            this.paletteContainer.appendChild(item);
        });
    }

    populateDefaultTextureSettings() {
        for(const [layer, select] of Object.entries(this.defaultTextureSelects)) {
            select.innerHTML = '';
            const textures = this.assetManager.layerTextures[layer] || [];
            const noneOption = document.createElement('option');
            noneOption.value = ''; noneOption.textContent = 'None'; select.appendChild(noneOption);
            textures.forEach(path => {
                const option = document.createElement('option');
                option.value = path; option.textContent = path.split('/').pop();
                select.appendChild(option);
            });
            if (layer === 'floor') {
                const defaultFloorTexture = '/data/pngs/floor_1.png';
                const floorTextures = this.assetManager.layerTextures['floor'] || [];
                if (floorTextures.includes(defaultFloorTexture)) {
                    select.value = defaultFloorTexture;
                    this.editor.defaultTextures['floor'] = defaultFloorTexture;
                } else if (floorTextures.length > 0) {
                    select.value = floorTextures[0];
                    this.editor.defaultTextures['floor'] = floorTextures[0];
                }
            }
        }
    }

    updateSettingsUI() {
        this.gridWidthInput.value = this.editor.gridWidth;
        this.gridHeightInput.value = this.editor.gridHeight;
        for(const [layer, select] of Object.entries(this.defaultTextureSelects)) {
            select.value = this.editor.defaultTextures[layer] || '';
        }
    }

    populateNpcPalette() {
        this.paletteContainer.innerHTML = '';
        const npcGroups = { 'Droids': [], 'Aliens': [], 'Stormies': [] };
        const groupMap = { 'wookiee': 'Aliens', 'gungan': 'Aliens', 'stormtrooper': 'Stormies' };
        this.assetManager.npcIcons.forEach((iconDataUrl, skinName) => {
            const baseName = skinName.match(/^(bb8|r2d2)/) ? skinName.match(/^(bb8|r2d2)/)[0] : skinName.replace(/\d+$/, '');
            const group = groupMap[baseName] || 'Droids';
            npcGroups[group].push({ skinName, iconDataUrl });
        });
        
        for (const groupName in npcGroups) {
            if(npcGroups[groupName].length === 0) continue;
            const header = document.createElement('div');
            header.className = 'palette-header'; header.textContent = groupName;
            this.paletteContainer.appendChild(header);
            for (const { skinName, iconDataUrl } of npcGroups[groupName]) {
                const item = document.createElement('div'); item.className = 'palette-item';
                if (this.editor.activeBrush && this.editor.activeBrush.key === skinName) item.classList.add('active');
                const img = new Image(); img.src = iconDataUrl; window[skinName + '_icon_img'] = img; item.appendChild(img);
                const label = document.createElement('span'); label.textContent = skinName; item.appendChild(label);
                item.addEventListener('click', () => {
                    this.paletteContainer.querySelectorAll('.palette-item').forEach(p => p.classList.remove('active'));
                    item.classList.add('active');
                    this.editor.activeBrush = { type: 'npc', key: skinName };
                });
                this.paletteContainer.appendChild(item);
            }
        }
    }
}

window.addEventListener('DOMContentLoaded', () => { new LevelEditor(); });