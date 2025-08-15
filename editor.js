// BROWSERFIREFOXHIDE editor/editor.js
// Standalone Level Editor Application

class EditorAssetManager {
    constructor(modelSystem) {
        this.modelSystem = modelSystem;
        this.npcSkins = [];
        this.npcIcons = new Map();
        this.textureLayers = ['subfloor', 'floor', 'water', 'floater', 'decor', 'ceiling', 'sky'];
        this.layerTextures = {};
        this.textureLayers.forEach(type => this.layerTextures[type] = []);
        console.log("Editor Asset Manager initialized.");
    }

    async fetchDirectoryListing(path) {
        try {
            const response = await fetch(path);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            return Array.from(doc.querySelectorAll('a'))
                .map(a => a.getAttribute('href'))
                .filter(href => !href.startsWith('?') && !href.startsWith('/'))
                .map(decodeURIComponent);
        } catch (e) {
            console.error(`Failed to fetch or parse directory listing for "${path}":`, e);
            alert(`Could not load assets from "${path}". Please ensure you are running this from a local web server that allows directory listing.`);
            return [];
        }
    }

    async discoverAssets() {
        console.log("Discovering assets...");
        const skinFiles = await this.fetchDirectoryListing('/data/skins/');
        this.npcSkins = skinFiles.filter(f => f.endsWith('.png')).map(f => `/data/skins/${f}`);
        console.log(`Found ${this.npcSkins.length} NPC skins.`);
        await this.generateNpcIcons();
        const textureFiles = await this.fetchDirectoryListing('/data/pngs/');
        const texturePngs = textureFiles.filter(f => f.endsWith('.png'));
        for (const layerType of this.textureLayers) {
            this.layerTextures[layerType] = texturePngs
                .filter(f => f.toLowerCase().startsWith(layerType))
                .map(f => `/data/pngs/${f}`);
        }
        console.log("Found layer textures:", this.layerTextures);
        return true;
    }

