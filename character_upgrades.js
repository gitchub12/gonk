// BROWSERFIREFOXHIDE character_upgrades.js

class CharacterUpgrades {
    constructor() {
        this.nodes = [];
        this.purchasedNodes = new Set();
        this.pendingPurchases = new Set(); // Track unconfirmed purchases
        this.loadNodes();
        this.nodeImageCache = new Map();

        // Auto-unlock all Carry powers for testing
        this.autoUnlockCarryPowers();

        // Setup UI button handlers
        this.setupButtonHandlers();
    }

    autoUnlockCarryPowers() {
        // Wait for nodes AND game state to load, then unlock all carry powers
        const checkReady = setInterval(() => {
            if (this.nodes.length > 0 && window.game && window.game.state && window.game.state.playerStats) {
                clearInterval(checkReady);

                // Find and auto-purchase all carry nodes (including carry_uniques)
                const carryNodes = ['storage_starter', 'carry_pistol', 'carry_rifle', 'carry_longarm', 'carry_uniques', 'carry_saber'];
                carryNodes.forEach(nodeId => {
                    const node = this.nodes.find(n => n.id === nodeId);
                    if (node) {
                        this.purchasedNodes.add(nodeId);
                        this.applyNodeEffects(node);
                    }
                });
                console.log('Auto-unlocked Carry powers for testing');

                // Auto-unlock social training and pamphlet speed
                const socialNode = this.nodes.find(n => n.id === 'social_starter');
                if (socialNode) {
                    this.purchasedNodes.add('social_starter');
                    this.applyNodeEffects(socialNode);
                    console.log('Auto-unlocked Social Training');
                }

                const pamphletSpeedNode = this.nodes.find(n => n.id === 'pamphlet_speed_1');
                if (pamphletSpeedNode) {
                    this.purchasedNodes.add('pamphlet_speed_1');
                    this.applyNodeEffects(pamphletSpeedNode);
                    console.log('Auto-unlocked Pamphlet Speed');
                }

                // Auto-unlock slicing starter for testing
                const slicingStarterNode = this.nodes.find(n => n.id === 'slicing_starter');
                if (slicingStarterNode) {
                    this.purchasedNodes.add('slicing_starter');
                    this.applyNodeEffects(slicingStarterNode);
                    console.log('Auto-unlocked Slicing Training');
                }
            }
        }, 100);
    }

