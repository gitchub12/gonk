# Gonk FPS - Level Editor & Data Glossary
_Last Updated: Wednesday, August 27, 2025 at 8:35 AM_

### **1. How to Use and Maintain This File**

This document is a condensed map of the **Level Editor and all data/config files** for Gonk FPS. Its purpose is to provide maximum context in minimum tokens for AI-assisted development. For information on the core game engine, see `GonkGameGlossary.md`.

**To maintain this glossary when you change the code:**
1.  **Find the File:** Locate the section for the file you modified using the "File Abbreviation Key" below.
2.  **Add/Remove Components:** If you added a new class, major function, or data schema property, add a new entry for it.
3.  **Update Dependencies:**
    * **If `File A` now calls a function in `File B`:**
        * In `File A`'s section, add an outgoing reference: `-> [Code for File B]:functionName()`
        * In `File B`'s section, add an incoming reference: `<- [Code for File A]:callingFunction()`
    * Update both sides of the connection to keep the map accurate.

---
### **2. Cross-Reference**

* This glossary details the **Level Editor application** and the **format of all data files**.
* The game engine that reads and interprets this data is detailed in **`GonkGameGlossary.md`**.

---
### **3. File Abbreviation Key**

**LEVEL EDITOR (E)**
* `E01`: `GonkLevelEditor.html` (Editor Entry Point)
* `E02`: `editor.js` (Core Editor Logic)
* `E03`: `editor_ui_and_assets.js` (Editor UI and Asset Management)

**DATA & CONFIG (D)**
* `D01`: `character_config.js` (NPC Stats and Base Definitions)
* `D02`: `data/weapons.json` (Defines Weapon Properties)
* `D03`: `data/furniture.json` (Defines Furniture Models and Instances)
* `D04`: `data/levels/level_*.json` (Level Layout Data)
* `D05`: `data/characters.json` (Specific character instance definitions)

---
### **4. Component & Dependency Reference**

---
#### **E01: GonkLevelEditor.html**
* **_Summary_**: The main HTML file that structures the entire Level Editor interface. It defines the layout with a left panel for controls and a main canvas area. It includes all necessary UI elements like tabs, buttons, input fields, and toolbars.
* **_Key UI Elements_**:
    * `#leftPanel`: The main container for all editor controls.
    * `.tabs`: Contains the "Editor" and "Settings" tab buttons (`.tab-button`).
    * `#editor-content`, `#settings-content`: The content panes for the two main tabs.
    * `#palette-container`: A grid that displays all placeable assets for the currently selected layer.
    * `#canvasContainer`: Wrapper for the 2D editor canvas.
    * `#toolbox`: The floating toolbar on the left with primary tools (Paint, Fill, Rotate, Erase, etc.). Buttons have IDs like `#tool-paint`.
    * `#layer-selector`: The floating toolbar at the top for selecting the active drawing layer (floor, walls, npcs, etc.).
    * `#playtest-button`: Button to save the current map state and launch the game.
* **_Dependencies_**: Loads `G06:gonk_models.js`, `E03:editor_ui_and_assets.js`, and `E02:editor.js`.

---
#### **E02: editor.js**
* **_Summary_**: Contains the core logic for the Level Editor. The `LevelEditor` class manages the 2D canvas rendering, handles all mouse and keyboard input for drawing, manages the level data in memory, and implements the functionality for all the editor tools. It also handles the undo/redo history.
* **_Defines_**: `class LevelEditor`.
* **_Key Functionality Groups_**:
    * **State Management**: `levelData` (holds map data), `activeTool`, `activeLayerName`, `activeBrush`, `history` (for undo/redo).
    * **Drawing Tools**: `handlePaintAction()`, `eraseItem()`, `rotateItem()`, `bucketFill()`.
    * **Wall Modes**: Contains logic to switch between and handle two distinct wall drawing methods:
        * `wallDrawMode = 'grid'`: Snaps walls to the grid edges.
        * `wallDrawMode = 'vector'`: Allows drawing free-form walls between vertices (`placeVectorWallVertex`).
    * **Rendering**: `render()` is the main drawing function, which iterates through all layers. `drawGridAndBorders()`, `drawHoverAndVectorUI()`, `renderWallLayer()`, `renderTileLayer()`.
    * **Data I/O**: `saveLevel()`, `loadLevel()`, `getLevelDataObject()`.
* **_Dependencies_**:
    * **`constructor`**: Instantiates `E03:EditorUI` and `E03:EditorAssetManager`.
    * **`init()`**: `-> E03:assetManager.discoverAssets()`
    * The "Play" button functionality uses `localStorage` to pass level data to `G04:LevelManager`.

