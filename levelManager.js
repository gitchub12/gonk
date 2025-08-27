// BROWSERFIREFOXHIDE js/levelManager.js
class LevelManager {
    constructor(scene, game) {
        this.scene = scene;
        this.game = game;
        this.collidables = [];
        this.currentLevel = 0;
        this.WALL_HEIGHT = 10;
    }

    async loadLevel(levelNumber) {
        try {
            const response = await fetch(`data/level_${levelNumber}.json`);
            if (!response.ok) throw new Error(`Level ${levelNumber} not found.`);
            let levelData = await response.json();

            this.currentLevel = levelNumber;
            this.buildLevel(levelData);
            return true;
        } catch (error) {
            console.error("Failed to load level:", error);
            return false;
        }
    }

    buildLevel(levelData) {
        this.clearLevel();
        const layers = levelData.layers;
        if (layers.walls) {
            layers.walls.forEach(wallData => this.buildWall(wallData));
        }
    }

    buildWall(wallData) {
        const wallInfo = wallData[1];
        const key = wallInfo.key;

        let wallMesh;
        const textureLoader = new THREE.TextureLoader();
        const texture = textureLoader.load(key);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        const material = new THREE.MeshLambertMaterial({ map: texture });

        if (wallInfo.type === 'vector' && wallInfo.points.length === 4) {
            const p1 = new THREE.Vector3(wallInfo.points[0], 0, wallInfo.points[1]);
            const p2 = new THREE.Vector3(wallInfo.points[2], 0, wallInfo.points[3]);
            const length = p1.distanceTo(p2);

            if (length === 0) return; // Avoid creating zero-size geometry

            texture.repeat.set(Math.ceil(length / 5), this.WALL_HEIGHT / 5);

            const geometry = new THREE.BoxGeometry(length, this.WALL_HEIGHT, 0.5);
            wallMesh = new THREE.Mesh(geometry, material);

            const midPoint = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
            wallMesh.position.set(midPoint.x, this.WALL_HEIGHT / 2, midPoint.z);

            const angle = Math.atan2(p2.x - p1.x, p2.z - p1.z);
            wallMesh.rotation.y = angle;

        } else {
            return; // Silently ignore malformed or non-vector walls for now
        }

        wallMesh.userData.isWall = true;
        if (key.includes('door_2.png')) {
            wallMesh.userData.isLevelExit = true;
            wallMesh.userData.targetLevel = this.currentLevel + 1;
        } else if (key.includes('door_0.png') && this.currentLevel > 1) {
            wallMesh.userData.isLevelExit = true;
            wallMesh.userData.targetLevel = this.currentLevel - 1;
        }

        this.collidables.push(wallMesh);
        this.scene.add(wallMesh);
    }

    clearLevel() {
        this.collidables.forEach(obj => {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) obj.material.dispose();
            this.scene.remove(obj);
        });
        this.collidables = [];
    }
}