// BROWSERFIREFOXHIDE data/models/creeper/creeper.js
window.CreeperModel = {
    name: 'creeper',
    textureWidth: 64,
    textureHeight: 32,
    parts: {
        head: { size: [8, 8, 8], uvOffset: [0, 0], position: [0, 18, 0], pivot: [0, 18, 0], parent: 'body' },
        body: { size: [4, 12, 8], uvOffset: [16, 16], position: [0, 6, 0], pivot: [0, 12, 0], parent: null },
        frontRightLeg: { size: [4, 6, 4], uvOffset: [0, 16], position: [-2, 0, -2], pivot: [-2, 6, -2], parent: 'body' },
        frontLeftLeg: { size: [4, 6, 4], uvOffset: [0, 16], position: [2, 0, -2], pivot: [2, 6, -2], parent: 'body' },
        backRightLeg: { size: [4, 6, 4], uvOffset: [0, 16], position: [-2, 0, 2], pivot: [-2, 6, 2], parent: 'body' },
        backLeftLeg: { size: [4, 6, 4], uvOffset: [0, 16], position: [2, 0, 2], pivot: [2, 6, 2], parent: 'body' }
    },
    scale: 0.0625, animationSpeed: 1.0,
    getUVMap: function(partName, isOverlay = false) {
        if (isOverlay) return null;
        const part = this.parts[partName];
        if (!part || !part.uvOffset) return null;
        const [width, height, depth] = part.size;
        const [u, v] = part.uvOffset;
        return {
            left: [u, v + depth, depth, height], right: [u + depth + width, v + depth, depth, height],
            top: [u + depth, v, width, depth], bottom: [u + depth + width, v, width, depth],
            front: [u + depth, v + depth, width, height], back: [u + depth + width + depth, v + depth, width, height]
        };
    },
    getGroundOffset: function(scaleY, modelScale, universalScale) { return 18 * scaleY * modelScale * universalScale; },
    applyAnimation: function(character, animState, time, options) {
        const parts = character.parts;
        switch (animState) {
            case 'walk':
                const walk = Math.sin(time * 3);
                if (parts.frontRightLeg) parts.frontRightLeg.rotation.x = walk * 0.6;
                if (parts.frontLeftLeg) parts.frontLeftLeg.rotation.x = -walk * 0.6;
                if (parts.backRightLeg) parts.backRightLeg.rotation.x = -walk * 0.6;
                if (parts.backLeftLeg) parts.backLeftLeg.rotation.x = walk * 0.6;
                break;
            case 'idle':
                if (parts.head) parts.head.rotation.y = Math.sin(time * 0.5) * 0.02;
                break;
            case 'attack':
                const swell = 1.0 + Math.sin(time * 10) * 0.1;
                Object.values(parts).forEach(p => p && p.scale && p.scale.set(swell, swell, swell));
                break;
        }
    }
};
console.log('Creeper model definition loaded');