    async generateNpcIcons() {
        console.log("Generating NPC icons from skins...");
        const iconPromises = this.npcSkins.map(skinPath => {
            return new Promise(resolve => {
                const img = new Image();
                img.crossOrigin = "Anonymous";
                img.src = skinPath;
                img.onload = () => {
                    const skinName = skinPath.split('/').pop().replace('.png', '');
                    let baseName = skinName;
                     if (skinName.startsWith('bb8') || skinName.startsWith('r2d2')) {
                        baseName = skinName.match(/^(bb8|r2d2)/)[0];
                    } else {
                        baseName = skinName.replace(/\d+$/, '');
                    }
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
                        console.warn(`Generated icon for "${skinName}" is blank. Falling back to full image.`);
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
        console.log(`Generated ${this.npcIcons.size} NPC icons.`);
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
        this.zoom = 1.0;
        this.panX = 0;
        this.panY = 0;
        this.isPanning = false;
        this.lastMouse = { x: 0, y: 0 };
        this.activeBrush = null;
        this.layerOrder = ['subfloor', 'floor', 'entities', 'water', 'floater', 'decor', 'ceiling', 'sky'];
        this.levelData = {};
        this.layerOrder.forEach(layer => this.levelData[layer] = new Map());
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
        await this.assetManager.discoverAssets();
        await this.preloadAllTextures();
        this.ui.init();
        this.ui.populateDefaultTextureSettings();
        this.render();
    }
    
    async preloadAllTextures() {
        const allPaths = new Set();
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
        console.log(`Preloaded ${this.preloadedImages.size} textures.`);
    }

    resizeCanvas() {
        const container = document.getElementById('canvasContainer');
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
        this.render();
    }
    
    getGridCoordsFromEvent(e) {
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const worldX = (mouseX - this.panX) / this.zoom;
        const worldY = (mouseY - this.panY) / this.zoom;
        return { x: Math.floor(worldX / this.gridSize), y: Math.floor(worldY / this.gridSize) };
    }

    placeItem(gridX, gridY) {
        if (!this.activeBrush) { this.statusMsg.textContent = "Select an item to place."; return; }
        const activeLayer = this.ui.getActiveLayer();
        const coordKey = `${gridX},${gridY}`;
        if (this.activeBrush.type === 'npc') {
            if (activeLayer !== 'entities') {
                this.statusMsg.textContent = "NPCs can only be placed on the 'Entities' layer."; return;
            }
        } else if (this.activeBrush.type === 'texture') {
            const textureType = this.activeBrush.key.split('/').pop().split('_')[0].split('.')[0];
            if (textureType !== activeLayer) {
                this.statusMsg.textContent = `You can only place '${textureType}' items on the '${textureType}' layer.`; return;
            }
        }
        this.levelData[activeLayer].set(coordKey, { type: this.activeBrush.type, key: this.activeBrush.key });
        this.statusMsg.textContent = `Placed ${this.activeBrush.key.split('/').pop()} on ${activeLayer} layer.`;
        this.render();
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
        if (e.button === 1) { this.isPanning = true; this.lastMouse = { x: e.clientX, y: e.clientY }; this.canvas.style.cursor = 'grabbing'; } 
        else if (e.button === 0) { const { x, y } = this.getGridCoordsFromEvent(e); this.placeItem(x, y); }
    }

    onMouseMove(e) {
        if (this.isPanning) {
            const dx = e.clientX - this.lastMouse.x;
            const dy = e.clientY - this.lastMouse.y;
            this.panX += dx; this.panY += dy;
            this.lastMouse = { x: e.clientX, y: e.clientY };
            this.render();
        }
    }

    onMouseUp(e) { if (e.button === 1) { this.isPanning = false; this.canvas.style.cursor = 'default'; } }

    onMouseWheel(e) {
        e.preventDefault();
        const zoomSpeed = 1.1; const oldZoom = this.zoom;
        this.zoom *= (e.deltaY < 0 ? zoomSpeed : 1 / zoomSpeed);
        this.zoom = Math.max(0.1, Math.min(10, this.zoom));
        const mouseX = e.clientX - this.canvas.getBoundingClientRect().left;
        const mouseY = e.clientY - this.canvas.getBoundingClientRect().top;
        this.panX = mouseX - (mouseX - this.panX) * (this.zoom / oldZoom);
        this.panY = mouseY - (mouseY - this.panY) * (this.zoom / oldZoom);
        this.render();
    }

    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.save();
        this.ctx.translate(this.panX, this.panY);
        this.ctx.scale(this.zoom, this.zoom);
        const gs = this.gridSize;
        const startX = Math.floor(-this.panX / this.zoom / gs), endX = Math.ceil((this.canvas.width - this.panX) / this.zoom / gs);
        const startY = Math.floor(-this.panY / this.zoom / gs), endY = Math.ceil((this.canvas.height - this.panY) / this.zoom / gs);
        this.ctx.strokeStyle = '#444'; this.ctx.lineWidth = 1 / this.zoom;
        this.ctx.beginPath();
        for (let x = startX; x <= endX; x++) { this.ctx.moveTo(x * gs, startY * gs); this.ctx.lineTo(x * gs, endY * gs); }
        for (let y = startY; y <= endY; y++) { this.ctx.moveTo(startX * gs, y * gs); this.ctx.lineTo(endX * gs, y * gs); }
        this.ctx.stroke();
        const activeLayer = this.ui.getActiveLayer();
        const itemsToDraw = this.levelData[activeLayer];
        if (itemsToDraw) {
            for (const [coordKey, item] of itemsToDraw.entries()) {
                const [x, y] = coordKey.split(',').map(Number);
                let imgToDraw = (item.type === 'npc') ? window[item.key + '_icon_img'] : this.preloadedImages.get(item.key);
                if (imgToDraw) this.ctx.drawImage(imgToDraw, x * gs, y * gs, gs, gs);
            }
        }
        if (this.zoom >= 1.5 && activeLayer === 'entities' && itemsToDraw) {
            const fontSize = 12 / this.zoom;
            this.ctx.font = `bold ${fontSize}px Arial`;
            this.ctx.textAlign = 'center'; this.ctx.textBaseline = 'middle';
            for (const [coordKey, item] of itemsToDraw.entries()) {
                const [x, y] = coordKey.split(',').map(Number);
                const labelText = item.key, textMetrics = this.ctx.measureText(labelText), padding = 2 / this.zoom;
                const bgWidth = textMetrics.width + (padding * 2), bgHeight = fontSize + (padding * 2);
                const labelX = (x + 0.5) * gs, labelY = (y + 0.5) * gs;
                this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
                this.ctx.fillRect(labelX - bgWidth / 2, labelY - bgHeight / 2, bgWidth, bgHeight);
                this.ctx.fillStyle = 'white';
                this.ctx.fillText(labelText, labelX, labelY);
            }
        }
        this.ctx.restore();
    }
}

class EditorUI {
    constructor(editor) {
        this.editor = editor;
        this.assetManager = editor.assetManager;
        this.layerSelect = document.getElementById('layer-select');
        this.paletteContainer = document.getElementById('palette-container');
    }

    init() {
        document.querySelectorAll('.tab-button').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.tab-button').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                tab.classList.add('active');
                document.getElementById(`editor-content`).style.display = tab.dataset.tab === 'editor' ? 'flex' : 'none';
                document.getElementById(`settings-content`).style.display = tab.dataset.tab === 'settings' ? 'flex' : 'none';
            });
        });
        this.layerSelect.addEventListener('change', () => { this.updatePalette(); this.editor.render(); });
        document.getElementById('reset-layer-btn').addEventListener('click', () => this.editor.resetLayer());
        document.getElementById('reset-map-btn').addEventListener('click', () => this.editor.resetMap());
        this.updatePalette();
    }

