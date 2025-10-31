// BROWSERFIREFOXHIDE tab_faction_controls.js

class TabFactionControls {
    constructor(gameInstance, tabControls) {
        this.game = gameInstance;
        this.tabControls = tabControls; // Reference to the main tab_controls

        this.factionPushForceRings = [];
        this.activeFactionTab = null;
        this.factionColors = {};

        this.initialize();
    }

    initialize() {
        const svgContainer = document.getElementById('faction-lines-svg');
        if (svgContainer) {
            for (let i = 0; i < 10; i++) { // Create a pool of rings
                const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                ring.setAttribute('fill', 'none');
                ring.style.display = 'none';
                svgContainer.appendChild(ring);
                this.factionPushForceRings.push(ring);
            }
        }
    }

    createFactionHTML() {
        const factionHTML = `
            <h4>Global Faction Physics</h4>
            <div class="horizontal-group" style="justify-content: space-around; padding: 5px 0;">
                <label class="toggle-label"><input type="checkbox" id="faction_unpause_cb"> RUN</label>
                <label class="toggle-label"><input type="checkbox" id="faction_show_grays_cb"> GRAYS</label>
                <label class="toggle-label"><input type="checkbox" id="faction_show_grid_cb" checked> GRID</label>
            </div>
            <hr>
            <div class="control-group"><label>Physics Speed: <span id="faction_speed_val">2.8</span></label><input type="range" class="faction-global-slider" id="faction_speed" min="0.1" max="5" value="2.8" step="0.1"></div>
            <div class="control-group"><label>Home Pull Strength: <span id="faction_home_pull_val">0.05</span></label><input type="range" class="faction-global-slider" id="faction_home_pull" min="0.01" max="0.5" value="0.05" step="0.005"></div>
            <div class="control-group"><label>Alliance Pull Multiplier: <span id="faction_alliance_pull_mult_val">1.0</span></label><input type="range" class="faction-global-slider" id="faction_alliance_pull_mult" min="0" max="2" value="1.0" step="0.05"></div>
            <div class="control-group"><label>Kill Push Impulse: <span id="faction_kill_push_val">5.0</span></label><input type="range" class="faction-global-slider" id="faction_kill_push" min="0" max="20" value="5.0" step="0.5"></div>
            <div class="control-group"><label>Damping Factor: <span id="faction_damping_val">0.97</span></label><input type="range" class="faction-global-slider" id="faction_damping" min="0.8" max="0.99" value="0.97" step="0.01"></div>
            <div class="control-group"><label>Min Force Threshold: <span id="faction_min_force_val">0.05</span></label><input type="range" class="faction-global-slider" id="faction_min_force" min="0" max="0.15" value="0.05" step="0.001"></div>
            <hr><h4>AI Behavior Thresholds</h4>
            <div class="control-group"><label>Friendly ( &lt; ): <span id="faction_friendly_thresh_val">20</span></label><input type="range" class="faction-global-slider" id="faction_friendly_thresh" min="0" max="100" value="20" step="1"></div>
            <div class="control-group"><label>Hostile ( &gt; ): <span id="faction_hostile_thresh_val">80</span></label><input type="range" class="faction-global-slider" id="faction_hostile_thresh" min="0" max="100" value="80" step="1"></div>
            <hr><h4>Simulate Allies</h4>
            <div class="control-group" style="font-size: 11px; color: #aaa;">Changes apply on next simulation step.</div>
            <div class="control-group sim-ally-group"><label>Rebels: <span id="sim_rebels_val">0</span></label><input type="range" class="sim-ally-slider" data-faction="rebels" id="sim_rebels" min="0" max="5" value="0" step="1"><button class="sim-kill-btn" data-faction="rebels">Kill</button></div>
            <div class="control-group sim-ally-group"><label>Aliens: <span id="sim_aliens_val">0</span></label><input type="range" class="sim-ally-slider" data-faction="aliens" id="sim_aliens" min="0" max="5" value="0" step="1"><button class="sim-kill-btn" data-faction="aliens">Kill</button></div>
            <div class="control-group sim-ally-group"><label>Clones: <span id="sim_clones_val">0</span></label><input type="range" class="sim-ally-slider" data-faction="clones" id="sim_clones" min="0" max="5" value="0" step="1"><button class="sim-kill-btn" data-faction="clones">Kill</button></div>
            <div class="control-group sim-ally-group"><label>Imperials: <span id="sim_imperials_val">0</span></label><input type="range" class="sim-ally-slider" data-faction="imperials" id="sim_imperials" min="0" max="5" value="0" step="1"><button class="sim-kill-btn" data-faction="imperials">Kill</button></div>
            <div class="control-group sim-ally-group"><label>Droids: <span id="sim_droids_val">0</span></label><input type="range" class="sim-ally-slider" data-faction="droids" id="sim_droids" min="0" max="5" value="0" step="1"><button class="sim-kill-btn" data-faction="droids">Kill</button></div>
            <div class="control-group sim-ally-group"><label>Sith: <span id="sim_sith_val">0</span></label><input type="range" class="sim-ally-slider" data-faction="sith" id="sim_sith" min="0" max="5" value="0" step="1"><button class="sim-kill-btn" data-faction="sith">Kill</button></div>
            <div class="control-group sim-ally-group"><label>Mandalorians: <span id="sim_mandalorians_val">0</span></label><input type="range" class="sim-ally-slider" data-faction="mandalorians" id="sim_mandalorians" min="0" max="5" value="0" step="1"><button class="sim-kill-btn" data-faction="mandalorians">Kill</button></div>
            <div class="control-group sim-ally-group"><label>Takers: <span id="sim_takers_val">0</span></label><input type="range" class="sim-ally-slider" data-faction="takers" id="sim_takers" min="0" max="5" value="0" step="1"><button class="sim-kill-btn" data-faction="takers">Kill</button></div>
            <button id="faction_reset_btn">Reset Globals to Defaults</button>
            <button id="faction_snapshot_btn">Snapshot All Faction Physics</button>
        `;

        let factionTabsHTML = '';
        let factionPanesHTML = '';
        const factionManager = this.game.factionManager;
        const factionColors = {
            rebels: {bg: '#a12a2a', border: '#d94242'},
            aliens: {bg: '#004d00', border: '#008000'},
            clones: {bg: '#b05c00', border: '#ff8c00'},
            imperials: {bg: '#101010', border: '#444444'},
            droids: {bg: '#003366', border: '#0066cc'},
            mandalorians: {bg: '#DAA520', border: '#FFC72C'},
            sith: {bg: '#330000', border: '#990000', text: '#ff4d4d'},
            takers: {bg: '#2E2E2E', border: '#C0C0C0'},
            player_droid: {bg: '#404040', border: '#707070'}
        };

        if (factionManager && factionManager.factions) {
            const factionKeys = Object.keys(factionManager.factions).filter(k => !factionManager.factions[k].isStatic);
            factionKeys.forEach((key, index) => {
                const faction = factionManager.factions[key];
                const activeClass = index === 0 ? 'active' : '';
                const colors = factionColors[key] || {bg: '#21252b', border: '#444', text: '#fff'};
                this.factionColors[key] = colors.border; // Store color for push rings
                const styleOverride = key === 'sith' ? `color: ${colors.text};` : '';
                factionTabsHTML += `<button class="editor-tab-btn faction-color-tab ${activeClass}" data-tab="tab-pane-faction-${key}" style="--faction-bg: ${colors.bg}; --faction-border: ${colors.border}; ${styleOverride}">${faction.name}</button>`;

                let pushForcesHTML = '<h4>Push Forces</h4>';
                const otherFactionKeys = factionKeys.filter(otherKey => otherKey !== key);
                otherFactionKeys.forEach(otherKey => {
                    const otherFaction = factionManager.factions[otherKey];
                    const otherColors = factionColors[otherKey] || { bg: '#21252b', border: '#444' };
                    const pushConfig = (faction.pushForces && faction.pushForces[otherKey])
                        ? faction.pushForces[otherKey]
                        : { strength: 0, radius: 0 };
                    pushForcesHTML += `
                        <p style="color: ${otherColors.border}; margin-bottom: 5px; font-weight: bold;">vs ${otherFaction.name}</p>
                        <div class="control-group"><label>Push Strength: <span id="faction_${key}_${otherKey}_strength_val">${pushConfig.strength}</span></label><input type="range" class="faction-push-slider" data-faction="${key}" data-other="${otherKey}" data-type="strength" min="0" max="200" value="${pushConfig.strength}" step="1"></div>
                        <div class="control-group"><label>Push Radius: <span id="faction_${key}_${otherKey}_radius_val">${pushConfig.radius}</span></label><input type="range" class="faction-push-slider" data-faction="${key}" data-other="${otherKey}" data-type="radius" min="0" max="100" value="${pushConfig.radius}" step="1"></div>
                    `;
                });

                factionPanesHTML += `
                    <div id="tab-pane-faction-${key}" class="tab-pane ${activeClass}">
                        <h4>${faction.name} Properties</h4>
                        <div class="control-group"><label>Home X: <span id="faction_${key}_homeX_val">${faction.homePosition.x}</span></label><input type="range" class="faction-prop-slider" data-faction="${key}" data-prop="homeX" min="0" max="100" value="${faction.homePosition.x}" step="0.5"></div>
                        <div class="control-group"><label>Home Y: <span id="faction_${key}_homeY_val">${faction.homePosition.y}</span></label><input type="range" class="faction-prop-slider" data-faction="${key}" data-prop="homeY" min="0" max="100" value="${faction.homePosition.y}" step="0.5"></div>
                        <div class="control-group"><label>Elasticity: <span id="faction_${key}_elasticity_val">${faction.elasticity}</span></label><input type="range" class="faction-prop-slider" data-faction="${key}" data-prop="elasticity" min="0.01" max="1" value="${faction.elasticity}" step="0.01"></div>
                        <div class="control-group"><label>Home Radius (Dead Zone): <span id="faction_${key}_homeRadius_val">${faction.homeRadius || 0}</span></label><input type="range" class="faction-prop-slider" data-faction="${key}" data-prop="homeRadius" min="0" max="20" value="${faction.homeRadius || 0}" step="0.5"></div>
                        <hr>${pushForcesHTML}
                    </div>
                `;
            });
        }

        return {
            globals: `<div id="tab-pane-faction-globals" class="tab-pane active">${factionHTML}</div>`,
            panes: factionPanesHTML,
            tabs: factionTabsHTML
        };
    }

