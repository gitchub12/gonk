// BROWSERFIREFOXHIDE conversation_logger.js

class ConversationLogger {
    constructor() {
        this.logStyle = 'background: #111; color: #aaeebb;';
        this.headerStyle = 'background: #111; color: #aaffaa; font-weight: bold; font-size: 1.1em;';
        this.factionStyle = 'background: #111; color: #88ddff;';
        this.errorStyle = 'background: #111; color: #ff8888; font-weight: bold;';
    }

    start(initiator, target, attitude) {
        console.groupCollapsed(`%cConversation Started: ${initiator.name} & ${target.name}`, this.headerStyle);
        console.log(`%cInitiator: ${initiator.name} (Faction: ${initiator.faction}, Health: ${initiator.health}/${initiator.maxHealth})`, initiator.isAlly ? this.factionStyle : this.logStyle);
        console.log(`%cTarget: ${target.name} (Faction: ${target.isAlly ? target.originalFaction : target.faction}, Health: ${target.health}/${target.maxHealth})`, target.isAlly ? this.factionStyle : this.logStyle);
        console.log(`%cInitial Attitude: ${attitude}`, this.logStyle);
        console.groupEnd();
    }

    phrase(speaker, phrase, reason) {
        console.groupCollapsed(`%cPhrase Chosen: ${speaker.name}`, this.logStyle);
        console.log(`%cText: "${phrase.text}"`, this.logStyle);
        console.log(`%cType: ${phrase.type}, Attitude: ${phrase.attitude}, Language: ${phrase.language}, Topic: ${phrase.topic || 'none'}`, this.logStyle);
        console.log(`%cReason: ${reason}`, this.logStyle);
        console.groupEnd();
    }

    noPhraseFound(speaker, type, attitude, topic) {
        console.groupCollapsed(`%cNo Phrase Found for ${speaker.name}`, this.errorStyle);
        console.log(`%cType: ${type}`, this.logStyle);
        console.log(`%cAttitude: ${attitude}`, this.logStyle);
        console.log(`%cTopic Received: ${topic}`, this.logStyle);
        console.log(`%cSpeaker Faction: ${speaker.isAlly ? speaker.originalFaction : speaker.faction}`, this.logStyle);
        console.log(`%cSpeaker Language: ${speaker.config.language || "language_basic"}`, this.logStyle);
        console.groupEnd();
    }

    interrupted(npc1, npc2) {
        console.groupCollapsed('%cConversation Interrupted', this.errorStyle);
        if (window.game.state.isPaused) console.log('%cReason: Game is paused.', this.errorStyle);
        if (npc1) console.log(`%c${npc1.name} state: ${npc1.currentState}, isDead: ${npc1.isDead}`, this.logStyle);
        if (npc2) console.log(`%c${npc2.name} state: ${npc2.currentState}, isDead: ${npc2.isDead}`, this.logStyle);
        console.groupEnd();
    }

    outcome(outcome, value, initiator, target) {
        console.groupCollapsed(`%cConversation Outcome: ${outcome}`, this.factionStyle);
        switch (outcome) {
            case 'relation_change':
                console.log(`%cFaction relationship between ${initiator.faction} and ${target.isAlly ? target.originalFaction : target.faction} changed by ${value}.`, this.factionStyle);
                break;
            case 'push_faction_topic':
                console.log(`%c${initiator.faction} and ${target.isAlly ? target.originalFaction : target.faction} relationship with ${value.target_faction} changed by ${value.change}.`, this.factionStyle);
                break;
            case 'combat':
                console.log(`%c${initiator.name} is now hostile to ${target.name}.`, this.errorStyle);
                break;
            case 'end_dialogue':
                console.log(`%cConversation ended peacefully.`, this.factionStyle);
                break;
            default:
                console.log(`%cOutcome: ${outcome}, Value: ${JSON.stringify(value)}`, this.factionStyle);
        }
        console.groupEnd();
    }

    socialCheck(details) {
        console.groupCollapsed('%cSocial Check Details', this.factionStyle);
        console.log(`%cAttacker: ${details.initiator.name} (${details.offense_label}: ${details.attack_stat} + ${details.attacker_roll.toFixed(0)} = ${details.attacker_total.toFixed(0)})`, this.logStyle);
        console.log(`%cDefender: ${details.target.name} (${details.defense_label}: ${details.defender_stat} + ${details.defender_roll.toFixed(0)} = ${details.defender_total.toFixed(0)})`, this.logStyle);
        console.log(`%cDifferential: ${details.differential !== undefined ? details.differential.toFixed(0) : 'N/A'} -> Outcome: ${details.outcome_tier}`, this.factionStyle);

        if (details.outcome_tier === 'h4') {
            console.log(`%cPermanent Effect: ${details.target_faction_name} faction shifted 1 point towards 'gonk'.`, this.factionStyle);
            console.log(`%cStatus Effect: ${details.target.name} is now a 'friend'.`, this.factionStyle);
        }
        if (details.actualShift !== undefined && details.actualShift !== 0) {
            const shiftText = details.actualShift > 0 ? `+${details.actualShift}` : `${details.actualShift}`;
            const targetFactionDisplayName = details.target_faction_name.charAt(0).toUpperCase() + details.target_faction_name.slice(1); // Capitalize first letter
            console.log(`%c${targetFactionDisplayName} Friendship ${shiftText}`, this.factionStyle);
        }
        console.groupEnd();
    }

    end() {
        console.log('%c--- Conversation Ended ---', this.headerStyle);
    }
}

window.conversationLogger = new ConversationLogger();