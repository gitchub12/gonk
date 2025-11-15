# Session Narrative

## Current Issues and Plan

### Furniture Problems

"E:\gonk\data\furniture\models\item\holotable.json"
"E:\gonk\data\furniture\models\item\crate.json" are the new locations for my two assets in the furniture category. In the editor, it says there are "no" assets. I need to be able to place these.

"E:\gonk\data\furniture\models\item\holotable.json"
"E:\gonk\data\furniture\blockstates\holotable.json"
"E:\gonk\data\furniture\models\block\holotable.json"

I need to point out that three jsons already define holotable and it was improperly listed as holo_table at one point. These will need to be consulted so you can picture how to place it in my game. It was ported language from minecraft that may need adjusting.

For now focus on the crate. crate.png referenced at:
"E:\gonk\data\furniture\models\item\crate.json"
"E:\gonk\data\furniture\blockstates\crate.json"
"E:\gonk\data\furniture\models\block\crate.json"
"E:\gonk\data\furniture\models\custom\crate.json"
Pic of it for the editor UI is "E:\gonk\data\furniture\textures\items\cratepic.png"

Many of the items are just "name of item"pic.png but these folders are HUGE so we're working on just these two items for now to prevent token overflow.

"E:\gonk\data\OldDeprecatedFilesWithWorkingElementToExtractByDirectOrderOnly\furniture_config.json"
"E:\gonk\data\OldDeprecatedFilesWithWorkingElementToExtractByDirectOrderOnly\furniture.js"

Here is deprecated info from when the crate worked. Use this as a basis.

### Errors and Bugs

#### Holotable Error
```
Error processing furniture model holo_table: TypeError: Cannot read properties of undefined (reading '0')
    at furniture.js?v=5:127:55
    at Array.forEach (<anonymous>)
    at furniture.js?v=5:113:27
    at Array.forEach (<anonymous>)
    at FurnitureLoader.createModelObject (furniture.js?v=5:87:28)
    at FurnitureLoader.getModel (furniture.js?v=5:54:38)
    at async LevelRenderer.buildFurniture (environment_and_physics.js?v=2:543:27)
getModel	@	furniture.js?v=5:62
```
The table doesn't seem to work. It does have a `_` in it?

#### Crate Collision Issue
The crate is kinda cool, but it does have an odd trait where it has collision on the sides, but if I jump on it (it is a box) I slowly sink down into it like it's a marshmallow... then after awhile I teleport to the side of it.

**Plan:**
- Make it have collision for its size.
- Player should not be able to sink into it.
- If player ends up inside, they should be moved outside quickly.
- Player should be able to stand on the crate.
- Some objects will be standable, others not. Need a way to distinguish.

### New Errors

```
furniture.js?v=5:80 Error processing furniture model crate: ReferenceError: position is not defined
    at furniture.js?v=5:262:43
    at Array.forEach (<anonymous>)
    at FurnitureLoader.createModelObject (furniture.js?v=5:105:28)
    at FurnitureLoader.getModel (furniture.js?v=5:72:38)
    at async LevelRenderer.buildFurniture (environment_and_physics.js?v=2:543:27)
getModel	@	furniture.js?v=5:80

furniture.js?v=5:80 Error processing furniture model holo_table: ReferenceError: position is not defined
    at furniture.js?v=5:262:43
    at Array.forEach (<anonymous>)
    at FurnitureLoader.createModelObject (furniture.js?v=5:105:28)
    at FurnitureLoader.getModel (furniture.js?v=5:72:38)
    at async LevelRenderer.buildFurniture (environment_and_physics.js?v=2:543:27)
getModel	@	furniture.js?v=5:80
```
Not only not fixed, but the crate does not appear either.

## Character Upgrade System Improvements (Session 2)

### Completed Tasks
- [x] Created 1-byte placeholder PNG files for missing node icons
  - storage_starter.png, carry_pistol.png, carry_rifle.png, carry_longarm.png
  - carry_uniques.png, carry_saber.png, extra_pistol.png, extra_rifle.png
  - extra_longarm.png, extra_uniques.png, extra_saber.png, copy_machine.png
- [x] Updated upgrade_nodes.json with icon paths for all placeholder files
- [x] Increased vertical spacing from 35px to 39px (~11% increase)
- [x] Added TOP_PADDING of 10px from top of screen
- [x] Updated drawConnections() to use topPadding parameter for line positioning
- [x] Fixed tooltip to show full-size icons (max 128x128px) with object-fit: contain
- [x] Expanded tooltip max-width from 250px to 350px to accommodate larger icons
- [x] Total grid height now: 10px (top) + (18.5 * 39px) + 58px ≈ 790px (fits on screen)
- [x] All nodes from row 0 to row 18.5 now visible without scrolling

## Character Upgrade System Improvements (Session 3)

### Completed Tasks
- [x] Added four Spare Core nodes (extra lives)
  - spare_core_1 at (11, 3) - Cost: 8 wire (2^3)
  - spare_core_2 at (11, 5) - Cost: 32 wire (2^5)
  - spare_core_3 at (11, 7) - Cost: 128 wire (2^7)
  - spare_core_4 at (11, 10) - Cost: 1024 wire (2^10)
