// BROWSERFIREFOXHIDE main.js
// update: Reverted trivia feedback popup to its original centered position to fix UI glitch.
// update: Halved the trivia screen's post-answer delay for a faster transition back to the game.
// update: Allies will now automatically become hostile towards any NPC that damages the player.
// update: Extracted LoadingScreenManager class to its own file (loadingScreenManager.js) to resolve conflicts and improve modularity.
// update: Added mouse wheel weapon cycling and KeyC character sheet toggle. Implemented Pickup class and updated main game loop for pickups.
// update: Refactored Pickup class to restore functional sine-wave bobbing and ensure co-location (shared X, Y, Z) to guarantee the stable visual flicker effect.

// === INPUT HANDLER ===
class InputHandler {
  constructor() {
    this.keys = {};
    this.yaw = Math.PI;
    this.pitch = 0;
    this.ignoreNextMouseMove = false;
    this.setupEventListeners();
  }

  setupEventListeners() {
    document.addEventListener('keydown', (e) => this.onKeyDown(e));
    document.addEventListener('keyup', (e) => this.keys[e.code] = false);
    document.addEventListener('click', () => { 
        if (game.canvas && !game.state.isPaused) game.canvas.requestPointerLock() 
    });
    document.addEventListener('mousemove', (e) => this.onMouseMove(e));
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('mousedown', (e) => this.onMouseDown(e));
    document.addEventListener('pointerlockchange', () => this.onPointerLockChange(), false);
    // ADDED: Mouse wheel listener for weapon cycling
    document.addEventListener('wheel', (e) => this.onMouseWheel(e), false);
  }

  onMouseWheel(e) {
    if (document.pointerLockElement !== game.canvas || game.state.isPaused) return;

    if (e.deltaY < 0) {
        playerWeaponSystem.nextWeapon();
    } else if (e.deltaY > 0) {
        playerWeaponSystem.prevWeapon();
    }
  }

  onPointerLockChange() {
    if (document.pointerLockElement === game.canvas) {
        this.ignoreNextMouseMove = true;
    } else if (!game.state.isPaused) {
        window.tabControls.show();
    }
  }

  onKeyDown(e) {
    if (e.code === 'Escape') {
        e.preventDefault();
        if (window.tabControls.isVisible) {
            window.tabControls.hide();
        } else if (document.pointerLockElement === game.canvas) {
            document.exitPointerLock();
        }
        return;
    }

    if (e.code === 'Tab' || e.code === 'Slash') {
        e.preventDefault();
        window.tabControls.toggle();
        return;
    }
    
    // ADDED: Character Sheet Toggle
    if (e.code === 'KeyC') {
        e.preventDefault();
        game.toggleCharacterSheet();
    }

    if (window.audioSystem && window.audioSystem.isInitialized) {
        if (e.key === '=') { // =/+ key
            e.preventDefault();
            audioSystem.increaseMusicVolume();
        } else if (e.key === '-') {
            e.preventDefault();
            audioSystem.decreaseMusicVolume();
        } else if (e.key === ']') {
            e.preventDefault();
            audioSystem.nextMusicTrack();
        } else if (e.key === '[') {
            e.preventDefault();
            audioSystem.previousMusicTrack();
        } else if (e.key === '\\') {
            e.preventDefault();
            audioSystem.nextMusicCategory();
        }
    }

    if (e.code === 'KeyF') {
        e.preventDefault();
        if (game) game.toggleFactionInfo();
    }

    if (game.state.isPaused) return;

    this.keys[e.code] = true;
    if (e.code === 'KeyE') {
        e.preventDefault();
        if(window.physics) physics.interact();
    }
    if (e.code === 'Space') {
        e.preventDefault();
        if (window.physics) {
            const didInteract = physics.interact();
            if (!didInteract) {
                physics.jump();
            }
        }
    }
    if (e.code === 'KeyH') {
        const hud = document.querySelector('.game-hud-container');
        if (hud) {
            hud.style.display = (hud.style.display === 'block') ? 'none' : 'block';
        }
    }

  }

  onMouseDown(e) {
    if (window.loadingScreenManager && window.loadingScreenManager.isActive) {
        if (e.button === 0) {
            window.loadingScreenManager.handleClick();
        }
        return;
    }

    if (document.pointerLockElement !== game.canvas || game.state.isPaused) return;
    if (e.button === 0) {
        if (window.playerWeaponSystem) playerWeaponSystem.handlePrimaryAttack();
    }
    if (e.button === 2) {
        if (window.playerWeaponSystem) playerWeaponSystem.handleSecondaryAttack();
    }
  }