    setupButtonHandlers() {
        // Close button handler
        const closeBtn = document.getElementById('upgrade-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                if (window.game) {
                    window.game.toggleCharacterSheet();
                }
            });
        }

        // Undo button handler
        const undoBtn = document.getElementById('upgrade-undo-btn');
        if (undoBtn) {
            undoBtn.addEventListener('click', () => {
                this.undoPendingPurchases();
            });
        }

        // Confirm button handler
        const confirmBtn = document.getElementById('upgrade-confirm-btn');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => {
                this.confirmPendingPurchases();
            });
        }
    }

    undoPendingPurchases() {
        // Remove all pending purchases and revert their effects
        this.pendingPurchases.forEach(nodeId => {
            const node = this.nodes.find(n => n.id === nodeId);
            if (node) {
                // Refund wire cost using actual cost calculation
                if (window.game && window.game.state) {
                    window.game.state.wire += this.getNodeCost(node);
                }
                this.revertNodeEffects(node);
                this.purchasedNodes.delete(nodeId);
            }
        });
        this.pendingPurchases.clear();
        this.hideActionButtons();
        this.drawUpgradeUI();
        console.log('Pending purchases undone and wire refunded');
    }

    confirmPendingPurchases() {
        // Confirm all pending purchases (they're already applied, just clear pending status)
        this.pendingPurchases.clear();
        this.hideActionButtons();
        console.log('Purchases confirmed');
    }

    showActionButtons() {
        const actionButtons = document.getElementById('upgrade-action-buttons');
        if (actionButtons) {
            actionButtons.style.display = 'flex';
        }
    }

    hideActionButtons() {
        const actionButtons = document.getElementById('upgrade-action-buttons');
        if (actionButtons) {
            actionButtons.style.display = 'none';
        }
    }

    revertNodeEffects(node) {
        // Revert the effects of a node (opposite of applyNodeEffects)
        if (!node.effects || !window.game || !window.game.state || !window.game.state.playerStats) return;

        const effects = node.effects;
        const stats = window.game.state.playerStats;

        // Revert stat changes
        if (effects.max_health) stats.max_health -= effects.max_health;
        if (effects.max_energy) stats.max_energy -= effects.max_energy;
        if (effects.max_modules) stats.max_modules -= effects.max_modules;

        // Revert weapon slots
        if (effects.weapon_slots && window.playerWeaponSystem) {
            window.playerWeaponSystem.removeSlots(effects.weapon_slots);
        }

        // Note: Some effects like starting_weapon can't be easily reverted
        console.log(`Reverted effects for node: ${node.id}`);
    }

    async loadNodes() {
        try {
            const response = await fetch('data/upgrade_nodes.json');
            const data = await response.json();
            this.nodes = data.nodes;
            this.preloadNodeImages();
            console.log('Upgrade nodes loaded successfully.');
        } catch (error) {
            console.error('Error loading upgrade nodes:', error);
        }
    }

    preloadNodeImages() {
        this.nodes.forEach(node => {
            if (node.icon) {
                const img = new Image();
                img.src = node.icon;
                img.onload = () => {
                    this.nodeImageCache.set(node.id, { img, loaded: true });
                };
                img.onerror = () => {
                    this.nodeImageCache.set(node.id, { loaded: false });
                };
            } else {
                this.nodeImageCache.set(node.id, { loaded: false });
            }
        });
    }

    // Calculate actual cost based on column position (2^column)
    getNodeCost(node) {
        const column = node.position.x;
        return Math.pow(2, column);
    }

    purchaseNode(nodeId) {
        const node = this.nodes.find(n => n.id === nodeId);
        if (!node) return;

        const actualCost = this.getNodeCost(node);
        if (this.canPurchaseNode(nodeId)) {
            if (game.state.wire >= actualCost) {
                game.state.wire -= actualCost;
                this.purchasedNodes.add(nodeId);
                this.pendingPurchases.add(nodeId); // Track as pending
                this.applyNodeEffects(node);
                console.log(`Purchased upgrade: ${node.name}`);
                this.showActionButtons(); // Show Confirm/Undo buttons
                this.drawUpgradeUI();
            } else {
                console.log('Not enough wire to purchase this upgrade.');
                // Optionally show a message to the user in the UI
            }
        } else {
            console.log('Cannot purchase this upgrade yet.');
        }
    }

    severNode(nodeId) {
        const node = this.nodes.find(n => n.id === nodeId);
        if (!node || !this.purchasedNodes.has(nodeId)) return;

        // Check if any other purchased node depends on this one
        const isPrerequisiteForOthers = this.nodes.some(n => 
            this.purchasedNodes.has(n.id) && n.prerequisites.includes(nodeId)
        );

        if (isPrerequisiteForOthers) {
            console.log("Cannot sever this node, other purchased nodes depend on it.");
            // Optionally show a message to the user
            return;
        }

        game.state.wire += Math.floor(this.getNodeCost(node) / 2);
        this.purchasedNodes.delete(nodeId);
        this.removeNodeEffects(node);
        console.log(`Severed upgrade: ${node.name}`);
        this.drawUpgradeUI();
    }

    canPurchaseNode(nodeId) {
        const node = this.nodes.find(n => n.id === nodeId);
        if (!node || this.purchasedNodes.has(nodeId)) return false;

        return node.prerequisites.every(prereqId => this.purchasedNodes.has(prereqId));
    }

    applyNodeEffects(node) {
        for (const effect in node.effects) {
            const value = node.effects[effect];
            console.log(`Applying effect: ${effect} = ${value}`);
            
            const applyBonus = (statName, val) => {
                if (!game.state.playerStats[statName]) game.state.playerStats[statName] = 0;
                game.state.playerStats[statName] += val;
            };

            switch (effect) {
                // STORAGE & WEAPONS
                case 'unlock_slot':
                    const categoryIndex = window.playerWeaponSystem.categories.indexOf(value);
                    if (categoryIndex !== -1) {
                        window.playerWeaponSystem.unlockedSlots = Math.max(window.playerWeaponSystem.unlockedSlots, categoryIndex + 1);
                        if (window.playerWeaponSystem.slotCapacity[categoryIndex] === 0) {
                            window.playerWeaponSystem.slotCapacity[categoryIndex] = 1;
                        }
                    }
                    break;
                case 'add_extra_slot':
                    const extraSlotIndex = window.playerWeaponSystem.categories.indexOf(value);
                    if (extraSlotIndex !== -1) {
                        window.playerWeaponSystem.slotCapacity[extraSlotIndex]++;
                    }
                    break;
                case 'mass_storage':
                    if (value) {
                        for (let i = 0; i < window.playerWeaponSystem.slotCapacity.length; i++) {
                            if (window.playerWeaponSystem.slotCapacity[i] > 1) {
                                window.playerWeaponSystem.slotCapacity[i]++;
                            }
                        }
                    }
                    break;
                case 'starting_weapon':
                    window.playerWeaponSystem.setStartingWeapon(value.category, value.weapon);
                    break;
                case 'max_modules':
                    game.state.playerStats.max_modules = value;
                    break;
                case 'pamphlet_generator':
                    game.state.playerStats.pamphlet_generator = value;
                    break;
                case 'spare_core':
                    // Add spare cores (extra lives)
                    if (!game.state.playerStats.spare_cores) {
                        game.state.playerStats.spare_cores = 0;
                    }
                    game.state.playerStats.spare_cores += value;
                    // Update the spare core display
                    const spareCoreCount = document.getElementById('spare-core-count');
                    if (spareCoreCount) {
                        spareCoreCount.textContent = game.state.playerStats.spare_cores;
                    }
                    break;
                case 'neighborhood_watch':
                    // Unlock vision of all ships behind player
                    game.state.playerStats.neighborhood_watch = value;
                    break;
                case 'spy_network':
                    // Unlock vision of up to 8 ships ahead
                    game.state.playerStats.spy_network = value;
                    break;
                case 'prophets':
                    // Enable ally-based ship control bonus
                    game.state.playerStats.prophets = value;
                    break;
                case 'slicing_skill':
                    // Increase slicing ability
                    if (!game.state.playerStats.slicing_skill) game.state.playerStats.slicing_skill = 0;
                    game.state.playerStats.slicing_skill += value;
                    break;
                case 'slicing_speed_bonus':
                    // Increase slicing speed
                    if (!game.state.playerStats.slicing_speed_bonus) game.state.playerStats.slicing_speed_bonus = 0;
                    game.state.playerStats.slicing_speed_bonus += value;
                    break;
                case 'slicing_silent':
                    // Enable silent slicing
                    game.state.playerStats.slicing_silent = value;
                    break;

                // GONK
                case 'max_energy':
                    game.state.maxEnergy += value;
                    game.state.energy += value;
                    break;
                // ... (rest of the cases from previous step)
                default:
                    console.warn(`Unknown upgrade effect: ${effect}`);
            }
        }
        game.updateCharacterSheet();
    }

    removeNodeEffects(node) {
        // This is the inverse of applyNodeEffects
        for (const effect in node.effects) {
            const value = node.effects[effect];
            console.log(`Removing effect: ${effect} = ${value}`);

            const removeBonus = (statName, val) => {
                if (game.state.playerStats[statName]) {
                    game.state.playerStats[statName] -= val;
                }
            };

            switch (effect) {
                // STORAGE & WEAPONS
                case 'unlock_slot':
                    // NOTE: For simplicity, we don't re-lock slots. Severing a chain is complex.
                    // We could disable the slot, but that has its own UI/UX challenges.
                    // For now, the wire is refunded, but the slot remains accessible if unlocked.
                    break;
                case 'add_extra_slot':
                    const extraSlotIndex = window.playerWeaponSystem.categories.indexOf(value);
                    if (extraSlotIndex !== -1) {
                        window.playerWeaponSystem.slotCapacity[extraSlotIndex]--;
                    }
                    break;
                case 'mass_storage':
                     if (value) {
                        for (let i = 0; i < window.playerWeaponSystem.slotCapacity.length; i++) {
                            if (window.playerWeaponSystem.slotCapacity[i] > 2) { // Assumes mass storage adds the 3rd slot
                                window.playerWeaponSystem.slotCapacity[i]--;
                            }
                        }
                    }
                    break;
                case 'starting_weapon':
                    // This is tricky. We can't easily know what the "previous" starting weapon was.
                    // For now, we'll do nothing, the player just loses the benefit.
                    break;
                case 'max_modules':
                    // Similar to above, we don't know the previous value. Assume it reverts to a base.
                    game.state.playerStats.max_modules = 4; // Revert to base
                    break;
                case 'pamphlet_generator':
                    game.state.playerStats.pamphlet_generator = false;
                    break;
                case 'spare_core':
                    // Remove spare cores
                    if (game.state.playerStats.spare_cores) {
                        game.state.playerStats.spare_cores -= value;
                        // Update the spare core display
                        const spareCoreCount = document.getElementById('spare-core-count');
                        if (spareCoreCount) {
                            spareCoreCount.textContent = game.state.playerStats.spare_cores;
                        }
                    }
                    break;
                case 'neighborhood_watch':
                    game.state.playerStats.neighborhood_watch = 0;
                    break;
                case 'spy_network':
                    game.state.playerStats.spy_network = 0;
                    break;
                case 'prophets':
                    game.state.playerStats.prophets = 0;
                    break;
                case 'slicing_skill':
                    if (game.state.playerStats.slicing_skill) {
                        game.state.playerStats.slicing_skill -= value;
                    }
                    break;
                case 'slicing_speed_bonus':
                    if (game.state.playerStats.slicing_speed_bonus) {
                        game.state.playerStats.slicing_speed_bonus -= value;
                    }
                    break;
                case 'slicing_silent':
                    game.state.playerStats.slicing_silent = false;
                    break;

                // GONK
                case 'max_energy':
                    game.state.maxEnergy -= value;
                    game.state.energy = Math.min(game.state.energy, game.state.maxEnergy);
                    break;
                // ... (rest of the cases from previous step)
                default:
                    console.warn(`Unknown upgrade effect to remove: ${effect}`);
            }
        }
        game.updateCharacterSheet();
    }

    drawUpgradeUI() {
        const container = document.getElementById('upgrade-container');
        const tooltip = document.getElementById('upgrade-tooltip');
        const closeBtn = document.getElementById('upgrade-close-btn');
        if (!container || !tooltip) {
            console.error('Required UI elements (upgrade-container or upgrade-tooltip) not found!');
            return;
        }
        container.innerHTML = ''; // Clear previous content

        // Show close button
        if (closeBtn) closeBtn.style.display = 'block';

        const GRID_SPACING_X = 104; // Horizontal spacing for 12 columns (0-11)
        const GRID_SPACING_Y = 32; // Vertical spacing to fit rows 0-22 on screen
        const NODE_SIZE = 50; // Square nodes (50px - smaller to fit rows 0-22)
        const NODE_WIDTH = NODE_SIZE;
        const NODE_HEIGHT = NODE_SIZE;
        const TOP_PADDING = 10; // 10px from top of screen
        const BOTTOM_PADDING = 5; // 5px gap at bottom

        // DEBUG: Draw grid dots (extend to show full range including row 22)
        for (let row = 0; row < 23; row++) {
            for (let col = 0; col < 12; col++) {
                const dot = document.createElement('div');
                dot.style.position = 'absolute';
                dot.style.left = `${col * GRID_SPACING_X}px`;
                dot.style.top = `${TOP_PADDING + row * GRID_SPACING_Y}px`;
                dot.style.width = '12px';
                dot.style.height = '12px';
                dot.style.fontSize = '8px';
                dot.style.color = '#666';
                dot.style.pointerEvents = 'none';
                dot.textContent = `${col},${row}`;
                container.appendChild(dot);
            }
        }

        // Draw lines first so they are behind nodes
        this.drawConnections(container, GRID_SPACING_X, GRID_SPACING_Y, NODE_WIDTH, NODE_HEIGHT, TOP_PADDING);

        this.nodes.forEach(node => {
            const nodeElement = document.createElement('div');
            nodeElement.className = 'upgrade-node';
            nodeElement.style.left = `${node.position.x * GRID_SPACING_X}px`;
            nodeElement.style.top = `${TOP_PADDING + node.position.y * GRID_SPACING_Y}px`;
            nodeElement.style.width = `${NODE_WIDTH}px`;
            nodeElement.style.height = `${NODE_HEIGHT}px`;

            const cachedImage = this.nodeImageCache.get(node.id);
            if (cachedImage && cachedImage.loaded) {
                nodeElement.style.backgroundImage = `url('${cachedImage.img.src}')`;
            } else {
                // Fallback to colored box with text
                nodeElement.style.backgroundColor = node.color || '#333';
                nodeElement.textContent = node.name;
                nodeElement.classList.add('fallback');
                // Add black text for white/light gray backgrounds
                if (node.color === '#FFFFFF' || node.color === '#adb5bd') {
                    nodeElement.style.color = '#000';
                }
            }

            if (this.purchasedNodes.has(node.id)) {
                nodeElement.classList.add('purchased');
            } else if (this.canPurchaseNode(node.id)) {
                nodeElement.classList.add('available');
            }

            nodeElement.onmousemove = (e) => {
                // Build tooltip with icon if available
                let tooltipHTML = '';
                if (node.icon) {
                    // Show full-size icon, not squished, using object-fit to maintain aspect ratio
                    tooltipHTML += `<img src="${node.icon}" style="max-width: 128px; max-height: 128px; display: block; margin: 0 auto 10px; image-rendering: pixelated; object-fit: contain;">`;
                }
                const actualCost = this.getNodeCost(node);
                tooltipHTML += `<h3>${node.name}</h3><p>${node.description}</p><p class="cost">Cost: ${actualCost} wire</p>`;

                tooltip.innerHTML = tooltipHTML;
                tooltip.style.display = 'block';
                tooltip.style.left = `${e.clientX + 15}px`;

                // Position tooltip above node if row >= 9, below if row < 9
                if (node.position.y >= 9) {
                    // Position above the cursor
                    tooltip.style.top = `${e.clientY - tooltip.offsetHeight - 10}px`;
                } else {
                    // Position below the cursor
                    tooltip.style.top = `${e.clientY + 15}px`;
                }
            };

            nodeElement.onmouseout = () => {
                tooltip.style.display = 'none';
            };

            nodeElement.onclick = () => {
                this.purchaseNode(node.id);
            };

            nodeElement.oncontextmenu = (e) => {
                e.preventDefault();
                this.severNode(node.id);
            };

            container.appendChild(nodeElement);
        });
    }

    drawConnections(container, spacingX, spacingY, nodeWidth, nodeHeight, topPadding = 0) {
        const svgNS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNS, "svg");
        svg.style.position = 'absolute';
        svg.style.top = 0;
        svg.style.left = 0;
        svg.style.width = '100%';
        svg.style.height = '100%';
        svg.style.pointerEvents = 'none';

        this.nodes.forEach(node => {
            node.prerequisites.forEach(prereqId => {
                const prereqNode = this.nodes.find(n => n.id === prereqId);
                if (prereqNode) {
                    const line = document.createElementNS(svgNS, 'line');
                    const x1 = node.position.x * spacingX + nodeWidth / 2;
                    const y1 = topPadding + node.position.y * spacingY + nodeHeight / 2;
                    const x2 = prereqNode.position.x * spacingX + nodeWidth / 2;
                    const y2 = topPadding + prereqNode.position.y * spacingY + nodeHeight / 2;

                    line.setAttribute('x1', x1);
                    line.setAttribute('y1', y1);
                    line.setAttribute('x2', x2);
                    line.setAttribute('y2', y2);
                    line.setAttribute('stroke', '#555');
                    line.setAttribute('stroke-width', '2');

                    if (this.purchasedNodes.has(node.id) && this.purchasedNodes.has(prereqId)) {
                        line.classList.add('active');
                        line.setAttribute('stroke', '#ffc107');
                    }
                    svg.appendChild(line);
                }
            });
        });
        container.appendChild(svg);
    }
}

// Instantiate the upgrade system
window.characterUpgrades = new CharacterUpgrades();
