// BROWSERFIREFOXHIDE character_config.js
// Centralized definitions for all characters, including detailed stats and sound events.

const CHARACTER_CONFIG = {
  gungan: {
    name: "Gungan",
    skinTexture: "gungan1.png",
    minecraftModel: "humanoid",
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
  }
};