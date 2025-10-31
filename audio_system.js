// BROWSERFIREFOXHIDE audio_system.js
class AudioSystem {
    constructor() {
        this.isInitialized = false;
        this.listener = null;
        this.camera = null;
        this.audioLoader = null;
        this.soundCache = new Map();
        this.activeSounds = new Set();
        this.soundLists = {}; // For categorized sounds
        this.globalVolume = 0.5;

        this.musicAudio = null;
        this.musicAudioLoader = null;
        this.musicLibrary = {}; // { category: [trackPath, ...], ... }
        this.musicCategories = [];
        this.musicRoot = '/data/sounds/MUSIC/';
        this.currentCategoryIndex = 0;
        this.currentTrackIndex = 0;
        this.isMusicPlaying = false;
        this.musicVolume = 0.72; // Separate volume for music, increased by another 20% from 0.6
        this.songTitleElement = null;
        this.songCategoryElement = null;
        this.musicVolumeElement = null;
        this.titleFadeTimeout = null;
        this.categoryFadeTimeout = null;
        this.volumeFadeTimeout = null;

        this.soundCategories = {
            'gonkstruck': '/data/sounds/gonkstruck/',
            'gonkblasted': '/data/sounds/gonkblasted/',
            'malehurt': '/data/sounds/malehurt/',
            'femalehurt': '/data/sounds/femalehurt/',
            'zaphit': '/data/sounds/zaphit/',
            'gamorreanhit': '/data/sounds/gamorreanhit/',
            'gamorreandeath': '/data/sounds/gamorreanhit/death/',
            'maledeath': '/data/sounds/malehurt/maledeath/',
            'femaledeath': '/data/sounds/femalehurt/death/',
            'pistolshot': '/data/sounds/pistolshot/',
            'rifleshot': '/data/sounds/rifleshot/',
            'longshot': '/data/sounds/longshot/',
            'uniqueshot': '/data/sounds/uniqueshot/',
            'music': '/data/sounds/music/',
            'pamphlet': '/data/sounds/pamphlettoss/',
            'gonk': '/data/sounds/gonk/',
            'zapper': '/data/sounds/gonkzapper/',
            'saberon': '/data/sounds/sabers/jedi/ignite/',
            'saberoff': '/data/sounds/sabers/jedi/deactivate/',
            'saberswing': '/data/sounds/sabers/jedi/swing/',
            'saberstrike': '/data/sounds/sabers/jedi/strike/',
            // NOTE: Weapon-specific sounds. The key (e.g., 'ee3') can be derived from a weapon's filename
            // (e.g., 'glong_ee3_mando' or 'long_ee3_mando') to play the correct sound for different visual assets.
            'ee3shot': '/data/sounds/longshot/ee3/'
        };
        // ADDED: Wookiee sounds
        this.soundCategories['wookhurt'] = '/data/sounds/wookiee/';
        this.soundCategories['wookdeath'] = '/data/sounds/wookiee/death/';
        this.soundCategories['wookconvert'] = '/data/sounds/wookiee/';

        this.staticSoundDefs = {
             'dooropen': '/data/sounds/dooropen.wav', 
             'dooropen2': '/data/sounds/dooropen2.wav',
             'triviacorrect': '/data/sounds/trivia/triviacorrect.wav',
             'triviawrong': '/data/sounds/trivia/triviawrong.wav',
             // ADDED: Pickup sound
             'pickup': '/data/sounds/pickup.wav' 
        };
    }
    
    init(camera) {
        if (this.isInitialized) return;
        this.listener = new THREE.AudioListener();
        camera.add(this.listener);
        this.audioLoader = new THREE.AudioLoader();
        this.musicAudioLoader = new THREE.AudioLoader();
        this.isInitialized = true;
        this.loadSoundCategories(); // Start loading categorized sounds
        console.log("AudioSystem initialized.");
    }

    async initializeMusic() {
        console.log("Initializing Music in AudioSystem...");

        await this.discoverMusic();

        this.songTitleElement = document.getElementById('song-title-display');
        this.songCategoryElement = document.getElementById('song-category-display');
        this.musicVolumeElement = document.getElementById('music-volume-display');

        if (this.musicCategories.length > 0) {
            this.currentCategoryIndex = 0;
            this.currentTrackIndex = 0;
        }

        console.log(`Music initialized with ${this.musicCategories.length} categories.`);
    }

    async discoverMusic() {
        try {
            const response = await fetch(this.musicRoot);
            if (!response.ok) {
                console.warn(`Music directory not found: ${this.musicRoot}`);
                return;
            }
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const links = Array.from(doc.querySelectorAll('a')).map(a => a.getAttribute('href'));

            for (const href of links) {
                if (href.endsWith('/')) {
                    const categoryName = href.slice(0, -1);
                    await this.discoverTracksInCategory(categoryName);
                }
            }
            this.musicCategories = Object.keys(this.musicLibrary);
        } catch (e) {
            console.warn(`Could not scan music root directory: ${this.musicRoot}`, e);
        }
    }

