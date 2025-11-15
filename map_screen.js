// BROWSERFIREFOXHIDE map_screen.js

class MapScreen {
    constructor() {
        this.canvas = document.getElementById('map-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.isVisible = false;
        this.scrollOffset = 0;
        this.shipData = this.generateShipData();

        // Layout constants
        this.shipWidth = 60; // Thinner ships
        this.shipHeight = 50;
        this.shipSpacing = 5; // Minimal spacing (short hallway)
        this.rowSpacing = 30; // Distance between L and R rows (closer together)

        // Ship destruction tracking (for entire run)
        this.destroyedShips = new Set(); // Ships destroyed this run

        this.factionIcons = {};
        this.loadFactionIcons();

        // Bind methods
        this.onWheel = this.onWheel.bind(this);
        this.onResize = this.onResize.bind(this);
    }

    generateShipData() {
        const factions = ['rebels', 'imperials', 'clones', 'mandolorians', 'sith', 'aliens', 'droids', 'takers'];
        const relationships = ['+', '-', '='];
        const ships = {};

        // Level 1 (no L/R)
        ships[1] = {
            level: 1,
            label: '1',
            dominantFaction: factions[Math.floor(Math.random() * factions.length)],
            secondaryFaction: factions[Math.floor(Math.random() * factions.length)],
            relationship: relationships[Math.floor(Math.random() * relationships.length)],
            control_percentage: 50 + Math.floor(Math.random() * 40) // 50-90%
        };

        // Levels 2-49 (L and R variants)
        // Default to Imperials (60%) vs Rebels (40%) at war for ships without level files
        for (let i = 2; i <= 49; i++) {
            ships[`${i}L`] = {
                level: i,
                side: 'L',
                label: `${i}L`,
                dominantFaction: 'imperials',
                secondaryFaction: 'rebels',
                relationship: '-',
                control_percentage: 60
            };
            ships[`${i}R`] = {
                level: i,
                side: 'R',
                label: `${i}R`,
                dominantFaction: 'imperials',
                secondaryFaction: 'rebels',
                relationship: '-',
                control_percentage: 60
            };
        }

        // Level 50 (no L/R)
        ships[50] = {
            level: 50,
            label: '50',
            dominantFaction: factions[Math.floor(Math.random() * factions.length)],
            secondaryFaction: factions[Math.floor(Math.random() * factions.length)],
            relationship: relationships[Math.floor(Math.random() * relationships.length)],
            control_percentage: 50 + Math.floor(Math.random() * 40) // 50-90%
        };

        return ships;
    }

    async loadFactionIcons() {
        const factions = ['rebels', 'imperials', 'clones', 'mandolorians', 'sith', 'aliens', 'droids', 'takers'];

        for (const faction of factions) {
            // Load h1 (happy) icon
            const h1Path = `data/pngs/factions/${faction}/h1`;
            const m1Path = `data/pngs/factions/${faction}/m1`;

            // Find first file in h1 directory (lowest number)
            // For now, construct expected path - we'll need to make this more dynamic
            const h1Icon = new Image();
            const m1Icon = new Image();

            // Placeholder - we'll load these dynamically
            this.factionIcons[faction] = {
                happy: h1Icon,
                mad: m1Icon
            };
        }
    }


    toggle() {
        this.isVisible = !this.isVisible;
        const mapScreen = document.getElementById('map-screen');

        if (this.isVisible) {
            // Close character sheet if it's open (mutually exclusive)
            const wrapper = document.getElementById('character-page-wrapper');
            if (wrapper && wrapper.style.display === 'flex') {
                window.game.toggleCharacterSheet();
            }

            mapScreen.style.display = 'block';
            this.resizeCanvas();
            this.render();
            window.addEventListener('wheel', this.onWheel, { passive: false });
            window.addEventListener('resize', this.onResize);
        } else {
            mapScreen.style.display = 'none';
            window.removeEventListener('wheel', this.onWheel);
            window.removeEventListener('resize', this.onResize);
        }
    }

    onWheel(e) {
        if (!this.isVisible) return;
        e.preventDefault();
        this.scrollOffset -= e.deltaY * 0.5;
        this.scrollOffset = Math.max(0, Math.min(this.scrollOffset, this.getMaxScroll()));
        this.render();
    }

    onResize() {
        if (this.isVisible) {
            this.resizeCanvas();
            this.render();
        }
    }

    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    getMaxScroll() {
        // Calculate total width of ship chain
        const shipsPerRow = 49; // 2L-49L or 2R-49R
        const totalWidth = (shipsPerRow * (this.shipWidth + this.shipSpacing));
        return Math.max(0, totalWidth - this.canvas.width + 200);
    }

    getFactionColor(faction) {
        // Use actual game faction colors from GAME_GLOBAL_CONSTANTS
        const colors = {
            rebels: '#d94242',
            aliens: '#008000',
            clones: '#ff8c00',
            imperials: '#444444',
            droids: '#0066cc',
            mandolorians: '#FFC72C',
            sith: '#990000',
            takers: '#C0C0C0'
        };
        return colors[faction] || '#666666';
    }

    shouldShowDetails(shipLabel, currentLevel) {
        // Parse ship label to get numeric level
        const shipLevel = parseInt(shipLabel.replace(/[LR]/g, ''));
        const current = parseInt(String(currentLevel).replace(/[LR]/g, ''));

        // Get player stats for vision upgrades
        const playerStats = window.game?.state?.playerStats || {};
        const hasNeighborhoodWatch = playerStats.neighborhood_watch || 0;
        const hasSpyNetwork = playerStats.spy_network || 0;

        // Current ship always visible with details
        if (shipLevel === current) return true;

        // Ships behind (Neighborhood Watch unlocks this)
        if (shipLevel < current && hasNeighborhoodWatch) return true;

        // Ships ahead (default: +1, Spy Network: up to +8)
        const forwardRange = hasSpyNetwork ? 8 : 1;
        if (shipLevel > current && shipLevel <= current + forwardRange) return true;

        // Show all ship images/boxes, but without faction details text
        // User can see all ships on map, just doesn't know faction info without upgrades
        return false;
    }

    render() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        // Clear canvas
        ctx.clearRect(0, 0, w, h);

        // Get current level
        const currentLevel = window.levelManager?.currentLevel || 1;

        // Calculate starting positions
        const startX = 100 - this.scrollOffset;
        const topRowY = h / 3;
        const bottomRowY = h * 2 / 3;
        const centerY = h / 2;

        // Draw L row (2L-49L) - starts where Ship 1 position + half spacing would be
        let xPos = startX;
        const ship1X = xPos;
        const ship1Y = centerY;

        // Position Ship 1 in center, calculate where 2L/2R start
        const ship2X = startX + this.shipWidth + this.shipSpacing;

        // Draw L row (2L-49L)
        xPos = ship2X;
        for (let i = 2; i <= 49; i++) {
            const shipKey = `${i}L`;
            const ship = this.shipData[shipKey];
            if (ship) {
                this.drawShip(ship, xPos, topRowY, currentLevel, true);
                xPos += this.shipWidth + this.shipSpacing;
            }
        }

        // Store position for Ship 50
        const ship50X = xPos;
        const ship49XEnd = xPos;

        // Draw R row (2R-49R) - aligned with L row
        xPos = ship2X;
        for (let i = 2; i <= 49; i++) {
            const shipKey = `${i}R`;
            const ship = this.shipData[shipKey];
            if (ship) {
                this.drawShip(ship, xPos, bottomRowY, currentLevel, false);
                xPos += this.shipWidth + this.shipSpacing;
            }
        }

        // Draw connection lines between L and R ships (doors)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        xPos = ship2X;
        for (let i = 2; i <= 49; i++) {
            const shipCenterX = xPos + this.shipWidth / 2;
            ctx.beginPath();
            ctx.moveTo(shipCenterX, topRowY + this.shipHeight);
            ctx.lineTo(shipCenterX, bottomRowY);
            ctx.stroke();
            xPos += this.shipWidth + this.shipSpacing;
        }

        // Draw Ship 1 in center with connecting lines to 2L and 2R
        const ship1 = this.shipData[1];
        if (ship1) {
            // Draw connecting lines first (behind ship)
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);

            // Line from Ship 1 to 2L
            ctx.beginPath();
            ctx.moveTo(ship1X + this.shipWidth, ship1Y + this.shipHeight / 2);
            ctx.lineTo(ship2X, topRowY + this.shipHeight / 2);
            ctx.stroke();

            // Line from Ship 1 to 2R
            ctx.beginPath();
            ctx.moveTo(ship1X + this.shipWidth, ship1Y + this.shipHeight / 2);
            ctx.lineTo(ship2X, bottomRowY + this.shipHeight / 2);
            ctx.stroke();

            ctx.setLineDash([]); // Reset line dash

            // Draw Ship 1
            this.drawShip(ship1, ship1X, ship1Y, currentLevel, false);
        }

