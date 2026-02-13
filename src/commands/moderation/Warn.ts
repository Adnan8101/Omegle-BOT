import { Context } from '../../core/context';
import { Resolver } from '../../util/Resolver';
import { modService } from '../../services/moderation/ModerationService';
import { EmbedBuilder, User, PermissionFlagsBits } from 'discord.js';
import { Command } from '../../core/command';
import { canPerformAction } from '../../util/rolePermissions';
import { ModLogger } from '../../services/logging/ModLogger';

const TICK = '<:tickYes:1469272837192814623>';

export const Warn: Command = {
    name: 'warn',
    description: 'Warn a member',
    category: 'Moderation',
    syntax: 'warn <user> <reason>',
    example: 'warn @David Spamming',
    permissions: [PermissionFlagsBits.ModerateMembers],
    modAction: 'warn',
    execute: async (ctx: Context, args: string[]) => {
        await ctx.defer();
        if (!ctx.inner.member) return;

        const targetInput = args[0];
        if (!targetInput) {
            await ctx.reply({ content: 'Please provide a user to warn.', ephemeral: true });
            return;
        }

        const targetUser = await Resolver.getUser(targetInput);
        if (!targetUser) {
            await ctx.reply({ content: 'User not found.', ephemeral: true });
            return;
        }

        const reason = args.slice(1).join(' ') || 'No reason provided';

        try {
            const caseId = await modService.createCase(
                ctx,
                targetUser.id,
                'warn',
                reason,
                null,
                async () => { }
            );

            const embed = new EmbedBuilder()
                .setDescription(
                    `${TICK} **Warned** ${targetUser.tag}\n` +
                    `**Reason:** ${reason}\n` +
                    `**Case:** #${caseId.toString().padStart(4, '0')}`
                );

            await ctx.reply({ embeds: [embed] });

            // Log action
            await ModLogger.log(ctx.inner.guild!, ctx.inner.member.user as User, targetUser, 'Warn', reason);
        } catch (err: any) {
            await ctx.reply({ content: `Failed to warn user: ${err.message}`, ephemeral: true });
        }
    }
};
