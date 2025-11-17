// BROWSERFIREFOXHIDE conversation_controller.js

class ConversationController {
    constructor() {
        this.phraseDatabase = [];
        if (this.currentConversation && this.currentConversation.socialCheckDetails) {
            // Ensure performSocialCheck is called with the correct initiator and target
            // The initiator of the social check is the ally, the target is the NPC
            this.performSocialCheck(this.currentConversation.socialCheckDetails.initiator, this.currentConversation.socialCheckDetails.target, this.currentConversation.socialCheckDetails);
        }
        this.currentConversation = null;
        this.factionTopicPreferences = {
            "rebels": { "liked": ["proindependence", "prolightside", "progroup: rebels", "progroup: aliens", "antigroup: imperials", "antigroup: sith", "antigroup: takers"], "disliked": ["proorder", "prodarkside", "antigroup: rebels", "antigroup: aliens", "progroup: imperials", "progroup: sith"] },
            "imperials": { "liked": ["proorder", "prodarkside", "antigroup: rebels", "antigroup: independence", "antigroup: aliens", "antigroup: takers", "progroup: imperials", "progroup: sith"], "disliked": ["proindependence", "prolightside", "progroup: rebels", "progroup: aliens", "antigroup: imperials", "antigroup: sith", "progroup: gonk"] },
            "clones": { "liked": ["proorder", "antigroup: droids", "progroup: clones", "progroup: 501st_legion", "progroup: imperials", "antigroup: takers"], "disliked": ["proindependence", "progroup: droids", "antigroup: clones", "antigroup: 501st_legion", "progroup: gonk"] },
            "mandalorians": { "liked": ["progroup: mandalorians", "antigroup: takers"], "disliked": ["proorder", "proindependence", "prolightside", "prodarkside", "progroup: jedi", "progroup: sith", "progroup: droids", "antigroup: droids", "antigroup: mandalorians"] },
            "sith": { "liked": ["prodarkside", "proorder", "progroup: sith", "progroup: imperials", "antigroup: rebels", "antigroup: jedi", "antigroup: prolightside"], "disliked": ["prolightside", "proindependence", "progroup: jedi", "progroup: rebels", "antigroup: sith", "antigroup: imperials", "progroup: gonk"] },
            "takers": { "liked": ["progroup: takers", "antigroup: droids", "antigroup: gonk"], "disliked": ["droids", "holonet", "progroup: gonk", "prolightside", "prodarkside", "proindependence", "progroup: [ANY other faction]", "antigroup: takers"] },
            "droids": { "liked": ["progroup: droids", "progroup: droid_humanoid", "progroup: rebels", "antigroup: clones", "antigroup: takers"], "disliked": ["antigroup: droids", "antigroup: droid_humanoid", "antigroup: gonk", "progroup: clones", "progroup: takers"] },
            "aliens": { "liked": ["proindependence", "progroup: aliens", "progroup: wookiee", "progroup: jawa", "progroup: gungan", "progroup: ewok", "progroup: gamorrean", "progroup: rebels", "progroup: droids", "antigroup: imperials", "antigroup: takers"], "disliked": ["proorder", "antigroup: aliens", "antigroup: wookiee", "antigroup: jawa", "antigroup: gungan", "antigroup: ewok", "antigroup: gamorrean", "progroup: imperials"] },
            "player_droid": { "liked": [], "disliked": [] }
        };
        this.factionTopicPreferences["any"] = { "liked": [], "disliked": [] };
    }

    loadPhrases(phraseData) {
        if (phraseData && phraseData.phrases) { this.phraseDatabase.push(...phraseData.phrases); }
    }

