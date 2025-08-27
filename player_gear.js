// BROWSERFIREFOXHIDE player_gear.js
// Rewritten to re-implement the Projectile class and pamphlet attack functionality.

class Projectile {
    constructor(position, direction, speed, lifetime) {
        const geo = new THREE.PlaneGeometry(0.2, 0.3);
        const mat = window.assetManager.getRandomPamphletMaterial();
        this.mesh = new THREE.Mesh(geo, mat);
        this.mesh.position.copy(position);

        // Make pamphlet face the direction it's thrown
        this.mesh.lookAt(position.clone().add(direction));
        
        this.velocity = direction.clone().multiplyScalar(speed);
        this.lifetime = lifetime;

        game.scene.add(this.mesh);
    }

    update(deltaTime) {
        // Move the projectile
        this.mesh.position.add(this.velocity);
        
        // Decrease lifetime
        this.lifetime--;
        
        // If lifetime is over, remove it from the scene
        if (this.lifetime <= 0) {
            game.scene.remove(this.mesh);
            if(this.mesh.geometry) this.mesh.geometry.dispose();
            if(this.mesh.material) this.mesh.material.dispose();
            return false; // Signal to the game loop to remove this projectile
        }
        
        return true; // Signal to keep this projectile active
    }
}

class PlayerWeaponSystem {
    constructor(){
      // Weapon system initialized
    }

    handlePamphletAttack() {
        if (game.state.ammo <= 0) {
            // Optional: play an "out of ammo" sound
            return; 
        }

        game.state.ammo--; // Use one ammo

        const cam = game.camera;
        const position = cam.position.clone();
        const direction = new THREE.Vector3();
        cam.getWorldDirection(direction);

        // Start the pamphlet slightly in front of the player to avoid clipping
        position.add(direction.clone().multiplyScalar(0.5));

        const pamphlet = new Projectile(
            position,
            direction,
            GAME_GLOBAL_CONSTANTS.WEAPONS.PAMPHLET_SPEED,
            GAME_GLOBAL_CONSTANTS.WEAPONS.PAMPHLET_LIFE
        );

        game.entities.projectiles.push(pamphlet);
    }
}


// === INSTANTIATION ===
// If we are in the game (e.g., index.html), instantiate the systems.
if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
    window.playerWeaponSystem = new PlayerWeaponSystem();
}