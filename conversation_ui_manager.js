// BROWSERFIREFOXHIDE conversation_ui_manager.js
// update: Removed all custom conversation animations and replaced them with fixed CSS shifts to prevent ally box disappearance and visual artifacts.
// update: Added 10-second fade timer after conversation ends to meet persistence requirement.
console.log('--- LOADING CONVERSATION UI MANAGER v3 ---'); // New version to check for caching issues

class ConversationUIManager {
    constructor() {
        this.container = document.getElementById('conversation-container');
        this.svgContainer = document.getElementById('conversation-lines-svg'); // Get the SVG container separately
        this.slots = [
            { wrapper: document.getElementById('conversation-slot-1'), box: document.querySelector('#conversation-slot-1 .conversation-box'), label: document.querySelector('#conversation-slot-1 .faction-label'), pointer: document.getElementById('conversation-pointer-1'), speaker: null },
            { wrapper: document.getElementById('conversation-slot-2'), box: document.querySelector('#conversation-slot-2 .conversation-box'), label: document.querySelector('#conversation-slot-2 .faction-label'), pointer: document.getElementById('conversation-pointer-2'), speaker: null },
            { wrapper: document.getElementById('conversation-slot-3'), box: document.querySelector('#conversation-slot-3 .conversation-box'), label: document.querySelector('#conversation-slot-3 .faction-label'), pointer: document.getElementById('conversation-pointer-3'), speaker: null },
        ];
        this.offscreenIndicators = document.getElementById('offscreen-indicators');
        this.socialCheckDisplay = null; // For social check roll display
        this.camera = null;
        this.canvas = null;
        this.allyBoxesContainer = document.querySelector('.ally-boxes');
    }

    init(camera, canvas) {
        this.camera = camera;
        this.canvas = canvas;
        this.hide(); // Start hidden
    }

    showPhrase(slotIndex, text, speaker, factionColor, factionName = '') {
        if (slotIndex < 0 || slotIndex >= this.slots.length) return;

        const slot = this.slots[slotIndex];
        slot.speaker = speaker;
        slot.box.textContent = text;
        slot.box.style.borderColor = factionColor || '#888';
        slot.wrapper.style.display = 'flex'; 
        slot.label.textContent = factionName;
        slot.label.style.color = factionColor || '#ccc';
        window.isConversationUIVisible = true;
        this.container.style.display = 'flex';
        
        // Apply immediate shift for the speaking ally/NPC
        const ally = window.game.state.allies.find(a => a.npc === speaker);
        if (ally) {
            document.getElementById(`ally-box-${ally.npc.allySlotIndex + 1}`).classList.add('shift-up');
        }
    }

    hide() {
        window.isConversationUIVisible = false;
        this.container.style.display = 'none';
        
        // Also hide the SVG container when the conversation ends
        if (this.svgContainer) {
            this.svgContainer.style.display = 'none';
        }

        for (const slot of this.slots) {
            slot.wrapper.style.display = 'none'; // Hide the wrapper, not the box
            slot.box.style.opacity = '1'; // Reset opacity for next time
            if (slot.pointer) {
                slot.pointer.style.display = 'none';
                slot.pointer.style.opacity = '0.2'; // Reset opacity
            }
            slot.speaker = null;
        }
        this.offscreenIndicators.innerHTML = ''; // Clear arrows
    }

