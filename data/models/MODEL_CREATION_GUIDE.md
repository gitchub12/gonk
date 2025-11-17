# Minecraft Model Conversion Guide for Gonk

## CRITICAL KNOWLEDGE FOR AI INSTANCES

This document explains how to properly create Minecraft-style 3D models for the Gonk game. The process has specific requirements that MUST be followed.

---

## 1. COORDINATE SYSTEMS

### Minecraft Coordinate System:
- Y+ is UP
- Z+ is BACK (behind the mob)
- Z- is FRONT (where mob faces)
- X+ is LEFT (mob's left)
- X- is RIGHT (mob's right)

### THREE.js Coordinate System:
- Y+ is UP
- Z+ is typically FRONT (camera facing)
- Z- is BACK
- X+ is RIGHT
- X- is LEFT

**KEY DIFFERENCE**: Front/Back are SWAPPED between systems!

---

## 2. UNIT SYSTEM

### Minecraft Units:
- All dimensions are in "PIXELS" where 16 pixels = 1 Minecraft block
- A typical player is 32 pixels tall (2 blocks)
- Iron Golem is ~41 pixels tall (~2.6 blocks)

### Gonk Game Units:
- Final scale is applied by: `modelDef.scale * config.scale * universalScaleModifier(0.3)`
- With scale=0.15: 0.15 * 1.0 * 0.3 = 0.045 per MC pixel
- Iron Golem: 41 pixels * 0.045 = ~1.85 game units tall

**IMPORTANT**: Keep part dimensions in MINECRAFT PIXEL UNITS. Let the engine scale them!

---

## 3. MODEL DEFINITION STRUCTURE

```javascript
window.ModelNameModel = {
    name: 'modelname',           // Must match registration key
    textureWidth: 128,           // Texture size in pixels
    textureHeight: 128,

    parts: {
        partName: {
            size: [width, height, depth],      // IN MC PIXELS!
            pixelSize: [width, height, depth], // Same as size (for UV mapping)
            uvOffset: [u, v],                  // Top-left corner on texture
            position: [x, y, z],               // IN MC PIXELS, relative to parent
            pivot: [x, y, z],                  // Rotation point, IN MC PIXELS
            parent: 'parentPartName' or null
        }
    },

    scale: 0.15,  // Adjust this to control final size
    // 0.0625 = Minecraft default (too small)
    // 0.15 = Good for large mobs
    // 0.1 = Good for normal mobs
}
```

---

## 4. UV MAPPING FORMULA

Minecraft uses a specific "box UV" layout:

```
For a box with pixelSize [width, height, depth] at uvOffset [u, v]:

Texture Layout (looking at the texture image):
      [top]    [bottom]
      [left][front][right][back]

Coordinates:
- top:    [u + depth, v, width, depth]
- bottom: [u + depth + width, v, width, depth]
- left:   [u, v + depth, depth, height]
- front:  [u + depth, v + depth, width, height]
- right:  [u + depth + width, v + depth, depth, height]
- back:   [u + depth + width + depth, v + depth, width, height]
```

---

## 5. PIVOT POINTS

The pivot is WHERE THE PART ROTATES AROUND:
- Arms: Pivot at TOP of arm (shoulder joint) → `pivot: [0, height/2, 0]`
- Legs: Pivot at TOP of leg (hip joint) → `pivot: [0, height/2, 0]`
- Head: Pivot at BOTTOM of head (neck) → `pivot: [0, -height/2, 0]`
- Body: Usually pivot at center → `pivot: [0, 0, 0]`

The mesh is offset by NEGATIVE pivot so the pivot point ends up at the group origin.

---

## 6. PART HIERARCHY

Parts attach to parents:
1. **Root part** (usually body) has `parent: null`
2. Child parts have `parent: 'parentName'`
3. Position is RELATIVE to parent's center

Example Iron Golem:
```
body (root, at Y=25)
├── head (12 pixels above body center)
│   └── nose (in front of head)
├── waist (11 pixels below body center)
│   ├── rightLeg
│   └── leftLeg
├── rightArm
└── leftArm
```

---

## 7. GROUND OFFSET CALCULATION

The `getGroundOffset()` function returns how high to lift the model so feet touch ground.

Calculate: Distance from ROOT PART CENTER to BOTTOM OF FEET (in MC pixels)

Example:
- Body center at Y=25
- Waist attached at Y=25-11=14
- Legs attached to waist, extending down
- Feet bottom at Y=0 (approximately)
- Ground offset = 25 pixels

Then return: `pixelOffset * scaleY * modelScale * universalScale`

---

## 8. COMMON MISTAKES TO AVOID

1. **Pre-scaling to game units** - DON'T! Keep in MC pixels
2. **Forgetting pixelSize** - MUST be same as size for UV mapping
3. **Wrong pivot direction** - Pivot is where rotation happens, mesh offsets AWAY from it
4. **Ignoring coordinate system swap** - Front/Back are inverted
5. **Missing parts** - Check Minecraft wiki for ALL parts (nose, ears, tails, etc.)
6. **Wrong texture size** - Most mobs are 64x32 or 64x64, Iron Golem is 128x128

---

## 9. REGISTRATION IN JSON

In faction JSON files (e.g., `8_droids.json`):

```json
"modelGroupName": {
    "name": "Display Name",
    "baseType": "modelGroupName",
    "minecraftModel": "modelname",  // MUST match model definition name!
    "faction": "droids",
    "macroCategory": "Droids",
    "path": "droids/modelname/",
    "textures": [...]
}
```

The `minecraftModel` property tells the game to use 3D model instead of billboard sprite.

---

## 10. TESTING CHECKLIST

After creating a model:
1. [ ] Check console for model registration messages
2. [ ] Verify `[GonkModels] Using external model: modelname`
3. [ ] Check all parts render (no missing geometry)
4. [ ] Verify proportions match reference (Blockbench, Minecraft wiki)
5. [ ] Test UV mapping - all faces should have correct textures
6. [ ] Verify parts connect properly (no floating)
7. [ ] Check ground placement (feet on ground, not underground)
8. [ ] Test animations (arms swing, legs move, etc.)

---

## 11. REFERENCE RESOURCES

- Minecraft Wiki: https://minecraft.wiki/
- Blockbench: https://www.blockbench.net/
- Model specifications for each mob (search "Minecraft [mob name] model")
- Texture layouts visible when opening mob textures in image editor

---

## 12. CURRENT KNOWN ISSUES

- UV face orientation may still be wrong (textures backwards/upside-down)
- THREE.js BoxGeometry face order needs verification
- May need to flip texture coordinates for certain faces

The UV mapping in `gonk_models.js createBoxGeometryWithUVs()` handles the THREE.js to Minecraft mapping but may need adjustment per face.
