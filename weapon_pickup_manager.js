class WeaponPickupManager {
    constructor() {
        this.activePickup = null;
        this.pickupRange = 0.5; // Very close range
        this.uiElement = null;
        this.allyNumberDisplayTimeout = null;
        this.eligibleAllies = [];
        this.allyNumbersDisplayed = {};
    }

    _getWeaponKeyFromPickup(pickup) {
        if (!pickup) return null;
        // A proper WeaponPickup object has a 'weaponKey' string.
        if (typeof pickup.weaponKey === 'string') {
            return pickup.weaponKey;
        }
        // If not, it might be a raw weapon object that was dropped.
        if (pickup.config && typeof pickup.config.key === 'string') {
            // Player weapons have a 'g' prefix in their key, we want the base name for lookup.
            return pickup.config.key.replace(/^g/, '');
        }
        // Or it might be a WeaponPickup where weaponKey was incorrectly assigned a weapon object.
        if (typeof pickup.weaponKey === 'object' && pickup.weaponKey !== null) {
            const nestedWeaponObject = pickup.weaponKey;
            if (nestedWeaponObject.config && typeof nestedWeaponObject.config.key === 'string') {
                return nestedWeaponObject.config.key.replace(/^g/, '');
            }
        }
        console.error("Could not determine weapon key from pickup:", pickup);
        return null;
    }

    init() {
        this.createPickupUI();
    }

    createPickupUI() {
        this.uiElement = document.createElement('div');
        this.uiElement.id = 'weaponPickupPrompt';
        this.uiElement.style.position = 'absolute';
        this.uiElement.style.bottom = '20%';
        this.uiElement.style.left = '50%';
        this.uiElement.style.transform = 'translateX(-50%)';
        this.uiElement.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        this.uiElement.style.color = 'white';
        this.uiElement.style.padding = '10px';
        this.uiElement.style.borderRadius = '5px';
        this.uiElement.style.textAlign = 'center';
        this.uiElement.style.display = 'none';
        this.uiElement.style.zIndex = '1000';
        this.uiElement.style.fontFamily = 'monospace';
        document.body.appendChild(this.uiElement);
    }

    update(player, droppedWeapons, allies) {
        let closestWeapon = null;
        let minDistance = Infinity;

        for (const weapon of droppedWeapons) {
            const distance = player.position.distanceTo(weapon.mesh.position);
            if (distance < minDistance) {
                minDistance = distance;
                closestWeapon = weapon;
            }
        }

        if (closestWeapon && minDistance < this.pickupRange) {
            if (this.activePickup !== closestWeapon) {
                this.activePickup = closestWeapon;
                this.showPickupUI(closestWeapon, allies);
            }
        } else {
            if (this.activePickup) {
                this.hidePickupUI();
                this.activePickup = null;
            }
        }
    }

    showPickupUI(weapon, allies) {
        const weaponKey = this._getWeaponKeyFromPickup(weapon);
        if (!weaponKey) {
            this.hidePickupUI();
            return;
        }

        const weaponName = this.formatWeaponName(weaponKey);
        this.eligibleAllies = this.getEligibleAllies(weaponKey, allies);
        const eligibleAllyNumbers = this.eligibleAllies.map(ally => ally.npc.allySlotIndex + 1);
        const giveOptions = eligibleAllyNumbers.length > 0 ? `Give (${eligibleAllyNumbers.join(',')})` : '';

        this.uiElement.innerHTML = `
            <div>(E)quip, ${giveOptions}, (T)rash</div>
            <div style="font-weight: bold;">${weaponName}</div>
        `;
        this.uiElement.style.display = 'block';

        this.displayAllyNumbers(this.eligibleAllies);
    }

    hidePickupUI() {
        this.uiElement.style.display = 'none';
        this.hideAllyNumbers();
    }

    formatWeaponName(rawName) {
        if (typeof rawName !== 'string') {
            console.error("formatWeaponName received non-string:", rawName);
            return "Unknown Weapon";
        }
        let name = rawName.split('.')[0]; // remove .png
        const parts = name.split('_');
        if (parts.length > 1) {
            // join all parts after the first one, capitalize each
            name = parts.slice(1).map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
        } else {
            name = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
        }
        return name;
    }

    getEligibleAllies(weaponKey, allies) {
        if (!weaponKey) return [];
        return allies.filter(ally => this.canAllyUseWeapon(ally.npc, weaponKey));
    }

    canAllyUseWeapon(ally, weaponKey) {
        const weaponConfig = window.assetManager.weaponData[weaponKey];
        if (!weaponConfig) return false;
        // Example: an ewok cannot use an eweb cannon
        if (ally.config.baseType === 'halfpint' && weaponConfig.weight > 50) {
            return false;
        }
        if (ally.config.technical_understanding < (weaponConfig.tech_level || 0)) {
            return false;
        }
        return true;
    }

    displayAllyNumbers(eligibleAllies) {
        this.hideAllyNumbers();

        eligibleAllies.forEach(ally => {
            const index = ally.npc.allySlotIndex;
            const numberElement = document.createElement('div');
            numberElement.style.position = 'absolute';
            
            const screenPos = this.worldToScreen(ally.npc.mesh.group.position);
            numberElement.style.left = `${screenPos.x}px`;
            numberElement.style.top = `${screenPos.y}px`;
            numberElement.style.transform = 'translate(-50%, -100%)';

            numberElement.style.fontSize = '48px';
            numberElement.style.color = 'white';
            numberElement.style.fontWeight = 'bold';
            numberElement.style.textShadow = '2px 2px 4px rgba(0,0,0,0.8)';
            numberElement.innerText = index + 1;
            this.uiElement.appendChild(numberElement);
            this.allyNumbersDisplayed[index] = numberElement;
        });

        this.allyNumberDisplayTimeout = setTimeout(() => {
            this.hideAllyNumbers();
        }, 3000);
    }

    worldToScreen(worldPosition) {
        const vector = worldPosition.clone().project(window.game.camera);
        vector.x = (vector.x + 1) / 2 * window.innerWidth;
        vector.y = -(vector.y - 1) / 2 * window.innerHeight;
        return vector;
    }

    hideAllyNumbers() {
        if (this.allyNumberDisplayTimeout) {
            clearTimeout(this.allyNumberDisplayTimeout);
            this.allyNumberDisplayTimeout = null;
        }
        for (const key in this.allyNumbersDisplayed) {
            this.allyNumbersDisplayed[key].remove();
        }
        this.allyNumbersDisplayed = {};
    }

    handleKeyPress(event) {
        if (!this.activePickup) return;

        switch (event.code) {
            case 'KeyE':
                this.equipWeapon();
                break;
            case 'KeyT':
                this.trashWeapon();
                break;
            case 'Digit1':
            case 'Digit2':
            case 'Digit3':
            case 'Digit4':
                this.giveWeaponToAlly(parseInt(event.key));
                break;
        }
    }

    equipWeapon() {
        const weaponToEquip = this.activePickup;
        const weaponKey = this._getWeaponKeyFromPickup(weaponToEquip);
        if (!weaponKey) return;

        const weaponConfig = window.assetManager.weaponData[weaponKey];
        if (!weaponConfig) {
            console.error(`equipWeapon: No config found for ${weaponKey}`);
            return;
        }

        // Use playerStats from game.state, assuming it's initialized
        if (window.game.state.playerStats.technical_understanding < (weaponConfig.tech_level || 0)) {
            window.audioSystem.playSound('E:/gonk/data/sounds/UIsoundeffects/NPCcannotpickup.wav');
            return;
        }
        
        const category = weaponConfig.category;
        const slotIndex = window.playerWeaponSystem.categories.indexOf(category);
        const currentWeaponsInSlot = window.playerWeaponSystem.slots[slotIndex];

        // Slots now contain arrays of weapons, check if slot has weapons
        if (currentWeaponsInSlot && currentWeaponsInSlot.length > 0) {
            // Drop the first weapon in the slot
            const weaponToDrop = currentWeaponsInSlot[0];
            let keyToDrop = weaponToDrop.config.key;
            if (keyToDrop.startsWith('g')) {
                keyToDrop = keyToDrop.slice(1);
            }
            const dropPosition = weaponToEquip.mesh.position.clone();
            dropPosition.y += 0.2;
            window.game.entities.droppedWeapons.push(new WeaponPickup(keyToDrop, dropPosition));
        }

        window.playerWeaponSystem.addWeapon('g' + weaponKey);
        
        this.removeDroppedWeapon(weaponToEquip);
        this.hidePickupUI();
    }

    giveWeaponToAlly(allyNumber) {
        const ally = this.eligibleAllies.find(a => a.npc.allySlotIndex === allyNumber - 1);
        if (!ally) {
            window.audioSystem.playSound('E:/gonk/data/sounds/UIsoundeffects/NPCcannotpickup.wav');
            return;
        }

        const weaponToGive = this.activePickup;
        const weaponKey = this._getWeaponKeyFromPickup(weaponToGive);
        if (!weaponKey) return;

        const weaponConfig = window.assetManager.weaponData[weaponKey];
        const category = weaponConfig.category;

        const currentWeapon = ally.npc.itemData.properties.weapon;
        if (currentWeapon && currentWeapon !== 'none') {
            const currentWeaponKey = currentWeapon.split('/').pop().replace('.png', '');
            const dropPosition = weaponToGive.mesh.position.clone();
            dropPosition.y += 0.2;
            window.game.entities.droppedWeapons.push(new WeaponPickup(currentWeaponKey, dropPosition));
        }

        // This path needs to be correct for the NPC to find the weapon asset
        const weaponPath = `data/NPConlyweapons/${category}/${weaponKey}.png`;
        ally.npc.itemData.properties.weapon = weaponPath;
        window.weaponIcons.attachToCharacter(ally.npc, weaponKey);
        
        window.audioSystem.playSound('E:/gonk/data/sounds/UIsoundeffects/NPCpickup.wav');
        this.removeDroppedWeapon(weaponToGive);
        this.hidePickupUI();
    }

    trashWeapon() {
        const weaponToTrash = this.activePickup;
        const weaponKey = this._getWeaponKeyFromPickup(weaponToTrash);
        if (!weaponKey) return;

        const weaponConfig = window.assetManager.weaponData[weaponKey];
        if (!weaponConfig) {
            console.error(`trashWeapon: No config found for ${weaponKey}`);
            this.removeDroppedWeapon(weaponToTrash);
            this.hidePickupUI();
            return;
        }

        const tier = weaponConfig.threat || 1; // Use 'threat' as per user request for tier
        const wireGained = Math.pow(tier, 3);
        window.game.state.wire = Math.min((window.game.state.wire || 0) + wireGained, 9999);
        
        // You'll need a way to update the UI for this. Let's assume a function exists.
        if(window.game.updateCharacterSheet) {
            window.game.updateCharacterSheet();
        }

        this.removeDroppedWeapon(weaponToTrash);
        this.hidePickupUI();
    }

    removeDroppedWeapon(weaponToRemove) {
        const index = window.game.entities.droppedWeapons.indexOf(weaponToRemove);
        if (index > -1) {
            weaponToRemove.dispose();
            window.game.entities.droppedWeapons.splice(index, 1);
        }
    }
}

