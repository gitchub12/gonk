// BROWSERFIREFOXHIDE skybox_animator.js
// new file: Manages the playback of pre-loaded animated skybox textures.
class SkyboxAnimator {
    constructor(textureArray, framesPerSecond = 24) {
        this.textures = textureArray;
        this.pmremGenerator = null;
        this.envMaps = [];
        this.isInitialized = false;

        this.fps = framesPerSecond;
        this.frameDuration = 1.0 / this.fps;
        this.currentIndex = 0;
        this.elapsedTime = 0;
    }

    async initialize(renderer) {
        if (this.isInitialized || this.textures.length === 0) return;
        this.pmremGenerator = new THREE.PMREMGenerator(renderer);
        this.pmremGenerator.compileEquirectangularShader();

        for (const texture of this.textures) {
            texture.mapping = THREE.EquirectangularReflectionMapping;
            texture.encoding = THREE.sRGBEncoding;
            const envMap = this.pmremGenerator.fromEquirectangular(texture);
            this.envMaps.push(envMap.texture);
            texture.dispose(); 
        }

        this.textures = [];
        this.pmremGenerator.dispose();
        this.pmremGenerator = null;
        this.isInitialized = true;
    }

    update(deltaTime) {
        if (!this.isInitialized || this.envMaps.length === 0) return;
        this.elapsedTime += deltaTime;
        if (this.elapsedTime >= this.frameDuration) {
            this.elapsedTime -= this.frameDuration;
            this.currentIndex = (this.currentIndex + 1) % this.envMaps.length;
            if (game && game.scene) game.scene.background = this.envMaps[this.currentIndex];
        }
    }

    dispose() {
        this.envMaps.forEach(map => map.dispose());
        this.envMaps = [];
        this.isInitialized = false;
    }
}