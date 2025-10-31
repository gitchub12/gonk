// BROWSERFIREFOXHIDE expression_manager.js

/**
 * Represents a single expressive asset (audio or emoji) with associated tags.
 */
class ExpressionAsset {
    constructor(path, type, tags) {
        this.path = path; // File path for audio, or the emoji character itself
        this.type = type; // 'audio' or 'emoji'
        this.tags = tags; // { key: value } pairs, e.g., { situation: 'death', faction: 'gamorrean' }
    }
}

class ExpressionManager {
    constructor() {
        this.assets = [];
        this.isInitialized = false;
        this.audioContext = null; // To be initialized when needed

        // Define the root directories for different expression types
        this.assetRoots = {
            audio: '/data/sounds/creatures/'
            // emoji: '/data/emojis/' // Future-proofing for emoji config files
        };
    }

    async initialize() {
        if (this.isInitialized) return;

        console.log("Initializing ExpressionManager...");

        // Discover and tag all audio assets based on folder structure
        await this.discoverAudioAssets(this.assetRoots.audio);

        // TODO: Discover and tag emoji assets
        this.loadEmojiAssets();

        this.isInitialized = true;
        console.log(`ExpressionManager initialized with ${this.assets.length} assets.`);
    }

    /**
     * Recursively scans directories to discover and tag audio files.
     * The folder structure determines the tags.
     * e.g., /data/sounds/creatures/gamorrean/death/groan.wav
     * will be tagged with { type: 'creature', creature: 'gamorrean', situation: 'death' }
     */
    async discoverAudioAssets(rootPath) {
        const directoriesToScan = [rootPath];
        
        while(directoriesToScan.length > 0) {
            const currentPath = directoriesToScan.shift();
            try {
                const response = await fetch(currentPath);
                if (!response.ok) continue;

                const html = await response.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                
                const links = Array.from(doc.querySelectorAll('a')).map(a => a.getAttribute('href'));

                for (const href of links) {
                    if (!href || href.startsWith('?') || href.startsWith('../')) continue;

                    const fullPath = currentPath + href;
                    if (href.endsWith('/')) {
                        // It's a directory, add to the scan queue
                        directoriesToScan.push(fullPath);
                    } else if (href.endsWith('.wav') || href.endsWith('.mp3') || href.endsWith('.ogg')) {
                        // It's an audio file, create tags from the path
                        const pathParts = fullPath.substring(this.assetRoots.audio.length).split('/');
                        pathParts.pop(); // remove filename

                        const tags = {};
                        if (pathParts.length > 0) tags.type = pathParts.shift(); // e.g., 'creature'
                        if (pathParts.length > 0) tags.subtype = pathParts.shift(); // e.g., 'gamorrean'
                        if (pathParts.length > 0) tags.situation = pathParts.shift(); // e.g., 'death'
                        // Add more tag levels if needed

                        const asset = new ExpressionAsset(fullPath, 'audio', tags);
                        this.assets.push(asset);
                    }
                }
            } catch (e) {
                console.warn(`Could not scan directory for expressions: ${currentPath}`, e);
            }
        }
    }

    loadEmojiAssets() {
        // Placeholder for loading emoji definitions from a JSON or similar
        // For now, we can hardcode a few examples
        this.assets.push(new ExpressionAsset('❤️', 'emoji', { concept: 'friendly_greeting', faction: 'rebels' }));
        this.assets.push(new ExpressionAsset('😠', 'emoji', { concept: 'hostile_taunt', faction: 'imperials' }));
        this.assets.push(new ExpressionAsset('❓', 'emoji', { concept: 'investigating', faction: 'any' }));
    }

    requestExpression(context) {
        // This is where the Behavior Tree will ask for an expression.
        // The logic to filter and select the best asset based on context will go here.
        console.log("Expression requested with context:", context);
    }
}

window.expressionManager = new ExpressionManager();