- [x] Implemented column-based exponential cost formula (2^column)
  - Added getNodeCost(node) method in character_upgrades.js
  - Column 0 = 1 wire, Column 1 = 2 wire, Column 2 = 4 wire, etc.
  - Column 10 = 1024 wire, Column 11 = 2048 wire
  - Updated all cost references to use calculated cost
- [x] Set starting wire to 2000 (from 100)
- [x] Stretched grid horizontally
  - Moved force_pike from x=9 to x=11 (rightmost position)
  - Grid now spans columns 0-11 (12 columns total)
- [x] Stretched grid vertically
  - Moved bartering from y=18.5 to y=21 (bottom position)
  - Reduced GRID_SPACING_Y from 39px to 34px to fit rows 0-21
  - Total grid height: 10px (top) + (21 * 34px) + 58px ≈ 782px
- [x] Fixed tooltip positioning
  - Tooltips appear above nodes for rows >= 9
  - Tooltips appear below nodes for rows < 9
  - Prevents tooltips from going off-screen at bottom
- [x] Renamed "Character Status" to "Gonk Pope Status"
- [x] Added Spare Core display to character sheet
  - Green text showing "Spare Cores: X" at top of sheet
  - Updates dynamically when spare cores are purchased/removed
- [x] Implemented spare_core effect handling
  - applyNodeEffects() adds spare cores to playerStats
  - removeNodeEffects() removes spare cores when severed/undone
  - Updates UI display in real-time

## Death and Respawn System (Session 3 Continued)

### Completed Tasks
- [x] Fixed editor context menu for docks and spawn points
  - Added UI generation for dock properties (target level input)
  - Added UI generation for spawn point properties (ID and rotation inputs)
  - Right-click on docks/spawns now shows editable properties panel
- [x] Implemented death system with spare core consumption
  - On death: consume 1 spare core and respawn at level entry point
  - If no spare cores: respawn at home spawn (level 1 by default)
  - Spare core count updates in real-time when consumed
- [x] Added spawn point tracking system
  - lastSpawnPointPerLevel tracks where player entered each level
  - homeSpawnLevel (default: 1) defines where player respawns with no cores
  - homeSpawnPoint stores the actual spawn point for home level
  - System allows future boss fights to update home spawn to level 20+
- [x] Repositioned Spare Core nodes
  - All four nodes now on row 22 (bottom of grid)
  - Positioned at columns 3, 5, 7, 10
  - All nodes have no prerequisites (can be purchased independently)
- [x] Reduced node size to fit expanded grid
  - Nodes: 58px to 50px
  - Vertical spacing: 34px to 32px
  - Fallback text: 7px to 6px
  - Grid now shows rows 0-22 (23 rows total)
- [x] Fixed weapon icon path errors
  - longarm_ee3_mando.png to long_ee3_mando.png
  - longarm_z6custom.png to long_z6custom.png

## Future Multi-Ship Level System (Documented, Not Implemented)

### Planned Layout
- 100 Total Ships: 50 manually created, 50 randomly generated
- Level 0: Testing only (no left/right divide)
- Level 1: Home spawn, no left/right divide
- Levels 2-49: Each has Left (L) and Right (R) variant
- Level 50: Final battle (no left/right divide)
- Level 51: Extra content level

## Map Screen System (M Key)

### Current Implementation Goals
- [x] Map screen overlay (similar to C menu - translucent, not paused)
- [x] Activated with M key
- [x] Ship chain layout:
  - Row 1 (top): 2L-3L-4L...49L
  - Row 2 (bottom): 1-2R-3R-4R...49R-50
  - Ship 51 hidden from map
- [x] Each ship represented as rectangular prism colored by dominant faction
- [x] Ship labels on rectangles (e.g., "3L", "7R")
- [x] Current ship highlighted/indicated
- [x] Mousewheel scrolling to view entire chain
- [x] Faction information display:
  - L ships: faction info ABOVE ship
  - R ships: faction info BELOW ship
  - Format: [Faction1 Icon] [+/-/=] [Faction2 Icon]
- [x] Random faction assignment (for now):
  - Each ship has dominant faction and secondary faction
  - Relationship symbol: + (allied), - (at war), = (neutral)
- [x] Faction icons from happy/mad portraits:
  - + symbol: Use h1 folder (happy faces) - lowest numbered file
  - - symbol: Use m1 folder (mad faces) - lowest numbered file
  - = symbol: Use h1 folder (happy faces)
- [x] Ship detail visibility:
  - Can only see details of ship directly above current ship
  - Can see details of all ships below current ship
  - Example: On ship 9, see details of ship 10 only (above), but all ships 1-8 (below)

### Future Enhancements (Not Yet Implemented)
- Conflict visualization: Moving line showing dominance in faction wars
- Actual faction data per ship (not random)
- Ship control percentage visualization
- Dynamic faction color mixing during conflicts

```