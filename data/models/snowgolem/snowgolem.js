// BROWSERFIREFOXHIDE data/models/snowgolem/snowgolem.js
// Snow Golem model - 64x64 texture
window.SnowGolemModel = {
    name: 'snowgolem',
    textureWidth: 64,
    textureHeight: 64,
    // Parts in game units (Minecraft pixels * 0.07)
    parts: {
        body: {
            size: [0.84, 0.84, 0.84],      // 12x12x12 pixels * 0.07
            pixelSize: [12, 12, 12],
            uvOffset: [0, 16],
            position: [0, 0.98, 0],         // Middle body section
            pivot: [0, 0, 0],
            parent: null
        },
        head: {
            size: [0.56, 0.56, 0.56],      // 8x8x8 pixels * 0.07
            pixelSize: [8, 8, 8],
            uvOffset: [0, 0],
            position: [0, 0.70, 0],         // On top of body
            pivot: [0, -0.28, 0],           // Pivot at bottom of head
            parent: 'body'
        },
        bottomBody: {
            size: [0.98, 0.70, 0.98],      // 14x10x14 pixels * 0.07
            pixelSize: [14, 10, 14],
            uvOffset: [0, 36],
            position: [0, -0.77, 0],        // Below body
            pivot: [0, 0.35, 0],            // Pivot at top
            parent: 'body'
        },
        rightArm: {
            size: [0.14, 0.84, 0.14],      // 2x12x2 pixels * 0.07 (stick arms!)
            pixelSize: [2, 12, 2],
            uvOffset: [32, 0],
            position: [-0.49, 0.35, 0],     // Right side of body
            pivot: [0, 0.42, 0],            // Pivot at top (shoulder)
            parent: 'body'
        },
        leftArm: {
            size: [0.14, 0.84, 0.14],      // 2x12x2 pixels * 0.07 (stick arms!)
            pixelSize: [2, 12, 2],
            uvOffset: [32, 0],
            position: [0.49, 0.35, 0],      // Left side of body
            pivot: [0, 0.42, 0],            // Pivot at top (shoulder)
            parent: 'body'
        }
    },
    scale: 1.0,  // Already in game units
    animationSpeed: 1.2,
    getUVMap: function(partName, isOverlay = false) {
        if (isOverlay) return null;
        const part = this.parts[partName];
        if (!part || !part.uvOffset || !part.pixelSize) return null;
        const [width, height, depth] = part.pixelSize;  // Use pixel dimensions
        const [u, v] = part.uvOffset;
        return {
            left:   [u, v + depth, depth, height],
            right:  [u + depth + width, v + depth, depth, height],
            top:    [u + depth, v, width, depth],
            bottom: [u + depth + width, v, width, depth],
            front:  [u + depth, v + depth, width, height],
            back:   [u + depth + width + depth, v + depth, width, height]
        };
    },
    getGroundOffset: function(scaleY, modelScale, universalScale) {
        return 0.0;  // Position already accounts for ground placement
    },
    applyAnimation: function(character, animState, time, options) {
        const parts = character.parts;
        switch (animState) {
            case 'walk':
                const bob = Math.abs(Math.sin(time * 3)) * 0.5;
                if (parts.body) parts.body.position.y = 8 + bob;
                const armSwing = Math.sin(time * 3) * 0.3;
                if (parts.rightArm) parts.rightArm.rotation.x = armSwing;
                if (parts.leftArm) parts.leftArm.rotation.x = -armSwing;
                break;
            case 'idle':
                const sway = Math.sin(time * 0.5) * 0.05;
                if (parts.head) parts.head.rotation.y = sway;
                if (parts.rightArm) parts.rightArm.rotation.z = -0.1 + Math.sin(time * 0.3) * 0.05;
                if (parts.leftArm) parts.leftArm.rotation.z = 0.1 - Math.sin(time * 0.3) * 0.05;
                break;
            case 'attack':
                const throwAnim = Math.sin(time * 8) * 1.2;
                if (parts.rightArm) parts.rightArm.rotation.x = throwAnim;
                break;
            default:
                break;
        }
    }
};
console.log('Snow Golem model definition loaded');
