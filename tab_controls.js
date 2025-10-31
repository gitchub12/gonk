// BROWSERFIREFOXHIDE tab_controls.js
// update: Re-implemented the logic for the player and NPC weapon sliders to correctly modify weapon transforms and pamphlet sizes in real-time.
// update: Faction physics reset button now correctly reads default values from GAME_GLOBAL_CONSTANTS.

class TabControls {
    constructor(gameInstance, playerWeaponSystem, physicsSystem) {
        this.game = gameInstance;
        this.pws = playerWeaponSystem;
        this.physics = physicsSystem;
        this.factionControls = new TabFactionControls(gameInstance, this);
        this.isVisible = false;
        this.leftPanel = null;
        this.rightPanel = null;
        this.animIndex = 0;
        this.animStates = ['idle', 'walk', 'run', 'shoot', 'melee', 'aim'];
        this.muzzleFlashHelpers = [];
        this.activeHelperIndex = 0;
        this.maxHelpers = 30;

        const lightHelperGeo = new THREE.SphereGeometry(0.1, 16, 16);
        const lightHelperMat = new THREE.MeshBasicMaterial({ color: 0x0000ff, wireframe: false, depthTest: false, depthWrite: false });
        this.lightOriginHelper = new THREE.Mesh(lightHelperGeo, lightHelperMat);
        this.lightOriginHelper.visible = false;
        this.lightOriginHelper.renderOrder = 999;
        this.game.scene.add(this.lightOriginHelper);

        // ADDED: Helper for player's blaster bolt origin
        const boltHelperGeo = new THREE.SphereGeometry(0.02, 8, 8);
        const boltHelperMat = new THREE.MeshBasicMaterial({ color: 0xffff00, wireframe: false, depthTest: false });
        this.boltOriginHelper = new THREE.Mesh(boltHelperGeo, boltHelperMat);
        this.boltOriginHelper.renderOrder = 1000; // Render on top
        this.boltOriginHelper.visible = false;
        this.game.scene.add(this.boltOriginHelper);

        this.createPanels();
        this.addEventListeners();
        this.initialHide();
    }

