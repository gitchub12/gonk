// BROWSERFIREFOXHIDE audio_system.js
// Standalone audio system.

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
}

window.audioSystem = new AudioSystem();