    async discoverTracksInCategory(category) {
        const categoryPath = `${this.musicRoot}${category}/`;
        try {
            const response = await fetch(categoryPath);
            if (!response.ok) return;

            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const links = Array.from(doc.querySelectorAll('a')).map(a => a.getAttribute('href'));

            const tracks = [];
            for (const href of links) {
                if (href.endsWith('.mp3') || href.endsWith('.ogg') || href.endsWith('.wav')) {
                    tracks.push(`${categoryPath}${href}`);
                }
            }

            if (tracks.length > 0) {
                this.musicLibrary[category] = tracks;
            }
        } catch (e) {
            console.warn(`Could not scan music category: ${categoryPath}`, e);
        }
    }

    playCurrentMusicTrack() {
        if (this.musicCategories.length === 0) return;
        const category = this.musicCategories[this.currentCategoryIndex];
        const trackPath = this.musicLibrary[category][this.currentTrackIndex];
        
        this.playMusic(trackPath, () => this.nextMusicTrack(true));
        this.isMusicPlaying = true;
        this.showSongTitle();
    }

    playMusic(filePath, onEndedCallback) {
        if (!this.isInitialized) return;

        if (this.musicAudio && this.musicAudio.isPlaying) {
            this.musicAudio.stop();
        }

        this.musicAudio = new THREE.Audio(this.listener);

        this.musicAudioLoader.load(filePath, (buffer) => {
            this.musicAudio.setBuffer(buffer);
            this.musicAudio.setLoop(false);
            this.musicAudio.setVolume(this.globalVolume * this.musicVolume);
            this.musicAudio.play();
            this.musicAudio.onEnded = onEndedCallback;
        }, undefined, (err) => {
            console.error(`Error loading music file: ${filePath}`, err);
        });
    }

    playRandomTrackFromCategory(categoryName) {
        if (!this.musicLibrary[categoryName] || this.musicLibrary[categoryName].length === 0) {
            console.warn(`Music category "${categoryName}" not found or is empty.`);
            return;
        }
        this.currentCategoryIndex = this.musicCategories.indexOf(categoryName);
        this.currentTrackIndex = Math.floor(Math.random() * this.musicLibrary[categoryName].length);
        this.playCurrentMusicTrack();
    }

    togglePlayPauseMusic() {
        if (this.musicCategories.length === 0) return;

        if (!this.isMusicPlaying && !this.musicAudio) {
            this.playCurrentMusicTrack();
        } else if (this.musicAudio) {
            if (this.musicAudio.isPlaying) this.musicAudio.pause();
            else this.musicAudio.play();
            this.isMusicPlaying = this.musicAudio.isPlaying;
        }
    }

    nextMusicTrack(fromAutoPlay = false) {
        if (this.musicCategories.length === 0) return;
        const category = this.musicCategories[this.currentCategoryIndex];
        this.currentTrackIndex = (this.currentTrackIndex + 1) % this.musicLibrary[category].length;
        this.playCurrentMusicTrack();
    }

    previousMusicTrack() {
        if (this.musicCategories.length === 0) return;
        const category = this.musicCategories[this.currentCategoryIndex];
        this.currentTrackIndex = (this.currentTrackIndex - 1 + this.musicLibrary[category].length) % this.musicLibrary[category].length;
        this.playCurrentMusicTrack();
    }

    nextMusicCategory() {
        if (this.musicCategories.length === 0) return;
        this.currentCategoryIndex = (this.currentCategoryIndex + 1) % this.musicCategories.length;
        this.currentTrackIndex = 0;
        this.showCategoryTitle();
        this.playCurrentMusicTrack();
    }

    previousMusicCategory() {
        if (this.musicCategories.length === 0) return;
        this.currentCategoryIndex = (this.currentCategoryIndex - 1 + this.musicCategories.length) % this.musicCategories.length;
        this.currentTrackIndex = 0;
        this.showCategoryTitle();
        this.playCurrentMusicTrack();
    }

    increaseMusicVolume() {
        this.musicVolume = Math.min(1.0, this.musicVolume + 0.1);
        if (this.musicAudio) {
            this.musicAudio.setVolume(this.globalVolume * this.musicVolume);
        }
        this.showMusicVolume();
        console.log(`Music volume: ${this.musicVolume.toFixed(1)}`);
    }

    decreaseMusicVolume() {
        this.musicVolume = Math.max(0.0, this.musicVolume - 0.1);
        if (this.musicAudio) {
            this.musicAudio.setVolume(this.globalVolume * this.musicVolume);
        }
        this.showMusicVolume();
        console.log(`Music volume: ${this.musicVolume.toFixed(1)}`);
    }

