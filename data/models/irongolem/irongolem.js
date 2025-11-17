// BROWSERFIREFOXHIDE data/models/irongolem/irongolem.js
// Iron Golem model definition with proper Minecraft UV mapping
// Texture size: 128x128 pixels
// Uses standard Minecraft box UV layout formula

window.IronGolemModel = {
    name: 'irongolem',
    textureWidth: 128,
    textureHeight: 128,

    // IMPORTANT: Parts are in MINECRAFT PIXEL UNITS (not game units!)
    // The gonk_models.js will scale by: modelDef.scale * config.scale * universalScaleModifier(0.3)
    // With scale=0.0625: 0.0625 * 1.0 * 0.3 = 0.01875 (converts MC pixels to game units)
    // Iron Golem total height = ~41 pixels, so 41 * 0.01875 ≈ 0.77 game units (too small)
    // With scale=0.15: 0.15 * 1.0 * 0.3 = 0.045 → 41 * 0.045 ≈ 1.85 game units (good size)
    parts: {
        body: {
            size: [18, 12, 11],            // ACTUAL: 18 wide x 12 tall x 11 deep (counted from texture)
            pixelSize: [18, 12, 11],       // Same as size for UV mapping
            uvOffset: [0, 40],
            position: [0, 25, 0],          // Body center Y position in MC pixels
            pivot: [0, 0, 0],              // Pivot at center of body
            parent: null
        },
        nose: {
            size: [2, 4, 2],               // Nose sticks out front
            pixelSize: [2, 4, 2],
            uvOffset: [24, 0],             // Nose UV position
            position: [0, 2, 5],           // Front of head (positive Z is front in THREE.js)
            pivot: [0, 0, 0],
            parent: 'head'
        },
        head: {
            size: [8, 10, 8],              // Head dimensions
            pixelSize: [8, 10, 8],
            uvOffset: [0, 0],
            position: [0, 6, 0],           // Position of pivot point relative to parent (body top = body half = 6)
            pivot: [0, -5, 0],             // Pivot at bottom of head (attach to body top)
            parent: 'body'
        },
        waist: {
            size: [9, 5, 6],               // Waist/crotch area - smaller than body
            pixelSize: [9, 5, 6],
            uvOffset: [0, 70],
            // FORMULA: Parent bottom edge is at -parentHeight/2 = -6
            // We want 0.5 pixel overlap, so position.y = -6 + 0.5 = -5.5
            // Pivot at top of waist (2.5 from center), so mesh will extend down from there
            position: [0, -5.5, 0],
            pivot: [0, 2.5, 0],            // Pivot at top of waist
            parent: 'body'
        },
        rightArm: {
            size: [4, 30, 6],              // Very long arms!
            pixelSize: [4, 30, 6],
            uvOffset: [60, 21],
            position: [-11, 6, 0],         // Right side of body (body half width 9 + arm half 2)
            pivot: [0, 15, 0],             // Pivot at top (shoulder joint)
            parent: 'body'
        },
        leftArm: {
            size: [4, 30, 6],
            pixelSize: [4, 30, 6],
            uvOffset: [60, 58],
            position: [11, 6, 0],          // Left side of body
            pivot: [0, 15, 0],             // Pivot at top (shoulder joint)
            parent: 'body'
        },
        rightLeg: {
            size: [6, 16, 5],              // Legs
            pixelSize: [6, 16, 5],
            uvOffset: [37, 0],
            // FORMULA: Waist partGroup origin at 19.5, mesh offset by -2.5, so waist center at 17
            // Waist bottom at 17 - 2.5 = 14.5
            // Leg pivot should be at waist bottom + 0.5 overlap = 15
            // Position relative to waist partGroup (19.5) = 15 - 19.5 = -4.5
            position: [-3, -4.5, 0],
            pivot: [0, 8, 0],              // Pivot at top (hip joint)
            parent: 'waist'
        },
        leftLeg: {
            size: [6, 16, 5],
            pixelSize: [6, 16, 5],
            uvOffset: [60, 0],
            position: [3, -4.5, 0],        // Under waist, left side
            pivot: [0, 8, 0],              // Pivot at top (hip joint)
            parent: 'waist'
        }
    },

    scale: 0.15,  // Scales MC pixels to game units: 0.15 * 0.3 = 0.045 per pixel
    animationSpeed: 2.0,

    // UV mapping using standard Minecraft box UV layout formula
    // For a box with pixel size [width, height, depth] at uvOffset [u, v]:
    // Layout on texture (horizontally): left | front | right | back
    // Layout on texture (vertically): top/bottom above front/right
    getUVMap: function(partName, isOverlay = false) {
        // Iron Golem has no overlay layer
        if (isOverlay) return null;

        const part = this.parts[partName];
        if (!part || !part.uvOffset || !part.pixelSize) return null;

        // Use pixel dimensions for UV mapping, not game-unit dimensions
        const [width, height, depth] = part.pixelSize;
        const [u, v] = part.uvOffset;

        // Standard Minecraft box UV layout formula
        // Maps pixel coordinates [x, y, w, h] for each face
        return {
            left:   [u, v + depth, depth, height],                         // -X face
            right:  [u + depth + width, v + depth, depth, height],         // +X face
            top:    [u + depth, v, width, depth],                          // +Y face
            bottom: [u + depth + width, v, width, depth],                  // -Y face
            front:  [u + depth, v + depth, width, height],                 // +Z face
            back:   [u + depth + width + depth, v + depth, width, height]  // -Z face
        };
    },

    // Calculate ground offset (how high model stands)
    getGroundOffset: function(scaleY, modelScale, universalScale) {
        // CALCULATION: Trace from character.group origin to feet bottom
        // Body partGroup at Y=25, waist partGroup at 25-5.5=19.5
        // Leg partGroup at 19.5-4.5=15, leg mesh offset by -8, so leg center at 15-8=7
        // Leg bottom at 7-8=-1
        // Feet are at Y=-1 (below group origin), so we LIFT by 1 pixel
        return 1 * scaleY * modelScale * universalScale;
    },

    // Custom animation for iron golem (slower, heavier movement)
    applyAnimation: function(character, animState, time, options) {
        const parts = character.parts;

        switch (animState) {
            case 'walk':
                const walk = Math.sin(time * 0.8); // Slower walk
                if (parts.rightLeg) parts.rightLeg.rotation.x = walk * 0.4;
                if (parts.leftLeg) parts.leftLeg.rotation.x = -walk * 0.4;
                if (parts.rightArm) parts.rightArm.rotation.x = -walk * 0.3;
                if (parts.leftArm) parts.leftArm.rotation.x = walk * 0.3;
                break;
            case 'idle':
                const sway = Math.sin(time * 0.2) * 0.03;
                if (parts.rightArm) parts.rightArm.rotation.z = sway;
                if (parts.leftArm) parts.leftArm.rotation.z = -sway;
                if (parts.head) parts.head.rotation.y = Math.sin(time * 0.3) * 0.1;
                break;
            case 'attack':
            case 'melee':
                const attackProgress = Math.min(character.animTime / 0.8, 1.0);
                const swingAngle = Math.sin(attackProgress * Math.PI) * -1.5; // Big overhead swing
                if (parts.rightArm) parts.rightArm.rotation.x = swingAngle;
                if (parts.leftArm) parts.leftArm.rotation.x = swingAngle;
                if (parts.body) parts.body.rotation.x = Math.sin(attackProgress * Math.PI) * 0.3;
                break;
            default:
                // Reset to default pose
                break;
        }
    }
};

console.log('Iron Golem model definition loaded');
