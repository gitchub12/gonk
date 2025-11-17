// BROWSERFIREFOXHIDE slicing_system.js

class SlicingTerminal {
    constructor(position, difficulty = 1, properties = {}) {
        this.position = position.clone ? position.clone() : new THREE.Vector3(position.x, position.y, position.z);
        this.difficulty = difficulty; // 1-5, requires matching slicing_skill level
        this.properties = properties;
        this.isSliced = false;
        this.linkedSpawnPointId = properties.linkedSpawnPointId || null;
        this.linkedDoorId = properties.linkedDoorId || null;
        this.type = properties.type || 'spawn_control'; // spawn_control, door_unlock, data_terminal

        // Create visual representation
        this.mesh = this.createMesh();
        this.mesh.userData.isSlicingTerminal = true;
        this.mesh.userData.terminal = this;
    }

    createMesh() {
        // Create a terminal console mesh
        const group = new THREE.Group();

        // Base console
        const baseGeom = new THREE.BoxGeometry(0.4, 0.6, 0.3);
        const baseMat = new THREE.MeshLambertMaterial({
            color: this.isSliced ? 0x00ff00 : 0xff6600
        });
        const base = new THREE.Mesh(baseGeom, baseMat);
        base.position.y = 0.3;
        group.add(base);

        // Screen
        const screenGeom = new THREE.PlaneGeometry(0.3, 0.2);
        const screenMat = new THREE.MeshBasicMaterial({
            color: this.isSliced ? 0x00ff88 : 0x00ffff,
            emissive: this.isSliced ? 0x00ff88 : 0x00ffff
        });
        const screen = new THREE.Mesh(screenGeom, screenMat);
        screen.position.set(0, 0.45, 0.16);
        group.add(screen);

        // Difficulty indicator (small spheres)
        for (let i = 0; i < this.difficulty; i++) {
            const indicatorGeom = new THREE.SphereGeometry(0.03);
            const indicatorMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
            const indicator = new THREE.Mesh(indicatorGeom, indicatorMat);
            indicator.position.set(-0.12 + (i * 0.06), 0.55, 0.16);
            group.add(indicator);
        }

        group.position.copy(this.position);
        return group;
    }

    updateVisuals() {
        // Update colors to show sliced state
        if (this.mesh && this.mesh.children.length > 0) {
            // Base color
            this.mesh.children[0].material.color.setHex(this.isSliced ? 0x00ff00 : 0xff6600);
            // Screen color
            if (this.mesh.children[1]) {
                this.mesh.children[1].material.color.setHex(this.isSliced ? 0x00ff88 : 0x00ffff);
            }
        }
    }

    canSlice(playerSlicingSkill) {
        return !this.isSliced && playerSlicingSkill >= this.difficulty;
    }

    slice() {
        if (this.isSliced) return false;

        this.isSliced = true;
        this.updateVisuals();

        // Apply effects based on terminal type
        if (this.type === 'spawn_control' && this.linkedSpawnPointId) {
            this.convertSpawnPoint();
        } else if (this.type === 'door_unlock' && this.linkedDoorId) {
            this.unlockDoor();
        }

        console.log(`Terminal sliced: ${this.type}`);
        return true;
    }

    convertSpawnPoint() {
        // Convert hostile spawn point to friendly/disabled
        if (window.game && window.game.slicingSystem) {
            window.game.slicingSystem.convertSpawnPoint(this.linkedSpawnPointId);
        }
    }

    unlockDoor() {
        // Unlock a locked door
        if (window.game && window.game.entities.doors) {
            const door = window.game.entities.doors.find(d =>
                d.properties && d.properties.id === this.linkedDoorId
            );
            if (door) {
                door.properties.locked = false;
                console.log(`Door ${this.linkedDoorId} unlocked`);
            }
        }
    }
}

class SlicingSystem {
    constructor() {
        this.terminals = [];
        this.sliceableSpawnPoints = new Map(); // id -> spawn point data
        this.currentSliceTarget = null;
        this.sliceProgress = 0;
        this.sliceTime = 3.0; // Base time in seconds to slice
        this.isSlicing = false;

        this.createUI();
    }