  onMouseMove(e) {
    if (window.loadingScreenManager && window.loadingScreenManager.isActive) {
        window.loadingScreenManager.handleMouseMove(e.movementX, e.movementY);
    }

    if (document.pointerLockElement !== game.canvas || game.state.isPaused) return;

    if (this.ignoreNextMouseMove) {
        this.ignoreNextMouseMove = false;
        return;
    }

    this.yaw -= e.movementX * 0.002;
    this.pitch -= e.movementY * 0.002;
    this.pitch = Math.max(-Math.PI/2, Math.min(Math.PI/2, this.pitch));

    if (game.camera) {
        game.camera.rotation.set(0,0,0, 'YXZ');
        game.camera.rotation.y = this.yaw;
        game.camera.rotation.x = this.pitch;
    }
  }
}

// === PICKUP CLASS ===
class Pickup {
    // REVERTED: Removed scaleFactor and yOffset from constructor parameters to ensure coplanar Z-fighting.
    constructor(pickupType, itemKey, position) {
        this.type = pickupType; // 'module', 'health', 'ammo', 'resource'
        this.itemKey = itemKey; // e.g., 'ranged_firerateup', 'healthsmall'
        
        this.mesh = this.createMesh(itemKey);
        this.mesh.position.copy(position);
        
        // Initial offset above ground, will be consistently updated in update()
        this.mesh.position.y += 0.25; 

        this.rotationSpeed = Math.random() * 0.02 + 0.01;
        this.hoverOffset = Math.random() * Math.PI * 2;
        this.spawnTime = performance.now();
        this.lifetime = 60000; // 60 seconds lifetime
        
        // Base pickup size/radius for collision
        this.size = 0.5; 

        game.scene.add(this.mesh);
    }

    createMesh(itemKey) {
        const texturePath = itemKey.includes('/') ? itemKey : 
            (this.type === 'module' ? `/data/pngs/MODULES/${itemKey}.png` : `/data/pngs/PICKUPS/${itemKey}.png`);
        
        const texture = assetManager.getTexture(texturePath.split('/').pop().replace(/\.[^/.]+$/, ""));
        let material;
        
        if (texture) {
            material = new THREE.MeshBasicMaterial({
                map: texture,
                transparent: true,
                alphaTest: 0.1,
                side: THREE.DoubleSide
            });
        } else {
            console.warn(`Texture for ${itemKey} not found. Using fallback.`);
            material = new THREE.MeshBasicMaterial({ color: 0xff00ff });
        }
        
        const size = 0.5;
        const geometry = new THREE.PlaneGeometry(size, size);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.x = Math.PI / 2; // Start with a vertical orientation (will be corrected in update)

        return mesh;
    }

    update(deltaTime) {
        // Billboard effect
        this.mesh.lookAt(game.camera.position);

        // Hover effect (Y-axis bobbing)
        const totalTime = performance.now() - this.spawnTime;
        
        // FIX: Recalculate base Y correctly using ground height + hover offset (0.25)
        const groundHeight = physics.getGroundHeight(this.mesh.position.x, this.mesh.position.z);
        const baseY = groundHeight + 0.25;
        
        // Apply sine wave motion
        this.mesh.position.y = baseY + Math.sin(totalTime * 0.005 + this.hoverOffset) * 0.05; // Increased bob amount for visibility

        // Check for player collision
        const playerPos = physics.playerCollider.position;
        const distance = playerPos.distanceTo(this.mesh.position);
        if (distance < this.size + physics.playerCollider.radius) {
            this.onPickup();
            return false; // Tells the game loop to remove it
        }

        // Lifetime expiration
        if (totalTime > this.lifetime) {
            return false;
        }

        return true;
    }

    onPickup() {
        if (window.audioSystem) audioSystem.playSound('pickup');

        if (this.type === 'module') {
            game.state.modules.push(this.itemKey);
        } else if (this.type === 'health') {
            game.state.health = Math.min(game.state.health + 10, GAME_GLOBAL_CONSTANTS.PLAYER.MAX_HEALTH);
        }
        // console.log(`Picked up ${this.type}: ${this.itemKey}`);
    }

    dispose() {
        game.scene.remove(this.mesh);
        if(this.mesh.geometry) this.mesh.geometry.dispose();
        if(this.mesh.material) this.mesh.material.dispose();
    }
}


