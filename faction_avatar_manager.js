// BROWSERFIREFOXHIDE faction_avatar_manager.js
// update: Integrated the Mandalorian faction into the avatar system.
class FactionAvatarManager {
    constructor() {
        this.container = null;
        this.avatars = {}; // { faction: { state: [urls] } }
        this.factionAvatars = []; // { el, imgEl, factionKey, currentState, animTimer, nextAnimTime, currentFrame, isAnimating }
        this.initialized = false;
        this.stateThresholds = {
            h3: 15,       // 0-15
            h2: 25,       // 16-25
            h1: 35,       // 26-35
            i1: 50,       // 36-50
            m1: 55,       // 51-55
            m2: 65,       // 56-65
            m3: Infinity  // 66+
        };
    }

    async initialize() {
        this.container = document.createElement('div');
        this.container.id = 'faction-avatar-container';
        document.querySelector('.game-hud-container').appendChild(this.container);

        const factionKeysWithAvatars = await this.discoverFactionAvatars();

        // Dynamically display any faction that has avatars, except for the player.
        const displayedFactions = factionKeysWithAvatars.filter(key => key !== 'player_droid' && key !== 'gonkpope');
        
        const factionColors = {
            rebels: {bg: '#a12a2a', border: '#d94242'},
            aliens: {bg: '#004d00', border: '#008000'},
            clones: {bg: '#b05c00', border: '#ff8c00'},
            imperials: {bg: '#101010', border: '#444444'},
            droids: {bg: '#003366', border: '#0066cc'},
            mandalorians: {bg: '#DAA520', border: '#FFC72C'},
            sith: {bg: '#330000', border: '#990000'},
            takers: {bg: '#2E2E2E', border: '#C0C0C0'}
        };

        // Create avatar elements in the DOM
        for (const factionKey of displayedFactions) {
            if (this.avatars[factionKey]) {
                const avatarBox = document.createElement('div');
                avatarBox.className = 'faction-avatar-box';
                const avatarImg = document.createElement('img');
                const avatarName = document.createElement('span');
                avatarName.className = 'faction-avatar-name';

                avatarBox.style.setProperty('--faction-avatar-border-color', factionColors[factionKey]?.border || '#444');
                
                // Set text color, with special case for black borders (like Imperials)
                const textColor = (factionColors[factionKey]?.border === '#444444') ? '#FFF' : (factionColors[factionKey]?.border || '#CCC');
                const textShadow = (factionColors[factionKey]?.border === '#444444') ? '0 0 3px #000' : '0 0 3px #000, 0 0 3px #000';
                avatarName.style.color = textColor;
                avatarName.style.textShadow = textShadow;
                avatarName.style.fontSize = 'calc(var(--faction-avatar-size, 80px) / 6)'; // Dynamic font size
                avatarName.textContent = factionKey.charAt(0).toUpperCase() + factionKey.slice(1);

                avatarBox.appendChild(avatarImg);
                avatarBox.appendChild(avatarName);
                this.container.appendChild(avatarBox);

                this.factionAvatars.push({
                    el: avatarBox,
                    imgEl: avatarImg,
                    factionKey: factionKey,
                    currentState: null,
                    currentAnimImages: [],
                    animTimer: 0,
                    nextAnimTime: 5 + Math.random() * 10, // Initial wait
                    currentFrame: 0,
                    isAnimating: false
                });
            }
        }
        this.initialized = true;
    }

    async fetchDirectoryListing(path, extensions = [], allowDirectories = false) {
        try {
            const response = await fetch(path);
            if (!response.ok) return [];
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const links = Array.from(doc.querySelectorAll('a'))
                .map(a => a.getAttribute('href'))
                .filter(href => href && !href.startsWith('?') && !href.startsWith('../'));
            
            return links.filter(href => (allowDirectories && href.endsWith('/')) || extensions.some(ext => href.endsWith(ext)));
        } catch (e) {
            console.warn(`Could not fetch directory listing for "${path}".`);
            return [];
        }
    }

    async discoverFactionAvatars() {
        const basePath = '/data/pngs/factions/';
        // Get all subdirectories in the factions folder
        const factionKeys = (await this.fetchDirectoryListing(basePath, [], true)).map(dir => dir.replace('/', '')).filter(f => f !== 'happysymbols' && f !== 'madsymbols');
        const states = ['h1', 'h2', 'h3', 'i1', 'i2', 'i3', 'm1', 'm2', 'm3', 's1'];

        for (const faction of factionKeys) {
            this.avatars[faction] = {};
            for (const state of states) {
                const path = `${basePath}${faction}/${state}/`;
                // Fetch only image files, not subdirectories
                const files = await this.fetchDirectoryListing(path, ['.png', '.jpg']);
                if (files.length > 0) {
                    this.avatars[faction][state] = files.sort().map(file => path + file);
                }
            }
        }
        // FIX: The function was not returning the list of discovered factions.
        return Object.keys(this.avatars).filter(key => Object.keys(this.avatars[key]).length > 0);
    }