        // Draw Ship 50 in center with connecting lines from 49L and 49R
        const ship50 = this.shipData[50];
        if (ship50) {
            // Draw connecting lines first (behind ship)
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);

            // Line from 49L to Ship 50
            ctx.beginPath();
            ctx.moveTo(ship49XEnd - this.shipSpacing, topRowY + this.shipHeight / 2);
            ctx.lineTo(ship50X, ship1Y + this.shipHeight / 2);
            ctx.stroke();

            // Line from 49R to Ship 50
            ctx.beginPath();
            ctx.moveTo(ship49XEnd - this.shipSpacing, bottomRowY + this.shipHeight / 2);
            ctx.lineTo(ship50X, ship1Y + this.shipHeight / 2);
            ctx.stroke();

            ctx.setLineDash([]); // Reset line dash

            // Draw Ship 50
            this.drawShip(ship50, ship50X, ship1Y, currentLevel, false);
        }

        // Draw title
        ctx.fillStyle = '#61afef';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('SHIP CHAIN MAP', w / 2, 40);
        ctx.font = '16px Arial';
        ctx.fillText('Use mousewheel to scroll | Press M to close', w / 2, 70);
    }

    drawShip(ship, x, y, currentLevel, isTopRow) {
        const ctx = this.ctx;
        const isCurrentShip = ship.label === String(currentLevel) || ship.label === `${currentLevel}L` || ship.label === `${currentLevel}R`;
        const showDetails = this.shouldShowDetails(ship.label, currentLevel);
        const isDestroyed = this.destroyedShips.has(ship.label);

        // Draw base ship rectangle (dark gray background)
        ctx.fillStyle = 'rgba(80, 80, 80, 0.6)';
        ctx.fillRect(x, y, this.shipWidth, this.shipHeight);

        // Draw faction control overlays (split by control_percentage)
        const controlPercent = ship.control_percentage || 50;
        const splitPoint = (controlPercent / 100) * this.shipWidth;

        // Dominant faction overlay (left side)
        const hexColor1 = this.getFactionColor(ship.dominantFaction);
        let r = parseInt(hexColor1.slice(1, 3), 16);
        let g = parseInt(hexColor1.slice(3, 5), 16);
        let b = parseInt(hexColor1.slice(5, 7), 16);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.4)`;
        ctx.fillRect(x, y, splitPoint, this.shipHeight);

        // Secondary faction overlay (right side)
        const hexColor2 = this.getFactionColor(ship.secondaryFaction);
        r = parseInt(hexColor2.slice(1, 3), 16);
        g = parseInt(hexColor2.slice(3, 5), 16);
        b = parseInt(hexColor2.slice(5, 7), 16);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.4)`;
        ctx.fillRect(x + splitPoint, y, this.shipWidth - splitPoint, this.shipHeight);

        // Draw vertical divider line at split point
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + splitPoint, y);
        ctx.lineTo(x + splitPoint, y + this.shipHeight);
        ctx.stroke();

        // Highlight current ship
        if (isCurrentShip) {
            ctx.strokeStyle = '#FFD700';
            ctx.lineWidth = 4;
            ctx.strokeRect(x - 2, y - 2, this.shipWidth + 4, this.shipHeight + 4);
        } else {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, this.shipWidth, this.shipHeight);
        }

        // Draw X over destroyed ships
        if (isDestroyed) {
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(x + 5, y + 5);
            ctx.lineTo(x + this.shipWidth - 5, y + this.shipHeight - 5);
            ctx.moveTo(x + this.shipWidth - 5, y + 5);
            ctx.lineTo(x + 5, y + this.shipHeight - 5);
            ctx.stroke();
        }

        // Draw ship label (black text on light ships, white on dark)
        const factionColor = this.getFactionColor(ship.dominantFaction);
        const isLightShip = factionColor === '#C0C0C0' || factionColor === '#FFC72C'; // takers, mandalorians
        ctx.fillStyle = isLightShip ? '#000000' : '#ffffff';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(ship.label, x + this.shipWidth / 2, y + this.shipHeight / 2);

        // Draw faction details if visible
        if (showDetails) {
            this.drawFactionDetails(ship, x, y, isTopRow);
        }
    }

    markShipDestroyed(shipLabel) {
        this.destroyedShips.add(shipLabel);
        console.log(`Ship ${shipLabel} marked as destroyed`);
    }

    clearDestroyedShips() {
        this.destroyedShips.clear();
        console.log('Cleared all destroyed ships (run reset)');
    }

    shiftShipControl(shipLabel) {
        const ship = this.shipData[shipLabel];
        if (!ship) return;

        // Roll 3d6 (3-18)
        const roll = (Math.floor(Math.random() * 6) + 1) +
                     (Math.floor(Math.random() * 6) + 1) +
                     (Math.floor(Math.random() * 6) + 1);

        // Convert roll to percentage shift: 3 = -3%, 18 = +15%
        // Linear mapping: shift = -3 + ((roll - 3) / 15) * 18
        const shift = -3 + ((roll - 3) / 15) * 18;

        // Determine which faction has worse relationship with player
        const factionManager = window.factionManager;
        if (!factionManager) return;

        const playerFaction = 'player'; // Assuming player faction is 'player'
        const dominantScore = factionManager.getRelationshipScore(playerFaction, ship.dominantFaction);
        const secondaryScore = factionManager.getRelationshipScore(playerFaction, ship.secondaryFaction);

        // Higher score = worse relationship (more hostile)
        const hostileFactionIsDominant = dominantScore > secondaryScore;

        // Apply shift toward the hostile faction
        let newControl = ship.control_percentage;
        if (hostileFactionIsDominant) {
            // Dominant faction is hostile, so they gain control
            newControl += shift;
        } else {
            // Secondary faction is hostile, so dominant faction loses control
            newControl -= shift;
        }

        // Clamp between 10% and 90%
        newControl = Math.max(10, Math.min(90, newControl));

        // Check if we need to apply Prophets bonus
        const playerStats = window.game?.state?.playerStats || {};
        if (playerStats.prophets) {
            // Count allies of the friendly faction
            const friendlyFaction = hostileFactionIsDominant ? ship.secondaryFaction : ship.dominantFaction;
            const allyCount = this.countAlliesOfFaction(friendlyFaction);
            const prophetBonus = allyCount * 2;

            // Apply bonus toward friendly faction
            if (hostileFactionIsDominant) {
                newControl -= prophetBonus;
            } else {
                newControl += prophetBonus;
            }

            newControl = Math.max(10, Math.min(90, newControl));
            console.log(`Prophets bonus: ${allyCount} allies × 2 = ${prophetBonus}% toward ${friendlyFaction}`);
        }

        const oldControl = ship.control_percentage;
        ship.control_percentage = Math.round(newControl);

        console.log(`Ship ${shipLabel} control shifted: ${oldControl}% → ${ship.control_percentage}% (roll: ${roll}, shift: ${shift.toFixed(1)}%)`);

        // Re-render map if it's visible
        if (this.isVisible) {
            this.render();
        }
    }

    countAlliesOfFaction(factionName) {
        // Count NPCs in player's ally list that belong to the specified faction
        const game = window.game;
        if (!game || !game.allies) return 0;

        return game.allies.filter(ally => ally.faction === factionName).length;
    }

    drawFactionDetails(ship, x, y, isTopRow) {
        const ctx = this.ctx;
        const baseY = isTopRow ? y - 50 : y + this.shipHeight + 20;
        const centerX = x + this.shipWidth / 2;

        // Stack vertically: Dominant faction (top), relationship symbol (middle, large), secondary faction (bottom)
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Draw dominant faction name (capitalized) in its color
        const faction1Color = this.getFactionColor(ship.dominantFaction);
        ctx.fillStyle = faction1Color;
        ctx.font = 'bold 10px Arial';
        ctx.fillText(ship.dominantFaction.toUpperCase(), centerX, baseY);

        // Draw relationship symbol (larger, more visible)
        ctx.fillStyle = ship.relationship === '+' ? '#00ff00' : ship.relationship === '-' ? '#ff0000' : '#ffff00';
        ctx.font = 'bold 18px Arial';
        ctx.fillText(ship.relationship, centerX, baseY + 15);

        // Draw secondary faction name (capitalized) in its color
        const faction2Color = this.getFactionColor(ship.secondaryFaction);
        ctx.fillStyle = faction2Color;
        ctx.font = 'bold 10px Arial';
        ctx.fillText(ship.secondaryFaction.toUpperCase(), centerX, baseY + 30);
    }
}

// Initialize map screen
window.mapScreen = null;

// Will be initialized after game loads
function initMapScreen() {
    window.mapScreen = new MapScreen();
}