    createUI() {
        // Create slicing prompt UI
        const promptDiv = document.createElement('div');
        promptDiv.id = 'slicing-prompt';
        promptDiv.style.cssText = `
            position: fixed;
            bottom: 200px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.8);
            color: #00ffcc;
            padding: 10px 20px;
            border: 2px solid #00ffcc;
            border-radius: 5px;
            font-family: monospace;
            font-size: 14px;
            display: none;
            z-index: 1000;
            text-align: center;
        `;
        document.body.appendChild(promptDiv);
        this.promptElement = promptDiv;

        // Create slicing progress bar
        const progressDiv = document.createElement('div');
        progressDiv.id = 'slicing-progress';
        progressDiv.style.cssText = `
            position: fixed;
            bottom: 160px;
            left: 50%;
            transform: translateX(-50%);
            width: 200px;
            height: 20px;
            background: rgba(0, 0, 0, 0.8);
            border: 2px solid #00ffcc;
            border-radius: 3px;
            display: none;
            z-index: 1000;
        `;
        const progressBar = document.createElement('div');
        progressBar.id = 'slicing-progress-bar';
        progressBar.style.cssText = `
            width: 0%;
            height: 100%;
            background: #00ffcc;
            transition: width 0.1s linear;
        `;
        progressDiv.appendChild(progressBar);
        document.body.appendChild(progressDiv);
        this.progressElement = progressDiv;
        this.progressBar = progressBar;
    }

    addTerminal(position, difficulty, properties) {
        const terminal = new SlicingTerminal(position, difficulty, properties);
        this.terminals.push(terminal);
        if (window.game && window.game.scene) {
            window.game.scene.add(terminal.mesh);
        }
        return terminal;
    }

    addSliceableSpawnPoint(id, spawnData) {
        this.sliceableSpawnPoints.set(id, {
            ...spawnData,
            isSliced: false,
            originalFaction: spawnData.faction || 'imperials'
        });
    }

    convertSpawnPoint(spawnPointId) {
        const spawnData = this.sliceableSpawnPoints.get(spawnPointId);
        if (spawnData && !spawnData.isSliced) {
            spawnData.isSliced = true;
            spawnData.faction = 'player_controlled'; // Mark as converted
            console.log(`Spawn point ${spawnPointId} converted to player control`);

            // If there are active NPCs from this spawn, they could be marked as neutral/friendly
            // This is a placeholder for future implementation
        }
    }

    checkNearbyTerminal() {
        if (!window.game || !window.physics) return null;

        const playerPos = window.physics.playerCollider.position;
        let nearestTerminal = null;
        let nearestDist = Infinity;

        for (const terminal of this.terminals) {
            if (terminal.isSliced) continue;

            const dist = playerPos.distanceTo(terminal.position);
            if (dist < nearestDist && dist < 2.0) {
                nearestDist = dist;
                nearestTerminal = terminal;
            }
        }

        return nearestTerminal;
    }

    updatePrompt() {
        const terminal = this.checkNearbyTerminal();

        if (terminal && !this.isSlicing) {
            const playerSkill = window.game.state.playerStats.slicing_skill || 0;
            const canSlice = terminal.canSlice(playerSkill);

            if (canSlice) {
                this.promptElement.innerHTML = `
                    <div>TERMINAL DETECTED (Difficulty: ${terminal.difficulty})</div>
                    <div style="margin-top: 5px;">Hold [E] to Slice</div>
                `;
                this.promptElement.style.borderColor = '#00ffcc';
                this.promptElement.style.color = '#00ffcc';
            } else {
                this.promptElement.innerHTML = `
                    <div>TERMINAL DETECTED (Difficulty: ${terminal.difficulty})</div>
                    <div style="margin-top: 5px; color: #ff6666;">
                        Requires Slicing Skill Level ${terminal.difficulty}
                    </div>
                    <div style="font-size: 12px;">Your Level: ${playerSkill}</div>
                `;
                this.promptElement.style.borderColor = '#ff6666';
                this.promptElement.style.color = '#ff6666';
            }
            this.promptElement.style.display = 'block';
        } else if (!this.isSlicing) {
            this.promptElement.style.display = 'none';
        }
    }

