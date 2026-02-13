import { Role, Channel } from 'discord.js';

/**
 * Calculate similarity between two strings using Levenshtein distance
 */
function calculateSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();
    
    if (s1 === s2) return 1.0;
    if (s1.length === 0 || s2.length === 0) return 0;
    
    // Check if one string contains the other
    if (s1.includes(s2) || s2.includes(s1)) {
        const shorter = Math.min(s1.length, s2.length);
        const longer = Math.max(s1.length, s2.length);
        return shorter / longer * 0.95;
    }
    
    // Levenshtein distance
    const matrix: number[][] = [];
    
    for (let i = 0; i <= s2.length; i++) {
        matrix[i] = [i];
    }
    
    for (let j = 0; j <= s1.length; j++) {
        matrix[0][j] = j;
    }
    
    for (let i = 1; i <= s2.length; i++) {
        for (let j = 1; j <= s1.length; j++) {
            if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    
    const distance = matrix[s2.length][s1.length];
    const maxLength = Math.max(s1.length, s2.length);
    return 1 - (distance / maxLength);
}

/**
 * Find the best matching role from a collection based on input
 */
export function findBestRoleMatch(
    input: string,
    roles: Role[],
    threshold: number = 0.6
): { role: Role; similarity: number } | null {
    let bestMatch: { role: Role; similarity: number } | null = null;
    
    for (const role of roles) {
        const similarity = calculateSimilarity(input, role.name);
        
        if (similarity >= threshold) {
            if (!bestMatch || similarity > bestMatch.similarity) {
                bestMatch = { role, similarity };
            }
        }
    }
    
    return bestMatch;
}

/**
 * Check if input is an exact match (ID, mention, or exact name)
 */
export function isExactRoleMatch(input: string, role: Role): boolean {
    // Check if it's a role ID
    if (input === role.id) return true;
    
    // Check if it's a role mention
    if (input === `<@&${role.id}>`) return true;
    
    // Check if it's exact name match (case insensitive)
    if (input.toLowerCase() === role.name.toLowerCase()) return true;
    
    return false;
}

/**
 * Find the best matching channel from a collection based on input
 */
export function findBestChannelMatch(
    input: string,
    channels: Channel[],
    threshold: number = 0.6
): { channel: Channel; similarity: number } | null {
    let bestMatch: { channel: Channel; similarity: number } | null = null;
    
    for (const channel of channels) {
        if (!('name' in channel)) continue;
        const similarity = calculateSimilarity(input, channel.name);
        
        if (similarity >= threshold) {
            if (!bestMatch || similarity > bestMatch.similarity) {
                bestMatch = { channel, similarity };
            }
        }
    }
    
    return bestMatch;
}
