# Gonk Big Files Overview

This document summarizes the key interfaces, global instances, methods, and data structures for major files in the Gonk project. It is intended as a token-saving reference.

**Files Overviewed:**
* `E:\gonk\tab_controls.js`
* `E:\gonk\editor.js`
* `E:\gonk\environment_and_physics.js`
* `E:\gonk\gonk_models.js`
* `E:\gonk\data\npc_names.json`
* `E:\gonk\data\trivia_questions.json`

---

## E:\gonk\tab_controls.js

This file creates and manages the in-game debug UI (the "Tab" menu). It is **not** part of the editor. Its primary purpose is to modify `GAME_GLOBAL_CONSTANTS` in real-time.

* **Global Instance:** `window.tabControls`
* **Class:** `TabControls`
* **Key Methods:**
    * `toggle()`: Toggles visibility, pauses/unpauses the game.
    * `show()`: Shows UI, pauses game, exits pointer lock.
    * `hide()`: Hides UI, unpauses game, requests pointer lock.
* **Key UI-to-Constant Mappings (What it Modifies):**
    * **Faction Tab:** Modifies properties within `GAME_GLOBAL_CONSTANTS.FACTIONS` (e.g., `PHYSICS_SPEED`, `HOSTILE_THRESHOLD`).
    * **Speed Tab:** Modifies `GAME_GLOBAL_CONSTANTS.MOVEMENT.SPEED`, `GAME_GLOBAL_CONSTANTS.PLAYER.JUMP_STRENGTH`, `GAME_GLOBAL_CONSTANTS.ELEVATION.PLAYER_GRAVITY`, `GAME_GLOBAL_CONSTANTS.WEAPONS.PAMPHLET_SPEED`, etc.
    * **Range Tab:** Modifies `GAME_GLOBAL_CONSTANTS.WEAPON_RANGES` (e.g., `pistol`, `rifle`).
    * **Label Tab:**
        * Modifies `GAME_GLOBAL_CONSTANTS.ALLY_RING` (e.g., `OPACITY`, `DIAMETER_MULTIPLIER`).
        * Modifies `GAME_GLOBAL_CONSTANTS.FACTION_HUD` (e.g., `SCALE`, `LINE_WIDTH`).
        * Modifies CSS variables for Faction Avatars (e.g., `--faction-avatar-size`).
    * **Player Weapon Tab:**
        * Modifies the `basePosition`, `rotation`, and `scale` of the *current* active weapon in `playerWeaponSystem.activeWeapon`.
        * Modifies `GAME_GLOBAL_CONSTANTS.WEAPONS.PAMPHLET_SIZE_MULTIPLIER`.
        * Modifies `GAME_GLOBAL_CONSTANTS.WEAPONS.BOLT_ORIGIN_X`, `_Y`, and `_Z`.
    * **NPC Weapon Tab (Right Panel):** Modifies the *default* weapon offsets in `window.assetManager.weaponData._defaults.categoryDefaults[category].offsets`.
    * **Effects Tab:**
        * Modifies `game.ambientLight.intensity`.
        * Calls `window.weaponIcons.setGlobalGlowProperties(...)` with UI values.
        * Modifies `GAME_GLOBAL_CONSTANTS.WEAPONS.BLASTER_GLOW_SIZE` and `OPACITY`.

---

## E:\gonk\editor.js

This file runs the **Level Editor** (`GonkLevelEditor.html`). Its primary product is the `level_XX.json` file.

* **Global Instance:** `new LevelEditor()` (self-contained on its own page).
* **Class:** `LevelEditor`
* **Core Data Structure:** `this.levelData` (a JavaScript `Map` object).
* **Level Schema Definition (Key Properties):**
    * `layerOrder`: Defines all possible layers.
        ```javascript
        ['subfloor', 'floor', 'water', 'floater', 'decor', 'npcs', 'assets', 'pillar', 'wall', 'door', 'dock', 'screen', 'panel', 'dangler', 'ceiling', 'sky', 'skybox', 'elevation', 'spawns']
        ```
    * `tileLayers`: `['subfloor', 'floor', 'water', 'floater', 'decor', 'dangler', 'ceiling', 'sky', 'elevation']`
    * `objectLayers`: `['npcs', 'assets', 'spawns', 'pillar']`
    * `lineLayers`: `['wall', 'door', 'dock']`
    * `overlayLayers`: `['screen', 'panel']`
* **Key Output Data Schema (from `getLevelDataObject()`):**
    This is the structure of the `level_XX.json` file consumed by the game.
    ```json
    {
      "settings": { "width": 64, "height": 64, "defaults": { "floor": { "key": "...", "size": 1 } } },
      "layers": {
        "floor": [ ["x,y", { "type": "texture", "key": "...", "rotation": 0, "size": 2 }] ],
        "npcs": [
          ["x,y", { "type": "npc", "key": "npc_skin_name", "properties": { "name": "...", "weapon": "..." } }],
          ["x,y", { "type": "random_npc", "key": "R1_Aliens_all", "properties": { "threat": 1, "macroCategory": "Aliens", "subgroup": "all" } }]
        ],
        "wall": [ ["H_x_y", { "type": "texture", "key": "...", "properties": { "level2": "..." } }] ],
        "spawns": [ ["x,y", { "id": "L01-SP-A", "rotation": 0, "key": "..." }] ]
      }
    }
    ```

