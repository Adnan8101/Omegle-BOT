import { Context } from '../../core/context';
import { Resolver } from '../../util/Resolver';
import { modService } from '../../services/moderation/ModerationService';
import { EmbedBuilder, User, PermissionFlagsBits } from 'discord.js';
import { Command } from '../../core/command';
import { canPerformAction } from '../../util/rolePermissions';
import { ModLogger } from '../../services/logging/ModLogger';

const TICK = '<:tickYes:1469272837192814623>';

export const Kick: Command = {
    name: 'kick',
    description: 'Kick a user from the server',
    category: 'Moderation',
    syntax: 'kick <user> [reason]',
    example: 'kick @David Rule violation',
    permissions: [PermissionFlagsBits.KickMembers],
    modAction: 'kick',
    execute: async (ctx: Context, args: string[]) => {
        await ctx.defer();
        if (!ctx.inner.member) return;

        const targetInput = args[0];
        if (!targetInput) {
            await ctx.reply({ content: 'Please provide a user to kick.', ephemeral: true });
            return;
        }

        const targetUser = await Resolver.getUser(targetInput);
        if (!targetUser) {
            await ctx.reply({ content: 'User not found.', ephemeral: true });
            return;
        }

        const reason = args.slice(1).join(' ') || 'No reason provided';
        const guild = ctx.inner.guild;
        if (!guild) return;

        try {
            const caseId = await modService.createCase(
                ctx,
                targetUser.id,
                'kick',
                reason,
                null,
                async () => {
                    const member = await guild.members.fetch(targetUser.id).catch(() => null);
                    if (member) await member.kick(`[Case] ${reason} - by ${ctx.authorId}`);
                }
            );

            const embed = new EmbedBuilder()
                .setColor(0x2b2d31)
            .setDescription(
                    `${TICK} **Kicked** ${targetUser.username}\n` +
                    `**Reason:** ${reason}\n` +
                    `**Case:** #${caseId.toString().padStart(4, '0')}`
                );

            await ctx.reply({ embeds: [embed] });

            // Log action
            await ModLogger.log(guild, ctx.inner.member.user as User, targetUser, 'Kick', reason);
        } catch (err: any) {
            await ctx.reply({ content: `Failed to kick user: ${err.message}`, ephemeral: true });
        }
    }
};