// === GAME ENGINE CORE ===
class Game {
  constructor() {
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.canvas = null;
    this.weaponHolder = new THREE.Group();
    this.isInitialized = false;
    this.deltaTime = 0;
    // UPDATED: Added 'pickups'
    this.entities = { npcs: [], projectiles: [], doors: [], pickups: [] };
    this.state = { 
        health: GAME_GLOBAL_CONSTANTS.PLAYER.MAX_HEALTH,
        ammo: GAME_GLOBAL_CONSTANTS.WEAPONS.PAMPHLET_START_AMMO,
        maxAmmo: GAME_GLOBAL_CONSTANTS.WEAPONS.PAMPHLET_MAX_AMMO,
        gameOver: false,
        allies: [],
        maxAllies: 4,
        simulatedAllies: { rebels: 0, aliens: 0, clones: 0, imperials: 0, droids: 0 },
        isPaused: false,
        showFactionInfo: false,
        unpauseFactionPhysics: false,
        // ADDED: Module state
        modules: [] 
    };
    this.hudGonkIcon = {
        basePath: 'data/pngs/hologonk/hologonk_',
        totalFrames: 40,
        currentFrame: 1,
        animTimer: 0,
        animSpeed: 0.05,
        needsUpdate: true
    };
    this.allyIcons = new Map();
    this.lastSpawnPointPerLevel = {};
    this.skyboxAnimator = null;

    this.shakeTimer = 0;
    this.shakeDuration = 0.2;
    this.shakeIntensity = 0;
    this.hudContainer = document.querySelector('.game-hud-container');
    this.allyBoxesContainer = document.querySelector('.ally-boxes');
    this.gonkHealthContainer = document.querySelector('.gonk-health');
    this.ALLY_COLORS = ['#00FFFF', '#00FF00', '#FFFF00', '#FF00FF'];
    this.factionManager = new FactionManager();
    this.factionRelationshipHUD = document.getElementById('faction-relationship-hud');
    this.factionLinesSVG = document.getElementById('faction-lines-svg');
    this.factionNodes = [];
    this.factionShadowNodes = [];
    this.ambientLight = null;
    
    // ADDED: Character Sheet reference
    this.characterSheet = document.getElementById('character-sheet-container');
    this.moduleDisplay = document.getElementById('module-display');
  }
  initialUISettingsApplied = false;

  init() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.autoClear = true; // Let Three.js handle clearing
    document.body.appendChild(this.renderer.domElement);
    this.canvas = this.renderer.domElement;

    this.camera.add(this.weaponHolder);
    this.scene.add(this.camera);
    this.camera.layers.enableAll();

    if(window.assetManager && assetManager.factionData) {
        this.factionManager.initialize(assetManager.factionData);
    }
     for (let i = 0; i < 9; i++) {
        this.factionNodes.push(document.getElementById(`faction-node-${i}`));
        this.factionShadowNodes.push(document.getElementById(`faction-node-shadow-${i}`));
    }

    if (window.playerWeaponSystem) {
        playerWeaponSystem.init(this.camera, this.weaponHolder);
    }

