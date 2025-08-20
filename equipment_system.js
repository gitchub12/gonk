// BROWSERFIREFOXHIDE equipment_system.js
// === EQUIPMENT SYSTEM ===

class EquipmentSystem {
  constructor() {
    this.equipped = {
      hat: null,
      bandolier: null,
      shoes: null
    };
    this.loadEquipped();
  }

  equip(type, key) {
    if (!window.EQUIPMENT_TYPES) {
        console.error("EQUIPMENT_TYPES not loaded yet.");
        return false;
    }
    const category = window.EQUIPMENT_TYPES[type + 's'];
    if (category && category[key]) {
      this.equipped[type] = key;
      this.applyEquipmentEffects();
      this.saveEquipped();
      return true;
    }
    return false;
  }

  unequip(type) {
    if (this.equipped[type]) {
      this.equipped[type] = null;
      this.applyEquipmentEffects();
      this.saveEquipped();
      return true;
    }
    return false;
  }

  applyEquipmentEffects() {
    window.equipmentSpeedMultiplier = 1.0;
    
    if (!window.EQUIPMENT_TYPES) {
        console.warn("EQUIPMENT_TYPES not loaded during effect application.");
        return;
    }

    for (const type in this.equipped) {
      const key = this.equipped[type];
      if (key) {
        const item = window.EQUIPMENT_TYPES[type + 's'][key];
        if (item && item.speedMultiplier) {
            window.equipmentSpeedMultiplier *= item.speedMultiplier;
        }
      }
    }
  }

  saveEquipped() {
    try { localStorage.setItem('gonkpope_equipped', JSON.stringify(this.equipped)); } 
    catch (e) { console.error("Failed to save equipped items:", e); }
  }

  loadEquipped() {
    try {
      const saved = localStorage.getItem('gonkpope_equipped');
      if (saved) { this.equipped = JSON.parse(saved); this.applyEquipmentEffects(); }
    } catch (e) { console.error("Failed to load equipped items:", e); }
  }

  reset() {
    this.equipped = { hat: null, bandolier: null, shoes: null };
    this.applyEquipmentEffects();
    this.saveEquipped();
  }
}

window.equipmentSystem = new EquipmentSystem();