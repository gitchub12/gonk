// BROWSERFIREFOXHIDE editor/editor.js
// Standalone Level Editor Application

class EditorAssetManager {
    constructor() {
        this.npcSkins = [];
        this.npcIcons = new Map();
        this.layerTypes = ['floor', 'wall', 'ceiling', 'sky', 'water', 'subfloor'];
        this.layerTextures = {};
        this.layerTypes.forEach(type => this.layerTextures[type] = []);
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

        for (const layerType of this.layerTypes) {
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
                    const iconCanvas = document.createElement('canvas');
                    const iconSize = 64;
                    iconCanvas.width = iconSize;
                    iconCanvas.height = iconSize;
                    const ctx = iconCanvas.getContext('2d');
                    ctx.imageSmoothingEnabled = false;

                    const scale = img.width / 64;
                    const faceX = 8 * scale, faceY = 8 * scale, faceSize = 8 * scale;
                    const hatX = 40 * scale, hatY = 8 * scale, hatSize = 8 * scale;

                    ctx.drawImage(img, faceX, faceY, faceSize, faceSize, 0, 0, iconSize, iconSize);
                    ctx.drawImage(img, hatX, hatY, hatSize, hatSize, 0, 0, iconSize, iconSize);
                    
                    this.npcIcons.set(skinName, iconCanvas.toDataURL());
                    resolve();
                };
                img.onerror = () => {
                    console.warn(`Failed to load skin image: ${skinPath}`);
                    resolve();
                };
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
        
        this.assetManager = new EditorAssetManager();
        this.ui = new EditorUI(this);

        this.gridSize = 32;
        this.zoom = 1.0;
        this.panX = 0;
        this.panY = 0;

        this.isPanning = false;
        this.lastMouse = { x: 0, y: 0 };
        
        this.activeBrush = null;
        this.placedEntities = [];

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
        this.ui.populateNpcPalette();
        this.ui.populateLayerPalette();
        this.ui.populateDefaultTextureSettings();
        this.render();
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

        const gridX = Math.floor(worldX / this.gridSize);
        const gridY = Math.floor(worldY / this.gridSize);

        return { x: gridX, y: gridY };
    }

    placeEntity(gridX, gridY) {
        if (!this.activeBrush) return;

        const existingEntity = this.placedEntities.find(e => e.x === gridX && e.y === gridY);
        if (existingEntity) return;

        const newEntity = {
            id: `${this.activeBrush.key}_${Date.now()}`,
            type: this.activeBrush.type,
            key: this.activeBrush.key,
            x: gridX,
            y: gridY,
        };
        this.placedEntities.push(newEntity);
        this.render();
    }

    onMouseDown(e) {
        if (e.button === 1) {
            this.isPanning = true;
            this.lastMouse.x = e.clientX;
            this.lastMouse.y = e.clientY;
            this.canvas.style.cursor = 'grabbing';
        } else if (e.button === 0) {
            const { x, y } = this.getGridCoordsFromEvent(e);
            this.placeEntity(x, y);
        }
    }

    onMouseMove(e) {
        if (this.isPanning) {
            const dx = e.clientX - this.lastMouse.x;
            const dy = e.clientY - this.lastMouse.y;
            this.panX += dx;
            this.panY += dy;
            this.lastMouse.x = e.clientX;
            this.lastMouse.y = e.clientY;
            this.render();
        }
    }

    onMouseUp(e) {
        if (e.button === 1) {
            this.isPanning = false;
            this.canvas.style.cursor = 'default';
        }
    }

