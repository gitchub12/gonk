// BROWSERFIREFOXHIDE weapons_player.js
// This new file handles player-specific weapon logic, like pamphlet projectiles.

class Projectile {
    constructor(startPos, direction) {
        this.life = GAME_GLOBAL_CONSTANTS.WEAPONS.PAMPHLET_LIFE;

        const geometry = new THREE.PlaneGeometry(0.5, 0.5);
        // We'll use a random pamphlet texture later from raw_asset_loader
        const material = new THREE.MeshBasicMaterial({ color: 0xffff00, side: THREE.DoubleSide });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(startPos);
        
        this.velocity = direction.clone().multiplyScalar(GAME_GLOBAL_CONSTANTS.WEAPONS.PAMPHLET_SPEED);
        
        game.scene.add(this.mesh);
    }

    update(deltaTime) {
        this.life--;
        if (this.life <= 0) {
            this.cleanup();
            return false;
        }

        this.mesh.position.add(this.velocity);
        // Make it spin
        this.mesh.rotation.x += 0.2;
        this.mesh.rotation.y += 0.2;

        // TODO: Add collision detection
        return true;
    }
    
    cleanup() {
        if (this.mesh) {
            game.scene.remove(this.mesh);
            this.mesh.geometry.dispose();
            this.mesh.material.dispose();
        }
    }
}


class PlayerWeaponSystem {
    handlePamphletAttack() {
        if (!game || !game.camera) return;

        const startPos = game.camera.position.clone();
        const direction = new THREE.Vector3();
        game.camera.getWorldDirection(direction);

        const projectile = new Projectile(startPos, direction);
        game.entities.projectiles.push(projectile);
    }
}

window.playerWeaponSystem = new PlayerWeaponSystem();