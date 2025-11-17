// BROWSERFIREFOXHIDE main.js
// update: Reverted trivia feedback popup to its original centered position to fix UI glitch.
// update: Halved the trivia screen's post-answer delay for a faster transition back to the game.
// update: Allies will now automatically become hostile towards any NPC that damages the player.
// update: Extracted LoadingScreenManager class to its own file (loadingScreenManager.js) to resolve conflicts and improve modularity.
// update: Added mouse wheel weapon cycling and KeyC character sheet toggle. Implemented Pickup class and updated main game loop for pickups.
// update: Refactored Pickup class to restore functional sine-wave bobbing and ensure co-location (shared X, Y, Z) to guarantee the stable visual flicker effect.
// update: Initialized PlayerWeaponSystem with the correct number of slots and set the starting unlocked slots based on initial module state.
// update: Fixed ally HUD vanishing during conversation, updated wire count display, and fixed HUD console spamming.
// update: Relocated Hologonk animated element into Faction Avatar HUD and cleaned up the old lower-left Gonk model display.
// update: Ensured the F-menu nodes are always visible for debugging by removing the `isEncountered` check from HUD logic.

// === INPUT HANDLER ===
class InputHandler {
  constructor() {
    this.keys = {};
    this.yaw = Math.PI;
    this.pitch = 0;
    this.ignoreNextMouseMove = false;
    this.isAttacking = false;
    this.setupEventListeners();
  }

  setupEventListeners() {
    document.addEventListener('keydown', (e) => this.onKeyDown(e));
    document.addEventListener('keyup', (e) => this.onKeyUp(e));
    document.addEventListener('click', () => { 
        if (game.canvas && !game.state.isPaused) game.canvas.requestPointerLock()
    });
    document.addEventListener('mousemove', (e) => this.onMouseMove(e));
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('mousedown', (e) => this.onMouseDown(e));
    document.addEventListener('mouseup', (e) => this.onMouseUp(e));
    document.addEventListener('pointerlockchange', () => this.onPointerLockChange(), false);
    document.addEventListener('wheel', (e) => this.onMouseWheel(e), false);
  }