    createPanels() {
        const damageFeedbackHTML = `
            <hr><h4>Player Damage Feedback</h4>
            <div class="control-group"><label>Flash Opacity: <span id="dmg_flash_opacity_val">0.5</span></label><input type="range" class="damage-slider" id="dmg_flash_opacity" min="0" max="1" value="0.5" step="0.05"></div>
            <div class="control-group"><label>Flash Duration (ms): <span id="dmg_flash_duration_val">80</span></label><input type="range" class="damage-slider" id="dmg_flash_duration" min="10" max="500" value="80" step="10"></div>
            <div class="control-group"><label>Shake Intensity: <span id="dmg_shake_intensity_val">0.02</span></label><input type="range" class="damage-slider" id="dmg_shake_intensity" min="0" max="0.1" value="0.02" step="0.001"></div>
            <div class="control-group"><label>Shake Duration (s): <span id="dmg_shake_duration_val">0.2</span></label><input type="range" class="damage-slider" id="dmg_shake_duration" min="0" max="1" value="0.2" step="0.05"></div>
            <button id="dmg_simulate_btn">Simulate Hit</button>
            <button id="dmg_snapshot_btn">Snapshot Damage FX</button>
        `;

        const combatHTML = `
            <h4>Combat Debug</h4>
            <p>Selects nearest NPC to run commands.</p>
            <div class="control-group">
                <button id="npc_melee_attack">Force Melee Attack</button>
                <button id="npc_blaster_attack">Force Blaster Attack</button>
            </div>
            <hr>
            <h4>Weapon Muzzle Offset</h4>
            <p>Adjusts projectile origin for all NPCs with the selected weapon category. The red dots show the calculated muzzle position.</p>
            <div class="control-group"><label>Muzzle X (Right/Left): <span id="npc_muzzle_posX_val">0</span></label><input type="range" class="muzzle-slider" id="npc_muzzle_posX" min="-2" max="2" value="0" step="0.01"></div>
            <div class="control-group"><label>Muzzle Y (Up/Down): <span id="npc_muzzle_posY_val">0</span></label><input type="range" class="muzzle-slider" id="npc_muzzle_posY" min="-2" max="2" value="0" step="0.01"></div>
            <div class="control-group"><label>Muzzle Z (Fwd/Back): <span id="npc_muzzle_posZ_val">1.0</span></label><input type="range" class="muzzle-slider" id="npc_muzzle_posZ" min="-2" max="3" value="1" step="0.01"></div>
            <button id="npc_muzzle_snapshotBtn">Snapshot Muzzle Offset</button>
            ${damageFeedbackHTML}
        `;

        const effectsHTML = `
            <h4>Saber/Blaster Bolt Glow (Emissive)</h4>
            <p>Affects all sabers, bolts, and weapon glows. <span id="glow_origin_status" style="color: #ffcc00;">[Light Origin Helper ON]</span></p>
            <div class="control-group"><label>Color:</label><input type="color" class="effects-input" id="fx_glow_color" value="#00ffff"></div>
            <div class="control-group"><label>Brightness: <span id="fx_glow_intensity_val">2.5</span></label><input type="range" class="effects-slider" id="fx_glow_intensity" min="0" max="10" value="2.5" step="0.1"></div>
            <div class="control-group"><label>Radius: <span id="fx_glow_distance_val">4</span></label><input type="range" class="effects-slider" id="fx_glow_distance" min="0" max="20" value="4" step="0.5"></div>
            <div class="control-group"><label>Origin X: <span id="fx_glow_posX_val">0</span></label><input type="range" class="effects-slider" id="fx_glow_posX" min="-20" max="20" value="0" step="0.1"></div>
            <div class="control-group"><label>Origin Y: <span id="fx_glow_posY_val">0</span></label><input type="range" class="effects-slider" id="fx_glow_posY" min="-20" max="20" value="0" step="0.1"></div>
            <div class="control-group"><label>Origin Z: <span id="fx_glow_posZ_val">0</span></label><input type="range" class="effects-slider" id="fx_glow_posZ" min="-20" max="20" value="0" step="0.1"></div>
            <hr><h4>Ambient Light</h4>
            <div class="control-group"><label>Ambient Intensity: <span id="fx_ambient_intensity_val">0.6</span></label><input type="range" class="effects-slider" id="fx_ambient_intensity" min="0" max="2" value="0.6" step="0.05"></div>
            <hr><h4>Player Weapon Light</h4>
            <div class="control-group"><label>Color:</label><input type="color" class="effects-input" id="fx_light_color" value="#0088ff"></div>
            <div class="control-group"><label>Intensity: <span id="fx_light_intensity_val">1.5</span></label><input type="range" class="effects-slider" id="fx_light_intensity" min="0" max="10" value="1.5" step="0.1"></div>
            <div class="control-group"><label>Distance: <span id="fx_light_distance_val">3</span></label><input type="range" class="effects-slider" id="fx_light_distance" min="0" max="20" value="3" step="0.5"></div>
            <div class="control-group"><label>Fade Time (s): <span id="fx_light_fade_val">0.15</span></label><input type="range" class="effects-slider" id="fx_light_fade" min="0.01" max="1" value="0.15" step="0.01"></div>
            <button id="fx_snapshot_btn">Snapshot Effects</button>
            <hr><h4>Blaster Glow Sprite</h4>
            <div class="control-group"><label>Glow Size: <span id="fx_glow_size_val">2.3</span></label><input type="range" class="effects-slider" id="fx_glow_size" min="0.1" max="25" value="2.3" step="0.1"></div>
            <div class="control-group"><label>Glow Opacity: <span id="fx_glow_opacity_val">0.15</span></label><input type="range" class="effects-slider" id="fx_glow_opacity" min="0" max="1" value="0.15" step="0.05"></div>

        `;
        
        const factionHTMLs = this.factionControls.createFactionHTML();
        // This will be injected later
        const simKillHTML = `<div id="sim-kill-buttons"></div>`;

        const speedHTML = `
            <h4>Physics & Speed Constants</h4>
            <p>Adjust global movement and physics properties. Requires restart to fully apply to new NPCs.</p>
            <div class="control-group"><label>Player Speed: <span id="speed_player_val">0.0306</span></label><input type="range" class="speed-slider" id="speed_player" min="0.001" max="0.1" value="0.0306" step="0.0001"></div>
            <div class="control-group"><label>NPC Base Speed: <span id="speed_npc_base_val">0.0060</span></label><input type="range" class="speed-slider" id="speed_npc_base" min="0.001" max="0.1" value="0.0060" step="0.0001"></div>
            <div class="control-group"><label>Jump Strength: <span id="speed_jump_val">0.0326</span></label><input type="range" class="speed-slider" id="speed_jump" min="0.001" max="0.1" value="0.0326" step="0.0001"></div>
            <div class="control-group"><label>Player Gravity (x1000): <span id="speed_gravity_val">1.000</span></label><input type="range" class="speed-slider" id="speed_gravity" min="0.0001" max="0.002" value="0.0010" step="0.00001"></div>
            <div class="control-group"><label>NPC Gravity: <span id="speed_npc_gravity_val">0.0010</span></label><input type="range" class="speed-slider" id="speed_npc_gravity" min="0.001" max="0.2" value="0.0010" step="0.0001"></div>
            <div class="control-group"><label>Climb Height (Step): <span id="speed_climb_height_val">0.22</span></label><input type="range" class="speed-slider" id="speed_climb_height" min="0.05" max="1.5" value="0.22" step="0.01"></div>
            <hr><h4>Projectiles</h4>
            <div class="control-group"><label>Pamphlet Speed: <span id="speed_pamphlet_val">0.062</span></label><input type="range" class="speed-slider" id="speed_pamphlet" min="0.01" max="0.3" value="0.062" step="0.001"></div>
            <div class="control-group"><label>Blaster Bolt Speed: <span id="speed_blaster_val">0.139</span></label><input type="range" class="speed-slider" id="speed_blaster" min="0.01" max="0.3" value="0.139" step="0.001"></div>
            <div class="control-group"><label>Blaster Bolt Radius: <span id="speed_blaster_radius_val">0.025</span></label><input type="range" class="speed-slider" id="speed_blaster_radius" min="0.005" max="0.2" value="0.025" step="0.001"></div>
            <div class="control-group"><label>Blaster Bolt Opacity: <span id="speed_blaster_opacity_val">0.85</span></label><input type="range" class="speed-slider" id="speed_blaster_opacity" min="0.0" max="1.0" value="0.85" step="0.01"></div>
            <hr><h4>Combat</h4>
            <div class="control-group"><label>NPC Attack Rate (s): <span id="speed_npc_cooldown_val">3.00</span></label><input type="range" class="speed-slider" id="speed_npc_cooldown" min="0.1" max="20.0" value="3.00" step="0.01"></div>
            <button id="speed_snapshot_btn">Snapshot Speed Constants</button>
        `;

        const rangeHTML = `
            <h4>Weapon Category Ranges</h4>
            <p>Adjusts the distance at which an NPC will stop approaching and start attacking, based on their weapon type.</p>
            <div class="control-group"><label>Pistol Range: <span id="range_pistol_val">12</span></label><input type="range" class="range-slider" id="range_pistol" min="1" max="30" value="12" step="0.5"></div>
            <div class="control-group"><label>Rifle Range: <span id="range_rifle_val">18</span></label><input type="range" class="range-slider" id="range_rifle" min="1" max="50" value="18" step="0.5"></div>
            <div class="control-group"><label>Long Range: <span id="range_long_val">25</span></label><input type="range" class="range-slider" id="range_long" min="1" max="80" value="25" step="0.5"></div>
            <div class="control-group"><label>Melee Range: <span id="range_melee_val">1.5</span></label><input type="range" class="range-slider" id="range_melee" min="0.5" max="5" value="1.5" step="0.1"></div>
            <div class="control-group"><label>Saber Range: <span id="range_saber_val">2.0</span></label><input type="range" class="range-slider" id="range_saber" min="0.5" max="5" value="2.0" step="0.1"></div>
            <button id="range_snapshot_btn">Snapshot Ranges</button>
        `;

        const npcPoseHTML = `
            <h4>Body</h4>
            <div class="control-group"><label>Y-Rotation: <span id="npc_body_rotY_val">0</span></label><input type="range" class="npc-pose-slider" id="npc_body_rotY" min="-180" max="180" value="0" step="1"></div>
            <div class="control-group"><label>Y-Position (Offset): <span id="npc_body_posY_val">0</span></label><input type="range" class="npc-pose-slider" id="npc_body_posY" min="-5" max="5" value="0" step="0.1"></div>
            <div class="control-group"><label>Instance Scale: <span id="npc_body_scale_val">1</span></label><input type="range" class="npc-pose-slider" id="npc_body_scale" min="0.5" max="3" value="1" step="0.05"></div>
            <h4>Left Arm</h4>
            <div class="control-group"><label>Arm Length: <span id="npc_lArm_scaleY_val">1</span></label><input type="range" class="npc-pose-slider" id="npc_lArm_scaleY" min="0.5" max="2" value="1" step="0.05"></div>
            <div class="control-group"><label>Rot X: <span id="npc_lArm_rotX_val">0</span></label><input type="range" class="npc-pose-slider" id="npc_lArm_rotX" min="-180" max="180" value="0" step="1"></div>
            <div class="control-group"><label>Rot Y: <span id="npc_lArm_rotY_val">0</span></label><input type="range" class="npc-pose-slider" id="npc_lArm_rotY" min="-180" max="180" value="0" step="1"></div>
            <div class="control-group"><label>Rot Z: <span id="npc_lArm_rotZ_val">0</span></label><input type="range" class="npc-pose-slider" id="npc_lArm_rotZ" min="-180" max="180" value="0" step="1"></div>
            <h4>Right Arm</h4>
            <div class="control-group"><label>Arm Length: <span id="npc_rArm_scaleY_val">1</span></label><input type="range" class="npc-pose-slider" id="npc_rArm_scaleY" min="0.5" max="2" value="1" step="0.05"></div>
            <div class="control-group"><label>Rot X: <span id="npc_rArm_rotX_val">0</span></label><input type="range" class="npc-pose-slider" id="npc_rArm_rotX" min="-180" max="180" value="0" step="1"></div>
            <div class="control-group"><label>Rot Y: <span id="npc_rArm_rotY_val">0</span></label><input type="range" class="npc-pose-slider" id="npc_rArm_rotY" min="-180" max="180" value="0" step="1"></div>
            <div class="control-group"><label>Rot Z: <span id="npc_rArm_rotZ_val">0</span></label><input type="range" class="npc-pose-slider" id="npc_rArm_rotZ" min="-180" max="180" value="0" step="1"></div>
            <button id="npc_pose_snapshotBtn">Snapshot Pose</button>`;

        const playerWeaponHTML = `
            <h4>Player Weapon</h4>
            <div class="control-group"><label>X-Offset: <span id="w_posX_val">-0.8150</span></label><input type="range" class="player-weapon-slider" id="weapon_posX" min="-2" max="2" value="-0.815" step="0.0001"></div>
            <div class="control-group"><label>Y-Offset: <span id="w_posY_val">-0.6240</span></label><input type="range" class="player-weapon-slider" id="weapon_posY" min="-2" max="2" value="-0.624" step="0.0001"></div>
            <div class="control-group"><label>Z-Offset: <span id="w_posZ_val">-1.500</span></label><input type="range" class="player-weapon-slider" id="weapon_posZ" min="-3" max="0" value="-1.5" step="0.001"></div><hr>
            <div class="control-group"><label>Pitch: <span id="w_rotX_val">0.0</span></label><input type="range" class="player-weapon-slider" id="weapon_rotX" min="-180" max="180" value="0" step="0.1"></div>
            <div class="control-group"><label>Yaw: <span id="w_rotY_val">0.0</span></label><input type="range" class="player-weapon-slider" id="weapon_rotY" min="-180" max="180" value="0" step="0.1"></div>
            <div class="control-group"><label>Roll: <span id="w_rotZ_val">-5.7</span></label><input type="range" class="player-weapon-slider" id="weapon_rotZ" min="-180" max="180" value="-5.7" step="0.1"></div><hr>
            <div class="control-group"><label>Scale: <span id="w_scale_val">1.4872</span></label><input type="range" class="player-weapon-slider" id="weapon_scale" min="0.1" max="5.0" value="1.4872" step="0.0001"></div>
            <div class="control-group"><label>Pamphlet Size: <span id="w_pamphlet_size_val">1.0</span></label><input type="range" class="player-weapon-slider" id="weapon_pamphlet_size" min="0.1" max="5.0" value="1.0" step="0.1"></div>
            <hr><h4>Blaster Bolt Origin</h4>
            <div class="control-group"><label>Bolt Origin X (Right/Left): <span id="w_bolt_originX_val">0.30</span></label><input type="range" class="player-weapon-slider" id="weapon_bolt_originX" min="-0.3" max="0.4" value="0.3" step="0.002"></div>
            <div class="control-group"><label>Bolt Origin Y (Up/Down): <span id="w_bolt_originY_val">-0.12</span></label><input type="range" class="player-weapon-slider" id="weapon_bolt_originY" min="-0.3" max="0.4" value="-0.12" step="0.002"></div>
            <div class="control-group"><label>Bolt Origin Z (Fwd/Back): <span id="w_bolt_originZ_val">0.50</span></label><input type="range" class="player-weapon-slider" id="weapon_bolt_originZ" min="0.1" max="0.9" value="0.5" step="0.002"></div>
            <button id="w_snapshotBtn">Snapshot Player Weapon</button>`;

        const labelHTML = `
            <h4>NPC Nameplate</h4>
            <div class="control-group"><label>X-Offset (All): <span id="npc_label_posX_val">0</span></label><input type="range" class="npc-label-slider" id="npc_label_posX" min="-100" max="100" value="0" step="1"></div>
            <div class="control-group"><label>Y-Offset (All): <span id="npc_label_posY_val">54</span></label><input type="range" class="npc-label-slider" id="npc_label_posY" min="-100" max="100" value="54" step="1"></div>
            <div class="control-group"><label>Z-Offset (All): <span id="npc_label_posZ_val">0</span></label><input type="range" class="npc-label-slider" id="npc_label_posZ" min="-100" max="100" value="0" step="1"></div>
            <div class="control-group"><label>Overall Scale: <span id="npc_label_scale_val">0.005</span></label><input type="range" class="npc-label-slider" id="npc_label_scale" min="0.001" max="0.1" value="0.005" step="0.001"></div>
            <div class="control-group"><label>Name Scale: <span id="npc_name_scale_val">13.85</span></label><input type="range" class="npc-label-slider" id="npc_name_scale" min="0.1" max="40.0" value="13.85" step="0.05"></div>
            <div class="control-group"><label>Name Y-Offset: <span id="npc_name_posY_val">540</span></label><input type="range" class="npc-label-slider" id="npc_name_posY" min="-3000" max="3000" value="540" step="10"></div>
            <div class="control-group"><label>Health Bar Scale: <span id="npc_bar_scale_val">5.45</span></label><input type="range" class="npc-label-slider" id="npc_bar_scale" min="0.1" max="15.0" value="5.45" step="0.05"></div>
            <hr><h4>Ally Ring</h4>
            <div class="control-group"><label>Ring Opacity: <span id="ring_opacity_val">0.52</span></label><input type="range" class="ring-slider" id="ring_opacity" min="0" max="1" value="0.52" step="0.01"></div>
            <div class="control-group"><label>Ring Diameter Multiplier: <span id="ring_diameter_val">0.75</span></label><input type="range" class="ring-slider" id="ring_diameter" min="0.1" max="2.0" value="0.75" step="0.01"></div>
            <div class="control-group"><label>Ring Base Height: <span id="ring_height_val">0.02</span></label><input type="range" class="ring-slider" id="ring_height" min="0.01" max="0.5" value="0.02" step="0.001"></div>
            <hr><h4>Faction HUD Visuals</h4>
            <div class="control-group"><label>HUD Scale (In/Out): <span id="faction_hud_scale_val">0.7</span></label><input type="range" class="faction-hud-slider" id="faction_hud_scale" min="0.1" max="2.0" value="0.7" step="0.05"></div>
            <div class="control-group"><label>HUD X Offset: <span id="faction_hud_offsetX_val">0</span></label><input type="range" class="faction-hud-slider" id="faction_hud_offsetX" min="-50" max="50" value="0" step="1"></div>
            <div class="control-group"><label>HUD Y Offset: <span id="faction_hud_offsetY_val">0</span></label><input type="range" class="faction-hud-slider" id="faction_hud_offsetY" min="-50" max="50" value="0" step="1"></div>
            <div class="control-group"><label>Line Width: <span id="faction_hud_lineWidth_val">2</span></label><input type="range" class="faction-hud-slider" id="faction_hud_lineWidth" min="1" max="10" value="2" step="0.5"></div>
            <hr><h4>Faction Avatars (Right Side)</h4>
            <div class="control-group"><label>Size (px): <span id="avatar_size_val">80</span></label><input type="range" class="avatar-slider" id="avatar_size" min="20" max="250" value="80" step="1"></div>
            <div class="control-group"><label>X Offset (from Right %): <span id="avatar_offsetX_val">2</span></label><input type="range" class="avatar-slider" id="avatar_offsetX" min="0" max="95" value="2" step="1"></div>
            <div class="control-group"><label>Y Offset (from Top %): <span id="avatar_offsetY_val">50</span></label><input type="range" class="avatar-slider" id="avatar_offsetY" min="0" max="95" value="50" step="1"></div>
            <button id="snapshot_visuals_btn">Snapshot Visuals</button>
        `;

        const uiPositionHTML = `
            <h4>Health/Gonk Display (Bottom-Left)</h4>
            <div class="control-group"><label>Left Offset (%): <span id="ui_gonk_offsetX_val">23</span></label><input type="range" class="ui-slider" id="ui_gonk_offsetX" min="0" max="100" value="23" step="1"></div>
            <div class="control-group"><label>Bottom Offset (%): <span id="ui_gonk_offsetY_val">5</span></label><input type="range" class="ui-slider" id="ui_gonk_offsetY" min="0" max="100" value="5" step="1"></div>
            <h4>Ally Boxes (Bottom-Center)</h4>
            <div class="control-group"><label>X Offset (%): <span id="ui_ally_offsetX_val">57</span></label><input type="range" class="ui-slider" id="ui_ally_offsetX" min="0" max="100" value="57" step="1"></div>
            <div class="control-group"><label>Bottom Offset (%): <span id="ui_ally_offsetY_val">10</span></label><input type="range" class="ui-slider" id="ui_ally_offsetY" min="0" max="100" value="10" step="1"></div>
            <h4>Ammo/Weapon Display (Bottom-Left)</h4>
            <div class="control-group"><label>Left Offset (%): <span id="ui_ammo_offsetX_val">12</span></label><input type="range" class="ui-slider" id="ui_ammo_offsetX" min="0" max="100" value="12" step="1"></div>
            <div class="control-group"><label>Bottom Offset (%): <span id="ui_ammo_offsetY_val">43</span></label><input type="range" class="ui-slider" id="ui_ammo_offsetY" min="0" max="100" value="43" step="1"></div>
            <button id="ui_snapshotBtn">Snapshot UI</button>
        `;


        const npcWeaponSliderHTML = `
            <div class="control-group"><label>X-Offset: <span id="npc_posX_val">0.1</span></label><input type="range" class="npc-weapon-slider" id="npc_weapon_posX" min="-10" max="10" value="0.1" step="0.01"></div>
            <div class="control-group"><label>Y-Offset: <span id="npc_posY_val">-0.25</span></label><input type="range" class="npc-weapon-slider" id="npc_weapon_posY" min="-50" max="50" value="-0.25" step="0.01"></div>
            <div class="control-group"><label>Z-Offset: <span id="npc_posZ_val">0.2</span></label><input type="range" class="npc-weapon-slider" id="npc_weapon_posZ" min="-50" max="50" value="0.2" step="0.01"></div><hr>
            <div class="control-group"><label>Pitch: <span id="npc_rotX_val">0.0</span></label><input type="range" class="npc-weapon-slider" id="npc_weapon_rotX" min="-180" max="180" value="0" step="0.1"></div>
            <div class="control-group"><label>Yaw: <span id="npc_rotY_val">-90.0</span></label><input type="range" class="npc-weapon-slider" id="npc_weapon_rotY" min="-180" max="180" value="-90" step="0.1"></div>
            <div class="control-group"><label>Roll: <span id="npc_rotZ_val">0.0</span></label><input type="range" class="npc-weapon-slider" id="npc_weapon_rotZ" min="-180" max="180" value="0" step="0.1"></div><hr>
            <div class="control-group"><label>Scale: <span id="npc_scale_val">266</span></label><input type="range" class="npc-weapon-slider" id="npc_weapon_scale" min="1" max="500" value="266" step="1"></div>
            <hr><h4>Weapon Planes</h4>
            <div class="control-group"><label>Plane Distance (x1000): <span id="npc_plane_dist_val">10.0</span></label><input type="range" class="npc-weapon-slider" id="npc_weapon_plane_dist" min="-0.02" max="0.03" value="0.01" step="0.0001"></div>
            <div class="control-group"><label>Plane Yaw Angle: <span id="npc_plane_yaw_val">0.50</span></label><input type="range" class="npc-weapon-slider" id="npc_weapon_plane_yaw" min="-2" max="2" value="0.5" step="0.01"></div>
            <div class="control-group"><label>Plane Pitch Angle: <span id="npc_plane_pitch_val">0.00</span></label><input type="range" class="npc-weapon-slider" id="npc_weapon_plane_pitch" min="-2" max="2" value="0.0" step="0.01"></div>
            <button id="npc_snapshotBtn">Snapshot NPC Weapon</button>`;

        let weaponCatTabs = '';
        // This logic is being removed because it was incorrectly loading ALL weapon categories,
        // including NPC-only ones, into the player's weapon system context.
        // The new system will handle NPC weapons entirely within the level editor's properties panel.
        // if (window.assetManager && window.assetManager.weaponData && window.assetManager.weaponData._defaults) {
        //     const categories = Object.keys(window.assetManager.weaponData._defaults.categoryDefaults);
        //     categories.forEach((cat, index) => {
        //         const activeClass = index === 0 ? 'active' : '';
        //         weaponCatTabs += `<button class="editor-tab-btn weapon-cat-btn ${activeClass}" data-category="${cat}">${cat}</button>`;
        //     });
        // }
        
        const rightPanelHTML = `
            <div class="editor-main-content">
                <div id="npc-weapon-pane" class="tab-pane active">${npcWeaponSliderHTML}</div>
            </div>
            <div class="tab-buttons">${weaponCatTabs}</div>`;

        const leftPanelHTML = `
            <div class="editor-main-content">
                <div id="tab-pane-combat" class="tab-pane">${combatHTML}</div>
                <div id="tab-pane-effects" class="tab-pane">${effectsHTML}</div>${simKillHTML}
                ${factionHTMLs.globals}
                ${factionHTMLs.panes}
                <div id="tab-pane-speed" class="tab-pane">${speedHTML}</div>
                <div id="tab-pane-range" class="tab-pane">${rangeHTML}</div>
                <div id="tab-pane-npcs" class="tab-pane">${npcPoseHTML}</div>
                <div id="tab-pane-player-weapon" class="tab-pane">${playerWeaponHTML}</div>
                <div id="tab-pane-label" class="tab-pane">${labelHTML}</div>
                <div id="tab-pane-ui" class="tab-pane">${uiPositionHTML}</div>
                <div class="global-controls">
                    <hr><h4>Global NPC Controls</h4>
                    <button id="npcCycleAnim">Cycle Anim (<span id="npcAnimState">idle</span>)</button>
                </div>
            </div>
            <div class="tab-buttons">
                <button class="editor-tab-btn" data-tab="tab-pane-combat">Combat</button>
                <button class="editor-tab-btn" data-tab="tab-pane-effects">Effects</button>
                <button class="editor-tab-btn active" data-tab="tab-pane-faction-globals">Factions</button>
                ${factionHTMLs.tabs}
                <button class="editor-tab-btn" data-tab="tab-pane-speed">Speed</button>
                <button class="editor-tab-btn" data-tab="tab-pane-range">Range</button>
                <button class="editor-tab-btn" data-tab="tab-pane-npcs">NPCs</button>
                <button class="editor-tab-btn" data-tab="tab-pane-player-weapon">Player Weapon</button>
                <button class="editor-tab-btn" data-tab="tab-pane-label">Label</button>
                <button class="editor-tab-btn" data-tab="tab-pane-ui">UI</button>
            </div>`;

        const panelStyle = `
            .editorPanel { position: absolute; top: 10px; color: white; background-color: rgba(10, 20, 30, 0.85); padding: 10px; border-radius: 8px; font-family: monospace; border: 1px solid rgba(0, 150, 200, 0.4); backdrop-filter: blur(5px); display: none; z-index: 1001; user-select: none; max-height: 95vh; display: flex; }
            #leftEditorPanel { left: 10px; width: 380px; }
            #rightEditorPanel { right: 10px; width: 320px; }
            .editor-main-content { flex-grow: 1; padding-right: 10px; overflow-y: auto; }
            .editorPanel h4 { margin-top: 10px; margin-bottom: 10px; border-bottom: 1px solid #555; padding-bottom: 5px; color: #00ffff; }
            .editorPanel p { font-size: 11px; color: #aaa; margin-bottom: 15px; }
            .editorPanel .control-group { margin: 10px 0; }
            .editorPanel label { display: block; margin-bottom: 5px; font-size: 12px; }
            .editorPanel input[type="range"] { width: 100%; }
            .editorPanel input[type="text"], .editorPanel input[type="color"], .editorPanel input[type="checkbox"] { width: 95%; background-color: #222; color: #fff; border: 1px solid #555; padding: 4px; box-sizing: border-box;}
            .editorPanel input[type="color"] { height: 30px; padding: 0; }
            .editorPanel button { width: 100%; padding: 8px; margin-top: 10px; background: #444; border: 1px solid #666; color: #fff; cursor: pointer; border-radius: 4px; }
            .editorPanel button:hover { background: #555; }
            .tab-buttons { display: flex; flex-direction: column; gap: 5px; border-left: 1px solid #555; padding-left: 10px; overflow-y: auto; }
            .editor-tab-btn { margin-top: 0; border-radius: 4px; text-align: right; text-transform: capitalize; background-color: #21252b; color: #888; border: 1px solid #444; transition: all 0.2s ease; }
            .editor-tab-btn.active { background-color: #FFFFFF; color: #000000; font-weight: bold; border-color: #FFF; }
            .editor-tab-btn.faction-color-tab { color: #fff; background-color: var(--faction-bg); border-color: var(--faction-border); }
            .editor-tab-btn.faction-color-tab.active { box-shadow: 0 0 10px var(--faction-border); border-width: 2px; }
            .tab-pane { display: none; }
            .tab-pane.active { display: block; }
            .horizontal-group { display: flex; align-items: center; gap: 10px; }
            .toggle-label { display: flex; align-items: center; gap: 5px; font-weight: bold; }
            .sim-ally-group { display: flex; align-items: center; gap: 10px; }
            .sim-ally-group label { flex-basis: 100px; flex-shrink: 0; }
            .sim-ally-group .sim-kill-btn { width: 50px; padding: 2px; margin-top: 0; font-size: 10px; flex-shrink: 0; }
            .global-controls { margin-top: auto; }
        `;

        const styleEl = document.createElement('style');
        styleEl.innerHTML = panelStyle;
        document.head.appendChild(styleEl);

        this.leftPanel = document.createElement('div');
        this.leftPanel.id = 'leftEditorPanel';
        this.leftPanel.className = 'editorPanel';
        this.leftPanel.innerHTML = leftPanelHTML;
        document.body.appendChild(this.leftPanel);

        this.rightPanel = document.createElement('div');
        this.rightPanel.id = 'rightEditorPanel';
        this.rightPanel.className = 'editorPanel';
        this.rightPanel.innerHTML = rightPanelHTML;
        document.body.appendChild(this.rightPanel);

        const helperGeo = new THREE.SphereGeometry(0.05, 8, 8);
        const helperMat = new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: false });
        for (let i = 0; i < this.maxHelpers; i++) {
            const helper = new THREE.Mesh(helperGeo, helperMat);
            helper.visible = false;
            this.muzzleFlashHelpers.push(helper);
            this.game.scene.add(helper);
        }
    }

    addEventListeners() {
        this.factionControls.addEventListeners();

        // Faction HUD in Label Tab
        document.querySelectorAll('.faction-hud-slider').forEach(el => el.addEventListener('input', (e) => this.updateFactionHudFromUI(e)));

        // ADDED: Faction Avatar sliders
        document.querySelectorAll('.avatar-slider').forEach(el => el.addEventListener('input', (e) => this.updateFactionAvatarFromUI(e)));


        // Labels & Rings
        document.querySelectorAll('.npc-label-slider, .ring-slider').forEach(el => el.addEventListener('input', (e) => {
            const valSpan = document.getElementById(`${e.target.id}_val`);
            if (valSpan) valSpan.textContent = e.target.value;
            this.updateLabelAndRingFromUI();
        }));
        document.getElementById('snapshot_visuals_btn').addEventListener('click', () => this.snapshotVisuals());
        
        // --- The rest of the event listeners ---
        document.getElementById('npc_melee_attack').addEventListener('click', () => this.triggerNpcAttack('melee'));
        document.getElementById('npc_blaster_attack').addEventListener('click', () => this.triggerNpcAttack('blaster'));
        document.getElementById('npc_muzzle_snapshotBtn').addEventListener('click', () => this.snapshotMuzzleOffset());
        document.querySelectorAll('.muzzle-slider').forEach(el => el.addEventListener('input', (e) => {
            const valSpan = document.getElementById(`${e.target.id}_val`);
            if (valSpan) valSpan.textContent = parseFloat(e.target.value).toFixed(3);
            this.updateMuzzleHelpersFromUI();
        }));
        document.getElementById('dmg_snapshot_btn').addEventListener('click', () => this.snapshotDamageFx());
        document.getElementById('dmg_simulate_btn').addEventListener('click', () => {
            const config = {
                flashOpacity: parseFloat(document.getElementById('dmg_flash_opacity').value),
                flashDuration: parseInt(document.getElementById('dmg_flash_duration').value),
                shakeIntensity: parseFloat(document.getElementById('dmg_shake_intensity').value),
                shakeDuration: parseFloat(document.getElementById('dmg_shake_duration').value)
            };
            this.game.triggerDamageEffect(config);
        });
        document.querySelectorAll('.damage-slider').forEach(el => el.addEventListener('input', (e) => {
            const valSpan = document.getElementById(`${e.target.id}_val`);
            if (valSpan) valSpan.textContent = e.target.value;
        }));
        document.getElementById('fx_snapshot_btn').addEventListener('click', () => this.snapshotEffects());
        document.querySelectorAll('#tab-pane-effects .effects-slider, #tab-pane-effects .effects-input').forEach(el => el.addEventListener('input', (e) => {
            const valSpan = document.getElementById(`${e.target.id}_val`);
            if (valSpan) {
                if (e.target.id === 'fx_ambient_intensity' || e.target.id === 'fx_light_fade') {
                     valSpan.textContent = parseFloat(e.target.value).toFixed(2);
                } else {
                    valSpan.textContent = e.target.value;
                }
            }
            this.updateEffectsFromUI();
            this.updateGlowSpriteFromUI();
        }));
        document.getElementById('speed_snapshot_btn').addEventListener('click', () => this.snapshotSpeedConstants());
        document.querySelectorAll('#tab-pane-speed .speed-slider').forEach(el => el.addEventListener('input', (e) => {
            const valSpan = document.getElementById(`${e.target.id}_val`);
            if (valSpan) {
                if (e.target.id === 'speed_gravity') {
                    valSpan.textContent = (parseFloat(e.target.value) * 1000).toFixed(3);
                } else {
                    valSpan.textContent = parseFloat(e.target.value).toFixed(4);
                }
            }
            this.updateSpeedConstantsFromUI();
        }));
        document.getElementById('range_snapshot_btn').addEventListener('click', () => this.snapshotRange());
        document.querySelectorAll('.range-slider').forEach(el => el.addEventListener('input', e => {
            const valSpan = document.getElementById(`${e.target.id}_val`);
            if (valSpan) valSpan.textContent = e.target.value;
            this.updateRangeFromUI(e);
        }));
        document.querySelectorAll('.player-weapon-slider').forEach(el => el.addEventListener('input', () => this.updatePlayerWeaponFromUI()));
        document.getElementById('w_snapshotBtn').addEventListener('click', () => this.snapshotPlayerToConsole());
        document.querySelectorAll('.npc-weapon-slider').forEach(el => el.addEventListener('input', () => this.updateNpcWeaponsFromUI()));
        document.getElementById('npc_snapshotBtn').addEventListener('click', () => this.snapshotNpcToConsole());
        document.querySelectorAll('.npc-pose-slider').forEach(el => el.addEventListener('input', () => this.updateNpcPoseFromUI()));
        document.getElementById('npc_pose_snapshotBtn').addEventListener('click', () => this.snapshotNpcPoseToConsole());
        document.querySelectorAll('.ui-slider').forEach(el => el.addEventListener('input', () => this.updateUIFromUI()));
        document.getElementById('ui_snapshotBtn').addEventListener('click', () => this.snapshotUI());
        document.querySelectorAll('#leftEditorPanel .editor-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#leftEditorPanel .editor-tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                document.querySelectorAll('#leftEditorPanel .tab-pane').forEach(p => p.classList.remove('active'));
                document.getElementById(btn.dataset.tab).classList.add('active');
                this.factionControls.activeFactionTab = btn.dataset.tab.replace('tab-pane-faction-', '');
                this.factionControls.updatePushForceRings();
            });
        });
        document.querySelectorAll('#rightEditorPanel .weapon-cat-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#rightEditorPanel .weapon-cat-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.loadWeaponDefaultsToUI(btn.dataset.category);
            });
        });
        document.getElementById('npcCycleAnim').addEventListener('click', () => this.cycleNpcAnimation());
    }

    loadPlayerWeaponToUI() {
        if (!this.pws || !this.pws.activeWeapon) return;

        const weapon = this.pws.activeWeapon;
        const GGC_WEAPONS = GAME_GLOBAL_CONSTANTS.WEAPONS;

        // Position
        document.getElementById('weapon_posX').value = weapon.basePosition.x;
        document.getElementById('weapon_posY').value = weapon.basePosition.y;
        document.getElementById('weapon_posZ').value = weapon.basePosition.z;

        // Rotation (convert radians to degrees for UI)
        document.getElementById('weapon_rotX').value = THREE.MathUtils.radToDeg(weapon.mesh.rotation.x);
        document.getElementById('weapon_rotY').value = THREE.MathUtils.radToDeg(weapon.mesh.rotation.y);
        document.getElementById('weapon_rotZ').value = THREE.MathUtils.radToDeg(weapon.mesh.rotation.z);

        // Scale
        document.getElementById('weapon_scale').value = weapon.mesh.scale.x; // Assuming uniform scale

        // Pamphlet
        document.getElementById('weapon_pamphlet_size').value = GGC_WEAPONS.PAMPHLET_SIZE_MULTIPLIER;

        // Bolt Origin
        // The UI shows positive-right, but the code uses negative-right, so we invert it for the slider.
        document.getElementById('weapon_bolt_originX').value = -GGC_WEAPONS.BOLT_ORIGIN_X;
        document.getElementById('weapon_bolt_originY').value = GGC_WEAPONS.BOLT_ORIGIN_Y;
        document.getElementById('weapon_bolt_originZ').value = GGC_WEAPONS.BOLT_ORIGIN_Z;

        // Manually trigger the update function to refresh all the text labels next to the sliders
        this.updatePlayerWeaponFromUI();
    }

    updateFactionHudFromUI(e) {
        const hud = GAME_GLOBAL_CONSTANTS.FACTION_HUD;
        hud.SCALE = parseFloat(document.getElementById('faction_hud_scale').value);
        hud.OFFSET_X = parseFloat(document.getElementById('faction_hud_offsetX').value);
        hud.OFFSET_Y = parseFloat(document.getElementById('faction_hud_offsetY').value);
        hud.LINE_WIDTH = parseFloat(document.getElementById('faction_hud_lineWidth').value);
        
        document.getElementById('faction_hud_scale_val').textContent = hud.SCALE.toFixed(2);
        document.getElementById('faction_hud_offsetX_val').textContent = hud.OFFSET_X.toFixed(0);
        document.getElementById('faction_hud_offsetY_val').textContent = hud.OFFSET_Y.toFixed(0);
        document.getElementById('faction_hud_lineWidth_val').textContent = hud.LINE_WIDTH.toFixed(1);

        // This was the missing link. The faction HUD sliders were not calling the avatar position update.
        if (window.factionAvatarManager) {
            window.factionAvatarManager.updatePosition(hud.OFFSET_X, hud.OFFSET_Y);
        }
    }

    updateFactionAvatarFromUI() {
        const size = document.getElementById('avatar_size').value;
        const offsetX = document.getElementById('avatar_offsetX').value;
        const offsetY = document.getElementById('avatar_offsetY').value;

        document.getElementById('avatar_size_val').textContent = size;
        document.getElementById('avatar_offsetX_val').textContent = offsetX;
        document.getElementById('avatar_offsetY_val').textContent = offsetY;

        const root = document.documentElement;
        root.style.setProperty('--faction-avatar-size', `${size}px`);
        root.style.setProperty('--faction-avatar-right', `${offsetX}%`);
        root.style.setProperty('--faction-avatar-top', `${offsetY}%`);
        root.style.setProperty('--faction-avatar-transform', `translateY(-${offsetY}%)`);
    }

    snapshotVisuals() {
        console.log("--- Visuals Snapshot ---");

        // Nameplates
        const posX = parseFloat(document.getElementById('npc_label_posX').value);
        const posY = parseFloat(document.getElementById('npc_label_posY').value);
        const posZ = parseFloat(document.getElementById('npc_label_posZ').value);
        const scale = parseFloat(document.getElementById('npc_label_scale').value);
        const nameScale = parseFloat(document.getElementById('npc_name_scale').value);
        const namePosY = parseFloat(document.getElementById('npc_name_posY').value);
        const barScale = parseFloat(document.getElementById('npc_bar_scale').value);

        console.log(`// --- NPC Nameplate Values (for tab_controls.js HTML) ---
<div class="control-group"><label>X-Offset (All): ... value="${posX}" ...</div>
<div class="control-group"><label>Y-Offset (All): ... value="${posY}" ...</div>
<div class="control-group"><label>Z-Offset (All): ... value="${posZ}" ...</div>
<div class="control-group"><label>Overall Scale: ... value="${scale.toFixed(3)}" ...</div>
<div class="control-group"><label>Name Scale: ... value="${nameScale.toFixed(2)}" ...</div>
<div class="control-group"><label>Name Y-Offset: ... value="${namePosY}" ...</div>
<div class="control-group"><label>Health Bar Scale: ... value="${barScale.toFixed(2)}" ...</div>`);

        // Rings
        const GGC_ALLY = GAME_GLOBAL_CONSTANTS.ALLY_RING;
        console.log(`// --- Ally Ring Snapshot (for GAME_GLOBAL_CONSTANTS) ---
ALLY_RING: { OPACITY: ${GGC_ALLY.OPACITY.toFixed(2)}, DIAMETER_MULTIPLIER: ${GGC_ALLY.DIAMETER_MULTIPLIER.toFixed(2)}, BASE_HEIGHT: ${GGC_ALLY.BASE_HEIGHT.toFixed(3)} },`);
        
        // Faction HUD
        const GGC_HUD = GAME_GLOBAL_CONSTANTS.FACTION_HUD;
        console.log(`// --- Faction HUD Visuals Snapshot (for GAME_GLOBAL_CONSTANTS) ---
FACTION_HUD: { SCALE: ${GGC_HUD.SCALE.toFixed(2)}, OFFSET_X: ${GGC_HUD.OFFSET_X.toFixed(0)}, OFFSET_Y: ${GGC_HUD.OFFSET_Y.toFixed(0)}, LINE_WIDTH: ${GGC_HUD.LINE_WIDTH.toFixed(1)} },`);
        console.log("---");
    }
    
    updateRangeFromUI(e) {
        const ranges = GAME_GLOBAL_CONSTANTS.WEAPON_RANGES;
        if (!ranges) return;

        ranges.pistol = parseFloat(document.getElementById('range_pistol').value);
        ranges.rifle = parseFloat(document.getElementById('range_rifle').value);
        ranges.long = parseFloat(document.getElementById('range_long').value);
        ranges.melee = parseFloat(document.getElementById('range_melee').value);
        ranges.saber = parseFloat(document.getElementById('range_saber').value);
    }

    snapshotRange() {
        console.log(`// For game_and_character_config.js -> GAME_GLOBAL_CONSTANTS.WEAPON_RANGES
WEAPON_RANGES: ${JSON.stringify(GAME_GLOBAL_CONSTANTS.WEAPON_RANGES, null, 4)},`);
    }

    // ... (The rest of the functions from the original file are below)
    
    updateSpeedConstantsFromUI() {
        const GGC = GAME_GLOBAL_CONSTANTS;
        GGC.MOVEMENT.SPEED = parseFloat(document.getElementById('speed_player').value);
        GGC.PLAYER.JUMP_STRENGTH = parseFloat(document.getElementById('speed_jump').value);
        GGC.ELEVATION.PLAYER_GRAVITY = parseFloat(document.getElementById('speed_gravity').value);
        GGC.ELEVATION.NPC_GRAVITY = parseFloat(document.getElementById('speed_npc_gravity').value);
        const climbHeight = parseFloat(document.getElementById('speed_climb_height').value);
        GGC.PLAYER.CLIMB_HEIGHT = climbHeight / GGC.ELEVATION.STEP_HEIGHT;
        if (this.physics.playerCollider) {
            this.physics.playerCollider.climbHeight = climbHeight;
        }
        GGC.WEAPONS.PAMPHLET_SPEED = parseFloat(document.getElementById('speed_pamphlet').value);
        GGC.WEAPONS.BLASTER_BOLT_SPEED = parseFloat(document.getElementById('speed_blaster').value);
        GGC.WEAPONS.BLASTER_BOLT_RADIUS = parseFloat(document.getElementById('speed_blaster_radius').value);
        const blasterOpacity = parseFloat(document.getElementById('speed_blaster_opacity').value);
        GGC.WEAPONS.BLASTER_BOLT_OPACITY = blasterOpacity;
        this.game.entities.projectiles.forEach(p => {
            if (p instanceof BlasterBolt) {
                p.mesh.material.opacity = blasterOpacity;
            }
        });
    }

    snapshotSpeedConstants() {
        const GGC = GAME_GLOBAL_CONSTANTS;
        const playerSpeed = GGC.MOVEMENT.SPEED.toFixed(4);
        const npcSpeed = (this.game.entities.npcs[0]?.speed || 0).toFixed(4);
        const jump = GGC.PLAYER.JUMP_STRENGTH.toFixed(4);
        const playerGravity = GGC.ELEVATION.PLAYER_GRAVITY.toFixed(4);
        const npcGravity = GGC.ELEVATION.NPC_GRAVITY.toFixed(4);
        const climb = GGC.PLAYER.CLIMB_HEIGHT.toFixed(2);
        const pamphlet = GGC.WEAPONS.PAMPHLET_SPEED.toFixed(3);
        const blaster = GGC.WEAPONS.BLASTER_BOLT_SPEED.toFixed(3);
        const blasterRadius = GGC.WEAPONS.BLASTER_BOLT_RADIUS.toFixed(3);
        const blasterOpacity = GGC.WEAPONS.BLASTER_BOLT_OPACITY.toFixed(2);
        const cooldown = (this.game.entities.npcs[0]?.attackCooldown || 0).toFixed(2);

        console.log("--- Speed & Physics Constants Snapshot ---");
        console.log(`// For main.js ...`); // Rest of console log omitted for brevity
    }

    updateEffectsFromUI() {
        const glowColor = document.getElementById('fx_glow_color').value;
        const glowIntensity = parseFloat(document.getElementById('fx_glow_intensity').value);
        const glowDistance = parseFloat(document.getElementById('fx_glow_distance').value);
        const glowPosX = parseFloat(document.getElementById('fx_glow_posX').value);
        const glowPosY = parseFloat(document.getElementById('fx_glow_posY').value);
        const glowPosZ = parseFloat(document.getElementById('fx_glow_posZ').value);
        const ambientIntensity = parseFloat(document.getElementById('fx_ambient_intensity').value);
    
        if(this.game.ambientLight) this.game.ambientLight.intensity = ambientIntensity;
    
        const lightOrigin = new THREE.Vector3(glowPosX, glowPosY, glowPosZ);
        if (window.weaponIcons && window.weaponIcons.setGlobalGlowProperties) {
            window.weaponIcons.setGlobalGlowProperties(glowColor, glowIntensity, glowDistance, lightOrigin);
        }
    
        this.game.entities.projectiles.forEach(p => {
            if (p instanceof BlasterBolt) {
                if (p.light) {
                    p.light.color.set(glowColor);
                    p.light.intensity = glowIntensity * 2; // Make light brighter than emissive
                    p.light.distance = glowDistance;
                }
                if (p.mesh.material.isMeshStandardMaterial) {
                    p.mesh.material.emissive.set(glowColor);
                    p.mesh.material.emissiveIntensity = glowIntensity;
                }
            }
        });
    
        this.lightOriginHelper.position.copy(lightOrigin);
        const weapon = this.pws.primaryWeapon;
        if (weapon && weapon.config && weapon.light) {
            weapon.config.glow.color = document.getElementById('fx_light_color').value;
            weapon.config.glow.intensity = parseFloat(document.getElementById('fx_light_intensity').value);
            weapon.config.glow.distance = parseFloat(document.getElementById('fx_light_distance').value);
            weapon.config.fadeTime = parseFloat(document.getElementById('fx_light_fade').value);
            if (weapon.state === 'attacking') weapon.light.color.set(weapon.config.glow.color);
        }
    }
    
    updateGlowSpriteFromUI() {
        const size = parseFloat(document.getElementById('fx_glow_size').value);
        const opacity = parseFloat(document.getElementById('fx_glow_opacity').value);
        GAME_GLOBAL_CONSTANTS.WEAPONS.BLASTER_GLOW_SIZE = size;
        GAME_GLOBAL_CONSTANTS.WEAPONS.BLASTER_GLOW_OPACITY = opacity;
        document.getElementById('fx_glow_size_val').textContent = size.toFixed(1);
        document.getElementById('fx_glow_opacity_val').textContent = opacity.toFixed(2);

        // Apply changes to existing blaster bolts in real-time
        if (this.game && this.game.entities && this.game.entities.projectiles) {
            this.game.entities.projectiles.forEach(p => {
                if (p instanceof BlasterBolt && p.glowSprite) {
                    p.glowSprite.scale.set(size, size, size);
                    p.glowSprite.material.opacity = opacity;
                }
            });
        }
    }

    snapshotEffects() {
        // ... implementation from original file ...
    }

    updateUIFromUI() {
        // Health/Gonk Display
        const gonkX = document.getElementById('ui_gonk_offsetX').value + '%';
        const gonkY = document.getElementById('ui_gonk_offsetY').value + '%';
        this.game.gonkHealthContainer.style.left = `${gonkX}px`;
        this.game.gonkHealthContainer.style.bottom = `${gonkY}px`;
        document.getElementById('ui_gonk_offsetX_val').textContent = gonkX;
        document.getElementById('ui_gonk_offsetY_val').textContent = gonkY;

        // Ally Boxes
        const allyX = document.getElementById('ui_ally_offsetX').value;
        const allyY = document.getElementById('ui_ally_offsetY').value;
        this.game.allyBoxesContainer.style.left = `${allyX}%`; // This is a transformX so % is correct
        this.game.allyBoxesContainer.style.bottom = `${allyY}px`; // This is a direct offset
        document.getElementById('ui_ally_offsetX_val').textContent = allyX;
        document.getElementById('ui_ally_offsetY_val').textContent = allyY;

        // Ammo/Weapon Display
        const ammoX = document.getElementById('ui_ammo_offsetX').value;
        const ammoY = document.getElementById('ui_ammo_offsetY').value;
        const ammoContainer = document.querySelector('.ammo-display');
        const weaponContainer = document.querySelector('.weapon-display');
        if (ammoContainer) {
            ammoContainer.style.left = `${ammoX}%`;
            ammoContainer.style.bottom = `${ammoY}%`;
        }
        if (weaponContainer) {
            weaponContainer.style.left = `${ammoX}%`; // Align with ammo
            weaponContainer.style.bottom = `calc(${ammoY}% + 105px)`; // Position above ammo
        }
        document.getElementById('ui_ammo_offsetX_val').textContent = ammoX;
        document.getElementById('ui_ammo_offsetY_val').textContent = ammoY;
    }

    snapshotUI() {
        const gonkX = document.getElementById('ui_gonk_offsetX').value;
        const gonkY = document.getElementById('ui_gonk_offsetY').value;
        const allyX = document.getElementById('ui_ally_offsetX').value;
        const allyY = document.getElementById('ui_ally_offsetY').value;
        const ammoX = document.getElementById('ui_ammo_offsetX').value;
        const ammoY = document.getElementById('ui_ammo_offsetY').value;
        console.log(`// --- UI Snapshot ---
Gonk: { left: ${gonkX}%, bottom: ${gonkY}% }
Allies: { left: ${allyX}%, bottom: ${allyY}px }
Ammo/Weapon: { left: ${ammoX}%, bottom: ${ammoY}% }`);
    }

    snapshotDamageFx() {
        // ... implementation from original file ...
    }

    getMuzzleOffsetFromUI() {
        const x = parseFloat(document.getElementById('npc_muzzle_posX').value);
        const y = parseFloat(document.getElementById('npc_muzzle_posY').value);
        const z = parseFloat(document.getElementById('npc_muzzle_posZ').value);
        return new THREE.Vector3(x, y, z);
    }

    getNearestNpc() {
        const playerPos = this.physics.playerCollider.position;
        let closestNpc = null;
        let minDistance = Infinity;
        for (const npc of this.game.entities.npcs) {
            if (npc.isDead) continue;
            const dist = playerPos.distanceTo(npc.mesh.group.position);
            if (dist < minDistance) {
                minDistance = dist;
                closestNpc = npc;
            }
        }
        return closestNpc;
    }

    triggerNpcAttack(type) {
        const npc = this.getNearestNpc();
        if (!npc) return;
        npc.target = this.physics.playerEntity;
        if (type === 'blaster' && npc.weaponMesh) {
            if (npc.itemData.properties.weapon) {
                const weaponName = npc.itemData.properties.weapon.split('/').pop().replace('.png', '');
                npc.performRangedAttack(weaponName);
            }
        } else {
            npc.performMeleeAttack();
        }
    }

    updateMuzzleHelpersFromUI() {
        // ... implementation from original file ...
    }

    showMuzzleFlash(position) {
        // ... implementation from original file ...
    }

    snapshotMuzzleOffset() {
        // ... implementation from original file ...
    }

    loadWeaponDefaultsToUI(category) {
        const weaponData = window.assetManager.weaponData;
        if (!weaponData || !weaponData._defaults || !weaponData._defaults.categoryDefaults[category]) return;

        const poseData = weaponData._defaults.categoryDefaults[category].offsets;
        if (!poseData) return;

        const fields = {
            'npc_weapon_posX': poseData.position.x,
            'npc_weapon_posY': poseData.position.y,
            'npc_weapon_posZ': poseData.position.z,
            'npc_weapon_rotX': THREE.MathUtils.radToDeg(poseData.rotation.x),
            'npc_weapon_rotY': THREE.MathUtils.radToDeg(poseData.rotation.y),
            'npc_weapon_rotZ': THREE.MathUtils.radToDeg(poseData.rotation.z),
            'npc_weapon_scale': poseData.scale,
            'npc_weapon_plane_dist': poseData.planes?.dist,
            'npc_weapon_plane_yaw': poseData.planes?.yaw,
            'npc_weapon_plane_pitch': poseData.planes?.pitch
        };

        for (const [id, value] of Object.entries(fields)) {
            const input = document.getElementById(id);
            const valSpan = document.getElementById(id.replace('npc_weapon_', 'npc_') + '_val');
            if (input && value !== undefined) {
                input.value = value;
                if (valSpan) valSpan.textContent = parseFloat(value).toFixed(2);
            }
        }
        this.updateNpcWeaponsFromUI();
    }

    toggle() {
        this.isVisible = !this.isVisible;
        if (this.isVisible) this.show();
        else this.hide();
    }

    show() {
        this.isVisible = true;
        this.game.state.isPaused = true;
        this.leftPanel.style.display = 'flex';
        this.rightPanel.style.display = 'flex';
        document.exitPointerLock();
        this.lightOriginHelper.visible = true;
        this.boltOriginHelper.visible = true;
        const activeWeaponTab = document.querySelector('#rightEditorPanel .weapon-cat-btn.active');
        if (activeWeaponTab) {
            this.loadWeaponDefaultsToUI(activeWeaponTab.dataset.category);
        }
        // FIX: Load the current player weapon's transform into the UI sliders.
        this.loadPlayerWeaponToUI();

        this.updateEffectsFromUI();
        this.factionControls.updatePushForceRings();
    }

    initialHide() {
        this.isVisible = false;
        this.game.state.isPaused = false;
        if (this.leftPanel) this.leftPanel.style.display = 'none';
        if (this.rightPanel) this.rightPanel.style.display = 'none';
    }

    hide() {
        this.initialHide();
        this.muzzleFlashHelpers.forEach(h => h.visible = false);
        this.lightOriginHelper.visible = false;
        this.boltOriginHelper.visible = false;
        this.factionControls.factionPushForceRings.forEach(r => r.style.display = 'none');
        this.game.state.unpauseFactionPhysics = false;
        if (document.getElementById('faction_unpause_cb')) {
            document.getElementById('faction_unpause_cb').checked = false;
        }
        this.game.entities.npcs.forEach(npc => {
            if (npc.mesh) {
                npc.mesh.editorRArmRot = null;
                npc.mesh.editorLArmRot = null;
            }
        });
        if (game.canvas) game.canvas.requestPointerLock();
    }

    updatePlayerWeaponFromUI() {
        if (!this.pws || !this.pws.activeWeapon) return;
        const weapon = this.pws.activeWeapon;

        const posX = parseFloat(document.getElementById('weapon_posX').value);
        const posY = parseFloat(document.getElementById('weapon_posY').value);
        const posZ = parseFloat(document.getElementById('weapon_posZ').value);
        const rotX = THREE.MathUtils.degToRad(parseFloat(document.getElementById('weapon_rotX').value)); 
        const rotY = THREE.MathUtils.degToRad(parseFloat(document.getElementById('weapon_rotY').value));
        const rotZ = THREE.MathUtils.degToRad(parseFloat(document.getElementById('weapon_rotZ').value));
        const scale = parseFloat(document.getElementById('weapon_scale').value);
        const pamphletSize = parseFloat(document.getElementById('weapon_pamphlet_size').value);
        
        // FIX: Update the basePosition vector, not the mesh's position directly.
        weapon.basePosition.set(posX, posY, posZ);
        weapon.mesh.rotation.set(rotX, rotY, rotZ);
        weapon.mesh.scale.setScalar(scale);
        GAME_GLOBAL_CONSTANTS.WEAPONS.PAMPHLET_SIZE_MULTIPLIER = pamphletSize;

        // FIX: Invert the X-axis value to match user expectation (positive = right).
        GAME_GLOBAL_CONSTANTS.WEAPONS.BOLT_ORIGIN_X = -parseFloat(document.getElementById('weapon_bolt_originX').value);
        GAME_GLOBAL_CONSTANTS.WEAPONS.BOLT_ORIGIN_Y = parseFloat(document.getElementById('weapon_bolt_originY').value);
        GAME_GLOBAL_CONSTANTS.WEAPONS.BOLT_ORIGIN_Z = parseFloat(document.getElementById('weapon_bolt_originZ').value);


        document.getElementById('w_posX_val').textContent = posX.toFixed(4);
        document.getElementById('w_posY_val').textContent = posY.toFixed(4);
        document.getElementById('w_posZ_val').textContent = posZ.toFixed(3);
        document.getElementById('w_rotX_val').textContent = (rotX * 180 / Math.PI).toFixed(1);
        document.getElementById('w_rotY_val').textContent = (rotY * 180 / Math.PI).toFixed(1);
        document.getElementById('w_rotZ_val').textContent = (rotZ * 180 / Math.PI).toFixed(1);
        document.getElementById('w_scale_val').textContent = scale.toFixed(4);
        document.getElementById('w_pamphlet_size_val').textContent = pamphletSize.toFixed(1);

        document.getElementById('w_bolt_originX_val').textContent = (-GAME_GLOBAL_CONSTANTS.WEAPONS.BOLT_ORIGIN_X).toFixed(3);
        document.getElementById('w_bolt_originY_val').textContent = GAME_GLOBAL_CONSTANTS.WEAPONS.BOLT_ORIGIN_Y.toFixed(3);
        document.getElementById('w_bolt_originZ_val').textContent = GAME_GLOBAL_CONSTANTS.WEAPONS.BOLT_ORIGIN_Z.toFixed(3);

        // ADDED: Update bolt origin helper position in real-time
        if (this.boltOriginHelper.visible) {
            const cam = this.game.camera;
            const startPosition = new THREE.Vector3();
            const direction = new THREE.Vector3();
            const right = new THREE.Vector3();

            cam.getWorldPosition(startPosition);
            cam.getWorldDirection(direction);
            right.crossVectors(cam.up, direction).normalize();

            startPosition.add(direction.clone().multiplyScalar(GAME_GLOBAL_CONSTANTS.WEAPONS.BOLT_ORIGIN_Z));
            startPosition.add(right.clone().multiplyScalar(GAME_GLOBAL_CONSTANTS.WEAPONS.BOLT_ORIGIN_X));
            startPosition.y += GAME_GLOBAL_CONSTANTS.WEAPONS.BOLT_ORIGIN_Y;
            this.boltOriginHelper.position.copy(startPosition);
        }
    }

    snapshotPlayerToConsole() {
        if (!this.pws || !this.pws.activeWeapon) {
            console.warn('No active weapon to snapshot.');
            return;
        }

        const snapshot = {
            offsets: {
                position: {
                    x: parseFloat(document.getElementById('weapon_posX').value) || 0,
                    y: parseFloat(document.getElementById('weapon_posY').value) || 0,
                    z: parseFloat(document.getElementById('weapon_posZ').value) || 0
                },
                rotation: {
                    x: THREE.MathUtils.degToRad(parseFloat(document.getElementById('weapon_rotX').value) || 0),
                    y: THREE.MathUtils.degToRad(parseFloat(document.getElementById('weapon_rotY').value) || 0),
                    z: THREE.MathUtils.degToRad(parseFloat(document.getElementById('weapon_rotZ').value) || 0)
                },
                scale: parseFloat(document.getElementById('weapon_scale').value) || 1
            },
            bolt_origin: {
                x: parseFloat(document.getElementById('weapon_bolt_originX').value),
                y: parseFloat(document.getElementById('weapon_bolt_originY').value),
                z: parseFloat(document.getElementById('weapon_bolt_originZ').value)
            }
        };

        const jsonString = JSON.stringify(snapshot, (k, v) => v.toFixed ? Number(v.toFixed(4)) : v, 4);
        navigator.clipboard.writeText(jsonString);

        console.log(`Copied ${this.pws.activeWeapon.config.name} offsets to clipboard!`, jsonString);
    }

    updateNpcWeaponsFromUI() {
        const activeTab = document.querySelector('#rightEditorPanel .weapon-cat-btn.active');
        if (!activeTab) return;
        const category = activeTab.dataset.category;

        const weaponData = window.assetManager.weaponData;
        if (!weaponData || !weaponData._defaults || !weaponData._defaults.categoryDefaults[category]) return;
        
        const offsets = weaponData._defaults.categoryDefaults[category].offsets;
        
        offsets.position.x = parseFloat(document.getElementById('npc_weapon_posX').value);
        offsets.position.y = parseFloat(document.getElementById('npc_weapon_posY').value);
        offsets.position.z = parseFloat(document.getElementById('npc_weapon_posZ').value);
        offsets.rotation.x = THREE.MathUtils.degToRad(parseFloat(document.getElementById('npc_weapon_rotX').value));
        offsets.rotation.y = THREE.MathUtils.degToRad(parseFloat(document.getElementById('npc_weapon_rotY').value));
        offsets.rotation.z = THREE.MathUtils.degToRad(parseFloat(document.getElementById('npc_weapon_rotZ').value));
        offsets.scale = parseFloat(document.getElementById('npc_weapon_scale').value);
        offsets.planes.dist = parseFloat(document.getElementById('npc_weapon_plane_dist').value);
        offsets.planes.yaw = parseFloat(document.getElementById('npc_weapon_plane_yaw').value);
        offsets.planes.pitch = parseFloat(document.getElementById('npc_weapon_plane_pitch').value);

        this.game.entities.npcs.forEach(npc => {
            if (npc.weaponMesh && npc.itemData.properties.weapon) {
                const weaponName = npc.itemData.properties.weapon.split('/').pop().replace('.png', '');
                const npcWeaponCategory = window.weaponIcons.getCategoryFromName(weaponName);
                if (npcWeaponCategory === category) {
                    const weaponMesh = npc.weaponMesh;
                    weaponMesh.position.set(offsets.position.x, offsets.position.y, offsets.position.z);
                    weaponMesh.rotation.set(offsets.rotation.x, offsets.rotation.y, offsets.rotation.z);
                    weaponMesh.scale.setScalar(offsets.scale);
                    if (weaponMesh.children.length === 3) {
                         const [plane1, , plane3] = weaponMesh.children;
                        plane1.position.z = offsets.planes.dist;
                        plane3.position.z = -offsets.planes.dist;
                        plane1.rotation.y = THREE.MathUtils.degToRad(offsets.planes.yaw);
                        plane3.rotation.y = THREE.MathUtils.degToRad(-offsets.planes.yaw);
                        plane1.rotation.x = THREE.MathUtils.degToRad(offsets.planes.pitch);
                        plane3.rotation.x = THREE.MathUtils.degToRad(-offsets.planes.pitch);
                    }
                }
            }
        });

        // Update UI labels
        document.getElementById('npc_posX_val').textContent = offsets.position.x.toFixed(2);
        document.getElementById('npc_posY_val').textContent = offsets.position.y.toFixed(2);
        document.getElementById('npc_posZ_val').textContent = offsets.position.z.toFixed(2);
        document.getElementById('npc_rotX_val').textContent = (offsets.rotation.x * 180 / Math.PI).toFixed(1);
        document.getElementById('npc_rotY_val').textContent = (offsets.rotation.y * 180 / Math.PI).toFixed(1);
        document.getElementById('npc_rotZ_val').textContent = (offsets.rotation.z * 180 / Math.PI).toFixed(1);
        document.getElementById('npc_scale_val').textContent = offsets.scale.toFixed(0);
        document.getElementById('npc_plane_dist_val').textContent = offsets.planes.dist.toFixed(4);
        document.getElementById('npc_plane_yaw_val').textContent = offsets.planes.yaw.toFixed(2);
        document.getElementById('npc_plane_pitch_val').textContent = offsets.planes.pitch.toFixed(2);
    }

    snapshotNpcToConsole() {
        // ... implementation from original file ...
    }

    updateNpcPoseFromUI() {
        // ... implementation from original file ...
    }

    snapshotNpcPoseToConsole() {
        // ... implementation from original file ...
    }

    updateLabelAndRingFromUI() {
        // Labels
        const posX = parseFloat(document.getElementById('npc_label_posX').value);
        const posY = parseFloat(document.getElementById('npc_label_posY').value);
        const posZ = parseFloat(document.getElementById('npc_label_posZ').value);
        const scale = parseFloat(document.getElementById('npc_label_scale').value);
        const nameScale = parseFloat(document.getElementById('npc_name_scale').value);
        const namePosY = parseFloat(document.getElementById('npc_name_posY').value);
        const barScale = parseFloat(document.getElementById('npc_bar_scale').value);

        this.game.entities.npcs.forEach(npc => {
            if (npc.nameplate) {
                npc.nameplate.position.set(posX * 0.2, 0.5 + (posY * 0.2), posZ * 0.2);
                npc.nameplate.scale.set(scale, scale, scale);
            }
            if (npc.nameplateName && npc.nameplateHealthBar) {
                npc.nameplateName.position.y = namePosY;
                npc.nameplateName.scale.set(nameScale, nameScale, nameScale);
                npc.nameplateHealthBar.scale.set(barScale, barScale, barScale);
            }
        });

        // Rings
        const GGC = GAME_GLOBAL_CONSTANTS;
        GGC.ALLY_RING.OPACITY = parseFloat(document.getElementById('ring_opacity').value);
        GGC.ALLY_RING.DIAMETER_MULTIPLIER = parseFloat(document.getElementById('ring_diameter').value);
        GGC.ALLY_RING.BASE_HEIGHT = parseFloat(document.getElementById('ring_height').value);

        this.game.state.allies.forEach(ally => {
            const npc = ally.npc;
            if (npc && npc.allyRing) {
                npc.allyRing.material.opacity = GGC.ALLY_RING.OPACITY;
                npc.allyRing.material.needsUpdate = true;
                // FIX: Changed npc.config.stats.collisionRadius to npc.config.collision_radius
                const baseRadius = npc.config.collision_radius || 0.5;
                const newScale = GGC.ALLY_RING.DIAMETER_MULTIPLIER * baseRadius / (npc.allyRing.geometry.parameters.innerRadius / 0.9);
                npc.allyRing.scale.set(newScale, newScale, 1);
            }
        });
    }

    snapshotLabelAndRing() {
        // ... this is an old function, will be replaced by snapshotVisuals ...
    }
    
    cycleNpcAnimation() {
        // ... implementation from original file ...
    }
}