import { db } from '../data/db';
import { GuildMember, APIInteractionGuildMember, PermissionFlagsBits } from 'discord.js';
import { hasPermission } from './permissions';

export type RoleType = 'srmod' | 'mod' | 'staff';
export type ModAction = 
    // Standard actions
    | 'ban' | 'kick' | 'mute' | 'unmute' | 'warn' | 'unban' | 'purge' | 'clear'
    | 'lock' | 'unlock' | 'hide' | 'unhide' | 'move' | 'movevc' | 'ad' | 'autodrag'
    | 'reason' | 'modlogs' | 'whois' | 'av'
    // Exclusive Sr Mod actions
    | 'caseinfo' | 'delcase' | 'banword' | 'checkperms' | 'dm' 
    | 'modleaderboard' | 'modstats' | 'role' | 'inrole' 
    | 'suggestion' | 'suggestion_action';

/**
 * Permission mapping for each role type
 * - srmod: Full access (standard + exclusive)
 * - mod: Standard moderation only
 * - staff: Basic moderation (no ban/unban)
 */
const ROLE_PERMISSIONS: Record<RoleType, ModAction[]> = {
    srmod: [
        // Standard moderation
        'ban', 'unban', 'kick', 'mute', 'unmute', 'warn', 'purge', 'clear',
        'lock', 'unlock', 'hide', 'unhide', 'move', 'movevc', 'ad', 'autodrag',
        'reason', 'modlogs', 'whois', 'av',
        // Exclusive commands
        'caseinfo', 'delcase', 'banword', 'checkperms', 'dm',
        'modleaderboard', 'modstats', 'role', 'inrole',
        'suggestion', 'suggestion_action'
    ],
    mod: [
        'ban', 'unban', 'kick', 'mute', 'unmute', 'warn', 'purge', 'clear',
        'lock', 'unlock', 'hide', 'unhide', 'move', 'movevc', 'ad', 'autodrag',
        'reason', 'modlogs', 'whois', 'av'
    ],
    staff: [
        'kick', 'mute', 'unmute', 'warn', 'purge', 'clear',
        'lock', 'unlock', 'hide', 'unhide', 'move', 'movevc', 'ad', 'autodrag',
        'reason', 'modlogs', 'whois', 'av'
    ]
};

/**
 * Discord permission mapping for each action
 */
const ACTION_DISCORD_PERMS: Partial<Record<ModAction, bigint>> = {
    ban: PermissionFlagsBits.BanMembers,
    unban: PermissionFlagsBits.BanMembers,
    kick: PermissionFlagsBits.KickMembers,
    mute: PermissionFlagsBits.ModerateMembers,
    unmute: PermissionFlagsBits.ModerateMembers,
    warn: PermissionFlagsBits.ModerateMembers,
    purge: PermissionFlagsBits.ManageMessages,
    clear: PermissionFlagsBits.ManageMessages,
    lock: PermissionFlagsBits.ManageChannels,
    unlock: PermissionFlagsBits.ManageChannels,
    hide: PermissionFlagsBits.ManageChannels,
    unhide: PermissionFlagsBits.ManageChannels,
    role: PermissionFlagsBits.ManageRoles
};

/**
 * Check if a member has a configured Sr Mod role
 */
export async function hasSrModRole(
    guildId: string, 
    member: GuildMember | APIInteractionGuildMember
): Promise<boolean> {
    try {
        const srModRoles = await db.srModRole.findMany({
            where: { guild_id: guildId },
            select: { role_id: true }
        });

        if (srModRoles.length === 0) return false;

        const srModRoleIds = new Set(srModRoles.map((mr: any) => mr.role_id));
        let memberRoleIds: string[] = [];
        
        if (Array.isArray(member.roles)) {
            memberRoleIds = member.roles;
        } else {
            memberRoleIds = member.roles.cache.map(r => r.id);
        }

        return memberRoleIds.some(roleId => srModRoleIds.has(roleId));
    } catch (error) {
        console.error('Error checking sr mod role:', error);
        return false;
    }
}

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
 * Hierarchy: Administrator > Sr Mod > Mod > Staff > Discord Permissions
 * Even if user doesn't have Discord perms, they can run if they have the role
 */
export async function canPerformAction(
    guildId: string,
    member: GuildMember | APIInteractionGuildMember,
    action: ModAction
): Promise<boolean> {
    // Check if user is administrator
    const perms = typeof member.permissions === 'string' 
        ? BigInt(member.permissions) 
        : member.permissions;
    
    if (hasPermission(perms, PermissionFlagsBits.Administrator)) {
        return true;
    }

    // Check if user has Sr Mod role and action is allowed for Sr Mods
    const isSrMod = await hasSrModRole(guildId, member);
    if (isSrMod && ROLE_PERMISSIONS.srmod.includes(action)) {
        return true;
    }

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
    const requiredPerm = ACTION_DISCORD_PERMS[action];
    if (requiredPerm) {
        return hasPermission(perms, requiredPerm);
    }

    return false;
}

/**
 * Get the role type of a member (srmod, mod, staff, or null)
 * Returns the highest role in the hierarchy
 */
export async function getMemberRoleType(
    guildId: string,
    member: GuildMember | APIInteractionGuildMember
): Promise<RoleType | null> {
    if (await hasSrModRole(guildId, member)) return 'srmod';
    if (await hasModRole(guildId, member)) return 'mod';
    if (await hasStaffRole(guildId, member)) return 'staff';
    return null;
}