    startConversation(initiator, target) {
        if (initiator.config.noConversation || target.config.noConversation) { return false; }

        if (window.conversationUIManager) {
            window.conversationUIManager.shiftAllyBoxesDown();
        }

        // If the target is an ally, use their original faction for the attitude check.
        const targetFaction = target.isAlly ? target.originalFaction : target.faction;
        const attitude = window.game.factionManager.getRelationshipAttitude(initiator.faction, targetFaction);

        const greeting = this.findPhrase(initiator, target, "greeting", attitude, "none");

        if (!greeting) { return false; }

        if (window.conversationLogger) window.conversationLogger.start(initiator, target, attitude);
        window.game.state.isConversationActive = true;
        initiator.isConversing = true;
        initiator.currentState = 'CONVERSING';
        initiator.target = target;

        target.isConversing = true;
        target.currentState = 'CONVERSING';
        target.target = initiator;

        // NEW: Initiate social check at the start
        this.currentConversation = {
            initiator: initiator,
            target: target
        };

        if (initiator.nameplate) initiator.nameplate.visible = true;
        const lookAtTarget1 = target.mesh.group.position.clone();
        lookAtTarget1.y = initiator.mesh.group.position.y;
        initiator.mesh.group.lookAt(lookAtTarget1);

        const lookAtTarget2 = initiator.mesh.group.position.clone();
        lookAtTarget2.y = target.mesh.group.position.y;
        target.mesh.group.lookAt(lookAtTarget2);

        // Highlight the initiator (NPC) with the rim shader.
        initiator.startHighlight(GAME_GLOBAL_CONSTANTS.FACTION_COLORS[initiator.faction] || '#FFFFFF');
        if (target.isAlly) this.highlightAllyBox(target, 'speaking'); else target.stopHighlight();

        if (window.conversationLogger) window.conversationLogger.phrase(initiator, greeting, `Initial greeting for attitude '${attitude}'.`);
        this.showPhrase(0, initiator, greeting, attitude);
        const greetingTopic = greeting.topic || "none";

        setTimeout(() => {
            if (this.isInterrupted(initiator, target)) {
                if (window.conversationLogger) window.conversationLogger.interrupted(initiator, target);
                this.conversationEnd(initiator, target);
                return;
            }
            const reply = this.findPhrase(target, initiator, "reply", attitude, greetingTopic);
            if (!reply) {
                if (window.conversationLogger) window.conversationLogger.noPhraseFound(target, 'reply', attitude, greetingTopic);
                this.conversationEnd(initiator, target); 
                return; 
            }
            
            this.currentConversation.socialCheckDetails = this.initiateSocialCheck(target, initiator);
            
            // Switch highlights
            initiator.stopHighlight();
            if (target.isAlly) this.highlightAllyBox(target, 'replying'); else target.startHighlight(GAME_GLOBAL_CONSTANTS.FACTION_COLORS[target.faction] || '#FFFFFF');

            // Hide the initiator's pointer when the target starts replying.
            if (window.conversationUIManager) {
                window.conversationUIManager.hidePointerForSlot(0); // Hide initiator's pointer
            }

            if (window.conversationLogger) window.conversationLogger.phrase(target, reply, `Reply to topic '${greetingTopic}'.`);
            this.showPhrase(1, target, reply, attitude);
            const replyTopic = reply.topic || "none";

            setTimeout(() => {
                if (this.isInterrupted(initiator, target) && !window.game.state.isPaused) {
                    if (window.conversationLogger) window.conversationLogger.interrupted(initiator, target);
                    this.conversationEnd(initiator, target);
                    return;
                }
                const response = this.findResponse(initiator, target, "response", attitude, replyTopic);
                if (!response) { 
                    if (window.conversationLogger) window.conversationLogger.noPhraseFound(initiator, 'response', attitude, replyTopic);
                    this.conversationEnd(initiator, target); 
                    return; 
                }

                // Switch highlights back to initiator
                initiator.startHighlight(GAME_GLOBAL_CONSTANTS.FACTION_COLORS[initiator.faction] || '#FFFFFF');
                if (target.isAlly) this.highlightAllyBox(target, null); else target.stopHighlight();

                // Hide the target's pointer when the initiator responds.
                // FIX: Restore the missing calls to log and show the final phrase.
                if (window.conversationLogger) window.conversationLogger.phrase(initiator, response, `Response to topic '${replyTopic}'.`);
                this.showPhrase(2, initiator, response, attitude);
                this.executeOutcome(initiator, target, response.outcome, response.value);

            }, 3000); // Increased delay
        }, 3000); // Increased delay

        return true;
    }

