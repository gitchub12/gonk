# Minecraft Model System for Gonk

This folder contains external model definitions for non-humanoid Minecraft character models.

## How It Works

1. **External Model Definitions**: Each model (Iron Golem, Snow Golem, Pig, Creeper, Slime) has its own JavaScript file containing:
   - Part definitions (size, position, pivot, parent hierarchy)
   - UV mapping coordinates for each face of each body part
   - Texture dimensions (width × height)
   - Custom animation functions
   - Ground offset calculations

2. **Integration with Main System**:
   - External models are loaded via `<script>` tags in `index.html`
   - `gonk_models.js` registers them via `initializeExternalModels()`
   - NPCs use `minecraftModel` property in faction JSON to select the 3D model
   - UV maps are automatically applied when creating the mesh

3. **Skin Textures**: Drop standard Minecraft skin PNGs into the appropriate `data/skins/` folders

## Available Models

### Iron Golem (`irongolem/irongolem.js`)
- **Texture Size**: 128×128 pixels
- **Parts**: head, body, waist, rightArm, leftArm, rightLeg, leftLeg
- **Character**: Large bipedal robot with long arms
- **Usage**: Set `"minecraftModel": "irongolem"` in faction JSON
- **Skin Path**: `data/skins/droids/irongolem/irongolem/`

### Snow Golem (`snowgolem/snowgolem.js`)
- **Texture Size**: 64×64 pixels
- **Parts**: head (pumpkin), upperBody, body (snowballs), rightArm, leftArm (sticks)
- **Character**: Stacked snowballs with pumpkin head
- **Usage**: Set `"minecraftModel": "snowgolem"` in faction JSON
- **Skin Path**: `data/skins/droids/snowgolem/`

### Pig (`pig/pig.js`)
- **Texture Size**: 64×32 pixels
- **Parts**: head, snout, body (horizontal), rightFrontLeg, leftFrontLeg, rightBackLeg, leftBackLeg
- **Character**: Four-legged quadruped
- **Usage**: Set `"minecraftModel": "pig"` in faction JSON

### Creeper (`creeper/creeper.js`)
- **Texture Size**: 64×32 pixels
- **Parts**: head, body (thin vertical), rightFrontLeg, leftFrontLeg, rightBackLeg, leftBackLeg
- **Character**: Four-legged creature with thin body
- **Usage**: Set `"minecraftModel": "creeper"` in faction JSON

### Slime (`slime/slime.js`)
- **Texture Size**: 64×32 pixels
- **Parts**: slimeOuter (transparent), slimeInner, rightEye, leftEye, mouth
- **Character**: Bouncy cube with inner core
- **Usage**: Set `"minecraftModel": "slime"` in faction JSON
- **Skin Path**: `data/skins/droids/slime/`

## How to Use

### 1. Add Skin Textures
Drop your Minecraft-format PNG files into the appropriate skin folder:
```
data/skins/droids/irongolem/irongolem/myirogolem.png   (128×128)
data/skins/droids/snowgolem/mysnowgolem.png            (64×64)
data/skins/droids/slime/bb8/myslime.png                (64×32)
```

### 2. Configure Faction JSON
In `data/factionJSONs/8_droids.json` (or appropriate faction file):

```json
{
  "my_iron_golem_group": {
    "name": "My Iron Golems",
    "baseType": "irongolem",
    "minecraftModel": "irongolem",  // ← This selects the 3D model
    "faction": "droids",
    "macroCategory": "Droids",
    "path": "droids/irongolem/mygroup/",
    "textures": [
      { "file": "myirongolem.png" }
    ]
  }
}
```

### 3. Place in Level Editor
- Open the level editor
- Select NPC layer
- Choose your NPC from the palette
- Place in level
- The correct 3D model is automatically used based on `minecraftModel` property

## Creating New Models

To add a new Minecraft model:

1. **Create the JS file**: `data/models/newmodel/newmodel.js`
2. **Define the model object**:
```javascript
window.NewModel = {
    name: 'newmodel',
    textureWidth: 64,
    textureHeight: 32,
    parts: { /* part definitions */ },
    scale: 0.0625,
    animationSpeed: 2.0,
    getUVMap: function(partName, isOverlay) { /* return UV coords */ },
    getGroundOffset: function(scaleY, modelScale, universalScale) { /* return offset */ },
    applyAnimation: function(character, animState, time, options) { /* custom animations */ }
};
```
3. **Add to index.html**: Add script to `scriptsToLoad` array after `gonk_models.js`
4. **Register in gonkModels**: Add check in `initializeExternalModels()`
5. **Use in faction JSON**: Set `"minecraftModel": "newmodel"`

## UV Mapping Format

Each body part has 6 faces with UV coordinates in format: `[u, v, width, height]`

```javascript
head: {
    right:  [0, 8, 8, 8],   // Left side of head in texture
    left:   [16, 8, 8, 8],  // Right side of head in texture
    top:    [8, 0, 8, 8],   // Top of head
    bottom: [16, 0, 8, 8],  // Bottom of head
    front:  [8, 8, 8, 8],   // Front face
    back:   [24, 8, 8, 8]   // Back face
}
```

Coordinates are in pixels from top-left of texture. The system automatically normalizes these to 0-1 UV space.

## Important Notes

- **No Overlay Support**: External models don't support the second layer (overlay/hat layer) that Steve/Alex models have. This is a future improvement task.
- **Texture Accuracy**: Ensure your PNG textures match the expected dimensions (128×128 for Iron Golem, 64×32 for Pig/Creeper, etc.)
- **Face Order**: THREE.js BoxGeometry face order is: right, left, top, bottom, front, back (in that order for UV indices 0-5)
- **Coordinate System**: Minecraft uses Y-up, same as THREE.js
- **Pivot Points**: Define rotation pivot for animations (e.g., arm pivots at shoulder)

## Future Improvements

- **Corner Rounding**: Plan to add beveled/rounded corners for heads and hand/foot illusions
- **Overlay Support**: Add second texture layer support for external models
- **LOD System**: Different detail levels for distant characters
- **More Models**: Zombie, Skeleton, Enderman, Villager, etc.

## Troubleshooting

**Model appears as default humanoid:**
- Check that `minecraftModel` property is set in faction JSON
- Verify the model JS file is loading (check console for registration message)
- Ensure texture path exists and PNG files are present

**Texture appears wrong/distorted:**
- Verify texture dimensions match model's expected size
- Check UV coordinates in the model definition
- Ensure PNG is in standard Minecraft skin format

**Animation not working:**
- Check that `applyAnimation` function handles the animation state
- Verify `character.externalModelDef` is set correctly
- Console log in animation function to debug

## File Structure

```
data/models/
├── MODEL_SYSTEM_README.md (this file)
├── irongolem/
│   └── irongolem.js
├── snowgolem/
│   └── snowgolem.js
├── pig/
│   └── pig.js
├── creeper/
│   └── creeper.js
└── slime/
    └── slime.js
```

## Version History

- **2025-11-15**: Initial model system with Iron Golem, Snow Golem, Pig, Creeper, Slime
- Refactored from hardcoded definitions to modular external files
- Added proper UV mapping based on standard Minecraft texture layouts
- Integrated with existing faction JSON system via `minecraftModel` property
