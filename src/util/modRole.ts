import { db } from '../data/db';
import { GuildMember, APIInteractionGuildMember } from 'discord.js';

/**
 * Check if a member has a configured moderator role
 */
export async function hasModRole(
    guildId: string, 
    member: GuildMember | APIInteractionGuildMember
): Promise<boolean> {
    try {
        // Get all mod roles for the guild
        const modRoles = await db.modRole.findMany({
            where: { guild_id: guildId },
            select: { role_id: true }
        });

        if (modRoles.length === 0) {
            return false;
        }

        const modRoleIds = new Set(modRoles.map((mr: any) => mr.role_id));

        // Get member's roles
        let memberRoleIds: string[] = [];
        if (Array.isArray(member.roles)) {
            memberRoleIds = member.roles;
        } else {
            memberRoleIds = member.roles.cache.map(r => r.id);
        }

        // Check if member has any mod role
        return memberRoleIds.some(roleId => modRoleIds.has(roleId));
    } catch (error) {
        console.error('Error checking mod role:', error);
        return false;
    }
}
