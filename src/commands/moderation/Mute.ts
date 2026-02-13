import { Context } from '../../core/context';
import { Resolver } from '../../util/Resolver';
import { modService } from '../../services/moderation/ModerationService';
import { EmbedBuilder, User, PermissionFlagsBits } from 'discord.js';
import { Command } from '../../core/command';
import { canPerformAction } from '../../util/rolePermissions';
import { parseSmartDuration } from '../../util/time';
import { ModLogger } from '../../services/logging/ModLogger';

const TICK = '<:tickYes:1469272837192814623>';

export const Mute: Command = {
    name: 'mute',
    description: 'Timeout a user (default 10m)',
    category: 'Moderation',
    permissions: [PermissionFlagsBits.ModerateMembers],
    syntax: 'mute <user> [time] [reason]',
    example: 'mute @David 30m Spamming',
    modAction: 'mute',
    execute: async (ctx: Context, args: string[]) => {
        await ctx.defer();
        if (!ctx.inner.member) return;

        const targetInput = args[0];
        if (!targetInput) {
            await ctx.reply({ content: 'Please provide a user to mute.', ephemeral: true });
            return;
        }

        const targetUser = await Resolver.getUser(targetInput);
        if (!targetUser) {
            await ctx.reply({ content: 'User not found.', ephemeral: true });
            return;
        }

        const restArgs = args.slice(1);
        const { durationSeconds: parsedSeconds, remainingArgs } = parseSmartDuration(restArgs);
        let durationSeconds = parsedSeconds;

        if (durationSeconds === null) {
            const first = restArgs[0];
            if (first && /^\d+$/.test(first)) {
                durationSeconds = parseInt(first) * 60;
                remainingArgs.shift();
            } else {
                durationSeconds = 600;
            }
        }

        if (durationSeconds! > 28 * 86400) {
            await ctx.reply({ content: 'Invalid duration. Max 28 days.', ephemeral: true });
            return;
        }

        const reason = remainingArgs.join(' ') || 'No reason provided';
        const guild = ctx.inner.guild;
        if (!guild) return;

        try {
            const caseId = await modService.createCase(
                ctx,
                targetUser.id,
                'mute',
                reason,
                durationSeconds,
                async () => {
                    const member = await guild.members.fetch(targetUser.id).catch(() => null);
                    if (!member) throw new Error('Member not found in guild');
                    await member.timeout(durationSeconds * 1000, `[Case] ${reason} - by ${ctx.authorId}`);
                }
            );

            const durationDisplay = durationSeconds < 60 ? `${durationSeconds}s` :
                durationSeconds < 3600 ? `${Math.floor(durationSeconds / 60)}m` :
                    `${(durationSeconds / 3600).toFixed(1)}h`;

            const embed = new EmbedBuilder()
                .setDescription(
                    `${TICK} **Muted** ${targetUser.tag}\n` +
                    `**Duration:** ${durationDisplay}\n` +
                    `**Reason:** ${reason}\n` +
                    `**Case:** #${caseId.toString().padStart(4, '0')}`
                );

            await ctx.reply({ embeds: [embed] });

            // Log action
            await ModLogger.log(guild, ctx.inner.member.user as User, targetUser, 'Mute', reason, { duration: durationDisplay });
        } catch (err: any) {
            await ctx.reply({ content: `Failed to mute user: ${err.message}`, ephemeral: true });
        }
    }
};
