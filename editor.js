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
        // Discover NPC Skins
        const skinFiles = await this.fetchDirectoryListing('/data/skins/');
        this.npcSkins = skinFiles.filter(f => f.endsWith('.png')).map(f => `/data/skins/${f}`);
        await this.generateNpcIcons();
        
        // Discover Layer Textures from subdirectories
        for (const layerType of this.textureLayers) {
            const path = `/data/pngs/${layerType}/`;
            try {
                const textureFiles = await this.fetchDirectoryListing(path);
                this.layerTextures[layerType] = textureFiles
                    .filter(f => f.endsWith('.png'))
                    .map(f => `${path}${f}`);
            } catch (e) {
                console.warn(`Could not discover assets in directory: ${path}`);
                this.layerTextures[layerType] = [];
            }
        }
        
        // Discover Furniture from its manifest
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
        } catch (e) {
            console.error("Failed to discover furniture assets:", e);
        }

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
        this.activeTool = 'paint';
        this.activeBrush = null;
        this.lastUsedBrush = {};
        this.hoveredLine = null;
        this.layerOrder = ['subfloor', 'floor', 'npcs', 'assets', 'spawns', 'walls', 'tapestry', 'dangler', 'water', 'floater', 'decor', 'ceiling', 'sky'];
        this.activeLayerName = 'floor';
        this.lineLayers = ['walls', 'tapestry'];
        this.levelData = {};
        this.layerOrder.forEach(layer => this.levelData[layer] = new Map());
        this.defaultTextures = {};
        this.preloadedImages = new Map();
        
        this.currentLevel = 1;
        this.isLevelDirty = false;

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
        this.loadLevel(this.currentLevel, true);
        this.render();
    }
    
    async preloadAllTextures() {
        const allPaths = new Set(['/data/pngs/hologonk.png', '/data/pngs/icons for UI/crate.png']);
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
    
    setDirty() { this.isLevelDirty = true; }

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
        const activeLayer = this.activeLayerName;
        let itemErased = false;
        if (this.lineLayers.includes(activeLayer)) {
            if (!this.hoveredLine) return;
            const lineKey = `${this.hoveredLine.type}_${this.hoveredLine.x}_${this.hoveredLine.y}`;
            if (this.levelData[activeLayer].has(lineKey)) {
                this.levelData[activeLayer].delete(lineKey);
                itemErased = true;
            }
        } else {
            const coordKey = `${gridX},${gridY}`;
            if (this.levelData[activeLayer].has(coordKey)) {
                this.levelData[activeLayer].delete(coordKey);
                itemErased = true;
            }
        }
        if (itemErased) {
            this.setDirty();
            this.statusMsg.textContent = `Erased item from ${activeLayer}.`;
            this.render();
        }
    }

    placeItem(gridX, gridY) {
        if (!this.activeBrush) return;
        const activeLayer = this.activeLayerName;
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
                const textureLayer = this.activeBrush.key.split('/')[3];
                if (textureLayer !== activeLayer) return;
            }
            this.levelData[activeLayer].set(currentCoord, { type: this.activeBrush.type, key: this.activeBrush.key, rotation: 0 });
        }
        
        this.setDirty();
        this.lastPlacedCoord = currentCoord;
        this.lastUsedBrush[activeLayer] = this.activeBrush;
        this.statusMsg.textContent = `Placed ${this.activeBrush.key.split('/').pop()}`;
        this.render();
    }
    
    placeSpawn(gridX, gridY) {
        if (this.activeLayerName !== 'spawns') return;
        const coordKey = `${gridX},${gridY}`;
        const spawnLayer = this.levelData['spawns'];
        if (spawnLayer.has(coordKey) || spawnLayer.size >= 9) return;
        
        spawnLayer.set(coordKey, { number: spawnLayer.size + 1, rotation: 0 });
        this.setDirty();
        this.render();
        this.statusMsg.textContent = `Placed spawn point #${spawnLayer.size}.`;
    }

    rotateItem(gridX, gridY) {
        const activeLayer = this.activeLayerName;
        if (this.lineLayers.includes(activeLayer)) return;
        const coordKey = `${gridX},${gridY}`;
        const item = this.levelData[activeLayer].get(coordKey);
        if (item) {
            item.rotation = (item.rotation + 1) % 4;
            this.setDirty();
            this.render();
            this.statusMsg.textContent = `Rotated item at ${coordKey}.`;
        }
    }

    resetLayer() {
        const activeLayer = this.activeLayerName;
        if (this.levelData[activeLayer].size === 0) return;
        if (window.confirm(`Are you sure you want to clear all items from the '${activeLayer}' layer?`)) {
            this.levelData[activeLayer].clear();
            this.setDirty();
            this.render();
            this.statusMsg.textContent = `Layer '${activeLayer}' has been cleared.`;
        }
    }

    resetMap() {
        if (window.confirm('Are you sure you want to clear the entire map? This cannot be undone.')) {
            this.layerOrder.forEach(layer => this.levelData[layer].clear());
            this.setDirty();
            this.render();
            this.statusMsg.textContent = 'Entire map has been cleared.';
        }
    }

    onMouseDown(e) {
        if (e.button === 1) { this.isPanning = true; this.lastMouse = { x: e.clientX, y: e.clientY }; return; }
        const { x, y } = this.getGridCoordsFromEvent(e);
        if (e.button === 2) { this.eraseItem(x, y); return; }
        if (e.button === 0) {
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
        if (!this.lineLayers.includes(this.activeLayerName)) {
            if (this.hoveredLine) { this.hoveredLine = null; this.render(); }
            return;
        }
        const { x: worldX, y: worldY } = this.getMouseWorldCoords(e);
        const gs = this.gridSize;
        const tolerance = 0.25;

        const gridX = Math.floor(worldX / gs);
        const gridY = Math.floor(worldY / gs);
        const fracX = worldX / gs - gridX;
        const fracY = worldY / gs - gridY;

        const dists = [
            { type: 'H', dist: fracY,           line: { type: 'H', x: gridX, y: gridY - 1 } },
            { type: 'H', dist: 1 - fracY,       line: { type: 'H', x: gridX, y: gridY } },
            { type: 'V', dist: fracX,           line: { type: 'V', x: gridX - 1, y: gridY } },
            { type: 'V', dist: 1 - fracX,       line: { type: 'V', x: gridX, y: gridY } }
        ];

        const closestH = dists.filter(d => d.type === 'H').sort((a,b) => a.dist - b.dist)[0];
        const closestV = dists.filter(d => d.type === 'V').sort((a,b) => a.dist - b.dist)[0];
        
        let newHoveredLine = null;
        if (closestH.dist < tolerance && closestV.dist < tolerance) {
            newHoveredLine = null; // In dead zone
        } else if (closestH.dist < tolerance && closestH.dist < closestV.dist) {
            newHoveredLine = closestH.line;
        } else if (closestV.dist < tolerance && closestV.dist < closestH.dist) {
            newHoveredLine = closestV.line;
        }

        if (JSON.stringify(this.hoveredLine) !== JSON.stringify(newHoveredLine)) {
            this.hoveredLine = newHoveredLine;
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
        if (e.ctrlKey) {
            const currentIndex = this.layerOrder.indexOf(this.activeLayerName);
            let nextIndex = currentIndex + (e.deltaY > 0 ? -1 : 1);
            nextIndex = (nextIndex + this.layerOrder.length) % this.layerOrder.length;
            this.ui.setActiveLayer(this.layerOrder[nextIndex]);
            return;
        }
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
        const activeLayerIndex = this.layerOrder.indexOf(this.activeLayerName);
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
                if (img) for (let y = startY; y < endY; y++) for (let x = startX; x < endX; x++) this.ctx.drawImage(img, x * gs, y * gs, gs, gs);
            }
            if (items) {
                 for (const [coordKey, item] of items.entries()) {
                    if (this.lineLayers.includes(layerName)) continue;
                    const [x, y] = coordKey.split(',').map(Number);
                    if(x < startX || x > endX || y < startY || y > endY) continue;
                     if (layerName === 'floor' || layerName === 'subfloor') {
                        const img = this.preloadedImages.get(item.key);
                        if(img) {
                             this.ctx.drawImage(img, x*gs, y*gs, gs, gs);
                             this.ctx.fillStyle = 'rgba(0,0,0,0.4)';
                             this.ctx.fillRect(x * gs, y * gs, gs, gs);
                        }
                    }
                 }
            }
            if (this.lineLayers.includes(layerName)) {
                if (items) for(const [key, item] of items.entries()) {
                    const [type, xStr, yStr] = key.split('_'); const x = Number(xStr); const y = Number(yStr);
                    const img = this.preloadedImages.get(item.key);
                    if (img) {
                        this.ctx.save();
                        if (type === 'V') this.ctx.translate((x + 1) * gs, y * gs);
                        else { this.ctx.translate(x * gs, (y + 1) * gs); this.ctx.rotate(Math.PI / 2); }
                        this.ctx.drawImage(img, - (gs*0.05), 0, gs*0.1, gs);
                        this.ctx.restore();
                    }
                }
            } else if (items) for (const [coordKey, item] of items.entries()) {
                const [x, y] = coordKey.split(',').map(Number);
                if(layerName === 'floor' || layerName === 'subfloor') continue;
                let img = null;
                if (layerName === 'spawns') img = this.preloadedImages.get('/data/pngs/hologonk.png');
                else img = (item.type === 'npc' || item.type === 'asset') ? window[item.key + '_icon_img'] : this.preloadedImages.get(item.key);
                if (layerName === 'water' && i <= activeLayerIndex) this.ctx.globalAlpha = 0.3;
                if (img) {
                    this.ctx.save();
                    this.ctx.translate(x * gs + gs / 2, y * gs + gs / 2);
                    if (item.rotation) this.ctx.rotate(item.rotation * Math.PI / 2);
                    if (layerName === 'npcs') this.ctx.drawImage(img, -(gs*0.375), -(gs*0.125), gs * 0.75, gs * 0.75);
                    else this.ctx.drawImage(img, -gs / 2, -gs / 2, gs, gs);
                    this.ctx.restore();
                }
                if (layerName === 'spawns') {
                    this.ctx.save();
                    this.ctx.translate(x * gs + gs / 2, y * gs + gs / 2);
                    this.ctx.font = `bold ${gs * 0.5}px Arial`; this.ctx.fillStyle = 'white'; this.ctx.textAlign = 'center'; this.ctx.textBaseline = 'middle';
                    this.ctx.shadowColor = 'black'; this.ctx.shadowBlur = 4;
                    this.ctx.fillText(item.number, 0, 0);
                    this.ctx.rotate(item.rotation * Math.PI / 2);
                    this.ctx.strokeStyle = 'white'; this.ctx.lineWidth = 3 / this.zoom; this.ctx.shadowBlur = 0;
                    this.ctx.beginPath(); this.ctx.moveTo(0, -gs * 0.2); this.ctx.lineTo(0, -gs * 0.4);
                    this.ctx.moveTo(-gs*0.1, -gs*0.3); this.ctx.lineTo(0, -gs*0.4); this.ctx.lineTo(gs*0.1, -gs*0.3);
                    this.ctx.stroke();
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
        if (this.zoom >= 1.5) ['npcs', 'assets'].forEach(layerName => {
            const items = this.levelData[layerName];
            if (items) for (const [coordKey, item] of items.entries()) {
                const [x, y] = coordKey.split(',').map(Number);
                const labelText = item.key;
                const fontSize = 12 / this.zoom;
                this.ctx.font = `bold ${fontSize}px Arial`; this.ctx.textAlign = 'center'; this.ctx.textBaseline = 'middle';
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
        });
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
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `level_${this.currentLevel}.json`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
        this.isLevelDirty = false;
        this.statusMsg.textContent = `Level ${this.currentLevel} saved successfully!`;
    }

    async loadLevel(levelNum, isInitialLoad = false) {
        if (!isInitialLoad && this.isLevelDirty) {
            if (!confirm('You have unsaved changes. Are you sure you want to load a new level and discard them?')) return;
        }
        const path = `/data/levels/level_${levelNum}.json`;
        try {
            const response = await fetch(path);
            if (!response.ok) throw new Error('Level not found');
            const data = await response.json();
            this.applyLoadedData(data);
            this.statusMsg.textContent = `Level ${levelNum} loaded successfully!`;
        } catch (err) {
            const createNew = confirm(`Level ${levelNum} not found. Would you like to create a new level?`);
            if (createNew) {
                this.layerOrder.forEach(layer => this.levelData[layer].clear());
                this.statusMsg.textContent = `Started new Level ${levelNum}.`;
            } else {
                this.ui.levelNumberInput.value = this.currentLevel; // Revert input if they cancel
                return;
            }
        }
        this.currentLevel = levelNum;
        this.isLevelDirty = false;
        this.ui.updateUIForNewLevel();
        this.render();
    }

    applyLoadedData(data) {
        this.gridWidth = data.settings?.width || 64; this.gridHeight = data.settings?.height || 64;
        this.defaultTextures = data.settings?.defaults || {}; this.ui.updateSettingsUI();
        this.layerOrder.forEach(layer => this.levelData[layer].clear());
        const loadedLayers = data.layers || {};
        for (const layerName in loadedLayers) {
            if (this.levelData.hasOwnProperty(layerName)) this.levelData[layerName] = new Map(loadedLayers[layerName]);
        }
    }
}

class EditorUI {
    constructor(editor) {
        this.editor = editor;
        this.assetManager = editor.assetManager;
        this.layerSelector = document.getElementById('layer-selector');
        this.paletteContainer = document.getElementById('palette-container');
        this.gridWidthInput = document.getElementById('grid-width-input');
        this.gridHeightInput = document.getElementById('grid-height-input');
        this.levelNumberInput = document.getElementById('level-number-input');
        this.levelDisplay = document.getElementById('level-display');
        this.defaultTextureSelects = {};
        this.layerButtons = {};
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
        document.querySelectorAll('.tab-button').forEach(tab => tab.addEventListener('click', () => {
            document.querySelectorAll('.tab-button, .tab-content').forEach(t => t.classList.remove('active'));
            tab.classList.add('active'); document.getElementById(`${tab.dataset.tab}-content`).classList.add('active');
        }));
        this.createLayerSelector();
        document.getElementById('load-level-btn').addEventListener('click', () => this.editor.loadLevel(parseInt(this.levelNumberInput.value) || 1));
        document.getElementById('save-level-btn').addEventListener('click', () => this.editor.saveLevel());
        document.getElementById('reset-layer-btn').addEventListener('click', () => this.editor.resetLayer());
        document.getElementById('reset-map-btn').addEventListener('click', () => this.editor.resetMap());
        this.gridWidthInput.addEventListener('change', (e) => { this.editor.gridWidth = parseInt(e.target.value) || 64; this.editor.setDirty(); this.editor.render(); });
        this.gridHeightInput.addEventListener('change', (e) => { this.editor.gridHeight = parseInt(e.target.value) || 64; this.editor.setDirty(); this.editor.render(); });
        for(const [layer, select] of Object.entries(this.defaultTextureSelects)) {
            select.addEventListener('change', (e) => { this.editor.defaultTextures[layer] = e.target.value; this.editor.setDirty(); this.editor.render(); });
        }
        Object.entries(this.toolButtons).forEach(([toolName, button]) => button.addEventListener('click', () => this.setActiveTool(toolName)));
        this.populateDefaultTextureSettings();
        this.setActiveLayer(this.editor.activeLayerName);
    }
    
    createLayerSelector() {
        this.layerSelector.innerHTML = '';
        this.editor.layerOrder.forEach(layerName => {
            const button = document.createElement('button');
            button.dataset.layer = layerName;
            button.title = layerName.charAt(0).toUpperCase() + layerName.slice(1);
            let iconSrc = null;
            switch(layerName) {
                case 'npcs': if (this.assetManager.npcIcons.size > 0) iconSrc = this.assetManager.npcIcons.values().next().value; break;
                case 'assets': iconSrc = '/data/pngs/icons for UI/crate.png'; break;
                case 'spawns': iconSrc = '/data/pngs/icons for UI/hologonk.png'; break;
                default:
                    const textures = this.assetManager.layerTextures[layerName] || [];
                    if (textures.length > 0) iconSrc = textures[0];
            }
            if (iconSrc) {
                const img = document.createElement('img'); img.src = iconSrc; img.className = 'layer-icon';
                button.appendChild(img);
            } else button.textContent = layerName.charAt(0).toUpperCase();
            button.addEventListener('click', () => this.setActiveLayer(layerName));
            this.layerSelector.appendChild(button);
            this.layerButtons[layerName] = button;
        });
    }

    setActiveLayer(layerName) {
        this.editor.activeLayerName = layerName;
        Object.values(this.layerButtons).forEach(btn => btn.classList.remove('active'));
        this.layerButtons[layerName].classList.add('active');
        this.updatePalette();
        this.editor.render();
    }

    setActiveTool(toolName) {
        this.editor.activeTool = toolName;
        Object.values(this.toolButtons).forEach(btn => btn.classList.remove('active'));
        this.toolButtons[toolName].classList.add('active');
        const cursors = { paint: 'crosshair', erase: 'not-allowed', rotate: 'grab', spawn: 'pointer' };
        this.editor.canvas.style.cursor = cursors[toolName] || 'default';
        this.updatePalette();
    }

    updateUIForNewLevel() {
        this.levelNumberInput.value = this.editor.currentLevel;
        this.levelDisplay.textContent = `Level: ${this.editor.currentLevel}`;
    }

    updatePalette() {
        const activeLayer = this.editor.activeLayerName;
        const activeTool = this.editor.activeTool;
        const showPalette = activeTool === 'paint' && !['spawns'].includes(activeLayer);
        document.querySelector('.content-group h4').style.display = showPalette ? 'block' : 'none';
        this.paletteContainer.style.display = showPalette ? 'grid' : 'none';
        document.getElementById('palette-controls').style.display = showPalette ? 'flex' : 'none';
        if (!showPalette) return;
        if (activeLayer === 'npcs') this.populateNpcPalette();
        else if (activeLayer === 'assets') this.populateAssetPalette();
        else this.populateTexturePalette();
    }
    
    _populatePalette(items, createItemFn) {
        this.paletteContainer.innerHTML = '';
        if (!items || items.length === 0) { this.paletteContainer.innerHTML = `<p style="font-size:12px; opacity: 0.7;">No assets found for '${this.editor.activeLayerName}' layer.</p>`; return; }
        items.forEach(createItemFn);
    }

    populateTexturePalette() {
        const selectedLayer = this.editor.activeLayerName;
        let textures = this.assetManager.layerTextures[selectedLayer];
        if (selectedLayer === 'walls') textures = [...this.assetManager.layerTextures['wall'],...this.assetManager.layerTextures['door'],...this.assetManager.layerTextures['cover']];
        this._populatePalette(textures, path => {
            const item = document.createElement('div'); item.className = 'palette-item';
            if (this.editor.activeBrush && this.editor.activeBrush.key === path) item.classList.add('active');
            const img = new Image(); img.src = path; item.appendChild(img);
            const label = document.createElement('span'); label.textContent = path.split('/').pop().replace('.png', '').replace(/_/g, ' '); item.appendChild(label);
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
            const noneOption = document.createElement('option'); noneOption.value = ''; noneOption.textContent = 'None'; select.appendChild(noneOption);
            textures.forEach(path => {
                const option = document.createElement('option'); option.value = path; option.textContent = path.split('/').pop();
                select.appendChild(option);
            });
            if (layer === 'floor') {
                const defaultFloorTexture = '/data/pngs/floor/floor_1.png';
                if (textures.includes(defaultFloorTexture)) {
                    select.value = defaultFloorTexture;
                    this.editor.defaultTextures['floor'] = defaultFloorTexture;
                } else if (textures.length > 0) {
                    select.value = textures[0];
                    this.editor.defaultTextures['floor'] = textures[0];
                }
            }
        }
    }

    updateSettingsUI() {
        this.gridWidthInput.value = this.editor.gridWidth;
        this.gridHeightInput.value = this.editor.gridHeight;
        for(const [layer, select] of Object.entries(this.defaultTextureSelects)) select.value = this.editor.defaultTextures[layer] || '';
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
            const header = document.createElement('div'); header.className = 'palette-header'; header.textContent = groupName;
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