    showSongTitle() {
        if (!this.songTitleElement || this.musicCategories.length === 0) return;

        const category = this.musicCategories[this.currentCategoryIndex];
        const trackPath = this.musicLibrary[category][this.currentTrackIndex];
        let trackName = decodeURIComponent(trackPath.split('/').pop());
        trackName = trackName.replace(/\.mp3|\.ogg|\.wav/gi, '').replace(/_/g, ' ');

        this.songTitleElement.textContent = trackName;
        this.songTitleElement.style.opacity = '1';
        this.songTitleElement.style.display = 'block';

        if (this.titleFadeTimeout) {
            clearTimeout(this.titleFadeTimeout);
        }

        this.titleFadeTimeout = setTimeout(() => {
            this.songTitleElement.style.opacity = '0';
        }, 4000);
    }

    showCategoryTitle() {
        if (!this.songCategoryElement || this.musicCategories.length === 0) return;

        const categoryName = this.musicCategories[this.currentCategoryIndex];

        this.songCategoryElement.textContent = categoryName.toUpperCase();
        this.songCategoryElement.style.opacity = '1';
        this.songCategoryElement.style.display = 'block';

        if (this.categoryFadeTimeout) {
            clearTimeout(this.categoryFadeTimeout);
        }

        // Fade out with the song title
        this.categoryFadeTimeout = setTimeout(() => {
            this.songCategoryElement.style.opacity = '0';
        }, 4000);
    }

    showMusicVolume() {
        if (!this.musicVolumeElement) return;

        const volumePercent = Math.round(this.musicVolume * 100);
        this.musicVolumeElement.textContent = `MUSIC VOL: ${volumePercent}%`;
        this.musicVolumeElement.style.opacity = '1';
        this.musicVolumeElement.style.display = 'block';

        if (this.volumeFadeTimeout) {
            clearTimeout(this.volumeFadeTimeout);
        }

        this.volumeFadeTimeout = setTimeout(() => {
            this.musicVolumeElement.style.opacity = '0';
            // After fade out, set display to none so it doesn't hold space
            setTimeout(() => { if(this.musicVolumeElement.style.opacity === '0') this.musicVolumeElement.style.display = 'none'; }, 500);
        }, 4000);
    }

    // --- Sound Effect Methods ---

    loadSound(soundPath) {
        return new Promise((resolve, reject) => {
            if (this.soundCache.has(soundPath)) {
                resolve(this.soundCache.get(soundPath));
                return;
            }
            this.audioLoader.load(soundPath,
                (buffer) => {
                    this.soundCache.set(soundPath, buffer);
                    resolve(buffer);
                },
                undefined, // onProgress callback
                (err) => {
                    console.error(`Error loading sound: ${soundPath}`, err);
                    reject(err);
                }
            );
        });
    }

    playSound(soundName, volume = 1.0) {
        if (!this.isInitialized || !this.staticSoundDefs[soundName]) {
            console.warn(`Sound not found or audio system not ready: ${soundName}`);
            return;
        }
        const soundPath = this.staticSoundDefs[soundName];
        this.loadSound(soundPath).then(buffer => {
            const sound = new THREE.Audio(this.listener);
            sound.setBuffer(buffer);
            sound.setVolume(volume * this.globalVolume);
            sound.play();
        }).catch(err => console.error(`Could not play sound: ${soundName}`, err));
    }

    playPositionalSound(soundPath, position, volume = 1.0) {
        if (!this.isInitialized) return;

        this.loadSound(soundPath).then(buffer => {
            const sound = new THREE.PositionalAudio(this.listener);
            sound.setBuffer(buffer);
            sound.setRefDistance(10);
            sound.setRolloffFactor(1);
            sound.setVolume(volume * this.globalVolume);

            const audioObject = new THREE.Object3D();
            audioObject.position.copy(position);
            game.scene.add(audioObject);
            audioObject.add(sound);

            this.activeSounds.add(sound);

            sound.onEnded = () => {
                sound.isPlaying = false;
                audioObject.remove(sound);
                game.scene.remove(audioObject);
                this.activeSounds.delete(sound);
            };
            sound.play();
        }).catch(err => console.error(`Could not play positional sound: ${soundPath}`, err));
    }

    // --- Categorized Sound Methods ---
    async fetchDirectoryListing(path) {
        try {
            const response = await fetch(path);
            if (!response.ok) return [];
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            return Array.from(doc.querySelectorAll('a'))
                .map(a => a.getAttribute('href'))
                .filter(href => href && !href.startsWith('?') && !href.startsWith('../') && !href.endsWith('/'));
        } catch (e) {
            console.warn(`Could not fetch directory listing for "${path}".`);
            return [];
        }
    }