  onMouseWheel(e) {
    // Check if character sheet or map screen is open
    const wrapper = document.getElementById('character-page-wrapper');
    const mapScreen = document.getElementById('map-screen');
    const isCharSheetOpen = wrapper && wrapper.style.display === 'flex';
    const isMapOpen = mapScreen && mapScreen.style.display === 'block';

    // Don't handle weapon scroll if pointer isn't locked or if any menu is open
    if (document.pointerLockElement !== game.canvas || game.state.isPaused || isCharSheetOpen || isMapOpen) return;

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
        if (window.isConversationUIVisible) {
            return; // This pointer lock exit was caused by the conversation UI. Do nothing.
        }
        window.tabControls.show();
    }
  }

  onKeyDown(e) {
    if (e.code === 'Escape') {
        e.preventDefault();
        window.tabControls.toggle();
        return;
    }

    if (e.code === 'Tab' || e.code === 'Slash') {
        e.preventDefault();
        window.tabControls.toggle();
        return;
    }
    
    if (e.code === 'KeyC') {
        e.preventDefault();
        game.toggleCharacterSheet();
    }

    if (e.code === 'KeyM') {
        e.preventDefault();
        if (window.mapScreen) {
            window.mapScreen.toggle();
        }
    }

    if (e.code === 'KeyP') {
        e.preventDefault();
        game.toggleCheatsMenu();
    }

    if (window.audioSystem && window.audioSystem.isInitialized) {
        if (e.key === '=') { e.preventDefault(); audioSystem.increaseMusicVolume(); }
        else if (e.key === '-') { e.preventDefault(); audioSystem.decreaseMusicVolume(); }
        else if (e.key === ']') { e.preventDefault(); audioSystem.nextMusicTrack(); }
        else if (e.key === '[') { e.preventDefault(); audioSystem.previousMusicTrack(); }
        else if (e.key === '\\') { e.preventDefault(); audioSystem.nextMusicCategory(); }
    }

    if (e.code === 'KeyF') {
        e.preventDefault();
        if (game) game.toggleFactionInfo();
    }

    if (game.state.isPaused) return;

    this.keys[e.code] = true;

    if (window.weaponPickupManager && window.weaponPickupManager.activePickup) {
        if (e.code === 'KeyE' || e.code === 'KeyT' || e.code.startsWith('Digit')) {
            e.preventDefault();
            window.weaponPickupManager.handleKeyPress(e);
            return;
        }
    }

    if (e.code === 'KeyG') {
        e.preventDefault();
        if (window.playerWeaponSystem) {
            playerWeaponSystem.handleForcePush();
        }
    }

    if (e.code === 'KeyE') {
        e.preventDefault();
        if (window.physics) {
            physics.interact();
        }
    }
    if (e.code === 'Space') {
        e.preventDefault();
        if (window.physics) {
            physics.jump();
            // Play random gonk sound on jump
            const gonkSounds = [
                'data/sounds/gonk/gonk_1.mp3',
                'data/sounds/gonk/gonk_2.mp3',
                'data/sounds/gonk/gonk_3.mp3',
                'data/sounds/gonk/gonk_4.mp3',
                'data/sounds/gonk/gonk_5.mp3',
                'data/sounds/gonk/gonk_6.mp3',
                'data/sounds/gonk/gonk_7.mp3',
                'data/sounds/gonk/gonk_8.mp3',
                'data/sounds/gonk/gonk_9.mp3',
                'data/sounds/gonk/gonk_10.mp3',
                'data/sounds/gonk/gonk_12.mp3',
                'data/sounds/gonk/gonk_13.mp3',
                'data/sounds/gonk/gonk_14.mp3',
                'data/sounds/gonk/gonk_15.mp3',
                'data/sounds/gonk/gonk_16.mp3',
                'data/sounds/gonk/gonk_17.mp3'
            ];
            const randomSound = gonkSounds[Math.floor(Math.random() * gonkSounds.length)];
            const audio = new Audio(randomSound);
            audio.volume = 0.5;
            audio.play().catch(err => console.log('Gonk sound failed:', err));
        }
    }
    if (e.code === 'KeyH') {
        const hud = document.querySelector('.game-hud-container');
        if (hud) { hud.style.display = (hud.style.display === 'block') ? 'none' : 'block'; }
    }
  }

  onKeyUp(e) {
    this.keys[e.code] = false;
  }

  onMouseDown(e) {
    if (window.loadingScreenManager && window.loadingScreenManager.isActive) {
        if (e.button === 0) { window.loadingScreenManager.handleClick(); }
        return;
    }

    if (document.pointerLockElement !== game.canvas || game.state.isPaused) return;
    if (e.button === 0) {
        this.isAttacking = true;
        if (window.playerWeaponSystem) {
            playerWeaponSystem.isAttacking = true;
            playerWeaponSystem.handlePrimaryAttack();
        }
    }
    if (e.button === 2) { if (window.playerWeaponSystem) playerWeaponSystem.handleSecondaryAttack(); }
  }

  onMouseUp(e) {
    if (e.button === 0) {
        this.isAttacking = false;
        if (window.playerWeaponSystem) {
            playerWeaponSystem.isAttacking = false;
        }
    }
  }

  onMouseMove(e) {
    if (window.loadingScreenManager && window.loadingScreenManager.isActive) {
        window.loadingScreenManager.handleMouseMove(e.movementX, e.movementY);
    }
    if (document.pointerLockElement !== game.canvas || game.state.isPaused) return;
    if (this.ignoreNextMouseMove) { this.ignoreNextMouseMove = false; return; }

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

class Pickup {
    constructor(pickupType, itemKey, position) {
        this.type = pickupType;
        this.itemKey = itemKey;
        this.mesh = this.createMesh(itemKey);
        this.mesh.position.copy(position);
        this.mesh.position.y += 0.25; 
        this.rotationSpeed = Math.random() * 0.02 + 0.01;
        this.hoverOffset = Math.random() * Math.PI * 2;
        this.spawnTime = performance.now();
        this.lifetime = 60000;
        this.size = 0.5; 
        game.scene.add(this.mesh);
    }

    createMesh(itemKey) {
        const texturePath = itemKey.includes('/') ? itemKey : (this.type === 'module' ? `/data/pngs/MODULES/${itemKey}.png` : `/data/pngs/PICKUPS/${itemKey}`);
        const texture = assetManager.getTexture(texturePath.split('/').pop().replace(/\.[^/.]+$/, ""));
        let material;
        if (texture) {
            material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, alphaTest: 0.1, side: THREE.DoubleSide });
        } else {
            material = new THREE.MeshBasicMaterial({ color: 0xff00ff });
        }
        const size = 0.5;
        const geometry = new THREE.PlaneGeometry(size, size);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.x = Math.PI / 2;
        return mesh;
    }

    update(deltaTime) {
        this.mesh.lookAt(game.camera.position);
        const totalTime = performance.now() - this.spawnTime;
        const groundHeight = physics.getGroundHeight(this.mesh.position.x, this.mesh.position.z);
        const baseY = groundHeight + 0.25;
        this.mesh.position.y = baseY + Math.sin(totalTime * 0.005 + this.hoverOffset) * 0.05;
        const playerPos = physics.playerCollider.position;
        const distance = playerPos.distanceTo(this.mesh.position);
        if (distance < this.size + physics.playerCollider.radius) {
            this.onPickup();
            return false;
        }
        if (totalTime > this.lifetime) { return false; }
        return true;
    }

    onPickup() {
        if (window.audioSystem) audioSystem.playSound('pickup');
        if (this.type === 'module') { game.state.modules.push(this.itemKey); 
            if (this.itemKey === 'equipment_plus4weaponslots') {
                if (window.playerWeaponSystem) {
                    window.playerWeaponSystem.unlockedSlots = 6;
                    window.playerWeaponSystem.updateUI();
                }
            }
        } else if (this.type === 'health') { 
            game.state.health = Math.min(game.state.health + 10, GAME_GLOBAL_CONSTANTS.PLAYER.MAX_HEALTH); 
        } else if (this.type === 'wire') {
            game.state.wire = Math.min(game.state.wire + 1, 9999);
        }
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
    this.entities = { npcs: [], projectiles: [], doors: [], pickups: [], droppedWeapons: [] };
    this.state = { 
        health: 0, // Will be initialized from playerStats.max_health in init()
        energy: 0, // Will be initialized from playerStats.base_energy in init()
        maxEnergy: 0, // Will be initialized from playerStats.max_energy in init()
        ammo: 0, // Will be initialized from playerStats.pamphlet_start_ammo in init()
        maxAmmo: 0, // Will be initialized from playerStats.pamphlet_max_ammo in init()
        gameOver: false,
        allies: [],
        maxAllies: 4,
        simulatedAllies: { rebels: 0, aliens: 0, clones: 0, imperials: 0, droids: 0 },
        isPaused: false,
        showFactionInfo: false,
        unpauseFactionPhysics: false,
        modules: [],
        noClipping: false,
        invincible: false,
        playerStats: null,
        wire: 2000
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
    this.lastSpawnPointPerLevel = {}; // Tracks where player entered each level
    this.homeSpawnLevel = 1; // Default home spawn is level 1
    this.homeSpawnPoint = null; // Will be set when level 1 loads
    this.skyboxAnimator = null;
    this.shakeTimer = 0;
    this.shakeDuration = 0.2;
    this.shakeIntensity = 0;
    this.hudContainer = document.querySelector('.game-hud-container');
    this.allyBoxesContainer = document.querySelector('.ally-boxes');
    this.hologonkAvatar = document.getElementById('hologonk-avatar-relocated'); // The new location for the animated Gonk
    this.ALLY_COLORS = ['#00FFFF', '#00FF00', '#FFFF00', '#FF00FF'];
    this.factionManager = new FactionManager();
    this.factionRelationshipHUD = document.getElementById('faction-relationship-hud');
    this.factionLinesSVG = document.getElementById('faction-lines-svg');
    this.factionNodes = [];
    this.factionShadowNodes = [];
    this.ambientLight = null;
    this.characterSheet = document.getElementById('character-sheet-container');
    this.upgradeContainer = document.getElementById('upgrade-container');
    this.statsDisplay = document.getElementById('stats-display');
    this.moduleDisplay = document.getElementById('module-display');
    this.cheatsMenu = document.getElementById('cheats-menu');
    this.conversationCheckTimer = 0;
    this.conversationCooldownTimer = 0;
  }
  initialUISettingsApplied = false;

  init() {
    this.state.playerStats = window.assetManager.playerStats;
    this.state.health = this.state.playerStats.max_health; // Initialize current health to max health
    this.state.energy = this.state.playerStats.base_energy; // Initialize current energy
    this.state.maxEnergy = this.state.playerStats.max_energy; // Initialize max energy
    this.state.ammo = this.state.playerStats.pamphlet_start_ammo; // Initialize pamphlet ammo
    this.state.maxAmmo = this.state.playerStats.pamphlet_max_ammo; // Initialize max pamphlet ammo
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.autoClear = true;
    document.body.appendChild(this.renderer.domElement);
    this.canvas = this.renderer.domElement;
    this.camera.add(this.weaponHolder);
    this.scene.add(this.camera);
    this.camera.layers.enableAll();
    // HUD will be shown after level loads (moved to avoid showing before trivia)

    if(window.assetManager && assetManager.factionData) { this.factionManager.initialize(assetManager.factionData); }
     for (let i = 0; i < 9; i++) {
        this.factionNodes.push(document.getElementById(`faction-node-${i}`));
        this.factionShadowNodes.push(document.getElementById(`faction-node-shadow-${i}`));
    }

    if (window.playerWeaponSystem) { 
        window.playerWeaponSystem.init(this.camera, this.weaponHolder); 
    }

    this.setupLighting();
    window.addEventListener('resize', this.onWindowResize.bind(this));
    this.isInitialized = true;
    window.furnitureLoader = new FurnitureLoader(window.assetManager);
    window.weaponPickupManager.init();

    const noClippingCheckbox = document.getElementById('no-clipping-checkbox');
    noClippingCheckbox.addEventListener('change', (e) => { this.state.noClipping = e.target.checked; });
    const invincibilityCheckbox = document.getElementById('invincibility-checkbox');
    invincibilityCheckbox.addEventListener('change', (e) => { this.state.invincible = e.target.checked; });
    const setPamphletsButton = document.getElementById('set-pamphlets-button');
    setPamphletsButton.addEventListener('click', () => {
        const pamphletsInput = document.getElementById('pamphlets-input');
        const amount = parseInt(pamphletsInput.value);
        if (!isNaN(amount)) { this.state.ammo = amount; }
    });
    const closeCheatsMenuButton = document.getElementById('close-cheats-menu');
    closeCheatsMenuButton.addEventListener('click', () => { this.toggleCheatsMenu(); });
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
      if (this.state.gameOver || (window.loadingScreenManager && window.loadingScreenManager.isActive) || this.state.invincible) return;
      this.state.health = Math.max(0, this.state.health - amount);
      this.triggerDamageEffect({ flashOpacity: 0.5, flashDuration: 80, shakeIntensity: 0.02, shakeDuration: 0.2 });
      if (attacker) { for (const ally of this.state.allies) { if (ally.npc && !ally.npc.isDead) { ally.npc.aggro(attacker); } } }
      if (this.state.health <= 0) { this.respawnPlayer(); }
  }

    handlePlayerKill(killedNpc) {
        const factionKey = killedNpc.faction;
        const encounteredFlag = `encountered_${factionKey}`;
        if (this.state.playerStats && !this.state.playerStats[encounteredFlag]) {
            this.state.playerStats[encounteredFlag] = true;
        }
    }

  triggerDamageEffect(config) {
      const flash = document.getElementById('damageFlash');
      flash.style.backgroundColor = `rgba(255, 0, 0, ${config.flashOpacity})`;
      flash.style.display = 'block';
      setTimeout(() => { flash.style.display = 'none'; }, config.flashDuration);
      this.shakeIntensity = config.shakeIntensity;
      this.shakeDuration = config.shakeDuration;
      this.shakeTimer = config.shakeTimer;
  }

  respawnPlayer() {
    this.state.health = GAME_GLOBAL_CONSTANTS.PLAYER.MAX_HEALTH;
    this.state.gameOver = false;

    // Check if player has spare cores
    const spareCores = this.state.playerStats?.spare_cores || 0;
    let targetLevel = window.levelManager.currentLevel;
    let spawnPoint = this.lastSpawnPointPerLevel[targetLevel];

    if (spareCores > 0) {
        // Consume a spare core and respawn at entry point of current level
        this.state.playerStats.spare_cores--;
        console.log(`Spare core consumed. Remaining: ${this.state.playerStats.spare_cores}`);

        // Update spare core display
        const spareCoreCount = document.getElementById('spare-core-count');
        if (spareCoreCount) {
            spareCoreCount.textContent = this.state.playerStats.spare_cores;
        }
    } else {
        // No spare cores - respawn at home spawn and reset run progress
        targetLevel = this.homeSpawnLevel;
        spawnPoint = this.homeSpawnPoint || this.lastSpawnPointPerLevel[targetLevel];
        console.log(`No spare cores. Respawning at home spawn (Level ${targetLevel})`);

        // Clear destroyed ships (run reset)
        if (window.mapScreen) {
            window.mapScreen.clearDestroyedShips();
        }

        // Load home level if we're not already there
        if (targetLevel !== window.levelManager.currentLevel) {
            window.levelManager.loadLevel(targetLevel);
            return; // Level loading will handle spawning
        }
    }

    // Perform the respawn
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
      const ringGeo = new THREE.RingGeometry(radius * 0.9, radius, 32);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: GAME_GLOBAL_CONSTANTS.ALLY_RING.OPACITY, side: THREE.DoubleSide });
      ringMat.color.set(allyData.color); // Set the material color from the ally data
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = -Math.PI / 2;
      this.scene.add(ringMesh);
      npc.allyRing = ringMesh;
  }

  async addAlly(npc) {
      if (this.state.allies.length >= this.state.maxAllies || this.state.allies.some(a => a.id === npc.mesh.group.uuid)) return;
      
      // Update encountered flag upon recruiting
      const factionKey = npc.originalFaction;
      const encounteredFlag = `encountered_${factionKey}`;
      if (this.state.playerStats && !this.state.playerStats[encounteredFlag]) {
          this.state.playerStats[encounteredFlag] = true;
      }
      
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
      npc.color = factionColor; // Explicitly set color on the NPC object for easier access.
      npc.allySlotIndex = this.state.allies.length;
      const allyData = { id: npc.mesh.group.uuid, name: npc.name, icon: iconDataUrl || '', color: factionColor, npc: npc };
      this.state.allies.push(allyData);
      this.recreateAllyRing(allyData);
      allyData.npc.mesh.group.visible = true;
      if(npc.onJoinParty) npc.onJoinParty();
  }

  handleAllyDeath(npc) {
      const allyIndex = this.state.allies.findIndex(ally => ally.id === npc.mesh.group.uuid);
      if (allyIndex === -1) return;

      const allyData = this.state.allies[allyIndex];
      allyData.isDeadAlly = true;
      allyData.graveImagePath = `data/pngs/factions/${allyData.npc.originalFaction.toLowerCase()}/${allyData.npc.originalFaction.toLowerCase()}grave.png`;
      console.log(`Ally ${npc.name} died. Faction: ${allyData.npc.originalFaction}, Grave image path: ${allyData.graveImagePath}`);
      
      // Dispose of the ring immediately
      if (npc.allyRing) {
          this.scene.remove(npc.allyRing);
          npc.allyRing.geometry.dispose();
          npc.allyRing.material.dispose();
          npc.allyRing = null;
      }
      // Keep the ally in the array, but mark it as dead.
      // The updateHUD will handle displaying the grave marker.
  }

  clearAllySlot(npc) {
      const allyIndex = this.state.allies.findIndex(ally => ally.id === npc.mesh.group.uuid);
      if (allyIndex === -1) return;
      
      // This function is now only called when an ally is truly removed, not just dead.
      // For example, when a level is cleared and new allies are added.
      if (npc.allyRing) {
          this.scene.remove(npc.allyRing);
          npc.allyRing.geometry.dispose();
          npc.allyRing.material.dispose();
          npc.allyRing = null;
      }
      npc.allySlotIndex = -1;
      this.state.allies.splice(allyIndex, 1);
      this.state.allies.forEach((ally, index) => { ally.npc.allySlotIndex = index; });
  }

  toggleFactionInfo() {
      this.state.showFactionInfo = !this.state.showFactionInfo;
      this.factionRelationshipHUD.style.display = this.state.showFactionInfo ? 'block' : 'none';
  }
  
  toggleCharacterSheet() {
    const wrapper = document.getElementById('character-page-wrapper');
    const isVisible = wrapper.style.display === 'flex';
    const closeBtn = document.getElementById('upgrade-close-btn');
    const actionButtons = document.getElementById('upgrade-action-buttons');

    if (isVisible) {
        wrapper.style.display = 'none';
        this.state.isPaused = false;
        if (this.hudContainer && !window.isConversationUIVisible) this.hudContainer.style.display = 'block';
        if (this.canvas) this.canvas.requestPointerLock();
        // Hide upgrade UI buttons
        if (closeBtn) closeBtn.style.display = 'none';
        if (actionButtons) actionButtons.style.display = 'none';
    } else {
        // Close map screen if it's open (mutually exclusive)
        if (window.mapScreen && window.mapScreen.isVisible) {
            window.mapScreen.toggle();
        }

        this.updateCharacterSheet();
        if (window.characterUpgrades) window.characterUpgrades.drawUpgradeUI();
        wrapper.style.display = 'flex';
        this.state.isPaused = true;
        if (this.hudContainer) this.hudContainer.style.display = 'none';
        document.exitPointerLock();
    }
  }

  toggleCheatsMenu() {
    const isVisible = this.cheatsMenu.style.display === 'block';
    if (isVisible) {
        this.cheatsMenu.style.display = 'none';
        this.state.isPaused = false;
        if (this.hudContainer && !window.isConversationUIVisible) this.hudContainer.style.display = 'block';
        if (this.canvas) this.canvas.requestPointerLock();
    } else {
        this.cheatsMenu.style.display = 'block';
        this.state.isPaused = true;
        if (this.hudContainer) this.hudContainer.style.display = 'none';
        document.exitPointerLock();
    }
  }
  
  updateCharacterSheet() {
    // Modules
    if (this.moduleDisplay) {
        this.moduleDisplay.innerHTML = '';
        this.state.modules.forEach(moduleKey => {
            const img = document.createElement('img');
            img.className = 'module-icon';
            img.src = `/data/pngs/MODULES/${moduleKey}.png`;
            img.title = moduleKey.replace(/_/g, ' ');
            this.moduleDisplay.appendChild(img);
        });
    }

    // Stats
    if (this.statsDisplay && this.state.playerStats) {
        this.statsDisplay.innerHTML = '';
        for (const [key, value] of Object.entries(this.state.playerStats)) {
            // Skip NPC-only stats and encountered flags
            if (['threat', 'perception_radius', 'special_moves', 'default_weapon', 'aggro'].includes(key) ||
                key.startsWith('encountered_')) {
                continue;
            }
            const statDiv = document.createElement('div');
            statDiv.className = 'stat-entry';
            const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            statDiv.innerHTML = `<span class="stat-label">${label}:</span> <span class="stat-value">${value}</span>`;
            this.statsDisplay.appendChild(statDiv);
        }
    }

    // Wire
    const wireDisplay = document.getElementById('wire-display');
    if (wireDisplay) {
        wireDisplay.textContent = `Wire: ${this.state.wire}`;
    }
  }

  updateFactionDisplay() {
      if(this.state.showFactionInfo) { this.updateFactionRelationshipHUD(); }
  }

    update(deltaTime, totalTime) {
      if (!this.initialUISettingsApplied && window.tabControls && this.entities.npcs.length > 0) {
          window.tabControls.updateLabelAndRingFromUI();
          window.tabControls.updateFactionHudFromUI();
          this.initialUISettingsApplied = true;
      }
      this.deltaTime = deltaTime;
      // Debugging HUD visibility during conversations
      if (window.isConversationUIVisible && !this._lastConversationState) {
          console.log(`[HUD Debug] isConversationUIVisible: ${window.isConversationUIVisible}, hudContainer.style.display: ${this.hudContainer.style.display}`);
      }
      this._lastConversationState = window.isConversationUIVisible;
      
      if (window.factionAvatarManager) { factionAvatarManager.update(deltaTime); }
      if (this.shakeTimer > 0) { this.shakeTimer -= deltaTime; }
      if (this.skyboxAnimator) { this.skyboxAnimator.update(this.deltaTime); }
      if (this.factionManager && this.factionManager.processFactionDynamics) {
          if (!this.state.isPaused || this.state.unpauseFactionPhysics) {
              this.factionManager.processFactionDynamics(deltaTime, this.state.allies, this.state.simulatedAllies);
          }
      }
      this.updateHUD();
      if (!this.state.isPaused) {
          window.weaponPickupManager.update(physics.playerCollider, this.entities.droppedWeapons, this.state.allies);
          if(window.playerWeaponSystem) { playerWeaponSystem.update(this.deltaTime, totalTime); }
          // Energy Regeneration
          let energyRegen = 12.500;
          if (this.state.playerStats.energy_regen_bonus) {
            energyRegen *= (1 + this.state.playerStats.energy_regen_bonus);
          }
          this.state.energy = Math.min(this.state.maxEnergy, this.state.energy + (energyRegen * deltaTime));
          for (const door of this.entities.doors) { if (door.update) { door.update(this.deltaTime); } }
  
          // Update dropped weapons
          for (let i = this.entities.droppedWeapons.length - 1; i >= 0; i--) {
              const droppedWeapon = this.entities.droppedWeapons[i];
              if (!droppedWeapon.update(deltaTime)) { 
                  droppedWeapon.dispose();
                  this.entities.droppedWeapons.splice(i, 1);
              }
          }
          // Only check for new conversations when the game is not paused.
          this.checkForNpcConversations();

          // Update slicing system
          if (this.slicingSystem) {
              this.slicingSystem.update(deltaTime);
          }
      } else {
          if (window.playerWeaponSystem) { playerWeaponSystem.update(this.deltaTime, totalTime); }
          if (window.tabControls && window.tabControls.isVisible) { window.tabControls.updateMuzzleHelpersFromUI(); }
          this.updatePaused(deltaTime);
      }
    }
  updatePaused(deltaTime) {
      for (const npc of this.entities.npcs) {
          if (npc.shootAnimTimer > 0) {
              npc.shootAnimTimer -= deltaTime;
              if (npc.shootAnimTimer <= 0) { window.setGonkAnimation(npc.mesh, 'aim'); }
          }
          if (npc.nameplate) { npc.nameplate.quaternion.copy(this.camera.quaternion); }
          if (npc.mesh) { window.updateGonkAnimation(npc.mesh, { deltaTime, isPaused: true }); }
      }
  }

  updateHUD() {
      // Update Hologonk Avatar
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
          if (frameChanged) { icon.animTimer = 0; icon.needsUpdate = true; }
      }
      if (icon.needsUpdate && this.hologonkAvatar) { 
          this.hologonkAvatar.src = `${icon.basePath}${icon.currentFrame}.png`; 
          this.hologonkAvatar.style.width = '100%';
          this.hologonkAvatar.style.height = '100%';
          this.hologonkAvatar.style.opacity = '0.7';
          this.hologonkAvatar.style.transform = 'none';
          this.hologonkAvatar.style.position = 'relative';
          this.hologonkAvatar.style.top = '0';
          this.hologonkAvatar.style.left = '0';
          icon.needsUpdate = false; 
      }
      // End Hologonk Update

      // Update Health and Power Gauges (Animated)
      if (window.gaugeManager) {
          // Update health gauge
          window.gaugeManager.updateHealth(this.state.health, this.state.playerStats.max_health);

          // Update power gauge with next shot cost preview
          let nextShotCost = 0;
          if (window.playerWeaponSystem && window.playerWeaponSystem.activeWeapon) {
              const weapon = window.playerWeaponSystem.activeWeapon;
              // Get energy cost from weapon config (default to 0 if not specified)
              nextShotCost = weapon.config.energyCost || weapon.config.energy_cost || 0;
          }
          window.gaugeManager.updatePower(this.state.energy, this.state.maxEnergy, nextShotCost);
      }

      const weaponContainer = document.querySelector('.weapon-display');
      const ammoDisplay = document.getElementById('gameHudAmmo');

      if (weaponContainer && window.playerWeaponSystem && window.playerWeaponSystem.activeWeapon) {
          const weapon = window.playerWeaponSystem.activeWeapon;
          let category = weapon.config.category || 'weapon';
          if (category === 'saberhiltoverlayer') { category = 'saber'; }
          let categoryName = category.charAt(0).toUpperCase() + category.slice(1);
          if (category === 'longarm') categoryName = 'Longarm';
          
          const weaponName = weapon.config.name;
          weaponContainer.innerHTML = `<div class="ammo-label">${categoryName}</div><div id="gameHudWeapon" style="text-transform: capitalize;">${weaponName}</div>`;
          if (ammoDisplay) { 
              ammoDisplay.textContent = `${this.state.ammo}`; 
          }
      }

      for (let i = 0; i < this.state.maxAllies; i++) {
          const box = document.getElementById(`ally-box-${i + 1}`);
          const allyData = this.state.allies[i];
          if (allyData) {
              const nameSpan = box.querySelector('.ally-name');
              const healthOverlay = box.querySelector('.ally-health-overlay');
              const healthOverlayFace = box.querySelector('.ally-health-overlay-face');
              const allyImage = box.querySelector('img'); // Get the image element

              if (allyData.isDeadAlly) {
                  // Display grave marker
                  allyImage.src = allyData.graveImagePath;
                  allyImage.style.filter = 'grayscale(100%)'; // Make it look dead
                  nameSpan.textContent = 'FALLEN'; // Change name to 'FALLEN'
                  healthOverlay.style.height = '100%'; // Full red overlay
                  healthOverlayFace.style.height = '100%';
                  healthOverlay.classList.remove('pulsing');
                  healthOverlayFace.classList.remove('pulsing');
                  box.style.borderColor = '#555'; // Grey border
                  box.classList.add('visible');
              } else {
                  // Existing logic for live allies
                  const factionColor = allyData.color;
                  allyImage.src = allyData.icon;
                  allyImage.style.filter = 'none'; // Remove grayscale
                  box.style.borderColor = factionColor;
                  if (allyData.name.includes(' ') && allyData.name.split(' ').length === 2) { nameSpan.innerHTML = allyData.name.replace(' ', '<br>');
                  } else { nameSpan.innerHTML = allyData.name; }
                  const npc = allyData.npc;
                  const maxHealth = npc.maxHealth;
                  const damagePercent = (1 - (npc.health / maxHealth)) * 100;
                  healthOverlay.style.height = `${damagePercent}%`;
                  healthOverlayFace.style.height = `${damagePercent}%`;
                  if (npc.health / maxHealth <= 0.1) { healthOverlay.classList.add('pulsing'); healthOverlayFace.classList.add('pulsing');
                  } else { healthOverlay.classList.remove('pulsing'); healthOverlayFace.classList.remove('pulsing'); }
                  box.classList.add('visible');

                  // Apply conversation movement effects
                  const isSpeaking = npc.isConversing && window.conversationController?.currentConversation?.initiator === npc;
                  const isReplying = npc.isConversing && window.conversationController?.currentConversation?.target === npc;

                  box.classList.remove('shift-up', 'shift-down');
                  if (isSpeaking) {
                      box.classList.add('shift-up');
                  } else if (isReplying) {
                      box.classList.add('shift-up');
                  } else if (window.isConversationUIVisible) {
                      // All non-speaking allies shift down when a conversation is active
                      box.classList.add('shift-down');
                  }
              }
          } else { box.classList.remove('visible'); }
      }

      if (this.state.showFactionInfo) { this.updateFactionRelationshipHUD(); }
  }

    checkForNpcConversations() {
        if (this.state.isConversationActive || this.conversationCooldownTimer > 0) {
            if (this.conversationCooldownTimer > 0) {
                this.conversationCooldownTimer -= this.deltaTime;
            }
            return;
        }

        this.conversationCheckTimer -= this.deltaTime;
        if (this.conversationCheckTimer > 0) {
            return;
        }
        this.conversationCheckTimer = 2.0; // Check every 2 seconds

        // Potential initiators are non-allies who are idle and haven't spoken.
        const potentialInitiators = this.entities.npcs.filter(npc =>
            !npc.isDead && !npc.isAlly && !npc.isAggro && !npc.hasSpoken && npc.currentState === 'IDLING'
        );

        // Allies who are available to talk.
        const availableAllies = this.state.allies.map(a => a.npc).filter(npc =>
            npc && !npc.isDead && !npc.isConversing && !npc.hasSpoken
        );

        if (potentialInitiators.length === 0 || availableAllies.length === 0) return;

        for (const initiator of potentialInitiators) {
            for (const ally of availableAllies) {
                // FIX: Prevent allies from talking to NPCs of their own original faction.
                // The initiator is a non-ally, the target (ally) is the one with an originalFaction.
                if (initiator.faction === ally.originalFaction) { 
                    continue; 
                }
                if (ally.faction === initiator.faction) { // Additional safeguard
                    continue;
                }
                const initiatorRadius = initiator.config.collision_radius || 0.5; // Default to 0.5 if not defined
                const allyRadius = ally.config.collision_radius || 0.5; // Default to 0.5 if not defined
                const requiredDistance = (initiatorRadius + allyRadius) * 1.01; // 1% buffer for "almost touching"
                if (initiator.mesh.group.position.distanceTo(ally.mesh.group.position) < requiredDistance) {
                    // The NPC initiates the conversation with the player's ally.
                    // The non-ally NPC initiates the conversation with the player's ally.
                    // Update encountered flag for the initiator's faction since they talked to us
                    const factionKey = initiator.faction;
                    const encounteredFlag = `encountered_${factionKey}`;
                    if (this.state.playerStats && !this.state.playerStats[encounteredFlag]) {
                        this.state.playerStats[encounteredFlag] = true;
                    }

                    if (window.conversationController && window.conversationController.startConversation(initiator, ally)) {
                        return; // A conversation has started, so we stop checking.
                    }
                }
            }
        }
    }

    updateFactionRelationshipHUD() {
        if (!this.factionManager || !this.factionManager.factions || !this.factionNodes.length) return;
        const displayedFactions = ['takers', 'imperials', 'sith', 'clones', 'player_droid', 'droids', 'mandalorians', 'aliens', 'rebels'];
        this.factionLinesSVG.innerHTML = '';
        const hudConfig = GAME_GLOBAL_CONSTANTS.FACTION_HUD;
        const padding = 5;
        const scale = 100 - (padding * 2);

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
            const vecFromOrigCenter = new THREE.Vector2(pos.x - 50, (100 - pos.y) - 50);
            vecFromOrigCenter.multiplyScalar(hudConfig.SCALE);
            const screenX = (vecFromOrigCenter.x + 50) / 100;
            const screenY = (vecFromOrigCenter.y + 50) / 100;
            return { x: `${padding + screenX * scale}%`, y: `${padding + screenY * scale}%`, rawX: padding + screenX * scale, rawY: padding + screenY * scale };
        };

        const positionedFactions = {};
        for (let i = 0; i < displayedFactions.length; i++) {
            const factionKey = displayedFactions[i];
            const factionData = this.factionManager.factions[factionKey];
            const encounteredFlag = `encountered_${factionKey}`;
            // F-menu nodes are always visible for debugging
            if (!factionData) continue;

            const currentNode = this.factionNodes[i];
            const shadowNode = this.factionShadowNodes[i];
            if (!currentNode || !shadowNode) continue;
            
            // This is the core logic to display the nodes in the F-Menu, it must NOT be hidden by isEncountered.
            const homeScreenPos = gridToScreen(factionData.homePosition);
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
            if (factionKey === 'takers') currentNode.classList.add('takers');
            if (factionKey === 'sith') currentNode.classList.add('sith');
            currentNode.textContent = factionData.name.toUpperCase().replace(' ', '\n');
            positionedFactions[factionKey] = { current: currentScreenPos, index: i };
        }

        for (let i = 0; i < displayedFactions.length; i++) {
            for (let j = i + 1; j < displayedFactions.length; j++) {
                const factionA_key = displayedFactions[i];
                const factionB_key = displayedFactions[j];

                // The lines should only be drawn if both nodes are positioned.
                if (!positionedFactions[factionA_key] || !positionedFactions[factionB_key]) continue;
                
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
                if (dist > 30) { 
                    createTextLabel(posA.rawX + (posB.rawX - posA.rawX) * 0.2, posA.rawY + (posB.rawY - posA.rawY) * 0.2);
                    createTextLabel(posA.rawX + (posB.rawX - posA.rawX) * 0.8, posA.rawY + (posB.rawY - posA.rawY) * 0.8);
                } else { 
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
            if (ally.isDeadAlly) {
                // For dead allies, we don't remove them from the state.allies array,
                // but we ensure their NPC mesh and ring are removed from the scene.
                if (ally.npc.allyRing) {
                    this.scene.remove(ally.npc.allyRing);
                    ally.npc.allyRing.geometry.dispose();
                    ally.npc.allyRing.material.dispose();
                    ally.npc.allyRing = null;
                }
                if (ally.npc.mesh && ally.npc.mesh.group) {
                    this.scene.remove(ally.npc.mesh.group);
                }
                // Reset 'hasSpoken' status for the new level.
                ally.npc.hasSpoken = false;
            } else {
                // For live allies, reset hasSpoken and remove ring if it exists
                if (ally.npc.allyRing) {
                    this.scene.remove(ally.npc.allyRing);
                    ally.npc.allyRing.geometry.dispose();
                    ally.npc.allyRing.material.dispose();
                    ally.npc.allyRing = null;
                }
                if (ally.npc) {
                    ally.npc.hasSpoken = false;
                }
            }
        });
    }
    // The rest of the clearScene function remains mostly the same,
    // but we need to be careful about removing NPCs from entities.npcs.
    // Live allies should be kept, dead ones should be removed from entities.npcs.

    const persistentAllyNpcs = this.state.allies.filter(a => !a.isDeadAlly).map(a => a.npc);

    for(let i = this.entities.npcs.length - 1; i >= 0; i--) {
        const npc = this.entities.npcs[i];
        if (!persistentAllyNpcs.includes(npc)) {
            if (npc.mesh && npc.mesh.group) { this.scene.remove(npc.mesh.group); }
            if (npc.weaponMesh) { window.weaponIcons.removeWeapon(npc); }
            this.entities.npcs.splice(i, 1);
        }
    }

    this.entities.projectiles.forEach(p => p.dispose());
    this.entities.projectiles = [];
    this.entities.doors = [];
    this.entities.pickups.forEach(p => p.dispose());
    this.entities.pickups = [];
    this.entities.droppedWeapons.forEach(dw => dw.dispose()); // Dispose of dropped weapons
    this.entities.droppedWeapons = [];

    const toRemove = [];
    this.scene.traverse(child => { if (child.userData.isLevelAsset) { toRemove.push(child); } });

    toRemove.forEach(child => {
        child.traverse(obj => {
            if (obj.isMesh) {
                obj.geometry.dispose();
                if (obj.material) {
                     if (Array.isArray(obj.material)) {
                        obj.material.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
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
    if (window.conversationUIManager) {
        window.conversationUIManager.hide();
    }
    if (window.conversationController) {
        window.conversationController.conversationEnd(null, null);
    }
  }

  respawnAllies() {
      if (this.state.allies.length === 0 || !window.physics) return;
      const playerPos = physics.playerCollider.position;
      const playerYaw = inputHandler.yaw;
      const offsets = [ new THREE.Vector3(-2.0, 0, -1.5), new THREE.Vector3(2.0, 0, -1.5), new THREE.Vector3(-2.5, 0, -1.0), new THREE.Vector3(2.5, 0, -1.0), new THREE.Vector3(0, 0, 3.0) ];
      this.state.allies.forEach((allyData) => {
          if (allyData.isDeadAlly) return; // Skip dead allies
          const npc = allyData.npc;
          if (!npc || !npc.mesh || !npc.movementCollider) return;
          const offset = npc.allySlotIndex < offsets.length ? offsets[npc.allySlotIndex].clone() : new THREE.Vector3(0,0,2);
          offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), playerYaw);
          const targetPos = playerPos.clone().add(offset);
          const groundY = physics.getGroundHeight(targetPos.x, targetPos.z);
          targetPos.y = groundY + (npc.mesh.groundOffset || 0);
          npc.mesh.group.visible = true;
          npc.mesh.group.position.copy(targetPos);
          npc.movementCollider.position.copy(targetPos);
          npc.mesh.group.rotation.y = playerYaw;
          npc.velocity.set(0, 0, 0);
          npc.currentState = 'FOLLOWING';
          npc.target = null;
          physics.addDynamicEntity(npc); // Re-register with physics system
          this.recreateAllyRing(allyData);
      });
  }
}
