import { db } from '../data/db';
import { GuildMember, APIInteractionGuildMember, PermissionFlagsBits } from 'discord.js';

export type RoleType = 'mod' | 'staff' | 'srmod';

export type ModAction =
    | 'ban' | 'kick' | 'mute' | 'unmute' | 'warn' | 'unban'
    | 'purge' | 'reason' | 'delcase' | 'modleaderboard'
    | 'modlogs' | 'modstats' | 'whois' | 'caseinfo'
    | 'av' | 'banword' | 'checkperms' | 'dm'
    | 'lock' | 'unlock' | 'hide' | 'unhide'
    | 'move' | 'movevc' | 'role' | 'inrole'
    | 'ad' | 'autodrag' | 'suggestion';

/**
 * Permission mapping for each role type
 */
export const ROLE_PERMISSIONS: Record<RoleType, ModAction[]> = {
    // SrMod has access to EVERYTHING
    srmod: [
        'ban', 'kick', 'mute', 'unmute', 'warn', 'unban', 'purge', 'reason', 'delcase',
        'modleaderboard', 'modlogs', 'modstats', 'whois', 'caseinfo', 'av', 'banword',
        'checkperms', 'dm', 'lock', 'unlock', 'hide', 'unhide', 'move', 'movevc', 'role',
        'inrole', 'ad', 'autodrag', 'suggestion'
    ],
    // Mod has restricted access (removed: lock, unlock, hide, unhide, caseinfo, banword, checkperms, delcase, dm, modleaderboard, modstats, role, suggestion)
    mod: [
        'ban', 'kick', 'mute', 'unmute', 'warn', 'unban', 'purge', 'reason',
        'modlogs', 'whois', 'av',
        'move', 'movevc', 'inrole',
        'ad', 'autodrag'
    ],
    // Staff has further restricted access (no ban/unban + same restrictions as mod)
    staff: [
        'kick', 'mute', 'unmute', 'warn', 'purge', 'reason',
        'modlogs', 'whois', 'av',
        'move', 'movevc', 'inrole',
        'ad', 'autodrag'
    ]
};

/**
 * Discord permission mapping for each action
 */
export const ACTION_DISCORD_PERMS: Record<ModAction, bigint> = {
    ban: PermissionFlagsBits.BanMembers,
    unban: PermissionFlagsBits.BanMembers,
    kick: PermissionFlagsBits.KickMembers,
    mute: PermissionFlagsBits.ModerateMembers,
    unmute: PermissionFlagsBits.ModerateMembers,
    warn: PermissionFlagsBits.ModerateMembers,
    purge: PermissionFlagsBits.ManageMessages,
    reason: PermissionFlagsBits.ModerateMembers,
    delcase: PermissionFlagsBits.Administrator,
    modleaderboard: PermissionFlagsBits.Administrator,
    modlogs: PermissionFlagsBits.ViewAuditLog,
    modstats: PermissionFlagsBits.Administrator,
    whois: PermissionFlagsBits.ModerateMembers,
    caseinfo: PermissionFlagsBits.ModerateMembers,
    av: PermissionFlagsBits.ModerateMembers,
    banword: PermissionFlagsBits.ManageMessages,
    checkperms: PermissionFlagsBits.ManageRoles,
    dm: PermissionFlagsBits.ManageMessages,
    lock: PermissionFlagsBits.ManageChannels,
    unlock: PermissionFlagsBits.ManageChannels,
    hide: PermissionFlagsBits.ManageChannels,
    unhide: PermissionFlagsBits.ManageChannels,
    move: PermissionFlagsBits.MoveMembers,
    movevc: PermissionFlagsBits.MoveMembers,
    role: PermissionFlagsBits.ManageRoles,
    inrole: PermissionFlagsBits.ManageRoles,
    ad: PermissionFlagsBits.MoveMembers,
    autodrag: PermissionFlagsBits.MoveMembers,
    suggestion: PermissionFlagsBits.ManageMessages
};


/**
 * Check if a member has a configured mod role
 */
export async function hasModRole(guildId: string, member: GuildMember | APIInteractionGuildMember): Promise<boolean> {
    if (!member) return false;

    // Get member role IDs
    const memberRoleIds = Array.isArray(member.roles)
        ? member.roles
        : Array.from(member.roles.cache.keys());

    // Check DB for configured mod roles
    const modRoles = await db.modRole.findMany({
        where: { guild_id: guildId }
    });

    // Check if member has any of the configured roles
    const hasConfiguredRole = modRoles.some((mr: any) => memberRoleIds.includes(mr.role_id));

    // Also check for literal "Mod" or "Moderator" role names if member object has roles cache
    let hasLiteralRole = false;
    if ('roles' in member && !Array.isArray(member.roles)) {
        hasLiteralRole = member.roles.cache.some(r => r.name === 'Mod' || r.name === 'Moderator');
    }

    return hasConfiguredRole || hasLiteralRole;
}

/**
 * Check if a member has a configured staff role
 */
export async function hasStaffRole(guildId: string, member: GuildMember | APIInteractionGuildMember): Promise<boolean> {
    if (!member) return false;

    const memberRoleIds = Array.isArray(member.roles)
        ? member.roles
        : Array.from(member.roles.cache.keys());

    const staffRoles = await db.staffRole.findMany({
        where: { guild_id: guildId }
    });

    return staffRoles.some((sr: any) => memberRoleIds.includes(sr.role_id));
}

/**
 * Check if a member has a configured senior mod role
 */
export async function hasSrModRole(guildId: string, member: GuildMember | APIInteractionGuildMember): Promise<boolean> {
    if (!member) return false;

    const memberRoleIds = Array.isArray(member.roles)
        ? member.roles
        : Array.from(member.roles.cache.keys());

    // @ts-ignore - srModRole is generated
    const srModRoles = await db.srModRole.findMany({
        where: { guild_id: guildId }
    });

    return srModRoles.some((smr: any) => memberRoleIds.includes(smr.role_id));
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
    // Check if user has srmod role and action is allowed for srmod
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
    let perms: bigint;

    if (typeof member.permissions === 'string') {
        perms = BigInt(member.permissions);
    } else {
        // It's a Readonly<PermissionsBitField>
        perms = member.permissions.bitfield;
    }

    const requiredPerm = ACTION_DISCORD_PERMS[action];
    return hasPermission(perms, requiredPerm);
}

// Helper to check permission bitfield
function hasPermission(memberPerms: bigint, requiredPerm: bigint): boolean {
    return (memberPerms & requiredPerm) === requiredPerm || (memberPerms & PermissionFlagsBits.Administrator) === PermissionFlagsBits.Administrator;
}

/**
 * Get the highest privilege role type a member has
 */
export async function getMemberRoleType(guildId: string, member: GuildMember | APIInteractionGuildMember): Promise<RoleType | null> {
    if (await hasSrModRole(guildId, member)) return 'srmod';
    if (await hasModRole(guildId, member)) return 'mod';
    if (await hasStaffRole(guildId, member)) return 'staff';
    return null;
}