    initiateSocialCheck(conversationTarget, conversationInitiator) {
        let socialCheckInitiator;
        let socialCheckTarget;

        // Determine who is the 'initiator' of the social check (ally or player)
        if (conversationInitiator.isAlly) {
            socialCheckInitiator = conversationInitiator;
            socialCheckTarget = conversationTarget;
        } else if (conversationTarget.isAlly) {
            socialCheckInitiator = conversationTarget;
            socialCheckTarget = conversationInitiator;
        } else {
            // If neither is an ally, the player is the implicit initiator of the social check
            socialCheckInitiator = window.game.player;
            socialCheckTarget = conversationTarget; // The NPC in the conversation
        }

        // Ensure we have valid participants for the social check
        if (!socialCheckInitiator || !socialCheckTarget) {
            console.warn("initiateSocialCheck: Invalid social check participants.", { socialCheckInitiator, socialCheckTarget });
            return null;
        }

        // Check if the initiator is a dummy object (e.g., from the simulator)
        const initiatorConfig = socialCheckInitiator.config || window.game.state.playerStats;
        const targetConfig = socialCheckTarget.config || window.game.state.playerStats;

        const initiator_lie = initiatorConfig['lie_attack'] || 50;
        const initiator_charm = initiatorConfig['charm_attack'] || 50;
        
        let attack_type, attack_stat, defense_type, offense_label, defense_label;
        if (initiator_lie >= initiator_charm) {
            attack_type = 'lie_attack';
            attack_stat = initiator_lie;
            defense_type = 'lie_defense';
            offense_label = 'Cunning';
            defense_label = 'Suspicion';
        } else {
            attack_type = 'charm_attack';
            attack_stat = initiator_charm;
            defense_type = 'charm_defense';
            offense_label = 'Charm';
            defense_label = 'Distrust';
        }
        
        const defender_stat = targetConfig[defense_type] || 50;

        const attacker_roll = Math.random() * 100;
        const defender_roll = Math.random() * 100;
        
        const attacker_total = attack_stat + attacker_roll;
        const defender_total = defender_stat + defender_roll;
        
        const differential = attacker_total - defender_total;

        let outcome_tier = 'equals';
        if (differential > 10) {
            if (differential <= 30) outcome_tier = 'h1';
            else if (differential <= 50) outcome_tier = 'h2';
            else if (differential <= 99) outcome_tier = 'h3';
            else outcome_tier = 'h4';
        } else if (differential < -10) {
            if (differential >= -30) outcome_tier = 'm1';
            else if (differential >= -50) outcome_tier = 'm2';
            else if (differential >= -99) outcome_tier = 'm3';
            else outcome_tier = 'm4';
        }

        const initiator_faction_name = socialCheckInitiator.isAlly ? socialCheckInitiator.originalFaction : socialCheckInitiator.faction;
        const target_faction_name = socialCheckTarget.isAlly ? socialCheckTarget.originalFaction : socialCheckTarget.faction;

        let initiatorDisplayName = initiator_faction_name.replace(/_/g, ' ');
        const pluralFactions = ['sith', 'clones', 'aliens', 'droids', 'takers', 'mandalorians'];
        if (initiatorDisplayName.endsWith('s') && !pluralFactions.includes(initiator_faction_name)) {
            initiatorDisplayName = initiatorDisplayName.slice(0, -1);
        }
        if (socialCheckInitiator.isAlly) {
            initiatorDisplayName = `${initiatorDisplayName} Ally`;
        } else if (socialCheckInitiator.isPlayer) {
            initiatorDisplayName = `Player`;
        } else {
            initiatorDisplayName = `${initiatorDisplayName} NPC`;
        }

        let targetDisplayName = target_faction_name.replace(/_/g, ' ');
        if (targetDisplayName.endsWith('s') && !pluralFactions.includes(target_faction_name)) {
            targetDisplayName = targetDisplayName.slice(0, -1);
        }
        if (socialCheckTarget.isAlly) {
            targetDisplayName = `${targetDisplayName} Ally`;
        } else {
            targetDisplayName = `${targetDisplayName} NPC`;
        }

        if (window.conversationUIManager) {
            window.conversationUIManager.displaySocialCheckRolls(
                { faction: initiator_faction_name, displayName: initiatorDisplayName, label: offense_label, total: attacker_total },
                { faction: target_faction_name, displayName: targetDisplayName, label: defense_label, total: defender_total }
            );
        }

        const socialCheckResult = {
            initiator: socialCheckInitiator, // Store the actual social check initiator
            target: socialCheckTarget,       // Store the actual social check target
            offense_label: offense_label,
            defense_label: defense_label,
            attack_stat: attack_stat,
            attacker_roll: attacker_roll,
            attacker_total: attacker_total,
            defender_stat: defender_stat,
            defender_roll: defender_roll,
            defender_total: defender_total,
            differential: differential,
            outcome_tier: outcome_tier,
            initiator_faction_name: initiator_faction_name,
            target_faction_name: target_faction_name
        };
        console.log("initiateSocialCheck returning:", socialCheckResult);
        return socialCheckResult;
    }

