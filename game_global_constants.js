// BROWSERFIREFOXHIDE game_global_constants.js
// Merged constants from the prototype to support new features.

const GAME_GLOBAL_CONSTANTS = {
  // === PLAYER SETTINGS ===
  PLAYER: {
    MAX_HEALTH: 10,
    HEIGHT: 1.5,
    COLLISION_RADIUS: 0.4
  },
  
  // === MOVEMENT (from prototype) ===
  MOVEMENT: {
    SPEED: 0.08,
    FRICTION: 0.85,
    BOB_SPEED: 8,
    BOB_AMOUNT: 0.1
  },
  
  // === WEAPONS ===
  WEAPONS: {
    PAMPHLET_SPEED: 0.3,
    PAMPHLET_LIFE: 100 // in frames
  },
  
  // === ENVIRONMENT ===
  ENVIRONMENT: {
    WALL_HEIGHT: 2.5,
    DOOR_OPEN_TIME: 5000,
    WALL_BARRIER: 0.6
  },
};

// Lock constants to prevent accidental changes
Object.freeze(GAME_GLOBAL_CONSTANTS);
Object.freeze(GAME_GLOBAL_CONSTANTS.PLAYER);
Object.freeze(GAME_GLOBAL_CONSTANTS.MOVEMENT);
Object.freeze(GAME_GLOBAL_CONSTANTS.WEAPONS);
Object.freeze(GAME_GLOBAL_CONSTANTS.ENVIRONMENT);

window.GAME_GLOBAL_CONSTANTS = GAME_GLOBAL_CONSTANTS;