class WeaponPickup {
    constructor(weaponKey, position, dropWeight = 0) { // Added dropWeight
        this.weaponKey = weaponKey;
        this.mesh = new THREE.Group();
        this.mesh.position.copy(position);
        this.lifetime = 60; // 60 seconds
        this.spawnTime = performance.now();

        // Add light source based on dropWeight
        let lightColor = 0xffff00; // yellow for 0-9
        if (dropWeight >= 30) {
            lightColor = 0xffffff; // white
        } else if (dropWeight >= 20) {
            lightColor = 0x8a2be2; // blueish violet
        } else if (dropWeight >= 10) {
            lightColor = 0xffa500; // orange
        }

        const pointLight = new THREE.PointLight(lightColor, 1, 5);
        pointLight.position.set(0, 0.5, 0);
        this.mesh.add(pointLight);
        this.light = pointLight;

        window.weaponIcons.getWeaponPickupMesh(this.weaponKey).then(weaponMesh => {
            if (weaponMesh) {
                this.mesh.add(weaponMesh);
            }
        });
        
        window.game.scene.add(this.mesh);
    }

    update(deltaTime) {
        this.lifetime -= deltaTime;
        if (this.lifetime <= 0) {
            return false;
        }
        this.mesh.rotation.y += 0.012;
        return true;
    }

    dispose() {
        window.game.scene.remove(this.mesh);
        this.mesh.traverse(child => {
            if (child.isMesh) {
                child.geometry.dispose();
                child.material.dispose();
            }
            if (child.isLight) {
                child.dispose();
            }
        });
    }
}