    startFadeOutSequence() {
        // Keep the UI visible for 10 seconds, then fade out.
        // This is the new persistent effect.
        if (window.game.state.isPaused) {
             // If paused (e.g., in simulator), just end immediately
             this.resetAllyBoxes();
             this.hide();
             return;
        }

        // Apply visual outcome effect and wait
        const effectContainer = document.createElement('div');
        effectContainer.id = 'conversation-outcome-effect';
        effectContainer.style.position = 'absolute';
        effectContainer.style.top = '100px';
        effectContainer.style.left = '50%';
        effectContainer.style.transform = 'translateX(-50%)';
        effectContainer.style.fontSize = '32px';
        effectContainer.style.color = 'yellow';
        effectContainer.style.textShadow = '0 0 10px black';
        effectContainer.style.zIndex = '1100';
        effectContainer.textContent = 'EFFECT: RELATIONSHIP SHIFT';
        document.body.appendChild(effectContainer);

        // Reset ally boxes after the effect is displayed
        this.resetAllyBoxes();

        // 10 second delay for effect to persist
        setTimeout(() => {
            effectContainer.style.opacity = '0';
            this.container.style.opacity = '0';
            
            setTimeout(() => {
                 this.hide();
                 effectContainer.remove();
                 this.container.style.opacity = '1'; // Reset opacity for next time
            }, 1000); // 1 second fade out
        }, 10000); // 10 second display time
    }

    hidePointerForSlot(slotIndex) {
        if (slotIndex < 0 || slotIndex >= this.slots.length) return;
        const slot = this.slots[slotIndex];
        if (slot.pointer) {
            slot.pointer.style.display = 'none';
        }
    }

    update() {
        if (this.container.style.display === 'none') return;
        // Ensure SVG container is visible if the main container is
        if (this.svgContainer && this.svgContainer.style.display === 'none') {
            this.svgContainer.style.display = 'block';
        }

        let hasActiveSpeaker = false;
        this.offscreenIndicators.innerHTML = ''; // Clear previous frame's arrows

        this.slots.forEach((slot, index) => {
            if (slot.speaker && slot.wrapper.style.display !== 'none') {
                hasActiveSpeaker = true;
                // Only draw pointers for the first two conversation slots (greeting and reply).
                if (index < 2) {
                    this.updateLineAndIndicator(slot);
                } else {
                    // Explicitly hide the pointer for the third slot (response).
                    if (slot.pointer) {
                        slot.pointer.style.display = 'none';
                    }
                }
            } else {
                if (slot.pointer) {
                    slot.pointer.style.display = 'none';
                }
            }
        });

        if (!hasActiveSpeaker) {
            // Note: We don't hide the container here anymore, startFadeOutSequence handles the end.
        }
    }

    updateLineAndIndicator(slot) {
        const { speaker, box, pointer } = slot;
        const screenPos = this.getSpeakerScreenPos(speaker);
        const boxRect = box.getBoundingClientRect();

        if (screenPos.z > 1) { // Behind the camera
            this.drawPointer(speaker, pointer, box, boxRect, screenPos, true);
            this.createOffscreenIndicator(speaker, box.style.borderColor);
        } else {
            this.drawPointer(speaker, pointer, box, boxRect, screenPos, false);
        }
    }

    getSpeakerScreenPos(speaker) {
        const position = new THREE.Vector3();
        const head = speaker.mesh.parts.head || speaker.mesh.group;

        // NEW: Guard against invalid speaker meshes
        if (!head || typeof head.getWorldPosition !== 'function') {
            console.warn("ConversationUIManager: Invalid speaker mesh, cannot get screen position.", speaker);
            return { x: -1000, y: -1000, z: 1 }; // Return off-screen position
        }

        head.getWorldPosition(position);
        position.y += 0.0; // Offset above the head

        position.project(this.camera);

        const x = (position.x * .5 + .5) * this.canvas.clientWidth;
        const y = (position.y * -.5 + .5) * this.canvas.clientHeight;

        return { x, y, z: position.z };
    }