    getActiveLayer() { return this.layerSelect.value; }

    updatePalette() {
        const activeLayer = this.getActiveLayer();
        this.editor.activeBrush = null; // Clear brush on layer change
        if (activeLayer === 'entities') this.populateNpcPalette();
        else this.populateTexturePalette();
    }

    populateTexturePalette() {
        const selectedLayer = this.getActiveLayer();
        this.paletteContainer.innerHTML = '';
        const textures = this.assetManager.layerTextures[selectedLayer] || [];
        if (textures.length === 0) this.paletteContainer.innerHTML = `<p style="font-size:12px; opacity: 0.7;">No textures found for '${selectedLayer}' layer.</p>`;
        textures.forEach(path => {
            const item = document.createElement('div');
            item.className = 'palette-item';
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

    populateDefaultTextureSettings() {
        for (const layerType of this.assetManager.textureLayers) {
            const selectEl = document.getElementById(`default-${layerType}-select`);
            if (!selectEl) continue;
            selectEl.innerHTML = '';
            const textures = this.assetManager.layerTextures[layerType] || [];
            const noneOption = document.createElement('option');
            noneOption.value = ''; noneOption.textContent = 'None'; selectEl.appendChild(noneOption);
            textures.forEach(path => {
                const option = document.createElement('option');
                option.value = path; option.textContent = path.split('/').pop();
                selectEl.appendChild(option);
            });
        }
    }

    populateNpcPalette() {
        this.paletteContainer.innerHTML = '';
        const groupedSkins = new Map();
        this.assetManager.npcIcons.forEach((iconDataUrl, skinName) => {
            let baseName;
            if (skinName.startsWith('bb8') || skinName.startsWith('r2d2')) {
                baseName = skinName.match(/^(bb8|r2d2)/)[0];
            } else { baseName = skinName.replace(/\d+$/, ''); }
            if (!groupedSkins.has(baseName)) groupedSkins.set(baseName, []);
            groupedSkins.get(baseName).push({ skinName, iconDataUrl });
        });
        const sortedKeys = Array.from(groupedSkins.keys()).sort();
        for (const baseName of sortedKeys) {
            const header = document.createElement('div');
            header.className = 'palette-header'; header.textContent = baseName;
            this.paletteContainer.appendChild(header);
            const skins = groupedSkins.get(baseName);
            for (const { skinName, iconDataUrl } of skins) {
                const item = document.createElement('div');
                item.className = 'palette-item';
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