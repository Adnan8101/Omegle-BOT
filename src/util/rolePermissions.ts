import { db } from '../data/db';
import { GuildMember, APIInteractionGuildMember, PermissionFlagsBits } from 'discord.js';
import { hasPermission } from './permissions';

export type RoleType = 'mod' | 'staff';
export type ModAction = 'ban' | 'kick' | 'mute' | 'unmute' | 'warn' | 'unban';

/**
 * Permission mapping for each role type
 */
const ROLE_PERMISSIONS: Record<RoleType, ModAction[]> = {
    mod: ['ban', 'kick', 'mute', 'unmute', 'warn', 'unban'],
    staff: ['kick', 'mute', 'unmute']
};

/**
 * Discord permission mapping for each action
 */
const ACTION_DISCORD_PERMS: Record<ModAction, bigint> = {
    ban: PermissionFlagsBits.BanMembers,
    unban: PermissionFlagsBits.BanMembers,
    kick: PermissionFlagsBits.KickMembers,
    mute: PermissionFlagsBits.ModerateMembers,
    unmute: PermissionFlagsBits.ModerateMembers,
    warn: PermissionFlagsBits.ModerateMembers
};

/**
 * Check if a member has a configured mod role
 */
export async function hasModRole(
    guildId: string, 
    member: GuildMember | APIInteractionGuildMember
): Promise<boolean> {
    try {
        const modRoles = await db.modRole.findMany({
            where: { guild_id: guildId },
            select: { role_id: true }
        });

        if (modRoles.length === 0) return false;

        const modRoleIds = new Set(modRoles.map((mr: any) => mr.role_id));
        let memberRoleIds: string[] = [];
        
        if (Array.isArray(member.roles)) {
            memberRoleIds = member.roles;
        } else {
            memberRoleIds = member.roles.cache.map(r => r.id);
        }

        return memberRoleIds.some(roleId => modRoleIds.has(roleId));
    } catch (error) {
        console.error('Error checking mod role:', error);
        return false;
    }
}

/**
 * Check if a member has a configured staff role
 */
export async function hasStaffRole(
    guildId: string, 
    member: GuildMember | APIInteractionGuildMember
): Promise<boolean> {
    try {
        const staffRoles = await db.staffRole.findMany({
            where: { guild_id: guildId },
            select: { role_id: true }
        });

        if (staffRoles.length === 0) return false;

        const staffRoleIds = new Set(staffRoles.map((sr: any) => sr.role_id));
        let memberRoleIds: string[] = [];
        
        if (Array.isArray(member.roles)) {
            memberRoleIds = member.roles;
        } else {
            memberRoleIds = member.roles.cache.map(r => r.id);
        }

        return memberRoleIds.some(roleId => staffRoleIds.has(roleId));
    } catch (error) {
        console.error('Error checking staff role:', error);
        return false;
    }
}

/**
 * Centralized permission check - checks custom roles OR Discord permissions
 * Even if user doesn't have Discord perms, they can run if they have the role
 */
export async function canPerformAction(
    guildId: string,
    member: GuildMember | APIInteractionGuildMember,
    action: ModAction
): Promise<boolean> {
    // Check if user has mod role and action is allowed for mods
    const isMod = await hasModRole(guildId, member);
    if (isMod && ROLE_PERMISSIONS.mod.includes(action)) {
        return true;
    }

    // Check if user has staff role and action is allowed for staff
    const isStaff = await hasStaffRole(guildId, member);
    if (isStaff && ROLE_PERMISSIONS.staff.includes(action)) {
        return true;
    }

    // Fallback to Discord permissions
    const perms = typeof member.permissions === 'string' 
        ? BigInt(member.permissions) 
        : member.permissions;
    
    const requiredPerm = ACTION_DISCORD_PERMS[action];
    return hasPermission(perms, requiredPerm);
}

/**
 * Get the role type of a member (mod, staff, or null)
 */
export async function getMemberRoleType(
    guildId: string,
    member: GuildMember | APIInteractionGuildMember
): Promise<RoleType | null> {
    if (await hasModRole(guildId, member)) return 'mod';
    if (await hasStaffRole(guildId, member)) return 'staff';
    return null;
}
