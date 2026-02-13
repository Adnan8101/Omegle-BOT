import { EmbedBuilder, Guild, User, TextChannel, Colors, GuildMember, APIInteractionGuildMember } from 'discord.js';
import { db } from '../../data/db';

export type ModLogAction =
    | 'Ban' | 'Unban' | 'Kick' | 'Warn' | 'Mute' | 'Unmute'
    | 'Purge' | 'Lock' | 'Unlock' | 'Hide' | 'Unhide'
    | 'Move' | 'Role' | 'Suggestion'
    | 'DelCase' | 'BanWord' | 'DM';

export class ModLogger {

    /**
     * Log a moderation action to the configured channel
     */
    static async log(
        guild: Guild,
        actor: User,
        target: User | string,
        action: ModLogAction,
        reason: string | null,
        details?: {
            duration?: string;
            channel?: string;
            messages?: number;
            role?: string;
        }
    ) {
        try {
            console.log(`[ModLogger] Attempting to log action: ${action} by ${actor.tag} in guild ${guild.name}`);
            
            // Fetch config
            // @ts-ignore - modConfig is generated
            const config = await db.modConfig.findUnique({
                where: { guild_id: guild.id }
            });

            console.log(`[ModLogger] Config found:`, config ? `Channel ID: ${config.log_channel_id}` : 'No config found');

            if (!config || !config.log_channel_id) {
                console.log(`[ModLogger] No mod log channel configured for guild ${guild.name}`);
                return;
            }

            const channel = guild.channels.cache.get(config.log_channel_id) as TextChannel;
            if (!channel) {
                console.log(`[ModLogger] Channel ${config.log_channel_id} not found in guild ${guild.name}`);
                return;
            }

            console.log(`[ModLogger] Found log channel: #${channel.name}`);
            
            const targetName = typeof target === 'string' ? target : `${target.tag} (${target.id})`;
            const targetAvatar = typeof target === 'string' ? null : target.displayAvatarURL();

            // Determine color based on action
            let color: number = Colors.Blue;
            switch (action) {
                case 'Ban': color = Colors.Red; break;
                case 'Unban': color = Colors.Green; break;
                case 'Kick': color = Colors.Orange; break;
                case 'Mute': color = Colors.Yellow; break;
                case 'Unmute': color = Colors.Green; break;
                case 'Warn': color = Colors.Gold; break;
                case 'DelCase': color = Colors.Grey; break;
                case 'BanWord': color = Colors.Purple; break;
                case 'DM': color = Colors.LightGrey; break;
                case 'Suggestion': color = Colors.Gold; break;
            }

            const embed = new EmbedBuilder()
                .setAuthor({ name: `${action} | ${targetName}`, iconURL: targetAvatar || undefined })
                .setColor(color)
                .addFields(
                    { name: 'Moderator', value: `${actor.tag}`, inline: true },
                    { name: 'Target', value: `${targetName}`, inline: true },
                )
                .setTimestamp();

            if (reason) {
                embed.addFields({ name: 'Reason', value: reason, inline: false });
            }

            if (details) {
                let detailsText = '';
                if (details.duration) detailsText += `**Duration:** ${details.duration}\n`;
                if (details.channel) detailsText += `**Channel:** ${details.channel}\n`;
                if (details.messages) detailsText += `**Messages:** ${details.messages}\n`;
                if (details.role) detailsText += `**Role:** ${details.role}\n`;

                if (detailsText) {
                    embed.addFields({ name: 'Details', value: detailsText.trim(), inline: false });
                }
            }

            await channel.send({ embeds: [embed] });
            console.log(`[ModLogger] Successfully logged ${action} to #${channel.name}`);

        } catch (error) {
            console.error('[ModLogger] Failed to send mod log:', error);
        }
    }
}