    addEventListeners() {
        document.getElementById('faction_unpause_cb')?.addEventListener('change', (e) => {
            this.game.state.unpauseFactionPhysics = e.target.checked;
        });
        document.getElementById('faction_snapshot_btn')?.addEventListener('click', () => this.snapshotFactionPhysics());
        document.querySelectorAll('.faction-global-slider').forEach(el => el.addEventListener('input', (e) => this.updateFactionSettingsFromUI(e)));
        document.querySelectorAll('.faction-prop-slider, .faction-push-slider').forEach(el => el.addEventListener('input', (e) => this.updateSpecificFactionProperties(e)));

        const showGraysCb = document.getElementById('faction_show_grays_cb');
        if (showGraysCb) showGraysCb.addEventListener('change', (e) => this.game.state.showNeutralFactionLines = e.target.checked);
        const showGridCb = document.getElementById('faction_show_grid_cb');
        if (showGridCb) showGridCb.addEventListener('change', (e) => this.game.state.showFactionGrid = e.target.checked);

        document.querySelectorAll('.sim-ally-slider').forEach(el => el.addEventListener('input', (e) => {
            const faction = e.target.dataset.faction;
            const value = parseInt(e.target.value);
            this.game.state.simulatedAllies[faction] = value;
            document.getElementById(`sim_${faction}_val`).textContent = value;
        }));
        document.querySelectorAll('.sim-kill-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const faction = e.target.dataset.faction;
                if (this.game.factionManager) {
                    this.game.factionManager.applyKillRepulsion('player_droid', faction);
                }
            });
        });
        document.getElementById('faction_reset_btn')?.addEventListener('click', () => this.resetFactionSettingsToDefaults());
    }

    updatePushForceRings() {
        if (!this.tabControls.isVisible || !this.activeFactionTab || !this.game.factionManager) {
            this.factionPushForceRings.forEach(r => r.style.display = 'none');
            return;
        }

        const activeFaction = this.game.factionManager.factions[this.activeFactionTab];
        if (!activeFaction) return;

        const otherFactions = Object.keys(activeFaction.pushForces || {});
        let ringIndex = 0;

        for (const otherFactionKey of otherFactions) {
            if (ringIndex >= this.factionPushForceRings.length) break;

            const ring = this.factionPushForceRings[ringIndex];
            const pushConfig = activeFaction.pushForces[otherFactionKey];
            const otherFactionColor = this.factionColors[otherFactionKey] || '#ffffff';

            const node = document.querySelector(`.faction-node.${this.activeFactionTab}:not(.faction-node-shadow)`);
            if (node) {
                ring.setAttribute('cx', node.style.left);
                ring.setAttribute('cy', node.style.top);
                ring.setAttribute('r', `${pushConfig.radius}%`);
                ring.setAttribute('stroke', otherFactionColor);
                ring.setAttribute('stroke-width', '2');
                ring.setAttribute('stroke-opacity', (pushConfig.strength / 200).toFixed(2)); // Max strength is 200
                ring.style.display = 'block';
            }
            ringIndex++;
        }

        for (let i = ringIndex; i < this.factionPushForceRings.length; i++) {
            this.factionPushForceRings[i].style.display = 'none';
        }
    }

    snapshotFactionPhysics() {
        const factionManager = this.game.factionManager;
        const GGC_FACTIONS = GAME_GLOBAL_CONSTANTS.FACTIONS;
        
        let output = "--- Faction Physics Snapshot ---\n\n";
        
        output += `// --- For game_and_character_config.js -> GAME_GLOBAL_CONSTANTS --- \n`;
        output += `FACTIONS: ${JSON.stringify(GGC_FACTIONS, null, 4)},\n\n`;

        output += `// --- For data/faction_config.json -> factions --- \n`;
        const factionDataToSnapshot = {};
        for (const key in factionManager.factions) {
            const faction = factionManager.factions[key];
            factionDataToSnapshot[key] = {
                name: faction.name,
                homePosition: faction.homePosition,
                isStatic: faction.isStatic,
                mass: faction.mass,
                elasticity: faction.elasticity,
                homeRadius: faction.homeRadius || 0
            };
            if (Object.keys(faction.pushForces).length > 0) {
                factionDataToSnapshot[key].pushForces = faction.pushForces;
            }
        }
        output += JSON.stringify(factionDataToSnapshot, null, 4);
        
        console.log(output);
    }

    updateSpecificFactionProperties(e) {
        const { faction, other, prop, type } = e.target.dataset;
        const value = parseFloat(e.target.value);
        const factionManager = this.game.factionManager;
        
        if (!factionManager.factions[faction]) return;

        if (prop) { // Home position or elasticity
            const valSpan = document.getElementById(`faction_${faction}_${prop}_val`);
            if (prop === 'homeX') factionManager.factions[faction].homePosition.x = value;
            if (prop === 'homeY') factionManager.factions[faction].homePosition.y = value;
            if (prop === 'elasticity') factionManager.factions[faction].elasticity = value;
            if (prop === 'homeRadius') factionManager.factions[faction].homeRadius = value;
            if(valSpan) valSpan.textContent = value.toFixed(2);
        } else if (other && type) { // Push forces
            const valSpan = document.getElementById(`faction_${faction}_${other}_${type}_val`);
            if (!factionManager.factions[faction].pushForces) factionManager.factions[faction].pushForces = {};
            if (!factionManager.factions[faction].pushForces[other]) factionManager.factions[faction].pushForces[other] = {};
            
            factionManager.factions[faction].pushForces[other][type] = value;
            if(valSpan) valSpan.textContent = value;
            
            // Symmetrical update for strength
            if (factionManager.factions[other] && type === 'strength') {
                if (!factionManager.factions[other].pushForces) factionManager.factions[other].pushForces = {};
                if (!factionManager.factions[other].pushForces[faction]) factionManager.factions[other].pushForces[faction] = {};
                factionManager.factions[other].pushForces[faction][type] = value;
                
                const otherSlider = document.querySelector(`.faction-push-slider[data-faction="${other}"][data-other="${faction}"][data-type="strength"]`);
                const otherValSpan = document.getElementById(`faction_${other}_${faction}_strength_val`);
                if(otherSlider) otherSlider.value = value;
                if(otherValSpan) otherValSpan.textContent = value;
            }
        }
        this.updatePushForceRings();
    }

    resetFactionSettingsToDefaults() {
        const F = GAME_GLOBAL_CONSTANTS.FACTIONS;
        
        document.getElementById('faction_speed').value = F.PHYSICS_SPEED;
        document.getElementById('faction_home_pull').value = F.HOME_PULL_STRENGTH;
        document.getElementById('faction_alliance_pull_mult').value = F.ALLIANCE_PULL_MULTIPLIER;
        document.getElementById('faction_kill_push').value = F.KILL_PUSH;
        document.getElementById('faction_damping').value = F.DAMPING_FACTOR;
        document.getElementById('faction_min_force').value = F.MIN_FORCE_THRESHOLD;
        document.getElementById('faction_friendly_thresh').value = F.FRIENDLY_THRESHOLD;
        document.getElementById('faction_hostile_thresh').value = F.HOSTILE_THRESHOLD;

        this.updateFactionSettingsFromUI();
    }

    updateFactionSettingsFromUI(e) {
        const F = GAME_GLOBAL_CONSTANTS.FACTIONS;
        F.PHYSICS_SPEED = parseFloat(document.getElementById('faction_speed').value);
        F.HOME_PULL_STRENGTH = parseFloat(document.getElementById('faction_home_pull').value);
        F.ALLIANCE_PULL_MULTIPLIER = parseFloat(document.getElementById('faction_alliance_pull_mult').value);
        F.KILL_PUSH = parseFloat(document.getElementById('faction_kill_push').value);
        F.DAMPING_FACTOR = parseFloat(document.getElementById('faction_damping').value);
        F.MIN_FORCE_THRESHOLD = parseFloat(document.getElementById('faction_min_force').value);
        F.FRIENDLY_THRESHOLD = parseInt(document.getElementById('faction_friendly_thresh').value);
        F.HOSTILE_THRESHOLD = parseInt(document.getElementById('faction_hostile_thresh').value);
        
        document.getElementById('faction_speed_val').textContent = F.PHYSICS_SPEED.toFixed(1);
        document.getElementById('faction_home_pull_val').textContent = F.HOME_PULL_STRENGTH.toFixed(3);
        document.getElementById('faction_alliance_pull_mult_val').textContent = F.ALLIANCE_PULL_MULTIPLIER.toFixed(2);
        document.getElementById('faction_kill_push_val').textContent = F.KILL_PUSH.toFixed(1);
        document.getElementById('faction_damping_val').textContent = F.DAMPING_FACTOR.toFixed(2);
        document.getElementById('faction_min_force_val').textContent = F.MIN_FORCE_THRESHOLD.toFixed(3);
        document.getElementById('faction_friendly_thresh_val').textContent = F.FRIENDLY_THRESHOLD;
        document.getElementById('faction_hostile_thresh_val').textContent = F.HOSTILE_THRESHOLD;
    }
}