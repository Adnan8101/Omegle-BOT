import { db } from '../../data/db';
import { client } from '../../core/discord';
import { Context } from '../../core/context';
import { TextChannel } from 'discord.js';
import { Sticky } from '@prisma/client';

const cache = new Map<string, Sticky>();

export class StickyService {

    async initialize() {
        const allStickies = await db.sticky.findMany();
        for (const sticky of allStickies) {
            cache.set(sticky.channel_id, sticky);
        }
    }

    async add(ctx: Context, content: string) {
        if (cache.has(ctx.channelId)) {
            throw new Error('A sticky message already exists in this channel');
        }

        const result = await db.sticky.create({
            data: {
                guild_id: ctx.guildId,
                channel_id: ctx.channelId,
                content: content,
                created_by: ctx.authorId,
                enabled: true,
                cooldown_seconds: 0
            }
        });

        const messageId = await this.sendStickyMessage(ctx.channelId, content);

        const updated = await db.sticky.update({
            where: { sticky_id: result.sticky_id },
            data: {
                last_message_id: messageId,
                last_posted_at: new Date()
            }
        });

        cache.set(ctx.channelId, updated);
    }

    async edit(ctx: Context, newContent: string) {
        const sticky = cache.get(ctx.channelId);
        if (!sticky) throw new Error('No sticky message found in this channel');

        if (sticky.last_message_id) {
            await this.deleteMessage(ctx.channelId, sticky.last_message_id);
        }

        const newMessageId = await this.sendStickyMessage(ctx.channelId, newContent);

        const updated = await db.sticky.update({
            where: { sticky_id: sticky.sticky_id },
            data: {
                content: newContent,
                last_message_id: newMessageId,
                last_posted_at: new Date(),
                updated_at: new Date()
            }
        });

        cache.set(ctx.channelId, updated);
    }

    async remove(ctx: Context) {
        const sticky = cache.get(ctx.channelId);
        if (!sticky) throw new Error('No sticky message found in this channel');

        if (sticky.last_message_id) {
            await this.deleteMessage(ctx.channelId, sticky.last_message_id);
        }

        await db.sticky.delete({
            where: { sticky_id: sticky.sticky_id }
        });

        cache.delete(ctx.channelId);
    }

    async list(ctx: Context) {
        const stickies: Sticky[] = [];
        for (const s of cache.values()) {
            if (s.guild_id === ctx.guildId) stickies.push(s);
        }
        return stickies;
    }

    async toggle(ctx: Context, enabled: boolean) {
        const sticky = cache.get(ctx.channelId);
        if (!sticky) throw new Error('No sticky message found');

        const updated = await db.sticky.update({
            where: { sticky_id: sticky.sticky_id },
            data: { enabled }
        });

        cache.set(ctx.channelId, updated);

        if (enabled) {
            if (sticky.last_message_id) await this.deleteMessage(ctx.channelId, sticky.last_message_id);
            const msgId = await this.sendStickyMessage(ctx.channelId, sticky.content);

            const reposted = await db.sticky.update({
                where: { sticky_id: sticky.sticky_id },
                data: {
                    last_message_id: msgId,
                    last_posted_at: new Date()
                }
            });

            cache.set(ctx.channelId, reposted);
        }
    }

    async setCooldown(ctx: Context, seconds: number) {
        if (seconds < 0) throw new Error('Cooldown cannot be negative');
        const sticky = cache.get(ctx.channelId);
        if (!sticky) throw new Error('No sticky message found');

        const updated = await db.sticky.update({
            where: { sticky_id: sticky.sticky_id },
            data: { cooldown_seconds: seconds }
        });

        cache.set(ctx.channelId, updated);
    }

    private async sendStickyMessage(channelId: string, content: string): Promise<string | null> {
        try {
            const channel = await client.channels.fetch(channelId) as TextChannel;
            if (!channel) return null;

            const { EmbedBuilder } = require('discord.js');
            const embed = new EmbedBuilder()
                
                .setColor(0x2b2d31)
            .setDescription(content)
                .setFooter({ text: 'Sticky Message' })
                .setTimestamp();

            const msg = await channel.send({ embeds: [embed] });
            return msg.id;
        } catch (err: any) {
            return null;
        }
    }

    private async deleteMessage(channelId: string, messageId: string) {
        try {
            const channel = await client.channels.fetch(channelId) as TextChannel;
            if (!channel) return;
            await channel.messages.delete(messageId);
        } catch (err: any) {
            if (err.code !== 10008) {
                // Ignore unknown message
            }
        }
    }

    async trigger(ctx: Context) {
        if (ctx.authorIsBot) return;

        const sticky = cache.get(ctx.channelId);
        if (!sticky) {
            return;
        }

        if (!sticky.enabled) {
            return;
        }

        const now = Date.now();
        const lastPosted = sticky.last_posted_at ? new Date(sticky.last_posted_at).getTime() : 0;
        const diff = now - lastPosted;
        const cooldownMs = sticky.cooldown_seconds * 1000;

        if (diff < cooldownMs) {
            // console.log(`Sticky Cooldown: ${diff}ms < ${cooldownMs}ms`);
            return;
        }

        if (ctx.messageId === sticky.last_message_id) {
            return;
        }

        // console.log('Triggering sticky repost for', ctx.channelId);

        if (sticky.last_message_id) {
            await this.deleteMessage(ctx.channelId, sticky.last_message_id);
        }

        const newMessageId = await this.sendStickyMessage(ctx.channelId, sticky.content);

        if (newMessageId) {
            const updated = await db.sticky.update({
                where: { sticky_id: sticky.sticky_id },
                data: {
                    last_message_id: newMessageId,
                    last_posted_at: new Date()
                }
            });

            if (updated) {
                cache.set(ctx.channelId, updated);
            }
        }
    }
}

export const stickyService = new StickyService();