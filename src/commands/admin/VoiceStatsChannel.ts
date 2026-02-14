import { Context } from '../../core/context';
import { Command } from '../../core/command';
import { EmbedBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { db } from '../../data/db';
import { Resolver } from '../../util/Resolver';

const CROSS = '<:cross:1469273232929456314>';

function formatDuration(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
}

export const VoiceStatsChannel: Command = {
    name: 'voicestatschannel',
    description: 'View voice statistics per channel for a user',
    category: 'Admin',
    syntax: 'voicestatschannel [user]',
    example: 'voicestatschannel @User',
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
            console.log(`[VoiceStatsChannel] Getting channel stats for User: ${targetUserId} in Guild: ${ctx.guildId}`);
            
            // Get all sessions for this user
            const sessions = await db.voiceTracking.findMany({
                where: {
                    guild_id: ctx.guildId,
                    user_id: targetUserId
                },
                orderBy: {
                    joined_at: 'desc'
                }
            });

            if (!sessions || sessions.length === 0) {
                const embed = new EmbedBuilder()
                    .setColor(0x2b2d31)
                    .setDescription(`${CROSS} No voice channel history found for ${targetUser.username}.`);
                await ctx.reply({ embeds: [embed] });
                return;
            }

            // Group by channel and calculate stats
            const channelStats = new Map<string, {
                totalTime: number;
                speaking: number;
                muted: number;
                deafened: number;
                listening: number;
                sessions: number;
            }>();

            const now = new Date();

            for (const session of sessions) {
                const channelId = session.channel_id;
                
                if (!channelStats.has(channelId)) {
                    channelStats.set(channelId, {
                        totalTime: 0,
                        speaking: 0,
                        muted: 0,
                        deafened: 0,
                        listening: 0,
                        sessions: 0
                    });
                }

                const stats = channelStats.get(channelId)!;
                stats.sessions++;

                // Calculate session time
                let sessionTime: number;
                let speaking = session.time_speaking;
                let muted = session.time_muted;
                let deafened = session.time_deafened;
                let listening = session.time_listening;

                if (session.left_at) {
                    // Completed session
                    sessionTime = Math.floor((session.left_at.getTime() - session.joined_at.getTime()) / 1000);
                } else {
                    // Active session - add current time
                    sessionTime = Math.floor((now.getTime() - session.joined_at.getTime()) / 1000);
                    const currentStateTime = Math.floor((now.getTime() - session.last_state_change.getTime()) / 1000);
                    
                    // Add current state time to appropriate category
                    if (session.was_deafened) {
                        deafened += currentStateTime;
                    } else if (session.was_muted) {
                        muted += currentStateTime;
                    } else {
                        speaking += currentStateTime;
                        listening += currentStateTime;
                    }
                }

                stats.totalTime += sessionTime;
                stats.speaking += speaking;
                stats.muted += muted;
                stats.deafened += deafened;
                stats.listening += listening;
            }

            // Build embed
            const avatarURL = 'displayAvatarURL' in targetUser ? targetUser.displayAvatarURL() : null;
            
            const embed = new EmbedBuilder()
                .setColor(0x2b2d31)
                .setTitle(`Voice Statistics by Channel for ${targetUser.username}`);
            
            if (avatarURL) {
                embed.setThumbnail(avatarURL);
            }

            // Sort channels by total time (descending)
            const sortedChannels = Array.from(channelStats.entries())
                .sort((a, b) => b[1].totalTime - a[1].totalTime);

            let description = '';
            let totalOverall = 0;
            let totalSpeakingOverall = 0;
            let totalMutedOverall = 0;
            let totalDeafenedOverall = 0;

            for (const [channelId, stats] of sortedChannels) {
                const channel = await guild.channels.fetch(channelId).catch(() => null);
                const channelName = channel?.name || `Deleted Channel (${channelId})`;
                
                const speakingPercent = stats.totalTime > 0 ? ((stats.speaking / stats.totalTime) * 100).toFixed(0) : '0';
                const mutedPercent = stats.totalTime > 0 ? ((stats.muted / stats.totalTime) * 100).toFixed(0) : '0';
                const deafenedPercent = stats.totalTime > 0 ? ((stats.deafened / stats.totalTime) * 100).toFixed(0) : '0';

                description += `**${channelName}**\n`;
                description += `Total: ${formatDuration(stats.totalTime)} • Sessions: ${stats.sessions}\n`;
                description += `Speaking: ${formatDuration(stats.speaking)} (${speakingPercent}%) • `;
                description += `Muted: ${formatDuration(stats.muted)} (${mutedPercent}%) • `;
                description += `Deafened: ${formatDuration(stats.deafened)} (${deafenedPercent}%)\n\n`;

                totalOverall += stats.totalTime;
                totalSpeakingOverall += stats.speaking;
                totalMutedOverall += stats.muted;
                totalDeafenedOverall += stats.deafened;
            }

            // Add overall summary
            description += `**Overall Summary**\n`;
            description += `Total Time: ${formatDuration(totalOverall)}\n`;
            description += `Speaking: ${formatDuration(totalSpeakingOverall)} • `;
            description += `Muted: ${formatDuration(totalMutedOverall)} • `;
            description += `Deafened: ${formatDuration(totalDeafenedOverall)}`;

            embed.setDescription(description);

            await ctx.reply({ embeds: [embed] });
        } catch (error: any) {
            console.error('Error fetching voice channel stats:', error);
            const embed = new EmbedBuilder()
                .setColor(0x2b2d31)
                .setDescription(`${CROSS} Failed to fetch voice channel statistics: ${error.message}`);
            await ctx.reply({ embeds: [embed] });
        }
    }
};
