import { Context } from '../../core/context';
import { activityLogService } from '../../services/logging/ActivityLogService';
import { EmbedBuilder, Colors, PermissionFlagsBits } from 'discord.js';
import { Command } from '../../core/command';
import { Resolver } from '../../util/Resolver';
import { hasPermission } from '../../util/permissions';
import { parseTimeString } from '../../util/time';

export const CLogs: Command = {
    name: 'clogs',
    description: 'Compare voice channel logs between two users to see when they were in the same VC',
    category: 'Moderator Utils',
    syntax: 'clogs <user1> <user2> [time]',
    example: 'clogs @David @Alex 24h',
    permissions: [PermissionFlagsBits.ModerateMembers],
    execute: async (ctx: Context, args: string[]) => {
        if (!ctx.inner.member) return;
        const perms = ctx.inner.member.permissions;
        const hasPerm = CLogs.permissions.some(p => hasPermission(perms, p));
        if (!hasPerm) return;

        if (args.length < 2) {
            await ctx.reply({ 
                content: 'Please provide two users to compare.\nUsage: `clogs <user1> <user2> [time]`\nExample: `clogs @David @Alex 24h`', 
                ephemeral: true 
            });
            return;
        }

        const user1Input = args[0];
        const user2Input = args[1];
        const timeInput = args[2] || '24h';

        const user1 = await Resolver.getUser(user1Input);
        const user2 = await Resolver.getUser(user2Input);

        if (!user1) {
            await ctx.reply({ content: 'First user not found.', ephemeral: true });
            return;
        }

        if (!user2) {
            await ctx.reply({ content: 'Second user not found.', ephemeral: true });
            return;
        }

        if (user1.id === user2.id) {
            await ctx.reply({ content: 'Please provide two different users.', ephemeral: true });
            return;
        }

        let timeSeconds = 86400; // Default 24 hours
        try {
            timeSeconds = parseTimeString(timeInput);
        } catch (e) {
            await ctx.reply({ content: 'Invalid time format. Use formats like: 1h, 24h, 7d, etc.', ephemeral: true });
            return;
        }

        try {
            const comparison = await activityLogService.compareVoiceLogs(
                ctx.guildId,
                user1.id,
                user2.id,
                timeSeconds
            );

            if (!comparison.interactions || comparison.interactions.length === 0) {
                const embed = new EmbedBuilder()
                    .setTitle(`VC Comparison | ${user1.tag} & ${user2.tag}`)
                    .setDescription(`No voice channel interactions found in the last ${timeInput}.`)
                    .setFooter({ text: `Requested by : ${ctx.inner.member.user.username}` })
                    .setTimestamp();
                await ctx.reply({ embeds: [embed] });
                return;
            }

            // Format interaction lines
            const interactionLines = comparison.interactions.slice(0, 10).map(interaction => {
                const channel = `<#${interaction.channel_id}>`;
                const start = Math.floor(interaction.overlap_start.getTime() / 1000);
                const duration = interaction.overlap_duration;
                
                let durationStr = '';
                const hrs = Math.floor(duration / 3600);
                const mins = Math.floor((duration % 3600) / 60);
                const secs = duration % 60;
                if (hrs > 0) durationStr = `${hrs}h ${mins}m`;
                else if (mins > 0) durationStr = `${mins}m ${secs}s`;
                else durationStr = `${secs}s`;

                return `${channel} • <t:${start}:R> • Duration: **${durationStr}**`;
            }).join('\n');

            // Calculate total time together
            const totalSeconds = comparison.totalOverlapTime;
            const totalHrs = Math.floor(totalSeconds / 3600);
            const totalMins = Math.floor((totalSeconds % 3600) / 60);
            const totalSecs = totalSeconds % 60;
            
            let totalTimeStr = '';
            if (totalHrs > 0) totalTimeStr = `${totalHrs}h ${totalMins}m ${totalSecs}s`;
            else if (totalMins > 0) totalTimeStr = `${totalMins}m ${totalSecs}s`;
            else totalTimeStr = `${totalSecs}s`;

            const embed = new EmbedBuilder()
                .setTitle(`VC Comparison | ${user1.tag} & ${user2.tag}`)
                .setDescription(`Found **${comparison.interactions.length}** interactions in the last ${timeInput}`)
                .addFields(
                    { name: 'Total Time Together', value: `**${totalTimeStr}**`, inline: true },
                    { name: 'Interactions', value: interactionLines.substring(0, 1024) || 'None' }
                )
                .setFooter({ text: `Showing ${Math.min(10, comparison.interactions.length)} of ${comparison.interactions.length} interactions | Requested by : ${ctx.inner.member.user.username}` })
                .setTimestamp();

            await ctx.reply({ embeds: [embed] });

        } catch (e: any) {
            await ctx.reply({ content: `Error comparing logs: ${e.message}`, ephemeral: true });
        }
    }
};
