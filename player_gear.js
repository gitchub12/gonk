// BROWSERFIREFOXHIDE player_gear.js
// New consolidated file for player weapons and equipment.

// === EQUIPMENT DATA ===
const EQUIPMENT_DATA = { /* ... equipment definitions ... */ };

// === EQUIPMENT SYSTEM ===
class EquipmentSystem {
    // ... equipment logic ...
}

// === PLAYER WEAPONS ===
class Projectile {
    constructor(startPos, direction) {
        this.life = GAME_GLOBAL_CONSTANTS.WEAPONS.PAMPHLET_LIFE;
        const material = assetManager.getRandomPamphletMaterial();
        this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.3), material);
        this.mesh.position.copy(startPos);
        this.velocity = direction.clone().multiplyScalar(GAME_GLOBAL_CONSTANTS.WEAPONS.PAMPHLET_SPEED);
        game.scene.add(this.mesh);
    }

    update() {
        this.life--;
        if (this.life <= 0) {
            this.cleanup();
            return false;
        }
        this.mesh.position.add(this.velocity);
        this.mesh.rotation.y += 0.2;
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
        if (!game || !game.camera || game.state.ammo <= 0) return;

        game.state.ammo--; // Consume ammo

        const startPos = game.camera.position.clone();
        const direction = new THREE.Vector3();
        game.camera.getWorldDirection(direction);
        const projectile = new Projectile(startPos, direction);
        game.entities.projectiles.push(projectile);
    }
}

// === INSTANTIATION ===
window.equipmentSystem = new EquipmentSystem();
window.playerWeaponSystem = new PlayerWeaponSystem();