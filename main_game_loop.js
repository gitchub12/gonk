// BROWSERFIREFOXHIDE main_game_loop.js
// The main entry point and game loop, now correctly initializes all systems.

async function initGame() {
    console.log('--- GAME INITIALIZING ---');
    const loadingStatus = document.getElementById('loadingStatus');

    await assetManager.loadAll();

    game.init();
    audioSystem.init(game.camera);
    
    // Load the first level from the manager
    await levelManager.loadLevel(1);

    document.getElementById('loadingScreen').style.display = 'none';

    startGameLoop();
}

function startGameLoop() {
    function gameLoop(currentTime) {
        requestAnimationFrame(gameLoop);
        
        if (!game || !game.isInitialized) return;
        
        game.update(currentTime);
        
        // Update player movement using the ported physics system
        physics.updateMovement(game.deltaTime, inputHandler.keys, game.camera, false);
        
        game.render();
    }
    
    requestAnimationFrame(gameLoop);
}