import { Context } from '../../core/context';
import { Command } from '../../core/command';
import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { voiceTrackingService } from '../../services/voice/VoiceTrackingService';

const CROSS = '<:cross:1469273232929456314>';

function formatDuration(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours < 24) return `${hours}h ${mins}m`;
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours}h`;
}

export const VoiceLeaderboard: Command = {
    name: 'voiceleaderboard',
    description: 'Show voice channel activity leaderboard',
    category: 'Admin',
    syntax: 'voiceleaderboard [type]',
    example: 'voiceleaderboard\nvoiceleaderboard speaking',
    permissions: [PermissionFlagsBits.Administrator],
    execute: async (ctx: Context, args: string[]) => {
        await ctx.defer();
        const guild = ctx.inner.guild;
        const member = ctx.inner.member;

        if (!guild || !member) {
            const embed = new EmbedBuilder()
                .setColor(0x2b2d31)
                .setDescription(`${CROSS} This command can only be used in a server.`);
            await ctx.reply({ embeds: [embed] });
            return;
        }

        const type = args[0]?.toLowerCase() || 'total';
        let leaderboard: any[];
        let title: string;
        let description: string;

        try {
            if (type === 'speaking' || type === 'speak') {
                leaderboard = await voiceTrackingService.getSpeakingLeaderboard(ctx.guildId, 10);
                title = 'Voice Leaderboard - Speaking Time';
                description = 'Top 10 users by speaking time (mic not muted)';
            } else {
                leaderboard = await voiceTrackingService.getLeaderboard(ctx.guildId, 10);
                title = 'Voice Leaderboard - Total Time';
                description = 'Top 10 users by total time in voice channels';
            }

            if (!leaderboard || leaderboard.length === 0) {
                const embed = new EmbedBuilder()
                    .setColor(0x2b2d31)
                    .setDescription(`${CROSS} No voice statistics found yet.`);
                await ctx.reply({ embeds: [embed] });
                return;
            }

            const embed = new EmbedBuilder()
                .setColor(0x2b2d31)
                .setTitle(title)
                .setDescription(description);

            let leaderboardText = '';
            for (let i = 0; i < leaderboard.length; i++) {
                const stats = leaderboard[i];
                const user = await guild.members.fetch(stats.user_id).catch(() => null);
                const userName = user ? user.user.username : `User ${stats.user_id}`;
                
                const medal = i === 0 ? '#1' : i === 1 ? '#2' : i === 2 ? '#3' : `**${i + 1}.**`;
                
                if (type === 'speaking' || type === 'speak') {
                    const speakingPercent = stats.total_time_in_vc > 0 
                        ? ((stats.total_time_speaking / stats.total_time_in_vc) * 100).toFixed(0)
                        : '0';
                    leaderboardText += `${medal} **${userName}**\n` +
                        `   Speaking: ${formatDuration(stats.total_time_speaking)} (${speakingPercent}% of VC time)\n` +
                        `   Total VC: ${formatDuration(stats.total_time_in_vc)} • Sessions: ${stats.total_sessions}\n\n`;
                } else {
                    const avgSession = stats.total_sessions > 0 
                        ? formatDuration(Math.floor(stats.total_time_in_vc / stats.total_sessions))
                        : '0s';
                    leaderboardText += `${medal} **${userName}**\n` +
                        `   Time: ${formatDuration(stats.total_time_in_vc)}\n` +
                        `   Sessions: ${stats.total_sessions} • Avg: ${avgSession}\n\n`;
                }
            }

            embed.addFields({
                name: '\u200B',
                value: leaderboardText,
                inline: false
            });

            embed.setFooter({ text: `Use !voicestats @user to see detailed stats` });

            await ctx.reply({ embeds: [embed] });
        } catch (error: any) {
            console.error('Error fetching voice leaderboard:', error);
            const embed = new EmbedBuilder()
                .setColor(0x2b2d31)
                .setDescription(`${CROSS} Failed to fetch voice leaderboard: ${error.message}`);
            await ctx.reply({ embeds: [embed] });
        }
    }
};