    onMouseWheel(e) {
        e.preventDefault();
        const zoomSpeed = 1.1;
        const oldZoom = this.zoom;
        
        if (e.deltaY < 0) this.zoom *= zoomSpeed;
        else this.zoom /= zoomSpeed;
        this.zoom = Math.max(0.1, Math.min(this.zoom, 10));

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

        // Draw grid
        const scaledGridSize = this.gridSize;
        const startXWorld = -this.panX / this.zoom;
        const endXWorld = (this.canvas.width - this.panX) / this.zoom;
        const startYWorld = -this.panY / this.zoom;
        const endYWorld = (this.canvas.height - this.panY) / this.zoom;

        const startGridX = Math.floor(startXWorld / scaledGridSize);
        const endGridX = Math.ceil(endXWorld / scaledGridSize);
        const startGridY = Math.floor(startYWorld / scaledGridSize);
        const endGridY = Math.ceil(endYWorld / scaledGridSize);

        this.ctx.strokeStyle = '#444';
        this.ctx.lineWidth = 1 / this.zoom;
        this.ctx.beginPath();
        for (let x = startGridX; x <= endGridX; x++) {
            this.ctx.moveTo(x * scaledGridSize, startGridY * scaledGridSize);
            this.ctx.lineTo(x * scaledGridSize, endGridY * scaledGridSize);
        }
        for (let y = startGridY; y <= endGridY; y++) {
            this.ctx.moveTo(startGridX * scaledGridSize, y * scaledGridSize);
            this.ctx.lineTo(endGridX * scaledGridSize, y * scaledGridSize);
        }
        this.ctx.stroke();

        // Draw placed entities
        this.placedEntities.forEach(entity => {
            if (entity.type === 'npc') {
                if (window[entity.key + '_icon_img']) {
                     const img = window[entity.key + '_icon_img'];
                     const drawSize = this.gridSize;
                     this.ctx.drawImage(img, entity.x * this.gridSize, entity.y * this.gridSize, drawSize, drawSize);
                }
            }
        });

        this.ctx.restore();
    }
}

class EditorUI {
    constructor(editor) {
        this.editor = editor;
        this.assetManager = editor.assetManager;

        this.tabs = document.querySelectorAll('.tab-button');
        this.content = document.querySelectorAll('.tab-content');
        
        this.layerSelect = document.getElementById('layer-select');
        this.layerPalette = document.getElementById('layers-palette');
        this.npcPalette = document.getElementById('entities-palette');
        
        this.init();
    }

    init() {
        this.tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                this.tabs.forEach(t => t.classList.remove('active'));
                this.content.forEach(c => c.classList.remove('active'));
                tab.classList.add('active');
                document.getElementById(`${tab.dataset.tab}-content`).classList.add('active');
            });
        });
        
        this.layerSelect.addEventListener('change', () => this.populateLayerPalette());
    }

    populateLayerPalette() {
        const selectedLayer = this.layerSelect.value;
        const textures = this.assetManager.layerTextures[selectedLayer] || [];
        this.layerPalette.innerHTML = '';
        
        textures.forEach(texturePath => {
            const item = document.createElement('div');
            item.className = 'palette-item';
            item.dataset.type = 'texture';
            item.dataset.path = texturePath;
            
            const img = new Image();
            img.src = texturePath;
            item.appendChild(img);
            
            const label = document.createElement('span');
            label.textContent = texturePath.split('/').pop().replace('.png', '').replace(/_/g, ' ');
            item.appendChild(label);

            item.addEventListener('click', () => {
                this.layerPalette.querySelectorAll('.palette-item').forEach(p => p.classList.remove('active'));
                item.classList.add('active');
                this.editor.activeBrush = { type: 'texture', key: texturePath };
            });
            
            this.layerPalette.appendChild(item);
        });
    }

    populateDefaultTextureSettings() {
        for (const layerType of this.assetManager.layerTypes) {
            const selectEl = document.getElementById(`default-${layerType}-select`);
            if (!selectEl) continue;

            selectEl.innerHTML = ''; // Clear existing options
            const textures = this.assetManager.layerTextures[layerType] || [];

            const noneOption = document.createElement('option');
            noneOption.value = '';
            noneOption.textContent = 'None';
            selectEl.appendChild(noneOption);

            textures.forEach(texturePath => {
                const option = document.createElement('option');
                option.value = texturePath;
                option.textContent = texturePath.split('/').pop();
                selectEl.appendChild(option);
            });
        }
    }

    populateNpcPalette() {
        this.npcPalette.innerHTML = '';
        this.assetManager.npcIcons.forEach((iconDataUrl, skinName) => {
            const item = document.createElement('div');
            item.className = 'palette-item';
            item.dataset.type = 'npc';
            item.dataset.id = skinName;
            
            const img = new Image();
            img.src = iconDataUrl;
            window[skinName + '_icon_img'] = img; 
            item.appendChild(img);
            
            const label = document.createElement('span');
            label.textContent = skinName;
            item.appendChild(label);

            item.addEventListener('click', () => {
                this.npcPalette.querySelectorAll('.palette-item').forEach(p => p.classList.remove('active'));
                item.classList.add('active');
                this.editor.activeBrush = { type: 'npc', key: skinName };
            });
            
            this.npcPalette.appendChild(item);
        });
    }
}

window.addEventListener('DOMContentLoaded', () => {
    new LevelEditor();
});