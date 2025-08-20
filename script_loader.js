// BROWSERFIREFOXHIDE script_loader.js
// This script now defines the loading order for our new, flat file structure.

class ScriptLoader {
  constructor() {
    this.scriptsToLoad = [
      // CORE DATA & CONFIG
      { path: 'game_global_constants.js', name: 'Global Constants' },
      { path: 'character_config.js', name: 'Character Config' },
      { path: 'equipment_data.js', name: 'Equipment Data' },
      
      // ENGINE SYSTEMS
      { path: 'raw_asset_loader.js', name: 'Asset Loader' },
      { path: 'game_engine_core.js', name: 'Game Engine Core' },
      { path: 'rendering_system.js', name: 'Rendering System' },
      { path: 'player_physics_and_interactions.js', name: 'Player Physics' },
      { path: 'audio_system.js', name: 'Audio System' },
      { path: 'input.js', name: 'Input Handler' },
      
      // GAMEPLAY SYSTEMS
      { path: 'gonk_models.js', name: 'Gonk Models' },
      { path: 'furniture_loader.js', name: 'Furniture Loader' },
      { path: 'weapon_icons.js', name: 'Weapon Icons' },
      { path: 'weapons_player.js', name: 'Player Weapons' },
      { path: 'equipment_system.js', name: 'Equipment System' },
      { path: 'level_management_system.js', name: 'Level Manager' },

      // MAIN LOOP (Must be last)
      { path: 'main_game_loop.js', name: 'Main Game Loop' }
    ];
  }

  async loadGame() {
    console.log('--- GONK SCRIPT LOADER ---');
    const loadingStatus = document.getElementById('loadingStatus');

    for (const script of this.scriptsToLoad) {
      if (loadingStatus) loadingStatus.textContent = `Loading ${script.name}...`;
      try {
        await this.loadScript(script.path);
        console.log(`✓ Loaded: ${script.name}`);
      } catch (error) {
        console.error(`✗ FAILED to load ${script.name} from ${script.path}:`, error);
        if (loadingStatus) {
            loadingStatus.textContent = `CRITICAL ERROR loading ${script.name}. Cannot continue.`;
            loadingStatus.style.color = 'red';
        }
        return; // Halt loading on any failure
      }
    }

    console.log('--- ALL SCRIPTS LOADED ---');
    if (typeof initGame === 'function') {
      initGame();
    } else {
      console.error('initGame function not found! Main loop did not load correctly.');
    }
  }

  loadScript(path) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = path;
      script.async = false; // Load scripts in order
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load script: ${path}`));
      document.head.appendChild(script);
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const loader = new ScriptLoader();
  loader.loadGame();
});