---
#### **E03: editor_ui_and_assets.js**
* **_Summary_**: Manages the "View" and "Controller" parts of the editor's MVC-like architecture. `EditorAssetManager` discovers all game assets and makes them available to the editor. `EditorUI` connects the HTML elements to the logic in `editor.js`, populating palettes and handling button clicks.
* **_Defines_**: `class EditorAssetManager`, `class EditorUI`.
* **_Dependencies_**:
    * **`EditorAssetManager`**:
        * **`discoverAssets()`**: Scans asset directories (`/data/skins/`, `/data/pngs/`, etc.) and reads `D03:furniture.json`.
        * **`generateNpcIcons()`**: Uses `G06:GonkModelSystem` definitions to correctly create headshot icons from full skin files for the NPC palette. `<- E02:LevelEditor.init`
    * **`EditorUI`**:
        * **`init()`**: Binds event listeners to all HTML controls (`#load-level-btn`, `#tool-paint`, etc.).
        * **`setActiveLayer()`/`updatePalette()`**: Manages the UI state, showing the correct assets based on the selected layer and tool.
        * **`playtest-button handler`**: `-> E02:levelEditor.getLevelDataObject()`, writes to `localStorage`, then opens `G01:index.html`.

---
#### **D01: character_config.js**
* **_Summary_**: A JS object that defines the **base template** for different types of characters. It contains default stats (health, speed), model information, and sound event mappings. This file defines the "class" of a character, like "Gungan".
* **_Schema_**: An object where each key is a character type ID (e.g., `gungan`). The value contains `name`, `skinTexture`, `minecraftModel`, and nested `stats` and `sounds` objects.
* **_Referenced By_**:
    * `<- G03:AssetManager` (to find and preload default skin textures).
    * `<- G04:LevelRenderer` (to get base stats when creating an NPC instance in the game).

---
#### **D02: data/weapons.json**
* **_Summary_**: **Intended** to define properties for specific, individual weapon instances, allowing for variations. For example, a `rifle_dl44_scoped.png` could be defined here with custom damage and offsets, overriding any generic "rifle" defaults.
* **_Intended Usage_**: The game's weapon systems (`G05`, `G07`) should be updated to read this file. When a weapon is picked up or equipped, the system would look up its name in this JSON to apply unique properties.
* **_Referenced By_**: (Currently none, implementation is pending).

---
#### **D03: data/furniture.json**
* **_Summary_**: A manifest file that defines all placeable furniture/props. It specifies the path to each model's `.json` file and provides a list of instances to be placed in every level by default (though this can be overridden by the level data itself).
* **_Schema_**: Contains a `_config` block, a `models` object mapping a name to a model file, and an `instances` array defining positions/rotations.
* **_Referenced By_**:
    * `<- G03:FurnitureLoader` (to load and place furniture in-game).
    * `<- E03:EditorAssetManager` (to find all available furniture and populate the editor's asset palette).

---
#### **D04: data/levels/level_*.json**
* **_Summary_**: The output of the level editor. This file contains all the data needed for the game engine to construct a playable level. It uses a layer-based system to organize all placed objects. The format is robust enough to support many interconnected levels.
* **_Schema_**: A root object with `settings` (width, height) and `layers`. `layers` is an object where each key is a layer name (e.g., `walls`, `npcs`) and the value is an array of `[coordinate_string, data_object]` pairs.
* **_Level Linking_**: Level transitions are defined within this format. A `door` object in the `walls` layer can have a `properties` object with `{ "isLevelExit": true, "targetLevel": 2 }`, which is how the engine knows to load the next level.
* **_Referenced By_**:
    * **Read by**: `<- G04:LevelManager` (to build the level for gameplay).
    * **Read/Written by**: `<- E02:LevelEditor` (for creating and modifying levels).

---
#### **D05: data/characters.json**
* **_Summary_**: **Intended** to define specific, named character instances that can be placed in a level. This allows for creating unique NPCs (e.g., a "Stormtrooper Captain" based on `stormtrooper1.png` but with double health) that override the base stats from `D01:character_config.js`.
* **_Intended Usage_**: The level format (`D04`) and level renderer (`G04`) should be updated to support placing characters by a key from this file, which would then apply the specified overrides. For example, placing "stormtrooper_captain" in the editor would use the data from this file.
* **_Referenced By_**: (Currently none, implementation is pending).