    startSlicing() {
        const terminal = this.checkNearbyTerminal();
        if (!terminal) return false;

        const playerSkill = window.game.state.playerStats.slicing_skill || 0;
        if (!terminal.canSlice(playerSkill)) return false;

        this.currentSliceTarget = terminal;
        this.isSlicing = true;
        this.sliceProgress = 0;

        // Calculate slice time based on difficulty and player bonuses
        let baseTime = this.sliceTime * terminal.difficulty;
        const speedBonus = window.game.state.playerStats.slicing_speed_bonus || 0;
        baseTime *= (1 - speedBonus);
        this.currentSliceTime = baseTime;

        this.promptElement.innerHTML = `<div>SLICING...</div>`;
        this.progressElement.style.display = 'block';

        return true;
    }

    updateSlicing(deltaTime) {
        if (!this.isSlicing || !this.currentSliceTarget) return;

        // Check if E is still held
        if (!window.inputHandler || !window.inputHandler.keys['KeyE']) {
            this.cancelSlicing();
            return;
        }

        // Check if still in range
        const playerPos = window.physics.playerCollider.position;
        const dist = playerPos.distanceTo(this.currentSliceTarget.position);
        if (dist > 2.5) {
            this.cancelSlicing();
            return;
        }

        // Update progress
        this.sliceProgress += deltaTime / this.currentSliceTime;
        this.progressBar.style.width = `${Math.min(this.sliceProgress * 100, 100)}%`;

        // Check completion
        if (this.sliceProgress >= 1.0) {
            this.completeSlicing();
        }
    }

    cancelSlicing() {
        this.isSlicing = false;
        this.currentSliceTarget = null;
        this.sliceProgress = 0;
        this.progressElement.style.display = 'none';
        this.progressBar.style.width = '0%';
    }

    completeSlicing() {
        if (this.currentSliceTarget) {
            this.currentSliceTarget.slice();

            // Play success sound if available
            if (window.audioSystem) {
                // audioSystem.playSound('slice_success');
            }

            // Show success message
            this.promptElement.innerHTML = `<div style="color: #00ff00;">SLICE SUCCESSFUL!</div>`;
            setTimeout(() => {
                this.promptElement.style.display = 'none';
            }, 2000);
        }

        this.isSlicing = false;
        this.currentSliceTarget = null;
        this.sliceProgress = 0;
        this.progressElement.style.display = 'none';
        this.progressBar.style.width = '0%';
    }

    update(deltaTime) {
        this.updatePrompt();
        this.updateSlicing(deltaTime);
    }

    // Load terminals from level data
    loadFromLevelData(levelData) {
        // Clear existing terminals
        this.terminals.forEach(terminal => {
            if (window.game && window.game.scene) {
                window.game.scene.remove(terminal.mesh);
            }
        });
        this.terminals = [];
        this.sliceableSpawnPoints.clear();

        // Load terminals from level
        if (levelData.terminals) {
            for (const terminalData of levelData.terminals) {
                const pos = new THREE.Vector3(
                    terminalData.x || 0,
                    terminalData.y || 0,
                    terminalData.z || 0
                );
                this.addTerminal(pos, terminalData.difficulty || 1, terminalData.properties || {});
            }
        }

        // Load sliceable spawn points
        if (levelData.npcs) {
            for (const npcData of levelData.npcs) {
                if (npcData.sliceable && npcData.sliceableId) {
                    this.addSliceableSpawnPoint(npcData.sliceableId, npcData);
                }
            }
        }
    }
}

// Initialize slicing system when game loads
window.addEventListener('load', () => {
    // Wait for game to initialize
    const checkGame = setInterval(() => {
        if (window.game) {
            clearInterval(checkGame);
            window.game.slicingSystem = new SlicingSystem();
            console.log('Slicing system initialized');

            // Add a test terminal spawn command (for debugging)
            window.spawnTestTerminal = (difficulty = 1) => {
                if (!window.game || !window.game.slicingSystem || !window.physics) {
                    console.error('Game not initialized');
                    return;
                }
                const playerPos = window.physics.playerCollider.position;
                const terminalPos = new THREE.Vector3(
                    playerPos.x + 2,
                    0,
                    playerPos.z
                );
                const terminal = window.game.slicingSystem.addTerminal(terminalPos, difficulty, {
                    type: 'spawn_control',
                    linkedSpawnPointId: 'test_spawn_' + Date.now()
                });
                console.log(`Test terminal spawned at (${terminalPos.x.toFixed(2)}, ${terminalPos.y.toFixed(2)}, ${terminalPos.z.toFixed(2)}) with difficulty ${difficulty}`);
                return terminal;
            };
        }
    }, 100);
});