    async loadSoundCategories() {
        console.log("Loading categorized sounds...");
        for (const [category, path] of Object.entries(this.soundCategories)) {
            if (typeof path === 'string' && path.endsWith('/')) {
                const files = await this.fetchDirectoryListing(path);
                this.soundLists[category] = files.map(file => path + file);
            }
        }
        console.log("Categorized sounds loaded.");
    }

    playPositionalSoundFromList(listName, position, volume = 1.0) {
        const list = this.soundLists[listName];
        if (!list || list.length === 0) {
            // console.warn(`Sound list not found or is empty: ${listName}`);
            return;
        }
        const soundPath = list[Math.floor(Math.random() * list.length)];
        this.playPositionalSound(soundPath, position, volume);
    }

    playWeaponFireSound(weaponName, position) {
        const category = window.weaponIcons.getCategoryFromName(weaponName);
        let listName;
        switch(category) {
            case 'pistol': listName = 'pistolshot'; break;
            case 'rifle': listName = 'rifleshot'; break; 
            case 'longarm':
                // Check for weapon-specific sound overrides first
                const weaponModel = weaponName.split('_')[1]; // e.g., 'glong_ee3_mando' -> 'ee3'
                if (this.soundLists[`${weaponModel}shot`]) {
                    listName = `${weaponModel}shot`;
                } else {
                    listName = 'longshot'; // Fallback to generic longshot sound
                }
                break;
            case 'unique': listName = 'uniqueshot'; break;
            default: return;
        }
        this.playPositionalSoundFromList(listName, position);
    }

    playPlayerWeaponFireSound(weaponName, category) {
        let listName;
        switch(category) {
            case 'pistol': listName = 'pistolshot'; break;
            case 'rifle': listName = 'rifleshot'; break;
            case 'longarm':
                const weaponModel = weaponName.split('_')[1];
                if (this.soundLists[`${weaponModel}shot`]) {
                    listName = `${weaponModel}shot`;
                } else {
                    listName = 'longshot';
                }
                break;
            case 'unique': listName = 'uniqueshot'; break;
            default: return;
        }
        this.playSoundFromList(listName, 0.7); // Play non-positional sound for player
    }

    playSoundFromList(listName, volume = 1.0) {
        const list = this.soundLists[listName];
        if (!list || list.length === 0) {
            // console.warn(`Sound list not found or is empty: ${listName}`);
            return;
        }
        const soundPath = list[Math.floor(Math.random() * list.length)];
        // This sound is non-positional, so we can't use playSound directly as it uses static defs.
        // We'll load it and play it as a simple THREE.Audio
        this.loadSound(soundPath).then(buffer => {
            const sound = new THREE.Audio(this.listener);
            sound.setBuffer(buffer);
            sound.setVolume(this.globalVolume * volume);
            sound.play();
        }).catch(err => console.error(`Could not play sound from list ${listName}:`, err));
    }

    playNpcHurtSound(npc) {
        const distance = game.camera.position.distanceTo(npc.mesh.group.position);
        if (distance > 50) return; // Don't play sounds for NPCs too far away

        const baseVolume = 0.9;
        const finalVolume = Math.max(0.1, baseVolume * (1 - distance / 50));

        let soundListName;
        const soundSet = npc.itemData.properties?.soundSet;

        if (soundSet === 'female') {
            soundListName = 'femalehurt';
        } else {
             switch (npc.config.baseType) {
                case 'gamorrean':
                    soundListName = 'gamorreanhit';
                    break;
                case 'wookiee':
                    soundListName = 'wookhurt';
                    break;
                case 'droid_humanoid': case 'r2d2': case 'r5d4': case 'bb8': case 'gonk': case 'mousedroid': case 'probe': case 'irongolem':
                    soundListName = 'zaphit';
                    break;
                case 'human_female':
                    soundListName = 'femalehurt';
                    break;
                default:
                    soundListName = 'malehurt';
                    break;
            }
        }
        
        this.playPositionalSoundFromList(soundListName, npc.mesh.group.position, finalVolume);
    }

    playMaleDeathSound(position, volume = 1.0) {
        // For now, just play a random sound from the maledeath category
        this.playPositionalSoundFromList('maledeath', position, volume);
    }

    playPlayerHurtSound(type) {
        // This is non-positional
        const list = this.soundLists[type === 'melee' ? 'gonkstruck' : 'gonkblasted'];
        if (!list || list.length === 0) return;
        const soundPath = list[Math.floor(Math.random() * list.length)];
        // This sound is non-positional, so we can't use playSound directly as it uses static defs.
        // We'll load it and play it as a simple THREE.Audio
        this.loadSound(soundPath).then(buffer => {
            const sound = new THREE.Audio(this.listener);
            sound.setBuffer(buffer);
            sound.setVolume(this.globalVolume);
            sound.play();
        });
    }
}

window.audioSystem = new AudioSystem();