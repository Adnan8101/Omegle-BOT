import { Context } from '../../core/context';
import { db } from '../../data/db';
import { EmbedBuilder, User, PermissionFlagsBits } from 'discord.js';
import { Command } from '../../core/command';
import { hasPermission } from '../../util/permissions';
import { hasModRole } from '../../util/modRole';

const TICK = '<:tickYes:1469272837192814623>';

export const Reason: Command = {
    name: 'reason',
    description: 'Update the reason for a specific case',
    category: 'Moderator Utils',
    syntax: 'reason <case_number> <new_reason>',
    example: 'reason 123 Corrected reason for ban',
    permissions: [PermissionFlagsBits.ModerateMembers],
    modAction: 'reason',
    execute: async (ctx: Context, args: string[]) => {
        await ctx.defer();
        if (!ctx.inner.member) return;
        const perms = ctx.inner.member.permissions;
        const hasPerm = Reason.permissions.some(p => hasPermission(perms, p));

        const hasRole = await hasModRole(ctx.guildId, ctx.inner.member);

        if (!hasPerm && !hasRole) return;

        const caseNumInput = args[0];
        const newReason = args.slice(1).join(' ');

        if (!caseNumInput || !newReason) {
            await ctx.reply({ content: 'Usage: `!reason <case_number> <new_reason>`', ephemeral: true });
            return;
        }

        const caseNum = parseInt(caseNumInput);
        if (isNaN(caseNum)) {
            await ctx.reply({ content: 'Invalid case number.', ephemeral: true });
            return;
        }

        try {
            // Find finding first
            const existing = await db.moderationCase.findFirst({
                where: {
                    guild_id: ctx.guildId,
                    case_number: caseNum
                }
            });

            if (!existing) {
                await ctx.reply({ content: 'Case not found.', ephemeral: true });
                return;
            }

            const result = await db.moderationCase.update({
                where: { id: existing.id },
                data: { reason: newReason }
            });

            if (!result) {
                await ctx.reply({ content: 'Case not found.', ephemeral: true });
                return;
            }

            const embed = new EmbedBuilder()
                .setColor(0x2b2d31)
            .setDescription(
                    `${TICK} **Case #${result.case_number} Updated**\n\n` +
                    newReason
                );

            await ctx.reply({ embeds: [embed] });

        } catch (err: any) {
            await ctx.reply({ content: `Failed to update case: ${err.message}`, ephemeral: true });
        }
    }
};
