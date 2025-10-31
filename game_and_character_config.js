// BROWSERFIREFOXHIDE game_and_character_config.js
// update: Halved the collision radius for the player and all NPC types to allow for closer movement.

const GAME_GLOBAL_CONSTANTS = {
  PLAYER: {
    MAX_HEALTH: 100,
    HEIGHT: 1.02,
    COLLISION_RADIUS: 0.2,
    CLIMB_HEIGHT: 0.88,
    JUMP_STRENGTH: 0.0374
  },
  MOVEMENT: {
    SPEED: 0.0462, 
    SPRINT_MULTIPLIER: 3, 
    FRICTION: 0.85,
    BOB_SPEED: 8,
    BOB_AMOUNT: 0.02
  },
  WEAPONS: {
    PAMPHLET_SPEED: 0.246, 
    BLASTER_BOLT_SPEED: 0.14,
    BLASTER_BOLT_OPACITY: 0.85,
    BLASTER_BOLT_RADIUS: 0.03,
    PAMPHLET_LIFESPAN: 480,
    PAMPHLET_MAX_AMMO: 100,
    PAMPHLET_START_AMMO: 100,
    PAMPHLET_SIZE_MULTIPLIER: 0.7,
    BLASTER_GLOW_SIZE: 2.3,
    BLASTER_GLOW_OPACITY: 0.15,
    // ADDED: Player bolt origin offsets
    BOLT_ORIGIN_X: 0.154,
    BOLT_ORIGIN_Y: -0.13,
    BOLT_ORIGIN_Z: 0.578
  },
  WEAPON_RANGES: {
    pistol: 12,
    rifle: 18,
    long: 25,
    melee: 1.5,
    saber: 2.0
  },
  ENVIRONMENT: {
    WALL_HEIGHT: 1.0,
    DOOR_OPEN_TIME: 5000,
    WALL_BARRIER: 0.6
  },
  ELEVATION: {
    STEP_HEIGHT: 0.22,
    PLAYER_GRAVITY: 0.0016,
    NPC_GRAVITY: 0.0243
  },
  GRID: {
    SIZE: 1
  },
  ALLY_RING: {
      OPACITY: 0.94,
      DIAMETER_MULTIPLIER: 0.44,
      BASE_HEIGHT: 0.033
  },
  FACTIONS: {
      PHYSICS_SPEED: 1,
      ALLIANCE_PULL: 0.13,
      KILL_PUSH: 5,
      DAMPING_FACTOR: 0.95,
      MIN_FORCE_THRESHOLD: 0.1,
      FRIENDLY_THRESHOLD: 30,
      HOSTILE_THRESHOLD: 82
  },
  FACTION_HUD: {
      SCALE: 1.0,
      OFFSET_X: 0,
      OFFSET_Y: 0,
      LINE_WIDTH: 2
  }
};

const CHARACTER_CONFIG = {}; // This is now obsolete and loaded from JSON files. Kept as an empty object to prevent errors in any lingering references.

// FIX: The FACTIONS object was outside the GAME_GLOBAL_CONSTANTS definition, causing a syntax error.
GAME_GLOBAL_CONSTANTS.FACTIONS = {
    "PHYSICS_SPEED": 3,
    "ALLIANCE_PULL": 0.13,
    "KILL_PUSH": 5,
    "DAMPING_FACTOR": 0.95,
    "MIN_FORCE_THRESHOLD": 0.008,
    "FRIENDLY_THRESHOLD": 20,
    "HOSTILE_THRESHOLD": 80,
    "HOME_PULL_STRENGTH": 0.05,
    "ALLIANCE_PULL_MULTIPLIER": 1
};

GAME_GLOBAL_CONSTANTS.FACTION_COLORS = {
    rebels: '#d94242',
    aliens: '#008000',
    clones: '#ff8c00',
    imperials: '#444444',
    droids: '#0066cc',
    mandalorians: '#FFC72C',
    sith: '#990000',
    takers: '#C0C0C0'
};