    isInterrupted(npc1, npc2) {
        // A conversation is NOT interrupted if the NPCs are conversing with each other.
        // It IS interrupted if they are dead, aggro, or doing something other than idling/conversing.
        const validStates = ['IDLING', 'CONVERSING'];
        if (window.game.state.isPaused) return true;
        if (!npc1 || !npc2) return true; // Safety check

        // Allies can be in a 'FOLLOWING' state and still converse.
        const npc1ValidStates = npc1.isAlly ? [...validStates, 'FOLLOWING'] : validStates;
        const npc2ValidStates = npc2.isAlly ? [...validStates, 'FOLLOWING'] : validStates;

        return !npc1ValidStates.includes(npc1.currentState) || !npc2ValidStates.includes(npc2.currentState) || npc1.isDead || npc2.isDead;
    }

    findPhrase(speaker, listener, type, attitude, topicReceived) {
        // Use original faction for allies to determine their "language" or dialogue style.
        const speakerFaction = speaker.isAlly ? speaker.originalFaction : speaker.faction;
        const listenerFaction = listener.isAlly ? listener.originalFaction : listener.faction;

        const speakerLang = speaker.config.language || "language_basic"; // This can stay for non-basic languages
        const speakerSubgroup = speaker.config.groupKey;

        const filterLogic = (p) => {
            if (!p.type || !p.type.includes(type) || p.attitude !== attitude || p.language !== speakerLang) { return false; }
            const factionMatch = p.from_faction.includes("any") || p.from_faction.includes(speakerFaction);
            const subgroupMatch = p.from_subgroup && p.from_subgroup.includes(speakerSubgroup);
            if (!factionMatch && !subgroupMatch) return false;
            if (!p.to_faction.includes("any") && !p.to_faction.includes(listenerFaction)) return false;
            if (p.to_subgroup && !p.to_subgroup.includes(listener.config.groupKey)) return false;
            return true;
        };

        let potentialPhrases = this.phraseDatabase.filter(p => {
            if (!filterLogic(p)) return false;
            if (type === "reply" || type === "response") {
                if (!p.on_topic_received || !p.on_topic_received.includes(topicReceived)) return false;
            }
            return true;
        });

        if (potentialPhrases.length === 0 && (type === "reply" || type === "response") && topicReceived !== "none") {
            // Fallback to "none" topic
            potentialPhrases = this.phraseDatabase.filter(p => {
                if (!filterLogic(p)) return false;
                if (!p.on_topic_received || !p.on_topic_received.includes("none")) return false;
                return true;
            });
        }

        if (potentialPhrases.length === 0) return null;
        return potentialPhrases[Math.floor(Math.random() * potentialPhrases.length)];
    }

    findResponse(speaker, listener, type, attitude, topicReceived) {
        const speakerFaction = speaker.isAlly ? speaker.originalFaction : speaker.faction;
        const listenerFaction = listener.isAlly ? listener.originalFaction : listener.faction;

        const speakerLang = speaker.config.language || "language_basic";
        const speakerSubgroup = speaker.config.groupKey;
        const filterPhrases = (filterLogic) => {
            return this.phraseDatabase.filter(p => {
                if (!p.type || !p.type.includes(type) || p.attitude !== attitude || p.language !== speakerLang) return false;
                const factionMatch = p.from_faction.includes("any") || p.from_faction.includes(speakerFaction);
                const subgroupMatch = p.from_subgroup && p.from_subgroup.includes(speakerSubgroup);
                if (!factionMatch && !subgroupMatch) return false;
                if (!p.to_faction.includes("any") && !p.to_faction.includes(listenerFaction)) return false;
                if (p.to_subgroup && !p.to_subgroup.includes(listener.config.groupKey)) return false;
                return filterLogic(p);
            });
        };
        let potentialPhrases = filterPhrases(p => p.on_topic_received && p.on_topic_received.includes(topicReceived));
        if (potentialPhrases.length === 0 && topicReceived !== "none") {
            const prefs = this.factionTopicPreferences[speakerFaction] || this.factionTopicPreferences["any"];
            let reaction = null;
            if (prefs.liked.includes(topicReceived)) reaction = "liked";
            if (prefs.disliked.includes(topicReceived)) reaction = "disliked";
            if (reaction) { potentialPhrases = filterPhrases(p => p.on_topic_reaction && p.on_topic_reaction.includes(reaction)); }
        }
        // NEW: Fallback to social check
        if (potentialPhrases.length === 0) {
            potentialPhrases = filterPhrases(p => typeof p.outcome === 'object' && p.outcome.type === 'social_check');
        }
        if (potentialPhrases.length === 0) { potentialPhrases = filterPhrases(p => p.outcome === "end_dialogue" && (!p.on_topic_received || p.on_topic_received.includes("none"))); }
        if (potentialPhrases.length === 0) return null;
        return potentialPhrases[Math.floor(Math.random() * potentialPhrases.length)];
    }