    getStateFromScore(score) {
        if (score <= this.stateThresholds.h3) return 'h3';
        if (score <= this.stateThresholds.h2) return 'h2';
        if (score <= this.stateThresholds.h1) return 'h1';
        if (score <= this.stateThresholds.i1) return 'i1';
        if (score <= this.stateThresholds.m1) return 'm1';
        if (score <= this.stateThresholds.m2) return 'm2';
        return 'm3';
    }

    triggerSpecialAnimation(factionKey, stateKey) {
        const avatar = this.factionAvatars.find(a => a.factionKey === factionKey);
        if (!avatar || !this.avatars[factionKey]?.[stateKey]) return;

        const animImages = this.avatars[factionKey][stateKey];
        if (animImages && animImages.length > 0) {
            avatar.isAnimating = true;
            avatar.currentAnimImages = animImages;
            avatar.currentFrame = 0;
            avatar.animTimer = 0;
            // Set a short nextAnimTime to prevent long waits after the special animation
            avatar.nextAnimTime = 5 + Math.random() * 5;
        }
    }

    getFallbackState(factionKey, desiredState) {
        if (this.avatars[factionKey]?.[desiredState]) {
            return desiredState;
        }
        // If desired state doesn't exist, try idle states
        if (this.avatars[factionKey]?.['i1']) return 'i1';
        if (this.avatars[factionKey]?.['i2']) return 'i2';
        if (this.avatars[factionKey]?.['i3']) return 'i3';
        return null; // No images found
    }

    update(deltaTime) {
        if (!this.initialized || !window.game || !window.game.factionManager) return;

        // --- Sort avatars based on relationship ---
        this.factionAvatars.sort((a, b) => {
            const relA = window.game.factionManager.getRelationship('player_droid', a.factionKey);
            const relB = window.game.factionManager.getRelationship('player_droid', b.factionKey);
            return relA - relB;
        });

        this.factionAvatars.forEach((avatar, index) => {
            const relationship = window.game.factionManager.getRelationship('player_droid', avatar.factionKey);
            const trend = window.game.factionManager.getRelationshipTrend('player_droid', avatar.factionKey);
            let newState = this.getStateFromScore(relationship);
            newState = this.getFallbackState(avatar.factionKey, newState);

            if (!newState) return;
            
            // FIX: Use CSS order property to re-sort without flickering.
            avatar.el.style.order = index;

            const stateImages = this.avatars[avatar.factionKey]?.[newState];
            if (!stateImages) return; // This was already correct, but for clarity.

            // Update glow effect based on relationship trend
            if (trend === 'improving') {
                avatar.el.style.boxShadow = '0 0 15px 5px rgba(0, 255, 0, 0.4)';
            } else if (trend === 'worsening') {
                avatar.el.style.boxShadow = '0 0 15px 5px rgba(255, 0, 0, 0.5)';
            } else {
                avatar.el.style.boxShadow = 'none';
            }

            // FIX: Only change src if the state has changed, preventing flicker.
            if (avatar.currentState !== newState && !avatar.isAnimating) {
                avatar.currentState = newState;
                avatar.isAnimating = false;
                avatar.currentFrame = 0;
                avatar.imgEl.src = stateImages[0];
                avatar.nextAnimTime = 7 + Math.random() * 15;
            }

            avatar.animTimer += deltaTime;

            // Check if it's time to start an animation
            if (!avatar.isAnimating && avatar.animTimer > avatar.nextAnimTime) {
                avatar.isAnimating = true;
                avatar.currentFrame = 1;
                avatar.animTimer = 0;

                // Special logic for idle states
                if (['i1', 'i2', 'i3'].includes(avatar.currentState)) {
                    const idlePool = ['i1', 'i2', 'i3'].filter(state => this.avatars[avatar.factionKey]?.[state]);
                    const randomIdleState = idlePool[Math.floor(Math.random() * idlePool.length)];
                    avatar.currentAnimImages = this.avatars[avatar.factionKey][randomIdleState];
                } else {
                    avatar.currentAnimImages = stateImages;
                }
            }

            // Process the animation frame
            if (avatar.isAnimating) {
                const animSpeed = 0.1; // seconds per frame
                if (avatar.animTimer > animSpeed) {
                    avatar.animTimer = 0;
                    if (avatar.currentAnimImages && avatar.currentFrame < avatar.currentAnimImages.length) {
                        avatar.imgEl.src = avatar.currentAnimImages[avatar.currentFrame];
                        avatar.currentFrame++;
                    } else {
                        // Animation finished, go back to base and wait
                        avatar.isAnimating = false;
                        avatar.currentFrame = 0;
                        avatar.imgEl.src = stateImages[0]; // Reset to the resting image of the *current* state
                        avatar.nextAnimTime = 22 + Math.random() * 45;
                        delete avatar.currentAnimImages;
                    }
                }
            }
        });
    }

    updatePosition(offsetX, offsetY) {
        if (this.container) {
            // This function is now only for the F-key grid's debug controls.
            // The main HUD avatar position is controlled by CSS variables set in tab_controls.js
            // However, we can keep this for the debug view if needed.
            this.container.style.right = `calc(var(--faction-avatar-right, 10px) - ${offsetX}px)`;
            this.container.style.top = `calc(var(--faction-avatar-top, 50%) + ${offsetY}px)`;
        }
    }
}

window.factionAvatarManager = new FactionAvatarManager();