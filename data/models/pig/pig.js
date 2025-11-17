// BROWSERFIREFOXHIDE data/models/pig/pig.js
// Pig model definition with proper Minecraft UV mapping
// Texture size: 64x32 pixels (classic Minecraft mob format)

window.PigModel = {
    name: 'pig',
    textureWidth: 64,
    textureHeight: 32,

    parts: {
        head: {
            size: [8, 8, 8],
            position: [0, 8, -7],
            pivot: [0, 12, -6],
            parent: 'body'
        },
        snout: {
            // Pig's distinctive nose
            size: [4, 3, 1],
            position: [0, 7, -11],
            pivot: [0, 9, -11],
            parent: 'head'
        },
        body: {
            size: [10, 16, 8],
            position: [0, 5.5, 0],
            pivot: [0, 13, 0],
            parent: null,
            rotation: [Math.PI / 2, 0, 0] // Body is horizontal
        },
        rightFrontLeg: {
            size: [4, 6, 4],
            position: [-3, 0, -5],
            pivot: [-3, 6, -5],
            parent: null
        },
        leftFrontLeg: {
            size: [4, 6, 4],
            position: [3, 0, -5],
            pivot: [3, 6, -5],
            parent: null
        },
        rightBackLeg: {
            size: [4, 6, 4],
            position: [-3, 0, 7],
            pivot: [-3, 6, 7],
            parent: null
        },
        leftBackLeg: {
            size: [4, 6, 4],
            position: [3, 0, 7],
            pivot: [3, 6, 7],
            parent: null
        }
    },

    scale: 0.0625,
    animationSpeed: 3.0,

    // UV mapping for Pig texture (64x32)
    // Standard Minecraft pig layout
    getUVMap: function(partName, isOverlay = false) {
        if (isOverlay) return null;

        const uvMaps = {
            head: {
                right:  [0, 8, 8, 8],
                left:   [16, 8, 8, 8],
                top:    [8, 0, 8, 8],
                bottom: [16, 0, 8, 8],
                front:  [8, 8, 8, 8],
                back:   [24, 8, 8, 8]
            },
            snout: {
                // Snout UV on pig texture
                right:  [16, 17, 1, 3],
                left:   [21, 17, 1, 3],
                top:    [17, 16, 4, 1],
                bottom: [21, 16, 4, 1],
                front:  [17, 17, 4, 3],
                back:   [22, 17, 4, 3]
            },
            body: {
                // Body is rotated 90 degrees in model space
                right:  [28, 8, 8, 16],
                left:   [52, 8, 8, 16],
                top:    [36, 8, 10, 8],   // Actually back when rotated
                bottom: [46, 8, 10, 8],   // Actually belly when rotated
                front:  [36, 16, 10, 8],
                back:   [56, 16, 10, 8]
            },
            rightFrontLeg: {
                right:  [0, 20, 4, 6],
                left:   [8, 20, 4, 6],
                top:    [4, 16, 4, 4],
                bottom: [8, 16, 4, 4],
                front:  [4, 20, 4, 6],
                back:   [12, 20, 4, 6]
            },
            leftFrontLeg: {
                // Same UV as right (mirrored in geometry)
                right:  [0, 20, 4, 6],
                left:   [8, 20, 4, 6],
                top:    [4, 16, 4, 4],
                bottom: [8, 16, 4, 4],
                front:  [4, 20, 4, 6],
                back:   [12, 20, 4, 6]
            },
            rightBackLeg: {
                right:  [0, 20, 4, 6],
                left:   [8, 20, 4, 6],
                top:    [4, 16, 4, 4],
                bottom: [8, 16, 4, 4],
                front:  [4, 20, 4, 6],
                back:   [12, 20, 4, 6]
            },
            leftBackLeg: {
                right:  [0, 20, 4, 6],
                left:   [8, 20, 4, 6],
                top:    [4, 16, 4, 4],
                bottom: [8, 16, 4, 4],
                front:  [4, 20, 4, 6],
                back:   [12, 20, 4, 6]
            }
        };

        return uvMaps[partName] || null;
    },

    getGroundOffset: function(scaleY, modelScale, universalScale) {
        return 6 * scaleY * modelScale * universalScale;
    },

    applyAnimation: function(character, animState, time, options) {
        const parts = character.parts;

        switch (animState) {
            case 'walk':
                const walk = Math.sin(time * 2);
                if (parts.rightFrontLeg) parts.rightFrontLeg.rotation.x = walk * 0.6;
                if (parts.leftFrontLeg) parts.leftFrontLeg.rotation.x = -walk * 0.6;
                if (parts.rightBackLeg) parts.rightBackLeg.rotation.x = -walk * 0.6;
                if (parts.leftBackLeg) parts.leftBackLeg.rotation.x = walk * 0.6;
                if (parts.head) parts.head.rotation.y = Math.sin(time) * 0.1;
                break;
            case 'idle':
                // Pig looks around, ears twitch
                const look = Math.sin(time * 0.5) * 0.3;
                if (parts.head) {
                    parts.head.rotation.y = look;
                    parts.head.rotation.x = Math.sin(time * 0.8) * 0.05;
                }
                break;
            default:
                break;
        }
    }
};

console.log('Pig model definition loaded');