    executeOutcome(initiator, target, outcome, value) {
        setTimeout(() => {
            if (window.conversationLogger) window.conversationLogger.outcome(outcome, value, initiator, target);

            if (this.currentConversation && this.currentConversation.socialCheckDetails) {
                this.performSocialCheck(initiator, target, this.currentConversation.socialCheckDetails);
            }
            this.conversationEnd(initiator, target);
        }, 2500);
    }

    executeSimpleOutcome(outcome, initiator, target, value = null) {
        switch (outcome) {
            case "combat":
                if (initiator.aggro) initiator.aggro(target);
                break;
            case "relation_change":
                // Legacy relation change logic, now funnels through physics shift
                if (window.game.factionManager) window.game.factionManager.shiftFactionBase(initiator.faction, target.isAlly ? target.originalFaction : target.faction, value);
                break;
            case "push_faction_topic":
                // Legacy push faction topic logic, now funnels through physics shift
                if (window.game.factionManager) {
                    window.game.factionManager.shiftFactionBase(initiator.faction, value.target_faction, value.change);
                    window.game.factionManager.shiftFactionBase(target.isAlly ? target.originalFaction : target.faction, value.target_faction, value.change);
                }
                break;
            case "convert_friend":
                // Handled in performSocialCheck
                break;
            case "ally_deserts":
                // Handled in performSocialCheck
                break;
                        case "end_dialogue":
                            // Peacefully end conversation
                            break;
        }
        this.conversationEnd(initiator, target);
    }

