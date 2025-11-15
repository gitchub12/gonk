# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Gonk** is a 3D browser-based action RPG game set in the Star Wars universe. Players control a Gonk droid navigating levels filled with NPCs from various factions (Rebels, Imperials, Clones, Mandalorians, Sith, Aliens, Droids, Takers). The game features a dynamic faction relationship system, real-time conversations with NPCs, combat mechanics, and a level editor.

## Technology Stack

- **Rendering Engine**: THREE.js (r128)
- **Language**: Vanilla JavaScript (ES6+ classes)
- **Audio**: Web Audio API (custom system in `audio_system.js`)
- **Physics**: Custom physics engine (no external library)
- **Architecture**: Event-driven, singleton-based global state management

## Critical File Header Protocol

**MANDATORY**: Every file in this codebase MUST contain a special header comment for build/deployment tooling. This is non-negotiable per project requirements in `gemini.md`:

- **JS files**: `// BROWSERFIREFOXHIDE filename.js` (first line)
- **HTML files**: `<meta name="file-identifier" content="index.html; BROWSERFIREFOXHIDE...">` (within first 6 lines)
- **JSON files**: Use `_comment` key with `BROWSERFIREFOXHIDE data/path/filename.json`

**Always preserve these headers when editing files. Never remove them.**

## Architecture Overview

### Entry Points & Initialization Flow

**Game (index.html)**:
1. `index.html` loads `ScriptLoader` class inline
2. ScriptLoader sequentially loads JS files in dependency order (asset_loaders.js → game_and_character_config.js → gonk_models.js → faction_manager.js → weapon_pickup_manager.js → main.js → etc.)
3. `initGame()` is called after all scripts load
4. Game initializes singletons: `assetManager`, `loadingScreenManager`, `game`, `tabControls`, `conversationUIManager`, `audioSystem`, `factionAvatarManager`
5. Level 1 loads via `levelManager.loadLevel(1)`
6. `startGameLoop()` begins the render loop

**Level Editor (GonkLevelEditor.html)**:
- Standalone editor loads `editor.js` and `editor_ui_and_assets.js`
- Allows visual level design with placement of NPCs, furniture, geometry, spawn points
- Exports JSON level files to `data/levels/`

### Core Game Loop (main.js)
- **Game class**: Central orchestrator managing scene, NPCs, game state, HUD/UI
- Main render loop calls `game.update(deltaTime, totalTime)` continuously
- Physics updates, NPC AI, combat resolution, conversation triggers all in main loop

### Major Systems

#### a) **Physics & Environment** (`environment_and_physics.js` - 949 lines)
- `LevelRenderer`: Builds 3D scenes from JSON level data
- `PhysicsSystem`: Handles collision, jumping, falling, interactions
- `Door`/`Dock`: Interactive world objects
- OBB (Oriented Bounding Box) for accurate collision detection
- Gravity, gravity zones, platforms, kill zones

#### b) **NPC System** (`npc_behavior.js`, `npc_behavior_death.js`)
NPCs use a state machine with states: `IDLING`, `WANDERING`, `CHASING`, `ATTACKING`, `FLEEING`, `FOLLOWING`, `CONVERSING`, `DEAD`.

- **Perception**: NPCs scan for targets within `perceptionRadius` every 0.5s
- **Targeting**: Uses faction relationships to determine hostility; personal relationships override faction defaults
- **Combat**: Weapon-based combat (blasters fire projectiles, melee weapons use hitbox detection)
- **Conversation**: Non-hostile NPCs can initiate/receive conversations if not in combat

**Configuration**: Each NPC type is defined in `data/factionJSONs/*.json` with stats like health, speed, perception_radius, attack_range, default_weapon, faction.

#### c) **Combat & Weapons** (`player_gear.js`)
**PlayerWeaponSystem**:
- Manages weapon array with slots (unlockable via modules)
- Cycling with mouse wheel or number keys
- Weapons defined in `data/weapons.json` with categories (pistol, rifle, melee, saber, launcher)
- Each weapon has category defaults + specific overrides for damage, cooldown, range, ammo, spread