    drawPointer(speaker, pointer, box, boxRect, screenPos, isOffscreen) {
        if (isOffscreen) {
            pointer.style.display = 'none';
            return;
        }
        if (!pointer) return;

        // Define pointer styles based on whether it's an ally or not.
        const isAllyPointer = speaker.isAlly;
        const POINTER_MAX_WIDTH = isAllyPointer ? 25 : 50;
        const POINTER_OPACITY = isAllyPointer ? 0.18 : 0.24;

        pointer.style.display = 'block';
        pointer.style.opacity = POINTER_OPACITY;

        // Calculate the base of the triangle, clamped to the max width
        const pointerHalfWidth = Math.min(boxRect.width / 2, POINTER_MAX_WIDTH / 2);
        const pointerCenterX = Math.max(boxRect.left + pointerHalfWidth, Math.min(screenPos.x, boxRect.right - pointerHalfWidth));

        const startX1 = pointerCenterX - pointerHalfWidth;
        const startX2 = pointerCenterX + pointerHalfWidth;
        const startY = boxRect.bottom;

        const points = `${startX1},${startY} ${startX2},${startY} ${screenPos.x},${screenPos.y}`;
        pointer.setAttribute('points', points);
        pointer.style.fill = box.style.borderColor;
    }

    createOffscreenIndicator(speaker, color) {
        const position = new THREE.Vector3();
        speaker.mesh.group.getWorldPosition(position);

        const cameraDirection = new THREE.Vector3();
        this.camera.getWorldDirection(cameraDirection);
        const toSpeaker = position.sub(this.camera.position);

        if (cameraDirection.dot(toSpeaker) < 0) {
            const screenEdgePos = this.getScreenEdge(position);
            const arrow = document.createElement('div');
            arrow.className = 'offscreen-arrow';
            arrow.style.position = 'absolute';
            arrow.style.left = `${screenEdgePos.x}px`;
            arrow.style.top = `${screenEdgePos.y}px`;
            arrow.style.transform = `translate(-50%, -50%) rotate(${screenEdgePos.rotation}rad)`;
            arrow.style.color = color;
            arrow.innerHTML = '&#9650;'; // Triangle character
            this.offscreenIndicators.appendChild(arrow);
        }
    }

    getScreenEdge(worldPosition) {
        const screenPos = new THREE.Vector3();
        screenPos.copy(worldPosition).project(this.camera);

        const halfWidth = this.canvas.clientWidth / 2;
        const halfHeight = this.canvas.clientHeight / 2;

        const x = screenPos.x * halfWidth;
        const y = screenPos.y * halfHeight;

        let rotation = 0;
        let screenX, screenY;

        if (Math.abs(x) > halfWidth || Math.abs(y) > halfHeight) {
            const slope = y / x;
            if (x > 0) {
                screenX = halfWidth;
                screenY = halfWidth * slope;
            } else {
                screenX = -halfWidth;
                screenY = -halfWidth * slope;
            }

            if (screenY > halfHeight) {
                screenX = halfHeight / slope;
                screenY = halfHeight;
            } else if (screenY < -halfHeight) {
                screenX = -halfHeight / slope;
                screenY = -halfHeight;
            }
        } else {
            screenX = x;
            screenY = y;
        }

        screenX += halfWidth;
        screenY = -screenY + halfHeight;

        screenX = Math.max(5, Math.min(this.canvas.clientWidth - 5, screenX));
        screenY = Math.max(5, Math.min(this.canvas.clientHeight - 5, screenY));

        const dx = screenX - (this.canvas.clientWidth / 2);
        const dy = screenY - (this.canvas.clientHeight / 2);
        rotation = Math.atan2(dy, dx) + Math.PI / 2;

        return { x: screenX, y: screenY, rotation };
    }

