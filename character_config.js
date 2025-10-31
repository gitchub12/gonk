// BROWSERFIREFOXHIDE character_config.js
// update: Added a 'perceptionRadius' stat to all NPC types to control their maximum vision range. Stormtroopers have been given a shorter radius as an example.

const CHARACTER_CONFIG = {
  // --- ALIENS ---
  humanoid: {
    name: "Default Humanoid",
    minecraftModel: "humanoid",
    stats: {
      health: 50, speed: 0.0250, attackRange: 1.5, perceptionRadius: 25, attackCooldown: 3.0,
      meleeDamage: 5, collisionRadius: 0.5, weight: 80, aggro: 0.5, accuracy: 60
    }
  },
  gamorrean: {
    name: "Gamorrean",
    minecraftModel: "humanoid",
    scaleX: 1.3, scaleY: 0.85, scaleZ: 1.6,
    stats: {
        health: 50, speed: 0.0250, attackRange: 1.6, perceptionRadius: 20, attackCooldown: 3.0,
        meleeDamage: 7, collisionRadius: 0.6, weight: 110, aggro: 0.7, accuracy: 65
    }
  },
  gungan: {
    name: "Gungan",
    minecraftModel: "humanoid",
    scaleX: 1.1, scaleY: 2.25, scaleZ: 1.1,
    stats: {
      health: 50, speed: 0.0250, attackRange: 1.5, perceptionRadius: 25, attackCooldown: 3.0,
      meleeDamage: 3, collisionRadius: 0.5, weight: 70, aggro: 0.3, accuracy: 60
    }
  },
   wookiee: {
    name: "Wookiee",
    minecraftModel: "humanoid",
    scaleX: 1.1, scaleY: 1.25, scaleZ: 1.1,
    stats: {
      health: 50, speed: 0.0250, attackRange: 1.8, perceptionRadius: 30, attackCooldown: 3.0,
      meleeDamage: 8, collisionRadius: 0.6, weight: 120, aggro: 0.5, accuracy: 85
    }
  },
  moncalamari: {
    name: "Mon Calamari",
    minecraftModel: "humanoid",
    stats: {
      health: 50, speed: 0.0250, attackRange: 1.5, perceptionRadius: 25, attackCooldown: 3.0,
      meleeDamage: 4, collisionRadius: 0.5, weight: 75, aggro: 0.4, accuracy: 60
    }
  },
  halfpint: {
    name: "Half-Pint",
    minecraftModel: "humanoid",
    scaleX: 0.6, scaleY: 0.6, scaleZ: 0.7,
    stats: {
      health: 50, speed: 0.0250, attackRange: 1.2, perceptionRadius: 20, attackCooldown: 3.0,
      meleeDamage: 2, collisionRadius: 0.3, weight: 30, aggro: 0.2, accuracy: 60
    }
  },
  quarterpint: {
    name: "Quarter-Pint",
    minecraftModel: "humanoid",
    scaleX: 0.3, scaleY: 0.3, scaleZ: 0.4,
    stats: {
      health: 50, speed: 0.0250, attackRange: 1.0, perceptionRadius: 18, attackCooldown: 3.0,
      meleeDamage: 1, collisionRadius: 0.2, weight: 10, aggro: 0.1, accuracy: 60
    }
  },
  hutt: {
    name: "Hutt",
    minecraftModel: "humanoid",
    scaleX: 2.5, scaleY: 1.5, scaleZ: 5.5,
    stats: {
      health: 50, speed: 0.0250, attackRange: 2.0, perceptionRadius: 22, attackCooldown: 3.0,
      meleeDamage: 10, collisionRadius: 1.2, weight: 500, aggro: 0.6, accuracy: 60
    }
  },

  // --- HUMANS & TROOPERS ---
  civilians: {
      name: "Civilian",
      minecraftModel: "humanoid",
      stats: {
          health: 50, speed: 0.0250, attackRange: 1.5, perceptionRadius: 25, attackCooldown: 3.0,
          meleeDamage: 4, collisionRadius: 0.5, weight: 85, aggro: 0.4, accuracy: 60
      }
  },
  human_male: {
      name: "Human Male",
      minecraftModel: "humanoid",
      stats: {
          health: 50, speed: 0.0250, attackRange: 1.5, perceptionRadius: 25, attackCooldown: 3.0,
          meleeDamage: 4, collisionRadius: 0.5, weight: 85, aggro: 0.4, accuracy: 60
      }
  },
  human_female: {
      name: "Human Female",
      minecraftModel: "humanoid",
      scaleX: 1, scaleY: 1, scaleZ: 1,
      stats: {
          health: 50, speed: 0.0250, attackRange: 1.5, perceptionRadius: 25, attackCooldown: 3.0,
          meleeDamage: 3, collisionRadius: 0.45, weight: 70, aggro: 0.4, accuracy: 60
      }
  },
  clone: {
    name: "Clone Trooper",
    minecraftModel: "humanoid",
    stats: {
      health: 50, speed: 0.0250, attackRange: 15.0, perceptionRadius: 30, attackCooldown: 3.0,
      meleeDamage: 5, collisionRadius: 0.5, weight: 80, aggro: 0.5, accuracy: 70
    }
  },
  mandalorian: {
    name: "Mandalorian",
    minecraftModel: "humanoid",
    stats: {
      health: 50, speed: 0.0250, attackRange: 15.0, perceptionRadius: 35, attackCooldown: 3.0,
      meleeDamage: 6, collisionRadius: 0.5, weight: 82, aggro: 0.7, accuracy: 85
    }
  },
  stormtrooper: {
    name: "Stormtrooper",
    minecraftModel: "humanoid",
    stats: {
      health: 50, speed: 0.0250, attackRange: 15.0, perceptionRadius: 15, attackCooldown: 3.0,
      meleeDamage: 5, collisionRadius: 0.5, weight: 80, aggro: 0.6, accuracy: 40
    }
  },
  darth: {
    name: "Sith Lord",
    minecraftModel: "humanoid",
     stats: {
      health: 100, speed: 0.0250, attackRange: 2.0, perceptionRadius: 35, attackCooldown: 3.0,
      meleeDamage: 10, collisionRadius: 0.5, weight: 85, aggro: 0.8, accuracy: 95
    }
  },

  // --- DROIDS ---
  droid_humanoid: {
    name: "Humanoid Droid",
    minecraftModel: "humanoid",
    scaleX: 0.8, scaleZ: 0.8,
    stats: {
      health: 50, speed: 0.0250, attackRange: 14.0, perceptionRadius: 28, attackCooldown: 3.0,
      meleeDamage: 4, collisionRadius: 0.4, weight: 100, aggro: 0.5, accuracy: 80
    }
  },
  r2d2: {
    name: "R2 Unit",
    minecraftModel: "humanoid", // Needs custom model
    scale: 0.6,
    stats: {
      health: 50, speed: 0.0250, attackRange: 1.0, perceptionRadius: 20, attackCooldown: 3.0,
      meleeDamage: 2, collisionRadius: 0.4, weight: 90, aggro: 0.1, accuracy: 80
    }
  },
  r5d4: {
      name: "R5 Unit",
      minecraftModel: "humanoid", // Needs custom model
      scale: 0.6,
      stats: { health: 50, speed: 0.0250, attackRange: 1.0, perceptionRadius: 20, meleeDamage: 2, attackCooldown: 3.0, weight: 90, aggro: 0.1, accuracy: 80 }
  },
  bb8: {
    name: "BB Unit",
    minecraftModel: "slime",
    scale: 0.5,
    stats: {
      health: 50, speed: 0.0250, attackRange: 1.0, perceptionRadius: 22, attackCooldown: 3.0,
      meleeDamage: 1, collisionRadius: 0.3, weight: 30, aggro: 0.1, accuracy: 80
    }
  },
  gonk: {
    name: "Gonk Droid",
    minecraftModel: "slime",
    scale: 0.8,
    stats: { health: 50, speed: 0.0250, attackRange: 1.0, perceptionRadius: 15, meleeDamage: 1, attackCooldown: 3.0, weight: 150, aggro: 0.0, accuracy: 80 }
  },
  mousedroid: {
      name: "Mouse Droid",
      minecraftModel: "slime", 
      scale: 0.4,
      stats: { health: 50, speed: 0.0250, attackRange: 1.0, perceptionRadius: 18, meleeDamage: 1, attackCooldown: 3.0, weight: 20, aggro: 0.1, accuracy: 80 }
  },
   probe: {
      name: "Probe Droid",
      minecraftModel: "humanoid", // Needs custom spider model
      stats: { health: 50, speed: 0.0250, attackRange: 12.0, perceptionRadius: 40, attackCooldown: 3.0, weight: 50, aggro: 0.5, accuracy: 80 }
  },
  irongolem: {
    name: "Large Droid",
    minecraftModel: "irongolem",
    stats: {
      health: 50, speed: 0.0250, attackRange: 2.5, perceptionRadius: 25, attackCooldown: 3.0,
      meleeDamage: 15, collisionRadius: 0.8, weight: 400, aggro: 0.8, accuracy: 80
    }
  },
};