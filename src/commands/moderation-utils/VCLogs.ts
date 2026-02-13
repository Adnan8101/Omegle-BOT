import { Context } from '../../core/context';
import { activityLogService } from '../../services/logging/ActivityLogService';
import { EmbedBuilder, Colors, PermissionFlagsBits } from 'discord.js';
import { Command } from '../../core/command';
import { Resolver } from '../../util/Resolver';
import { hasPermission } from '../../util/permissions';

export const VCLogs: Command = {
    name: 'vclogs',
    description: 'View voice channel activity logs for a user or compare logs between multiple users',
    category: 'Moderator Utils',
    syntax: 'vclogs <user> [user2] [time]',
    example: 'vclogs @David @John 7d',
    permissions: [PermissionFlagsBits.ModerateMembers],
    execute: async (ctx: Context, args: string[]) => {
        if (!ctx.inner.member) return;
        const perms = ctx.inner.member.permissions;
        const hasPerm = VCLogs.permissions.some(p => hasPermission(perms, p));
        if (!hasPerm) return;

        // Parse all mentions/users from args
        const users: any[] = [];
        let remainingArgs = [...args];

        // Try to resolve up to 2 users
        for (let i = 0; i < 2 && remainingArgs.length > 0; i++) {
            const user = await Resolver.getUser(remainingArgs[0]);
            if (user) {
                users.push(user);
                remainingArgs.shift();
            } else {
                break;
            }
        }

        // If no users found, use author as default
        if (users.length === 0) {
            const authorUser = await Resolver.getUser(ctx.authorId);
            if (authorUser) users.push(authorUser);
        }

        if (users.length === 0) {
            await ctx.reply({ content: 'User not found.', ephemeral: true });
            return;
        }

        try {
            // If we have 2 users, show mutual VC time
            if (users.length === 2) {
                const user1 = users[0];
                const user2 = users[1];

                // Default time: 30 days
                const timeSeconds = 30 * 24 * 60 * 60;

                const comparison = await activityLogService.compareVoiceLogs(
                    ctx.guildId,
                    user1.id,
                    user2.id,
                    timeSeconds
                );

                if (!comparison.interactions || comparison.interactions.length === 0) {
                    const embed = new EmbedBuilder()
                        .setTitle(`VC Logs | ${user1.username} & ${user2.username}`)
                        .setDescription('No mutual voice activity found in the last 30 days.')
                        .setFooter({ text: `Requested by : ${ctx.inner.member.user.username}` });
                    await ctx.reply({ embeds: [embed] });
                    return;
                }

                // Format mutual VC sessions
                const lines = comparison.interactions.slice(0, 6).map(interaction => {
                    const startTimestamp = Math.floor(interaction.overlap_start.getTime() / 1000);
                    const channel = `<#${interaction.channel_id}>`;

                    let durationStr = '';
                    const duration = interaction.overlap_duration;
                    const hrs = Math.floor(duration / 3600);
                    const mins = Math.floor((duration % 3600) / 60);
                    const secs = duration % 60;
                    if (hrs > 0) durationStr = `${hrs}h ${mins}m`;
                    else if (mins > 0) durationStr = `${mins}m ${secs}s`;
                    else durationStr = `${secs}s`;

                    return `${channel} • <t:${startTimestamp}:R> • **${durationStr}**`;
                });

                // Calculate total time together
                let totalStr = '';
                const total = comparison.totalOverlapTime;
                const totalHrs = Math.floor(total / 3600);
                const totalMins = Math.floor((total % 3600) / 60);
                if (totalHrs > 0) totalStr = `${totalHrs}h ${totalMins}m`;
                else totalStr = `${totalMins}m`;

                const embed = new EmbedBuilder()
                    .setTitle(`VC Logs | ${user1.username} & ${user2.username}`)
                    .setDescription(
                        `**Mutual VC Time:** ${totalStr}\n\n` +
                        lines.join('\n')
                    )
                    .setFooter({ text: `Showing last ${Math.min(comparison.interactions.length, 6)} mutual sessions | Requested by : ${ctx.inner.member.user.username}` })
                    .setTimestamp();

                await ctx.reply({ embeds: [embed] });
                return;
            }

            // Single user mode (original behavior)
            const targetUser = users[0];
            const logs = await activityLogService.getVoiceLogs(ctx.guildId, targetUser.id, 15);

            if (!logs || logs.length === 0) {
                const embed = new EmbedBuilder()
                    .setTitle(`VC Logs | ${targetUser.username}`)
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
                .setTitle(`VC Logs | ${targetUser.username}`)
                .setDescription(lines.join('\n'))
                .setFooter({ text: `Showing last ${logs.length} sessions | Requested by : ${ctx.inner.member.user.username}` })
                .setTimestamp();

            await ctx.reply({ embeds: [embed] });

        } catch (e: any) {
            await ctx.reply({ content: `Error fetching logs: ${e.message}`, ephemeral: true });
        }
    }
};