    displaySocialCheckRolls(attackerInfo, defenderInfo) {
        console.log("displaySocialCheckRolls called with:", { attackerInfo, defenderInfo });
        if (!this.socialCheckDisplay) {
            this.socialCheckDisplay = document.createElement('div');
            this.socialCheckDisplay.id = 'social-check-display';
            this.socialCheckDisplay.style.position = 'absolute';
            this.socialCheckDisplay.style.bottom = '250px';
            this.socialCheckDisplay.style.width = '100%';
            this.socialCheckDisplay.style.textAlign = 'center';
            this.socialCheckDisplay.style.color = 'white';
            this.socialCheckDisplay.style.fontFamily = 'monospace';
            this.socialCheckDisplay.style.fontSize = '24px';
            this.socialCheckDisplay.style.fontWeight = 'bold';
            this.socialCheckDisplay.style.textShadow = '1px 1px 2px black';
            this.socialCheckDisplay.style.pointerEvents = 'none';
            this.socialCheckDisplay.style.transition = 'opacity 0.5s ease-in-out';
            document.body.appendChild(this.socialCheckDisplay);
        }

        const attackerColor = GAME_GLOBAL_CONSTANTS.FACTION_COLORS[attackerInfo.faction] || '#FFFFFF';
        const defenderColor = GAME_GLOBAL_CONSTANTS.FACTION_COLORS[defenderInfo.faction] || '#FFFFFF';

        const capitalize = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';

        this.socialCheckDisplay.innerHTML = `
            <div><span style="color: ${attackerColor}">${capitalize(attackerInfo.faction)}</span> ${attackerInfo.label}: ${attackerInfo.total.toFixed(0)}</div>
            <div><span style="color: ${defenderColor}">${capitalize(defenderInfo.faction)}</span> ${defenderInfo.label}: ${defenderInfo.total.toFixed(0)}</div>
        `;
        this.socialCheckDisplay.style.display = 'block';
        this.socialCheckDisplay.style.opacity = '1';

        setTimeout(() => {
            if (this.socialCheckDisplay) {
                this.socialCheckDisplay.style.opacity = '0';
            }
        }, 6000); // Increased from 4000
    }

    displaySocialCheckOutcome(outcomeTier, targetNpc) {
        console.log(`--- displaySocialCheckOutcome ---`);
        console.log(`outcomeTier: ${outcomeTier}`);
        console.log(`targetNpc:`, targetNpc);

        // Removed animated icon in favor of persistent outcome text from startFadeOutSequence
    }

    displayFactionShiftOutcome(factionName, changeAmount) {
        console.log("displayFactionShiftOutcome called with:", { factionName, changeAmount });
        const displayElement = document.createElement('div');
        displayElement.className = 'faction-shift-display';
        displayElement.style.position = 'absolute';
        displayElement.style.bottom = '220px'; // Below social check rolls
        displayElement.style.width = '100%';
        displayElement.style.textAlign = 'center';
        displayElement.style.color = changeAmount > 0 ? '#aaffaa' : '#ffaaaa'; // Green for positive, red for negative
        displayElement.style.fontFamily = 'monospace';
        displayElement.style.fontSize = '20px';
        displayElement.style.fontWeight = 'bold';
        displayElement.style.textShadow = '1px 1px 2px black';
        displayElement.style.pointerEvents = 'none';
        displayElement.style.opacity = '1';
        displayElement.style.transition = 'opacity 0.5s ease-in-out';
        displayElement.style.zIndex = '1000';
        
        const sign = changeAmount > 0 ? '+' : '';
        displayElement.textContent = `${factionName.replace(/_/g, ' ')} ${sign}${changeAmount} FRIENDSHIP`;
        document.body.appendChild(displayElement);

        setTimeout(() => {
            displayElement.style.opacity = '0';
            setTimeout(() => displayElement.remove(), 500);
        }, 3000); // Display for 3 seconds
    }

    shiftAllyBoxesDown() {
        // This is handled by main.js now, which applies the 'shift-down' class to all non-speakers
    }

    resetAllyBoxes() {
        // Remove all shifting classes from all ally boxes
        window.game.state.allies.forEach(ally => {
            const box = document.getElementById(`ally-box-${ally.npc.allySlotIndex + 1}`);
            if (box) {
                box.classList.remove('shift-up', 'shift-down');
            }
        });
    }
}

window.conversationUIManager = new ConversationUIManager();