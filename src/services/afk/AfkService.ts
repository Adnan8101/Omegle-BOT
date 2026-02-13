import { db } from '../../data/db';
import { EmbedBuilder, Colors, Message } from 'discord.js';

export class AfkService {

    async setAfk(guildId: string, userId: string, reason: string) {
        // Double check enabled status
        const settings = await this.getSettings(guildId);
        if (!settings.enabled) return;

        return await db.afkUser.upsert({
            where: {
                guild_id_user_id: {
                    guild_id: guildId,
                    user_id: userId
                }
            },
            update: {
                reason: reason,
                timestamp: new Date()
            },
            create: {
                guild_id: guildId,
                user_id: userId,
                reason: reason,
                timestamp: new Date()
            }
        });
    }

    async removeAfk(guildId: string, userId: string) {
        // Check existence first or try delete with composite key
        // Prisma allows delete with unique where input
        return await db.afkUser.delete({
            where: {
                guild_id_user_id: {
                    guild_id: guildId,
                    user_id: userId
                }
            }
        }).catch(() => null); // Ignore if not found
    }

    async getAfk(guildId: string, userId: string) {
        return await db.afkUser.findUnique({
            where: {
                guild_id_user_id: {
                    guild_id: guildId,
                    user_id: userId
                }
            }
        });
    }

    async getAllAfk(guildId: string) {
        return await db.afkUser.findMany({
            where: { guild_id: guildId }
        });
    }

    async getSettings(guildId: string) {
        const row = await db.afkSettings.findUnique({
            where: { guild_id: guildId }
        });

        // Default: Enabled (1), No restrictions
        if (!row) return { allowed_channels: [], allowed_roles: [], enabled: 1 };

        return {
            allowed_channels: JSON.parse(row.allowed_channels) as string[],
            allowed_roles: JSON.parse(row.allowed_roles) as string[],
            enabled: row.enabled
        };
    }

    async updateSettings(guildId: string, allowedChannels: string[], allowedRoles: string[], enabled: number) {
        return await db.afkSettings.upsert({
            where: { guild_id: guildId },
            update: {
                allowed_channels: JSON.stringify(allowedChannels),
                allowed_roles: JSON.stringify(allowedRoles),
                enabled: enabled
            },
            create: {
                guild_id: guildId,
                allowed_channels: JSON.stringify(allowedChannels),
                allowed_roles: JSON.stringify(allowedRoles),
                enabled: enabled
            }
        });
    }

    async isAllowed(guildId: string, channelId: string, memberRoles: string[]) {
        const settings = await this.getSettings(guildId);

        if (!settings.enabled) return false;

        // 1. Check Channel (Loose: Empty = All)
        if (settings.allowed_channels.length > 0) {
            if (!settings.allowed_channels.includes(channelId)) return false;
        }

        // 2. Check Roles (Strict: Empty = None)
        if (settings.allowed_roles.length === 0) {
            // User requested explicit whitelisting. If no roles selected, nobody permitted.
            return false;
        } else {
            // Check if member has at least one allowed role
            const hasRole = memberRoles.some(r => settings.allowed_roles.includes(r));
            if (!hasRole) return false;
        }

        return true;
    }

    async handleMessage(message: Message) {
        if (!message.guild || message.author.bot) return;

        // Check if system enabled globally
        const settings = await this.getSettings(message.guild.id);
        if (!settings.enabled) return;

        // 1. Check if author is AFK -> Remove AFK
        // Fix: Don't remove if the message is setting the AFK (starts with "afk")
        const content = message.content.toLowerCase().trim();
        // Regex for prefix+afk or just afk at start. 
        const isAfkCommand = /^([!.\?])?afk\b/i.test(content);

        if (!isAfkCommand) {
            const authorAfk = await this.getAfk(message.guild.id, message.author.id);
            if (authorAfk) {
                await this.removeAfk(message.guild.id, message.author.id);
                // Plain text welcome back request by user
                const msg = await message.reply({
                    content: `Welcome back, <@${message.author.id}>! I have removed your AFK.`,
                    allowedMentions: { users: [message.author.id] }
                });
                setTimeout(() => msg.delete().catch(() => { }), 5000);
            }
        }

        // 2. Check mentions -> Reply if mentioned user is AFK
        if (message.mentions.users.size > 0) {
            for (const [id, user] of message.mentions.users) {
                if (id === message.author.id) continue;
                if (user.bot) continue;

                const targetAfk = await this.getAfk(message.guild.id, id);
                if (targetAfk) {
                    const time = Math.floor(new Date(targetAfk.timestamp).getTime() / 1000);
                    // Plain text reply ("no embeds" per user request)
                    const msg = await message.reply({
                        content: `<@${id}> is currently AFK: **${targetAfk.reason || 'No reason'}** - <t:${time}:R>`,
                        allowedMentions: { parse: [] }
                    });
                    setTimeout(() => msg.delete().catch(() => { }), 10000);
                }
            }
        }
    }
}

export const afkService = new AfkService();