    performSocialCheck(initiator, target, checkData) {
        console.log("performSocialCheck received checkData:", checkData);
        const attacker_total = checkData.attacker_total;
        const defender_total = checkData.defender_total;
        const differential = checkData.differential;
        const outcome_tier = checkData.outcome_tier;
        const initiator_faction_name = checkData.initiator_faction_name;
        const target_faction_name = checkData.target_faction_name;

        let shiftAmount = 0;
        let shiftDirection = 0; // 1 for towards, -1 for away
        let actualShift; // Declare without initializing to avoid potential redeclaration error

        switch (outcome_tier) {
            case 'h1': shiftAmount = 2; shiftDirection = 1; break;
            case 'h2': shiftAmount = 5; shiftDirection = 1; break;
            case 'h3': shiftAmount = 8; shiftDirection = 1; break;
            case 'h4': shiftAmount = 10; shiftDirection = 1; break;
            case 'm1': shiftAmount = 2; shiftDirection = -1; break;
            case 'm2': shiftAmount = 5; shiftDirection = -1; break;
            case 'm3': shiftAmount = 8; shiftDirection = -1; break;
            case 'm4': shiftAmount = 10; shiftDirection = -1; break;
            case 'equals': shiftAmount = 0; shiftDirection = 0; break; // No shift for 'equals'
        }

        actualShift = 0; // Initialize here, after switch, before conditional assignment

        if (shiftAmount !== 0 && window.game.factionManager) {
            actualShift = shiftAmount * shiftDirection;
            // Shift the target's base *towards* the initiator's base (player_droid for allies)
            window.game.factionManager.shiftFactionBase(target_faction_name, initiator_faction_name, actualShift);
            if (window.conversationUIManager) {
                window.conversationUIManager.displayFactionShiftOutcome(target_faction_name, actualShift);
            }
            if (window.conversationLogger) {
                window.conversationLogger.outcome('faction_shift', {
                    faction: target_faction_name,
                    targetFaction: initiator_faction_name,
                    change: actualShift
                }, initiator, target);
            }
        }

        // Existing logic for h4 and m4 specific effects (friend/desert)
        if (outcome_tier === 'h4') {
            target.isFriend = true;
            // Also apply a small physics push toward the initiator to represent the "force" of conviction
            window.game.factionManager.applyFactionPhysics(target_faction_name, initiator_faction_name, 5.0); 
        }
        if (outcome_tier === 'm4') {
            if (initiator.isAlly) {
                const formerAlly = initiator;
                if (window.game.removeAlly) window.game.removeAlly(formerAlly);
                formerAlly.isAlly = false;
                formerAlly.isFriend = false;
                if (window.game.player) {
                    formerAlly.aggro(window.game.player);
                    for (const ally of window.game.state.allies) {
                        if (ally.npc && !ally.npc.isDead) {
                            formerAlly.aggro(ally.npc);
                        }
                    }
                }
            }
            // Also apply a small physics push away from the initiator to represent the "force" of rejection
            window.game.factionManager.applyFactionPhysics(target_faction_name, initiator_faction_name, -5.0);
        }

        if (window.conversationLogger) {
            window.conversationLogger.socialCheck({
                initiator: initiator,
                target: target,
                offense_label: checkData.offense_label,
                defense_label: checkData.defense_label,
                attack_stat: checkData.attack_stat,
                attacker_roll: checkData.attacker_roll,
                attacker_total: attacker_total,
                defender_stat: checkData.defender_stat,
                defender_roll: checkData.defender_roll,
                defender_total: defender_total,
                differential: checkData.differential,
                outcome_tier: outcome_tier,
                push_force: checkData.push_force,
                target_faction_name: target_faction_name,
                initiator_faction_name: initiator_faction_name,
                actualShift: actualShift // Pass the actualShift here
            });
        }

        if (window.conversationUIManager) {
            window.conversationUIManager.displaySocialCheckRolls(
                { faction: initiator_faction_name, label: checkData.offense_label, total: attacker_total },
                { faction: target_faction_name, label: checkData.defense_label, total: defender_total }
            );
        }
        
        if (window.conversationUIManager) {
            window.conversationUIManager.displaySocialCheckOutcome(outcome_tier, target);
        }
        
        // conversationEnd is called by the setTimeout in executeOutcome or directly if no outcome is found.
        // We should not call it here to avoid double-ending the conversation.
    }

    executeFactionPush(winner, loser) {
        // TODO: Implement faction nudge logic
        console.log(`Faction Push: ${winner.faction} pushes a topic on ${loser.faction}`);
    }

    showPhrase(slotIndex, speaker, phrase, attitude) {
        const speakerFaction = speaker.isAlly ? speaker.originalFaction : speaker.faction;
        let factionDisplayName = speakerFaction.replace(/_/g, ' ');
        
        // Singularize faction name if it's plural, with exceptions
        const pluralFactions = ['sith', 'clones', 'aliens', 'droids', 'takers', 'mandalorians'];
        if (factionDisplayName.endsWith('s') && !pluralFactions.includes(speakerFaction)) {
            factionDisplayName = factionDisplayName.slice(0, -1);
        }
        
        // Add "NPC" or "Ally" to the display name
        if (speaker.isAlly) {
            factionDisplayName = `${factionDisplayName} Ally`;
        } else {
            factionDisplayName = `${factionDisplayName} NPC`;
        }

        const factionColor = GAME_GLOBAL_CONSTANTS.FACTION_COLORS[speakerFaction] || '#888';
        const textToShow = `${speaker.name}: ${phrase.text}`;
        
        // Play audio immediately
        let soundName;
        if (phrase.type.includes('greeting')) {
            soundName = attitude === 'h1' ? 'happy1' : (attitude === 'm1' ? 'mad1' : 'idle1');
        } else if (slotIndex === 1) { soundName = 'reply2';
        } else { soundName = 'response3'; }
        this.playConversationSound(speaker, soundName);

        // Delay showing the text box
        setTimeout(() => {
            window.conversationUIManager.showPhrase(slotIndex, textToShow, speaker, factionColor, factionDisplayName);
        }, 200);
    }

    highlightAllyBox(ally, animationType) { // animationType can be 'speaking', 'replying', or null
        if (!ally || ally.allySlotIndex === -1) return;
        const box = document.getElementById(`ally-box-${ally.allySlotIndex + 1}`);
        if (box) {
            box.style.setProperty('--ally-color', ally.color); // Set CSS variable for animation
            box.classList.remove('speaking', 'replying');

            if (animationType) {
                void box.offsetWidth; // Trigger reflow
                box.classList.add(animationType);
            } else {
                box.style.borderWidth = '2px';
            }
        }
    }

