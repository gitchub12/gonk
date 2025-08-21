// BROWSERFIREFOXHIDE audio_system.js
// Standalone audio system for playing game sounds.

class AudioSystem {
    constructor() {
        this.listener = null;
    }

    init(camera) {
        this.listener = new THREE.AudioListener();
        if (camera) {
            camera.add(this.listener);
        }
    }

    playSound(soundName) {
        if (!this.listener || !assetManager.sounds[soundName]) {
            console.warn(`Sound not found or listener not ready: ${soundName}`);
            return;
        }
        const sound = new THREE.Audio(this.listener);
        sound.setBuffer(assetManager.sounds[soundName]);
        sound.play();
    }
}

window.audioSystem = new AudioSystem();