**Projectiles**:
- `BlasterBolt`: Raycast-style projectiles with collision detection
- `PamphletProjectile`: Special player weapon (throws random pamphlet textures)

**Combat**:
- Ranged: Fires projectiles that damage on collision with hitboxes
- Melee: Performs sphere-cast hit detection during attack animations
- NPCs have similar weapon logic but use simpler targeting

#### d) **Conversation System** (`conversation_controller.js`, `conversation_ui_manager.js`, `conversation_logger.js`)
Dynamic dialogue system based on:
- **Phrase Database**: Loaded from `data/conversations_*.json` (h1, i1, m1, nonbasic)
- **Attitudes**: Conversations change based on faction relationship (allied/friendly/neutral/unfriendly/hostile)
- **Topics**: Phrases have topics (e.g., "proindependence", "antigroup: imperials") that match faction preferences
- **Social Checks**: Mid-conversation stat checks determine if allies can recruit NPCs
- **Flow**: greeting → reply → rejoinder (3-phase structure)

**UI**: Conversation text appears in boxes at top of screen with colored SVG pointers to speakers. Ally portraits shift down during conversations.

#### e) **Faction System** (`faction_manager.js`, `faction_avatar_manager.js`)
**The game's most unique feature.** Factions exist on a 2D grid (0-100 x/y coordinates) with physics-based relationships:

- **Distance = Hostility**: Closer factions are friendlier (low score), distant factions are hostile (high score)
- **Forces**: Each faction has `pushForces` (defined in `data/faction_config.json`) that push/pull other factions
- **Events**: Killing NPCs pushes factions apart; recruiting allies pulls player faction toward target faction
- **Updates**: Positions update every 0.1s using velocity-based physics with mass/elasticity
- **Visual**: Press `F` in-game to show faction grid HUD with real-time relationship lines

**Key Methods**:
- `getRelationshipScore(factionA, factionB)`: Returns 0-100 score (distance-based)
- `getRelationshipAttitude(factionA, factionB)`: Returns "allied", "friendly", "neutral", "unfriendly", "hostile"
- `registerKillEvent()`: Adds push force when player kills NPC
- `registerAllyEvent()`: Adds pull force when player recruits ally

#### f) **Level Management** (`levelManager.js`)
Levels are JSON files in `data/levels/` with layers:
- **geometry**: Walls, floors (collision-enabled meshes)
- **npcs**: NPC spawn points with `type: 'npc'` or `type: 'random_npc'`
- **furniture**: Interactive objects (crates, holo_table, etc.) from `data/furniture.json`
- **player_spawn**: Starting position coordinates

**NPC Name Assignment**: `levelManager` uses `data/npc_names.json` to assign random names based on faction/subgroup during level load. The `generateNpcName()` function in `data/npc_name_assigner.js` handles this.

**Level Links**: `data/level_links.json` defines transitions between levels (triggers at specific coordinates).

