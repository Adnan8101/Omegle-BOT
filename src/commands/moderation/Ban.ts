import { Context } from '../../core/context';
import { Resolver } from '../../util/Resolver';
import { modService } from '../../services/moderation/ModerationService';
import { banAbuseService } from '../../services/moderation/BanAbuseService';
import { EmbedBuilder, User, PermissionFlagsBits } from 'discord.js';
import { Command } from '../../core/command';
import { canPerformAction } from '../../util/rolePermissions';
import { ModLogger } from '../../services/logging/ModLogger';

const TICK = '<:tickYes:1469272837192814623>';
const CROSS = '<:cross:1469273232929456314>';

export const Ban: Command = {
    name: 'ban',
    description: 'Ban a user from the server',
    category: 'Moderation',
    syntax: 'ban <user> [reason]',
    example: 'ban @David Spamming',
    permissions: [PermissionFlagsBits.BanMembers],
    modAction: 'ban',
    execute: async (ctx: Context, args: string[]) => {
        await ctx.defer();
        if (!ctx.inner.member) return;

        // Check ban cooldown
        const cooldownUntil = await banAbuseService.isOnCooldown(ctx.guildId, ctx.authorId);
        if (cooldownUntil) {
            const embed = new EmbedBuilder()
                .setDescription(
                    `${CROSS} **Ban Cooldown Active**\n\n` +
                    `You are on a 10-minute ban cooldown.\n` +
                    `Ends: <t:${Math.floor(cooldownUntil.getTime() / 1000)}:R>`
                );
            await ctx.reply({ embeds: [embed], ephemeral: true });
            return;
        }

        const targetInput = args[0];
        if (!targetInput) {
            await ctx.reply({ content: 'Please provide a user to ban.', ephemeral: true });
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
            // Track ban for abuse detection with reason
            const trackResult = await banAbuseService.trackBan(ctx.guildId, ctx.authorId, targetUser.id, reason);

            if (trackResult.blocked) {
                const embed = new EmbedBuilder()
                    .setDescription(`⚠️ ${trackResult.message}`);
                await ctx.reply({ embeds: [embed], ephemeral: true });
                return;
            }

            const caseId = await modService.createCase(
                ctx,
                targetUser.id,
                'ban',
                reason,
                null,
                async () => {
                    await guild.members.ban(targetUser.id, { reason: `[Case] ${reason} - by ${ctx.authorId}` });
                }
            );

            const embed = new EmbedBuilder()
                .setDescription(
                    `${TICK} **Banned** ${targetUser.tag}\n` +
                    `**Reason:** ${reason}\n` +
                    `**Case:** #${caseId.toString().padStart(4, '0')}`
                );

            await ctx.reply({ embeds: [embed] });

            // Log action
            await ModLogger.log(guild, ctx.inner.member.user as User, targetUser, 'Ban', reason);
        } catch (err: any) {
            await ctx.reply({ content: `Failed to ban user: ${err.message}`, ephemeral: true });
        }
    }
};
