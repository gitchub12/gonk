// BROWSERFIREFOXHIDE equipment_data.js
// === EQUIPMENT DATA ===

const EQUIPMENT_TYPES = {
  hats: {
    jedi_hood: { name: 'Jedi Hood', sprite: 'hat_jedi' },
    stormtrooper_helmet: { name: 'Stormtrooper Helmet', sprite: 'hat_stormtrooper' },
    ewok_hood: { name: 'Ewok Hood', sprite: 'hat_ewok' }
  },
  bandoliers: {
    ammo_belt: { name: 'Ammo Belt', sprite: 'bandolier_ammo', maxPamphlets: 50 },
    power_cell: { name: 'Power Cell', sprite: 'bandolier_power', zapDamage: 1, zapRecharge: 0.5 }
  },
  shoes: {
    speed_boots: { name: 'Speed Boots', sprite: 'shoes_speed', speedMultiplier: 1.2 },
    stealth_sandals: { name: 'Stealth Sandals', sprite: 'shoes_stealth', speedMultiplier: 0.8 },
    sand_shoes: { name: 'Sand Shoes', sprite: 'shoes_sand', speedMultiplier: 1.0 }
  }
};

window.EQUIPMENT_TYPES = EQUIPMENT_TYPES;