    this.setupLighting();
    window.addEventListener('resize', this.onWindowResize.bind(this));
    this.isInitialized = true;
  }

  setupLighting() {
    const existingLights = this.scene.children.filter(c => c.name === 'AmbientLight' || c.name === 'DirectionalLight');
    existingLights.forEach(light => this.scene.remove(light));

    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.ambientLight.name = 'AmbientLight';
    this.scene.add(this.ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 15);
    directionalLight.castShadow = true;
    directionalLight.name = 'DirectionalLight';
    this.scene.add(directionalLight);
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  takePlayerDamage(amount, attacker = null) {
      if (this.state.gameOver || (window.loadingScreenManager && window.loadingScreenManager.isActive)) return;
      this.state.health = Math.max(0, this.state.health - amount);

      this.triggerDamageEffect({
          flashOpacity: 0.5,
          flashDuration: 80,
          shakeIntensity: 0.02,
          shakeDuration: 0.2
      });

      if (attacker) {
          for (const ally of this.state.allies) {
              if (ally.npc && !ally.npc.isDead) {
                  ally.npc.aggro(attacker);
              }
          }
      }

      if (this.state.health <= 0) {
          this.respawnPlayer();
      }
  }

    handlePlayerKill(killedNpc) {
        // Placeholder
    }

  triggerDamageEffect(config) {
      const flash = document.getElementById('damageFlash');
      flash.style.backgroundColor = `rgba(255, 0, 0, ${config.flashOpacity})`;
      flash.style.display = 'block';
      setTimeout(() => { flash.style.display = 'none'; }, config.flashDuration);

      this.shakeIntensity = config.shakeIntensity;
      this.shakeDuration = config.shakeDuration;
      this.shakeTimer = config.shakeDuration;
  }

  respawnPlayer() {
    this.state.health = GAME_GLOBAL_CONSTANTS.PLAYER.MAX_HEALTH;
    this.state.gameOver = false;

    const currentLevel = window.levelManager.currentLevel;
    const spawnPoint = this.lastSpawnPointPerLevel[currentLevel];

    if (spawnPoint && window.physics) {
        const [posStr, item] = spawnPoint;
        const [x, z] = posStr.split(',').map(Number);
        const gridSize = GAME_GLOBAL_CONSTANTS.GRID.SIZE;

        const spawnX = x * gridSize + gridSize / 2;
        const spawnZ = z * gridSize + gridSize / 2;
        const spawnY = physics.getGroundHeight(spawnX, spawnZ) + GAME_GLOBAL_CONSTANTS.PLAYER.HEIGHT / 2;

        physics.playerCollider.position.set(spawnX, spawnY, spawnZ);
        physics.playerCollider.velocity.set(0, 0, 0);
        if (window.inputHandler) inputHandler.yaw = (item.rotation || 0) * -Math.PI / 2;
    }
  }

  recreateAllyRing(allyData) {
      const npc = allyData.npc;
      if (npc.allyRing) return;

      const radius = (npc.config.collision_radius || 0.5) * GAME_GLOBAL_CONSTANTS.ALLY_RING.DIAMETER_MULTIPLIER;
      const ringGeo = new THREE.RingGeometry(radius * 0.9, radius, 32); // The geometry is correct.
      const ringMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: GAME_GLOBAL_CONSTANTS.ALLY_RING.OPACITY, side: THREE.DoubleSide }); // FIX: Use neutral white for the ring.
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = -Math.PI / 2;
      this.scene.add(ringMesh);
      npc.allyRing = ringMesh;
  }

  async addAlly(npc) {
      if (this.state.allies.length >= this.state.maxAllies || this.state.allies.some(a => a.id === npc.mesh.group.uuid)) return;

      const skinTextureName = npc.itemData.key;
      let iconDataUrl = this.allyIcons.get(skinTextureName);
      if (!iconDataUrl) {
          const skinTexture = assetManager.getTexture(skinTextureName);
          if (skinTexture) {
              iconDataUrl = await window.generateNpcIconDataUrl(skinTexture);
              this.allyIcons.set(skinTextureName, iconDataUrl);
          }
      }

      const factionColor = GAME_GLOBAL_CONSTANTS.FACTION_COLORS[npc.originalFaction] || '#FFFFFF';
      npc.allySlotIndex = this.state.allies.length;

      const allyData = {
          id: npc.mesh.group.uuid,
          name: npc.name,
          icon: iconDataUrl || '',
          color: factionColor, // This now correctly stores the faction color
          npc: npc 
      };
      this.state.allies.push(allyData);

      this.recreateAllyRing(allyData);
      allyData.npc.mesh.group.visible = true; // Ensure ally is visible

      if(npc.onJoinParty) npc.onJoinParty();
  }

  removeAlly(npc) {
      const allyIndex = this.state.allies.findIndex(ally => ally.id === npc.mesh.group.uuid);
      if (allyIndex === -1) return;

      if (npc.allyRing) {
          this.scene.remove(npc.allyRing);
          npc.allyRing.geometry.dispose();
          npc.allyRing.material.dispose();
          npc.allyRing = null;
      }
      npc.allySlotIndex = -1;
      this.state.allies.splice(allyIndex, 1);

      this.state.allies.forEach((ally, index) => {
          ally.npc.allySlotIndex = index;
      });
  }

  toggleFactionInfo() {
      this.state.showFactionInfo = !this.state.showFactionInfo;
      this.factionRelationshipHUD.style.display = this.state.showFactionInfo ? 'block' : 'none';
  }
  
  // ADDED: Character Sheet Toggle method
  toggleCharacterSheet() {
      const isVisible = this.characterSheet.style.display === 'block';
      if (isVisible) {
          this.characterSheet.style.display = 'none';
          this.state.isPaused = false;
          if (this.hudContainer) this.hudContainer.style.display = 'block';
          if (this.canvas) this.canvas.requestPointerLock();
      } else {
          this.updateCharacterSheet();
          this.characterSheet.style.display = 'block';
          this.state.isPaused = true;
          if (this.hudContainer) this.hudContainer.style.display = 'none';
          document.exitPointerLock();
      }
  }
  
  // ADDED: Character Sheet update logic
  updateCharacterSheet() {
      if (!this.moduleDisplay) return;
      this.moduleDisplay.innerHTML = '';
      
      this.state.modules.forEach(moduleKey => {
          const img = document.createElement('img');
          img.className = 'module-icon';
          img.src = `/data/pngs/MODULES/${moduleKey}.png`;
          img.title = moduleKey.replace(/_/g, ' ');
          this.moduleDisplay.appendChild(img);
      });
  }

  updateFactionDisplay() {
      if(this.state.showFactionInfo) {
          this.updateFactionRelationshipHUD();
      }
  }

  update(deltaTime, totalTime) {
    if (!this.initialUISettingsApplied && window.tabControls && this.entities.npcs.length > 0) {
        window.tabControls.updateLabelAndRingFromUI();
        window.tabControls.updateFactionHudFromUI();
        this.initialUISettingsApplied = true;
    }

    this.deltaTime = deltaTime;

    if (window.factionAvatarManager) {
        factionAvatarManager.update(deltaTime);
    }

    if (this.shakeTimer > 0) {
        this.shakeTimer -= deltaTime;
    }

    if (this.skyboxAnimator) {
        this.skyboxAnimator.update(this.deltaTime);
    }

    if (this.factionManager && this.factionManager.processFactionDynamics) {
        if (!this.state.isPaused || this.state.unpauseFactionPhysics) {
            this.factionManager.processFactionDynamics(deltaTime, this.state.allies, this.state.simulatedAllies);
        }
    }

    this.updateHUD();

    if (!this.state.isPaused) {
        if(window.playerWeaponSystem) {
            playerWeaponSystem.update(this.deltaTime, totalTime);
        }
        for (const door of this.entities.doors) {
            if (door.update) {
                door.update(this.deltaTime);
            }
        }
        // ADDED: Pickup update loop
        for (let i = game.entities.pickups.length - 1; i >= 0; i--) {
            const pickup = game.entities.pickups[i];
            if (pickup.update) {
                if (!pickup.update(game.deltaTime)) {
                    pickup.dispose();
                    game.entities.pickups.splice(i, 1);
                }
            }
        }
    } else {
        if (window.playerWeaponSystem) {
            playerWeaponSystem.update(this.deltaTime, totalTime);
        }
        if (window.tabControls && window.tabControls.isVisible) {
            window.tabControls.updateMuzzleHelpersFromUI();
        }
        this.updatePaused(deltaTime);
    }
  }

  updatePaused(deltaTime) {
      for (const npc of this.entities.npcs) {
          if (npc.shootAnimTimer > 0) {
              npc.shootAnimTimer -= deltaTime;
              if (npc.shootAnimTimer <= 0) {
                  window.setGonkAnimation(npc.mesh, 'aim');
              }
          }
          if (npc.nameplate) {
              npc.nameplate.quaternion.copy(this.camera.quaternion);
          }
          if (npc.mesh) {
              window.updateGonkAnimation(npc.mesh, { deltaTime, isPaused: true });
          }
      }
  }

  updateHUD() {
      const healthFill = document.querySelector('.health-fill');
      const healthLabel = document.querySelector('.health-label');
      const ammoDisplay = document.getElementById('gameHudAmmo');
      const weaponDisplay = document.getElementById('gameHudWeapon');
      const weaponContainer = document.querySelector('.weapon-display'); // Corrected selector
      const gonkImage = document.getElementById('gonkImage');

      // ADDED: Update displayed weapon name
      if (weaponContainer && window.playerWeaponSystem && window.playerWeaponSystem.activeWeapon) {
          const weapon = window.playerWeaponSystem.activeWeapon;
          let category = weapon.config.category || 'weapon';
          // Simplify "saberhiltoverlayer" for the HUD
          if (category === 'saberhiltoverlayer') {
              category = 'Saber';
          }
          const categoryName = category.charAt(0).toUpperCase() + category.slice(1);
          const weaponName = weapon.config.name;
          
          weaponContainer.innerHTML = `<div class="ammo-label">${categoryName}</div><div id="gameHudWeapon" style="text-transform: capitalize;">${weaponName}</div>`;

          if (ammoDisplay) {
              ammoDisplay.textContent = (weapon instanceof RangedWeapon) ? `${weapon.ammo}` : `${this.state.ammo}`;
          }
      }


      if (healthFill && healthLabel) {
          const healthPercent = Math.max(0, (this.state.health / GAME_GLOBAL_CONSTANTS.PLAYER.MAX_HEALTH) * 100);
          healthFill.style.width = `${healthPercent}%`;
          healthLabel.textContent = `HEALTH: ${Math.round(this.state.health)} / ${GAME_GLOBAL_CONSTANTS.PLAYER.MAX_HEALTH}`;
      }

      for (let i = 1; i <= 4; i++) {
          const box = document.getElementById(`ally-box-${i}`);
          const allyData = this.state.allies[i - 1];
          if (allyData) {
              const nameSpan = box.querySelector('.ally-name');
              const healthOverlay = box.querySelector('.ally-health-overlay');
              const healthOverlayFace = box.querySelector('.ally-health-overlay-face'); // This is now just for the face overlay
              const factionColor = allyData.color;

              box.querySelector('img').src = allyData.icon;
              box.style.borderColor = factionColor;

              // Split name only if it's a generated name with a space
              if (allyData.name.includes(' ') && allyData.name.split(' ').length === 2) {
                  nameSpan.innerHTML = allyData.name.replace(' ', '<br>');
              } else {
                  nameSpan.innerHTML = allyData.name;
              }

              const npc = allyData.npc;
              // FIX: The maxHealth to check against is the *original* maxHealth, before it was doubled.
              // We can get this by dividing the current maxHealth by 2.
              const maxHealth = npc.maxHealth;
              const damagePercent = (1 - (npc.health / maxHealth)) * 100;
              healthOverlay.style.height = `${damagePercent}%`;
              healthOverlayFace.style.height = `${damagePercent}%`;
              
              // Add pulsing effect for critical health
              if (npc.health / maxHealth <= 0.1) {
                  healthOverlay.classList.add('pulsing');
                  healthOverlayFace.classList.add('pulsing');
              } else {
                  healthOverlay.classList.remove('pulsing');
                  healthOverlayFace.classList.remove('pulsing');
              }

              box.classList.add('visible');
          } else {
              box.classList.remove('visible');
          }
      }

      const icon = this.hudGonkIcon;
      icon.animTimer += this.deltaTime;

      if (icon.animTimer >= icon.animSpeed) {
          let frameChanged = false;
          const playerIsMoving = inputHandler.keys['KeyW'] || inputHandler.keys['KeyS'] || inputHandler.keys['KeyA'] || inputHandler.keys['KeyD'];
          if (playerIsMoving) {
              icon.currentFrame++;
              if (icon.currentFrame > icon.totalFrames) icon.currentFrame = 1;
              frameChanged = true;
          }
          if (frameChanged) {
              icon.animTimer = 0;
              icon.needsUpdate = true;
          }
      }

      if (icon.needsUpdate && gonkImage) {
          gonkImage.src = `${icon.basePath}${icon.currentFrame}.png`;
          icon.needsUpdate = false;
      }

      if (this.state.showFactionInfo) {
          this.updateFactionRelationshipHUD();
      }
  }

    updateFactionRelationshipHUD() {
        if (!this.factionManager || !this.factionManager.factions || !this.factionNodes.length) return;

        const displayedFactions = ['player_droid', 'rebels', 'droids', 'imperials', 'clones', 'aliens', 'mandalorians', 'takers', 'sith'];
        this.factionLinesSVG.innerHTML = '';

        const hudConfig = GAME_GLOBAL_CONSTANTS.FACTION_HUD;
        const padding = 5;
        const scale = 100 - (padding * 2);

        // Draw grid lines
        if (this.state.showFactionGrid) {
            for (let i = 0; i <= 10; i++) {
                const pos = padding + (i * (scale / 10));
                const hLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                hLine.setAttribute('x1', `${padding}%`); hLine.setAttribute('y1', `${pos}%`);
                hLine.setAttribute('x2', `${100 - padding}%`); hLine.setAttribute('y2', `${pos}%`);
                hLine.setAttribute('stroke', 'rgba(255,255,255,0.1)'); hLine.setAttribute('stroke-width', '1');
                this.factionLinesSVG.appendChild(hLine);

                const vLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                vLine.setAttribute('x1', `${pos}%`); vLine.setAttribute('y1', `${padding}%`);
                vLine.setAttribute('x2', `${pos}%`); vLine.setAttribute('y2', `${100 - padding}%`);
                vLine.setAttribute('stroke', 'rgba(255,255,255,0.1)'); vLine.setAttribute('stroke-width', '1');
                this.factionLinesSVG.appendChild(vLine);
            }
        }

        const gridToScreen = (pos) => {
            // Invert Y so 0 is at the bottom
            const vecFromOrigCenter = new THREE.Vector2(pos.x - 50, (100 - pos.y) - 50);
            vecFromOrigCenter.multiplyScalar(hudConfig.SCALE);

            const screenX = (vecFromOrigCenter.x + 50) / 100;
            const screenY = (vecFromOrigCenter.y + 50) / 100;

            return {
                x: `${padding + screenX * scale}%`,
                y: `${padding + screenY * scale}%`,
                rawX: padding + screenX * scale,
                rawY: padding + screenY * scale
            };
        };

        const positionedFactions = {};

        for (let i = 0; i < displayedFactions.length; i++) {
            const factionKey = displayedFactions[i];
            const factionData = this.factionManager.factions[factionKey];
            if (!factionData) continue;

            const currentNode = this.factionNodes[i];
            const shadowNode = this.factionShadowNodes[i];
            if (!currentNode || !shadowNode) continue;

            const homeScreenPos = gridToScreen(factionData.homePosition); // Now reads directly from the manager
            shadowNode.style.left = homeScreenPos.x;
            shadowNode.style.top = homeScreenPos.y;
            shadowNode.className = 'faction-node faction-node-shadow ' + factionKey;
            shadowNode.textContent = factionData.name.toUpperCase().replace(' ', '\n');

            const currentScreenPos = gridToScreen(factionData.currentPosition);
            currentNode.style.left = currentScreenPos.x;
            currentNode.style.top = currentScreenPos.y;

            const trend = (factionKey !== 'player_droid') ? this.factionManager.getRelationshipTrend('player_droid', factionKey) : 'stable';
            currentNode.className = 'faction-node ' + factionKey;
            if (trend === 'improving') currentNode.classList.add('improving');
            else if (trend === 'worsening') currentNode.classList.add('worsening');

            // Add new faction colors here
            if (factionKey === 'takers') currentNode.classList.add('takers');
            if (factionKey === 'sith') currentNode.classList.add('sith');


            currentNode.textContent = factionData.name.toUpperCase().replace(' ', '\n');
            positionedFactions[factionKey] = { current: currentScreenPos, index: i };
        }

        for (let i = 0; i < displayedFactions.length; i++) {
            for (let j = i + 1; j < displayedFactions.length; j++) {
                const factionA_key = displayedFactions[i];
                const factionB_key = displayedFactions[j];

                const relationship = this.factionManager.getRelationship(factionA_key, factionB_key);
                const posA = positionedFactions[factionA_key].current;
                const posB = positionedFactions[factionB_key].current;

                let color = '#888';
                if (relationship < GAME_GLOBAL_CONSTANTS.FACTIONS.FRIENDLY_THRESHOLD) color = '#00ff00';
                if (relationship > GAME_GLOBAL_CONSTANTS.FACTIONS.HOSTILE_THRESHOLD) color = '#ff0000';

                if (color === '#888' && !this.state.showNeutralFactionLines) continue;

                const dist = Math.sqrt(Math.pow(posB.rawX - posA.rawX, 2) + Math.pow(posB.rawY - posA.rawY, 2));

                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', `${posA.rawX}%`);
                line.setAttribute('y1', `${posA.rawY}%`);
                line.setAttribute('x2', `${posB.rawX}%`);
                line.setAttribute('y2', `${posB.rawY}%`);
                line.setAttribute('stroke', color);
                line.setAttribute('stroke-width', hudConfig.LINE_WIDTH);
                this.factionLinesSVG.appendChild(line);

                const createTextLabel = (x, y) => {
                    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                    text.setAttribute('x', `${x}%`);
                    text.setAttribute('y', `${y}%`);
                    text.setAttribute('fill', color);
                    text.setAttribute('font-size', '14');
                    text.setAttribute('font-weight', 'bold');
                    text.setAttribute('text-anchor', 'middle');
                    text.setAttribute('alignment-baseline', 'middle');
                    text.style.filter = 'drop-shadow(0 0 3px rgba(0, 0, 0, 0.9))';
                    text.textContent = Math.round(relationship);
                    this.factionLinesSVG.appendChild(text);
                };

                if (dist > 30) { // If line is long, show two labels
                    createTextLabel(posA.rawX + (posB.rawX - posA.rawX) * 0.2, posA.rawY + (posB.rawY - posA.rawY) * 0.2);
                    createTextLabel(posA.rawX + (posB.rawX - posA.rawX) * 0.8, posA.rawY + (posB.rawY - posA.rawY) * 0.8);
                } else { // Otherwise, show one in the middle
                    createTextLabel((posA.rawX + posB.rawX) / 2, (posA.rawY + posB.rawY) / 2);
                }
            }
        }
    }

  render() {
      const originalPos = this.camera.position.clone();
      if (this.shakeTimer > 0) {
          const progress = this.shakeTimer / this.shakeDuration;
          const shakeAmount = this.shakeIntensity * progress;
          this.camera.position.x += (Math.random() - 0.5) * shakeAmount;
          this.camera.position.y += (Math.random() - 0.5) * shakeAmount;
      }

      this.renderer.render(this.scene, this.camera);

      this.camera.position.copy(originalPos);
  }

  clearScene() {
    this.initialUISettingsApplied = false;
    if (this.state.allies.length > 0) {
        this.state.allies.forEach(ally => {
            if (ally.npc.allyRing) {
                this.scene.remove(ally.npc.allyRing);
                ally.npc.allyRing.geometry.dispose();
                ally.npc.allyRing.material.dispose();
                ally.npc.allyRing = null;
            }
        });
    }
    const persistentAllyNpcs = this.state.allies.map(a => a.npc);

    for(let i = this.entities.npcs.length - 1; i >= 0; i--) {
        const npc = this.entities.npcs[i];
        if (!persistentAllyNpcs.includes(npc)) {
            if (npc.mesh && npc.mesh.group) {
                this.scene.remove(npc.mesh.group);
            }
            this.entities.npcs.splice(i, 1);
        }
    }

    this.entities.projectiles.forEach(p => p.dispose());
    this.entities.projectiles = [];
    this.entities.doors = [];
    
    // UPDATED: Dispose of pickups
    this.entities.pickups.forEach(p => p.dispose());
    this.entities.pickups = [];

    const toRemove = [];
    this.scene.traverse(child => {
        if (child.userData.isLevelAsset) {
            toRemove.push(child);
        }
    });

    toRemove.forEach(child => {
        child.traverse(obj => {
            if (obj.isMesh) {
                obj.geometry.dispose();
                if (obj.material) {
                     if (Array.isArray(obj.material)) {
                        obj.material.forEach(m => {
                            if (m.map) m.map.dispose();
                            m.dispose();
                        });
                     } else {
                        if (obj.material.map) obj.material.map.dispose();
                        obj.material.dispose();
                     }
                }
            }
        });
        this.scene.remove(child);
    });

    if (window.weaponIcons) {
        window.weaponIcons.clear();
    }
  }

  respawnAllies() {
      if (this.state.allies.length === 0 || !window.physics) return;
  
      const playerPos = physics.playerCollider.position;
      const playerYaw = inputHandler.yaw;
  
      const offsets = [
          new THREE.Vector3(-2.0, 0, -1.5),  // ~9:30 o'clock
          new THREE.Vector3(2.0, 0, -1.5),   // ~2:30 o'clock
          new THREE.Vector3(-2.5, 0, -1.0),  // ~9:45 o'clock
          new THREE.Vector3(2.5, 0, -1.0),   // ~2:45 o'clock
          new THREE.Vector3(0, 0, 3.0)       // 6 o'clock (for 5th ally)
      ];
  
      this.state.allies.forEach((allyData) => {
          const npc = allyData.npc;
          if (!npc || !npc.mesh || !npc.movementCollider) return;
  
          const offset = npc.allySlotIndex < offsets.length ? offsets[npc.allySlotIndex].clone() : new THREE.Vector3(0,0,2);
          offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), playerYaw);
  
          const targetPos = playerPos.clone().add(offset);
          const groundY = physics.getGroundHeight(targetPos.x, targetPos.z);
          targetPos.y = groundY + (npc.mesh.groundOffset || 0);
          npc.mesh.group.visible = true; // Make sure they are visible

          npc.mesh.group.position.copy(targetPos);
          npc.movementCollider.position.copy(targetPos);
          npc.mesh.group.rotation.y = playerYaw;
          npc.velocity.set(0, 0, 0);
  
          npc.currentState = 'FOLLOWING';
          npc.target = null;
  
          this.recreateAllyRing(allyData);
      });
  }
}

// === INSTANTIATION ===
window.game = new Game();
window.inputHandler = new InputHandler();