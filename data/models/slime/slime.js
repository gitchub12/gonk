// BROWSERFIREFOXHIDE data/models/slime/slime.js
// Slime model definition with proper Minecraft UV mapping
// Texture size: 64x32 pixels
// Uses standard Minecraft box UV layout formula

window.SlimeModel = {
    name: 'slime',
    textureWidth: 64,
    textureHeight: 32,

    // Parts in game units (Minecraft pixels * 0.07)
    parts: {
        slimeOuter: {
            size: [0.56, 0.56, 0.56],      // 8x8x8 pixels * 0.07
            pixelSize: [8, 8, 8],
            uvOffset: [0, 0],
            position: [0, 0.28, 0],         // Center of slime
            pivot: [0, 0, 0],
            parent: null,
            transparent: true
        },
        slimeInner: {
            size: [0.42, 0.42, 0.42],      // 6x6x6 pixels * 0.07
            pixelSize: [6, 6, 6],
            uvOffset: [0, 16],
            position: [0, 0, 0],            // Same center as outer
            pivot: [0, 0, 0],
            parent: 'slimeOuter'
        },
        rightEye: {
            size: [0.14, 0.14, 0.14],      // 2x2x2 pixels * 0.07
            pixelSize: [2, 2, 2],
            uvOffset: [32, 0],
            position: [-0.105, 0.07, -0.245],  // Front right
            pivot: [0, 0, 0],
            parent: 'slimeOuter'
        },
        leftEye: {
            size: [0.14, 0.14, 0.14],      // 2x2x2 pixels * 0.07
            pixelSize: [2, 2, 2],
            uvOffset: [32, 0],
            position: [0.105, 0.07, -0.245],   // Front left
            pivot: [0, 0, 0],
            parent: 'slimeOuter'
        },
        mouth: {
            size: [0.07, 0.07, 0.07],      // 1x1x1 pixels * 0.07
            pixelSize: [1, 1, 1],
            uvOffset: [32, 4],
            position: [0, -0.07, -0.245],      // Front center lower
            pivot: [0, 0, 0],
            parent: 'slimeOuter'
        }
    },

    scale: 1.0,  // Already in game units
    animationSpeed: 1.5,

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
        const baseY = 0.28;  // Base Y position in game units
        switch (animState) {
            case 'walk':
            case 'jump':
                const jumpPhase = time % 2.0;
                let scaleY = 1.0, scaleXZ = 1.0, yOffset = 0;
                if (jumpPhase < 0.2) {
                    const t = jumpPhase / 0.2;
                    scaleY = 1.0 - t * 0.5;
                    scaleXZ = 1.0 + t * 0.3;
                } else if (jumpPhase < 0.6) {
                    const t = (jumpPhase - 0.2) / 0.4;
                    scaleY = 0.5 + t * 0.3;
                    scaleXZ = 1.3 - t * 0.2;
                    yOffset = Math.sin(t * Math.PI) * 0.56;  // Jump height in game units
                } else if (jumpPhase < 0.8) {
                    const t = (jumpPhase - 0.6) / 0.2;
                    scaleY = 0.8 - t * 0.3;
                    scaleXZ = 1.1 + t * 0.2;
                } else {
                    const t = (jumpPhase - 0.8) / 0.2;
                    scaleY = 0.5 + t * 0.5;
                    scaleXZ = 1.3 - t * 0.3;
                }
                if (parts.slimeOuter) {
                    parts.slimeOuter.scale.set(scaleXZ, scaleY, scaleXZ);
                    parts.slimeOuter.position.y = baseY + yOffset;
                }
                break;
            case 'idle':
                const wobble = Math.sin(time * 2) * 0.05;
                if (parts.slimeOuter) {
                    parts.slimeOuter.scale.set(1.0 + wobble, 1.0 - wobble, 1.0 + wobble);
                }
                break;
            default:
                if (parts.slimeOuter) parts.slimeOuter.scale.set(1, 1, 1);
                break;
        }
    }
};
console.log('Slime model definition loaded');
