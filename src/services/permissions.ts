import { db } from '../data/db';
import { Context } from '../core/context';
import { PermissionsBitField } from 'discord.js';

export class PermissionEngine {
    async can(ctx: Context, permissionNode: string): Promise<boolean> {
        if (!ctx.guildId || !ctx.inner.member) return false;

        const member = ctx.inner.member;

        // 1. Check DB for User overrides (Allow/Deny)
        const userOverride = await db.permission.findFirst({
            where: {
                guild_id: ctx.guildId,
                subject_type: 'user',
                subject_id: ctx.authorId,
                permission: permissionNode
            }
        });

        if (userOverride) {
            return userOverride.effect === 'allow';
        }

        // 2. Check DB for Role overrides
        let roleIds: string[] = [];
        if (Array.isArray(member.roles)) {
            roleIds = member.roles;
        } else {
            roleIds = member.roles.cache.map(r => r.id);
        }

        // Check roles
        for (const roleId of roleIds) {
            const roleOverride = await db.permission.findFirst({
                where: {
                    guild_id: ctx.guildId,
                    subject_type: 'role',
                    subject_id: roleId,
                    permission: permissionNode
                },
                select: { effect: true }
            });

            if (roleOverride) {
                if (roleOverride.effect === 'deny') return false;
                if (roleOverride.effect === 'allow') return true;
                // Optimization: if we find an explicit allow, should we stop?
                // If we assume a Deny in a lower role shouldn't override an Allow in a higher role, we need order.
                // Without order, 'Deny takes precedence' is safest.
            }
        }

        // 3. Native Discord Permission Check
        // APIInteractionGuildMember permissions is a string (bitfield).
        // GuildMember permissions is PermissionsBitField.

        const permissions = typeof member.permissions === 'string'
            ? new PermissionsBitField(BigInt(member.permissions))
            : member.permissions;

        if (permissions.has(PermissionsBitField.Flags.Administrator)) {
            return true;
        }

        if (permissions.has(PermissionsBitField.Flags.ManageMessages)) {
            return true;
        }

        return false;
    }
}

export const permissions = new PermissionEngine();