#### g) **Audio System** (`audio_system.js`)
- **Music Categories**: Levels have music categories; tracks auto-play on level load
- **3D Audio**: Positional audio for NPCs (e.g., footsteps, weapon sounds)
- **Controls**: `[` / `]` for track skip, `-` / `=` for volume, `\` for category switch

#### h) **Asset Management** (`asset_loaders.js`)
Global singleton `assetManager` handles all resource loading:
- **Textures**: Character skins, weapons, furniture, pamphlets (100+ items)
- **Data**: JSON configs for factions, weapons, conversations, trivia
- **3D Models**: Uses THREE.TextureLoader + custom sprite-based character system (not GLTF)

**Character Models**: NPCs are billboard sprites (`gonk_models.js`) with animation frames, not 3D meshes. The `CharacterMesh` class manages sprite sheets with states (idle, walk, attack, dead).

#### i) **UI & Input** (`tab_controls.js`, main.js InputHandler)
HUD elements (all in `index.html`):
- **Ally Boxes**: Bottom-center portraits showing recruited NPCs with health overlays
- **Player Gauges**: Circular health/energy gauges (bottom-left)
- **Weapon Display**: Current weapon + ammo count (bottom-left)
- **Faction Avatar Grid**: 3x3 grid (right side) showing all faction avatars with relationship scores
- **Crosshair**: Center-screen aiming reticle
- **Loading Screen**: Trivia questions during level transitions
- **Character Sheet**: Press `C` to view player stats/modules

**Tab Menu** (`tab_controls.js`): Pause menu with tabs for Weapons, Modules, Enemies, Music, Faction Relations (simulation).

#### j) **Physics & Environment** (`environment_and_physics.js`)
Custom collision system (no library):
- **Player Collider**: Capsule-based collision with gravity
- **NPC Colliders**: Sphere-based collision with separation forces
- **Static Geometry**: Levels define collision meshes
- **Projectile Collision**: Sphere-vs-sphere and sphere-vs-hitbox tests

**Movement**: WASD controls, mouse look, pointer lock API for FPS controls.

## Data Flow

```
User Input (InputHandler)
  ↓
Game State Update (Game.update)
  ├→ Physics (collision, gravity, interaction detection)
  ├→ NPC AI & Pathfinding (npc_behavior.js)
  ├→ Combat Resolution (weapon hits, damage)
  ├→ Conversation Triggers (faction_manager checks)
  └→ Faction Relation Changes
        ↓
THREE.js Render (camera, scene, NPCs, particles)
  ├→ HUD/UI Overlay (health, minimap, dialogue UI)
  └→ Audio Playback (AudioSystem)
