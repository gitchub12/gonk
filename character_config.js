// BROWSERFIREFOXHIDE character_config.js
// Centralized definitions for all characters, including detailed stats and sound events.

const CHARACTER_CONFIG = {
  gungan: {
    name: "Gungan",
    skinTexture: "gungan1.png",
    minecraftModel: "humanoid",
    scale: 1.1, // Added scale property
    sounds: {
      meet: [],
      happy: [],
      unhappy: [],
      flirt: [],
      combatStart: [],
      attack: [],
      hurt: [],
      die: []
    },
    stats: {
      health: 12,
      speed: 0.03,
      runSpeed: 0.05,
      attackRange: 1.5,
      attackCooldown: 1.5,
      meleeRange: 1.5,
      meleeDamage: 3,
      collisionRadius: 0.5,
      spriteWidth: 1.0,
      spriteHeight: 1.9,
      loyalty: 0.5,
      courage: 0.4,
      imperialAffiliation: 0.1,
      rebelAffiliation: 0.6,
      fellowAffiliation: 0.8,
      weaponPickupAbility: 0.2,
      weight: 70,
      aggro: 0.3,
    }
  },
  stormtrooper: {
    name: "Stormtrooper",
    skinTexture: "stormtrooper1.png",
    minecraftModel: "humanoid",
    scale: 1.0, // Added scale property
    sounds: {
      meet: [],
      happy: [],
      unhappy: [],
      flirt: [],
      combatStart: [],
      attack: [],
      hurt: [],
      die: []
    },
    stats: {
      health: 10,
      speed: 0.025,
      runSpeed: 0.04,
      attackRange: 15.0,
      attackCooldown: 2.0,
      meleeRange: 1.5,
      meleeDamage: 5,
      collisionRadius: 0.5,
      spriteWidth: 1.0,
      spriteHeight: 1.8,
      loyalty: 0.2,
      courage: 0.8,
      imperialAffiliation: 0.9,
      rebelAffiliation: 0.0,
      fellowAffiliation: 0.5,
      weaponPickupAbility: 0.5,
      weight: 80,
      aggro: 0.6,
    }
  },
  wookiee: {
    name: "Wookiee",
    skinTexture: "wookiee1.png",
    minecraftModel: "humanoid",
    scale: 1.25, // Added scale property
    stats: { health: 20, speed: 0.02, attackRange: 2.0, attackCooldown: 2.5 }
  },
  r2d2: {
    name: "R2-D2",
    skinTexture: "r2d21.png",
    minecraftModel: "r2d2", // Assuming a custom model definition exists
    scale: 0.7,
    stats: { health: 15, speed: 0.03, attackRange: 10.0, attackCooldown: 1.8 }
  },
  bb8: {
    name: "BB-8",
    skinTexture: "bb81.png",
    minecraftModel: "slime",
    scale: 0.6,
    stats: { health: 12, speed: 0.04, attackRange: 1.0, attackCooldown: 3.0 }
  },
  irongolem: {
    name: "Iron Golem",
    skinTexture: "irongolem1.png",
    minecraftModel: "irongolem",
    scale: 1.4,
    stats: { health: 100, speed: 0.015, attackRange: 2.5, attackCooldown: 3.5 }
  }
};