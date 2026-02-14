import { Context } from '../../core/context';
import { Command } from '../../core/command';
import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { voiceTrackingService } from '../../services/voice/VoiceTrackingService';
import { Resolver } from '../../util/Resolver';

const CROSS = '<:cross:1469273232929456314>';

function formatDuration(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
}

export const VoiceStats: Command = {
    name: 'voicestats',
    description: 'View voice channel statistics for a user',
    category: 'Admin',
    syntax: 'voicestats [user]',
    example: 'voicestats @User',
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

        // Determine target user
        let targetUserId = ctx.authorId;
        let targetUser = member.user;

        if (args.length > 0) {
            const resolvedUser = await Resolver.getUser(args[0]);
            if (!resolvedUser) {
                const embed = new EmbedBuilder()
                    .setColor(0x2b2d31)
                    .setDescription(`${CROSS} User not found.`);
                await ctx.reply({ embeds: [embed] });
                return;
            }
            targetUserId = resolvedUser.id;
            targetUser = resolvedUser;
        }

        try {
            const stats = await voiceTrackingService.getUserStats(ctx.guildId, targetUserId);

            if (!stats || stats.total_time_in_vc === 0) {
                const embed = new EmbedBuilder()
                    .setColor(0x2b2d31)
                    .setDescription(`${CROSS} No voice statistics found for ${targetUser.username}.`);
                await ctx.reply({ embeds: [embed] });
                return;
            }

            const speakingPercentage = stats.total_time_in_vc > 0 
                ? ((stats.total_time_speaking / stats.total_time_in_vc) * 100).toFixed(1)
                : '0.0';

            const mutedPercentage = stats.total_time_in_vc > 0 
                ? ((stats.total_time_muted / stats.total_time_in_vc) * 100).toFixed(1)
                : '0.0';

            const deafenedPercentage = stats.total_time_in_vc > 0 
                ? ((stats.total_time_deafened / stats.total_time_in_vc) * 100).toFixed(1)
                : '0.0';

            const avatarURL = 'displayAvatarURL' in targetUser ? targetUser.displayAvatarURL() : null;
            
            const embed = new EmbedBuilder()
                .setColor(0x2b2d31)
                .setTitle(`Voice Statistics for ${targetUser.username}`);
            
            if (avatarURL) {
                embed.setThumbnail(avatarURL);
            }
            
            embed.addFields(
                    {
                        name: 'Overall Stats',
                        value: 
                            `**Total Time in VC:** ${formatDuration(stats.total_time_in_vc)}\n` +
                            `**Total Sessions:** ${stats.total_sessions}\n` +
                            `**Average Session:** ${stats.total_sessions > 0 ? formatDuration(Math.floor(stats.total_time_in_vc / stats.total_sessions)) : '0s'}`,
                        inline: false
                    },
                    {
                        name: 'Speaking Time',
                        value: `${formatDuration(stats.total_time_speaking)} (${speakingPercentage}%)`,
                        inline: true
                    },
                    {
                        name: 'Muted Time',
                        value: `${formatDuration(stats.total_time_muted)} (${mutedPercentage}%)`,
                        inline: true
                    },
                    {
                        name: 'Deafened Time',
                        value: `${formatDuration(stats.total_time_deafened)} (${deafenedPercentage}%)`,
                        inline: true
                    },
                    {
                        name: 'Active Listening',
                        value: formatDuration(stats.total_time_listening),
                        inline: true
                    }
                );

            if (stats.last_joined_at) {
                embed.setFooter({ text: `Last seen: ${stats.last_joined_at.toLocaleString()}` });
            }

            await ctx.reply({ embeds: [embed] });
        } catch (error: any) {
            console.error('Error fetching voice stats:', error);
            const embed = new EmbedBuilder()
                .setColor(0x2b2d31)
                .setDescription(`${CROSS} Failed to fetch voice statistics: ${error.message}`);
            await ctx.reply({ embeds: [embed] });
        }
    }
};