---

## E:\gonk\environment_and_physics.js

This file builds the 3D level from the JSON file and handles all physics, collision, and raycasting for the game.

* **Global Instances:**
    * `window.levelRenderer = new LevelRenderer()`
    * `window.physics = new PhysicsSystem()`
* **Classes:** `LevelRenderer`, `Door`, `Dock`, `PhysicsSystem`
* **Key `LevelRenderer` Methods:**
    * `buildLevelFromData(levelData)`: **Main Entry Point.** Consumes the `levelData` object.
    * `createNPCs(items)`: Consumes `levelData.layers.npcs`. Iterates and creates `new NPC(...)` for each item.
    * `createSkybox(item)`: Consumes `levelData.layers.skybox`.
* **Key `PhysicsSystem` Properties:**
    * `playerCollider`: Global player object: `{ isPlayer, radius, position, velocity, weight, onGround, ... }`.
    * `dynamicEntities`: An array containing `playerCollider` and all active NPC `movementCollider` objects.
    * `walls`: An array of all static wall/door/pillar colliders (`AABB` or `OBB`).
* **Key `PhysicsSystem` Methods (API for other files):**
    * `initHeightmap(width, height, elevationData)`: Consumes `levelData.layers.elevation`.
    * `getGroundHeight(x, z)`: **CRITICAL.** Returns the Y-level of the terrain at a world position. Used by NPCs for movement and placement.
    * `clear()`: Destroys all level geometry, NPCs, and physics objects.
    * `addWall(mesh, isOBB)`: Adds static mesh to physics simulation.
    * `addDynamicEntity(entity)`: Adds player or NPC to the simulation.
    * `update(deltaTime, ...)`: Main physics tick (gravity, collisions).
    * `hasLineOfSight(start, end)`: **CRITICAL.** Performs a raycast. Used by NPC AI for targeting.
    * `resolveProjectileCollisions(deltaTime)`: **CRITICAL.** Checks `window.game.entities.projectiles` against `walls` and `dynamicEntities`.
    * `interact()`: Called by player input to open doors/docks.
    * `createRagdoll(characterMesh)`: Called by `npc.die()`.

---

## E:\gonk\gonk_models.js

This file defines the Minecraft-style models, maps textures to them, and handles animations.

* **Global Instances:**
    * `window.gonkModels = new GonkModelSystem()`
    * `window.createGonkMesh = window.gonkModels.createGonkMesh.bind(...)`
    * `window.setGonkAnimation = window.gonkModels.setAnimation.bind(...)`
    * `window.updateGonkAnimation = window.gonkModels.updateAnimation.bind(...)`
    * `window.generateNpcIconDataUrl = async (texture)`
* **Class:** `GonkModelSystem`
* **Key Methods:**
    * `createGonkMesh(modelType, config, position, characterType)`: **CRITICAL Entry Point.**
        * `modelType`: 'humanoid', 'humanoid_alex', 'slime', 'irongolem'.
        * `config`: `{ skinTexture, armType, scaleX, scaleY, scaleZ, scale, transparent, alphaTexture }`.
        * Returns: A `character` object: `{ modelDef, parts, hitboxes, group, animState, ... }`. `character.parts` contains `THREE.Group` objects for 'head', 'body', 'leftArm', etc.
    * `setAnimation(character, animState)`: Sets `character.animState`.
        * `animState`: 'idle', 'walk', 'run', 'shoot', 'melee', 'aim'.
    * `updateAnimation(character, options)`: Ticks the animation. `options` can include `{ deltaTime, isPaused, target }`.
    * `generateNpcIconDataUrl(texture)`: Creates a 64x64 icon from a skin's head texture. Used by `asset_loaders.js` and `editor_ui_and_assets.js`.

---

## E:\gonk\data\npc_names.json

This file provides arrays of strings for procedurally generating NPC names. Consumed by `npc_behavior.js` (`processName` method).

* **Data Structure:** A flat JSON object where each key is a string array.
* **Key Schema & Naming Rules:**
    * `npc_behavior.js` combines a `...F` (First) and `...L` (Last) key.
    * **No Space:** `droids`, `wookiee`, `gamorrean`, `stormtrooper`, `taker`.
        * `"droidF": [...]` + `"droidL": ["-3PO", ...]`.
    * **With Space:** All other types (Male, Female, Darth, Gungan, etc.)
        * `"maleF": [...]` + `"maleL": [" Skywalker", ...]`.

---

## E:\gonk\data\trivia_questions.json

This file provides questions and answers for the loading screen (`loadingScreenManager.js`).

* **Data Structure:** A JSON object with two main keys: `genericWrongAnswers` and `loadingItems`.
* **Schema `genericWrongAnswers`:**
    * An object containing arrays of strings for categories: `names`, `places`, `numbers`, `quotes`, `other`. Used to populate incorrect answers.
* **Schema `loadingItems`:**
    * An array of trivia objects.
    * Example: `{ "type": "trivia", "category": "places", "question": "...", "correctAnswer": "Tatooine", "cleverWrong": "Jakku" }`