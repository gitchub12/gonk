// e:\gonktest\data\npc_name_assigner.js

/**
 * Assigns a final, randomized name to an NPC based on a clear hierarchy of rules.
 * This is the central authority for all NPC naming in the game.
 *
 * @param {object} npcData - An object containing NPC properties { name, faction, subgroup, baseType }.
 * @param {object} nameData - The full dataset from npc_names.json.
 * @returns {string} The final, generated name for the NPC.
 */
function generateNpcName(npcData, nameData) {
    // Priority 1: Manually set name in the editor.
    // A placeholder name looks like "factionF factionL". We want to replace those.
    // If the name does not look like a placeholder, use it.
    if (npcData.name && npcData.name.trim().length > 0 && !/\w+F \w+L$/.test(npcData.name.trim())) {
        return npcData.name.trim();
    }

    let nameKey = '';
    const faction = (npcData.faction || '').toLowerCase();
    const subgroup = (npcData.subgroup || '').toLowerCase();

    // Handle subgroup aliases to ensure correct name list selection.
    const subgroupMap = {
        'human_female': 'female',
        'human_male': 'male'
    };
    const effectiveSubgroup = subgroupMap[subgroup] || subgroup;

    // Priority 2: Subgroup-based name.
    // Check if a name list exists for the effective subgroup.
    if (effectiveSubgroup && nameData[`${effectiveSubgroup}F`]) {
        nameKey = effectiveSubgroup;
    }
    // Priority 3: Faction-based name (if subgroup naming fails or subgroup doesn't exist).
    else if (faction) {
        // First, try a direct mapping (e.g., faction 'droids' -> name key 'droids')
        if (nameData[`${faction}F`]) {
            nameKey = faction;
        } else {
            // If direct mapping fails, try special cases (e.g., faction 'imperials' -> name key 'stormtrooper')
            const factionMap = {
                'imperials': 'stormtrooper',
                'rebels': 'male', // Default for rebels
                'clones': 'clone',
                'mandalorians': 'mando',
                'sith': 'darth',
                'takers': 'taker',
                'aliens': 'humanoid', // Generic alien
                'droids': 'droid'
            };
            const mappedKey = factionMap[faction];
            if (mappedKey && nameData[`${mappedKey}F`]) {
                nameKey = mappedKey;
            }
        }
    }

    // If we found a valid key, generate the name.
    if (nameKey) {
        const firstNames = nameData[`${nameKey}F`];
        const lastNames = nameData[`${nameKey}L`] || [''];

        if (!firstNames || firstNames.length === 0) {
            const errorFaction = faction || subgroup || 'unknown';
            return `ERR_${errorFaction.toUpperCase()}F ERR_${errorFaction.toUpperCase()}L`;
        }

        const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
        const lastName = lastNames.length > 0 ? lastNames[Math.floor(Math.random() * lastNames.length)] : '';

        // Categories that should not have a space between first and last name.
        const noSpaceCategories = ['droid', 'wookiee', 'gamorrean', 'stormtrooper', 'taker'];
        if (noSpaceCategories.includes(nameKey)) {
            return `${firstName}${lastName.trim()}`;
        } else {
            return `${firstName} ${lastName.trim()}`.trim();
        }
    }

    // Priority 4: Error name as a fallback.
    const errorFaction = faction || 'unknown';
    return `ERR_${errorFaction.toUpperCase()}F ERR_${errorFaction.toUpperCase()}L`;
}