```

## Data Organization

### JSON Data Files
- **Faction Configs**: `data/faction_config.json` - faction physics (mass, elasticity, pushForces)
- **NPC Definitions**: `data/factionJSONs/*.json` - per-faction NPC stats
- **Weapons**: `data/weapons.json` - weapon stats with category defaults + specific overrides
- **Conversations**: `data/conversations_*.json` - phrase database with topics/attitudes/text
- **Trivia**: `data/trivia_questions.json` - loading screen questions
- **Names**: `data/npc_names.json` - name pools for NPC generation
- **Furniture**: `data/furniture.json` + `data/furniture/*.json` - interactive object configs
- **Levels**: `data/levels/*.json` - level geometry, NPC spawns, furniture placement

### Global Constants
`GAME_GLOBAL_CONSTANTS` (defined in `game_and_character_config.js`):
- `FACTION_COLORS`: Color codes for each faction (used in UI, highlights)
- `WEAPONS`: Blaster bolt speed, size, damage multipliers
- `PHYSICS`: Gravity, player speed, jump force
- `NPC`: Default perception radius, attack ranges

## Key Global Singletons

These are instantiated once and accessed globally via `window.*`:
- `window.game`: Main game instance (Game class from main.js)
- `window.assetManager`: Asset loader (AssetManager from asset_loaders.js)
- `window.physics`: Physics engine (PhysicsEngine from environment_and_physics.js)
- `window.inputHandler`: Keyboard/mouse input (InputHandler from main.js)
- `window.playerWeaponSystem`: Player's weapon manager (PlayerWeaponSystem from player_gear.js)
- `window.levelManager`: Level loading (LevelManager from levelManager.js)
- `window.audioSystem`: Audio playback (AudioSystem from audio_system.js)
- `window.factionManager`: Faction physics (FactionManager from faction_manager.js)
- `window.conversationController`: Dialogue system (ConversationController from conversation_controller.js)
- `window.conversationUIManager`: Conversation UI (ConversationUIManager from conversation_ui_manager.js)
- `window.loadingScreenManager`: Trivia screens (LoadingScreenManager from loadingScreenManager.js)
- `window.tabControls`: Pause menu (TabControls from tab_controls.js)

## Development Workflow

### Running the Game
1. **Local Server Required**: Use any HTTP server (e.g., `python -m http.server 8000` or Live Server extension)
2. Open `http://localhost:8000/index.html` in Firefox (primary browser for this project)
3. Game auto-loads Level 1 after asset initialization

### Code Modification Patterns

**Adding a New NPC Type**:
1. Add skin PNGs to `data/skins/{faction}/` with naming pattern `{name}_idle_0001.png`, `{name}_walk_0001.png`, etc.
2. Add config to appropriate `data/factionJSONs/*.json` with stats (health, speed, faction, default_weapon, etc.)
3. Update `data/npc_names.json` if new subgroup needs custom name pool
4. Reload `assetManager` will auto-detect new NPC

**Adding a New Weapon**:
1. Add weapon PNG to `data/pngs/weapons/`
2. Define stats in `data/weapons.json` (or rely on category defaults)
3. Update `data/npc_weapons.json` if NPCs should use it
4. For player weapons, add to `PlayerWeaponSystem._generateWeaponConfigs()` in `player_gear.js`

**Modifying Faction Relationships**:
1. Edit `data/faction_config.json` pushForces (strength = force magnitude, radius = activation distance)
2. Adjust homePosition to change faction's equilibrium point on grid
3. Changes apply immediately on next level load

**Adding Conversations**:
1. Add phrases to `data/conversations_*.json` (h1=humans, i1=imperials, m1=mandalorians, nonbasic=aliens/droids)
2. Match `speaker_faction` + `listener_faction` + `attitude` + `type` (greeting/reply/rejoinder)
3. Add `topics` array with tags matching faction preferences in `conversation_controller.js`

### Common Gotchas

1. **Missing File Headers**: Any new file MUST have `BROWSERFIREFOXHIDE` header or deployment will break
2. **Script Load Order**: New JS files must be added to `ScriptLoader.scriptsToLoad` array in correct dependency order (in `index.html`)
3. **Asset Paths**: All asset paths in JSON are relative to project root (e.g., `data/pngs/skins/aliens/geonosian.png`)
4. **Faction Manager Updates**: After modifying faction relationships, check faction grid HUD (press F) to verify physics behavior
5. **NPC Naming**: Names are auto-generated; if custom name needed, set `name` property explicitly in level JSON's NPC properties
6. **Weapon Offsets**: Each weapon category has specific 3D offsets; new weapons in existing category inherit defaults, custom weapons need explicit offsets in weapons.json
7. **Conversation Matching**: If conversation doesn't trigger, check console for "No phrase found" warnings - likely missing phrase for attitude/topic combo

## Map File Maintenance

`GONKPROJECTMAP.json` contains high-level summaries of all files for AI navigation. **After making changes**:
- **DO Update**: If you add new classes, major functions, or change file architecture
- **DO NOT Update**: For minor implementation details (e.g., tweaking NPC health value, fixing typo)
- Add update notes as `\r\n// update: [brief description]` in relevant "content" strings

## Architecture Notes

### Why Singletons?
The game uses global singleton pattern (via `window.*`) because:
- THREE.js encourages single scene/renderer per page
- Cross-system communication (e.g., faction manager → conversation controller → UI manager) is simpler
- No build system or module bundler (vanilla ES6 with sequential script loading)

### Faction Physics Model
The 2D grid system maps abstract "relationship" to physical distance. This creates emergent behavior:
- Killing enemies → factions drift apart → harder to recruit later
- Recruiting allies → player faction moves toward target → related factions become friendlier
- Elasticity/mass creates momentum, preventing instant teleports
- Visual representation (faction HUD) makes abstract diplomacy tangible

### Character Rendering System
NPCs are **not 3D models** - they're billboarded sprite sheets. Each character has:
- Directional sprites (8 angles: front, back, left, right, diagonals)
- State animations (idle, walk, attack, dead) with 2-4 frames each
- The `CharacterMesh` class (gonk_models.js) manages sprite switching based on camera angle + animation state
- Performance benefit: 100+ sprites render faster than 100 rigged 3D models

This approach mimics classic Doom/Duke Nukem 3D sprite-based enemies.