    playConversationSound(speaker, soundName) {
        if (!window.audioSystem) return;
        const path = this.getSpeakerSoundPath(speaker);
        let extension = '.mp3';
        // Wookiees use .wav files for their dialogue.
        if (speaker.config.baseType === 'wookiee') {
            extension = '.wav';
        }
        const fullSoundPath = `${path}${soundName}${extension}`;
        console.log(`[AudioDebug] Attempting to play: ${fullSoundPath}`);
        // Use voice volume for conversation audio
        const voiceVolume = window.audioSystem.voiceVolume || 1.0;
        window.audioSystem.playPositionalSound(fullSoundPath, speaker.mesh.group.position, voiceVolume);
    }

    getSpeakerSoundPath(speaker) {
        const basePath = '/data/speech/conversation/'; // Corrected base path for dialogue
        const baseType = speaker.config.baseType;
        const faction = speaker.config.faction;

        // NEW: Handle rebels who are human
        if (faction === 'rebels') {
            if (baseType === 'human_male') {
                return `${basePath}rebels/males/`;
            }
            if (baseType === 'human_female') {
                return `${basePath}rebels/females/`;
            }
        }

        // Map baseType to the known conversation sound directories
        switch (baseType) {
            case 'gamorrean': return `${basePath}aliens/humanoid/gamorrean/`;
            case 'wookiee': return `${basePath}aliens/humanoid/wookiee/`;
            case 'gungan': return `${basePath}aliens/humanoid/gungan/`;
            case 'ewok': return `${basePath}aliens/humanoid/halfpints/ewok/`;
            case 'jawa': return `${basePath}aliens/humanoid/halfpints/jawa/`;
            case 'human_male': return `${basePath}rebels/males/`;
            case 'human_female': return `${basePath}rebels/females/`;
            case 'clone': return `${basePath}clones/`;
            case 'mandalorian': return `${basePath}mandolorians/`;
            case 'stormtrooper': return `${basePath}stormtrooper/stormtrooper/`;
            case 'imperial_officer': return `${basePath}stormtrooper/imperial officer/`;
            case 'darth': return `${basePath}sith/`;
            case 'taker': return `${basePath}takers/`;
            // Droids are a bit scattered
            case 'r2d2': return `${basePath}droids/humanoid/r2d2/`;
            case 'gonk': return `${basePath}droids/slime/gonk/`;
            case 'probe': return `${basePath}droids/spider/probe/`;
            default:
                // Final fallback for generic aliens, droids, etc.
                if (speaker.faction === 'droids') return `${basePath}droids/humanoid/generic/`;
                if (speaker.faction === 'aliens') return `${basePath}aliens/humanoid/generic/`;
                return `${basePath}rebels/males/`; // Absolute fallback
        }
    }

    conversationEnd(initiator, target) {
        if (window.conversationLogger) window.conversationLogger.end();
        if (window.game) {
            window.game.conversationCooldownTimer = 10.0 + Math.random() * 5;
            window.game.state.isConversationActive = false;
        }
        if (initiator) {
            initiator.isConversing = false;
            initiator.hasSpoken = true;
            initiator.stopHighlight();
            initiator.currentState = 'IDLING'; // Reset to IDLING after conversation
            initiator.target = null; // Clear target
        }
        if (target) {
            target.isConversing = false;
            target.hasSpoken = true;
            if (target.isAlly) {
                // Restore the original ring color
                const allyData = game.state.allies.find(a => a.npc === target);
                if (allyData && target.allyRing) {
                    target.allyRing.material.color.set(allyData.color);
                }
                this.highlightAllyBox(target, null); // Stop HUD animation
            }
            target.stopHighlight();
            target.currentState = 'IDLING'; // Reset to IDLING after conversation
            target.target = null; // Clear target
        }
        if (window.conversationUIManager) {
            window.conversationUIManager.startFadeOutSequence(); // Fade out the UI gracefully
            window.isConversationUIVisible = false; // Ensure this flag is reset
            window.conversationUIManager.resetAllyBoxes(); // Reset ally boxes position
        }
    }
}

window.conversationController = new ConversationController();