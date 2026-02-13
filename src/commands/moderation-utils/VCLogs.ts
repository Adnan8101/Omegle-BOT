import { Context } from '../../core/context';
import { activityLogService } from '../../services/logging/ActivityLogService';
import { EmbedBuilder, Colors, PermissionFlagsBits } from 'discord.js';
import { Command } from '../../core/command';
import { Resolver } from '../../util/Resolver';
import { hasPermission } from '../../util/permissions';

export const VCLogs: Command = {
    name: 'vclogs',
    description: 'View voice channel activity logs for a user',
    category: 'Moderator Utils',
    syntax: 'vclogs <user>',
    example: 'vclogs @David',
    permissions: [PermissionFlagsBits.ModerateMembers],
    execute: async (ctx: Context, args: string[]) => {
        if (!ctx.inner.member) return;
        const perms = ctx.inner.member.permissions;
        const hasPerm = VCLogs.permissions.some(p => hasPermission(perms, p));
        if (!hasPerm) return;

        const targetInput = args[0] || ctx.authorId;
        const targetUser = await Resolver.getUser(targetInput);

        if (!targetUser) {
            await ctx.reply({ content: 'User not found.', ephemeral: true });
            return;
        }

        try {
            const logs = await activityLogService.getVoiceLogs(ctx.guildId, targetUser.id, 15);

            if (!logs || logs.length === 0) {
                const embed = new EmbedBuilder()
                    .setTitle(`VC Logs | ${targetUser.tag}`)
                    .setDescription('No voice activity found.')
                    .setFooter({ text: `Requested by : ${ctx.inner.member.user.username}` });
                await ctx.reply({ embeds: [embed] });
                return;
            }

            // Simple Frontend Format
            // Channel | Time | Duration
            const lines = logs.map(log => {
                const joined = Math.floor(new Date(log.joined_at).getTime() / 1000);
                const channel = `<#${log.channel_id}>`;

                let durationStr = 'Active';
                if (log.duration_seconds && log.duration_seconds > 0) {
                    const hrs = Math.floor(log.duration_seconds / 3600);
                    const mins = Math.floor((log.duration_seconds % 3600) / 60);
                    const secs = log.duration_seconds % 60;
                    if (hrs > 0) durationStr = `${hrs}h ${mins}m`;
                    else if (mins > 0) durationStr = `${mins}m ${secs}s`;
                    else durationStr = `${secs}s`;
                }

                return `${channel} • <t:${joined}:R> • **${durationStr}**`;
            });

            const embed = new EmbedBuilder()
                .setTitle(`VC Logs | ${targetUser.tag}`)
                .setDescription(lines.join('\n'))
                .setFooter({ text: `Showing last ${logs.length} sessions | Requested by : ${ctx.inner.member.user.username}` })
                .setTimestamp();

            await ctx.reply({ embeds: [embed] });

        } catch (e: any) {
            await ctx.reply({ content: `Error fetching logs: ${e.message}`, ephemeral: true });
        }
    }
};
