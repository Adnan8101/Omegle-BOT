import { db } from '../../data/db';

export class MailService {
    private ticketCache = new Map<string, any>();
    private CACHE_TTL = 1000 * 60 * 5;
    private cacheTimestamps = new Map<string, number>();

    async getGuildConfig(guildId: string) {
        return await db.mailConfig.findUnique({
            where: { guild_id: guildId }
        });
    }

    async getCategories(guildId: string) {
        return await db.mailCategory.findMany({
            where: { guild_id: guildId }
        });
    }

    async getActiveTicket(guildId: string, userId: string) {
        return await db.ticket.findFirst({
            where: {
                guild_id: guildId,
                user_id: userId,
                status: { in: ['pending', 'open', 'claimed'] }
            }
        });
    }

    async getTicketByChannel(channelId: string) {
        if (this.ticketCache.has(channelId)) {
            const cached = this.ticketCache.get(channelId);
            const ts = this.cacheTimestamps.get(channelId) || 0;
            if (Date.now() - ts < this.CACHE_TTL) {
                return cached;
            }
        }

        const ticket = await db.ticket.findFirst({
            where: { channel_id: channelId }
        });

        this.ticketCache.set(channelId, ticket || null);
        this.cacheTimestamps.set(channelId, Date.now());

        return ticket;
    }

    invalidateCache(channelId: string) {
        this.ticketCache.delete(channelId);
        this.cacheTimestamps.delete(channelId);
    }

    async createPendingTicket(guildId: string, userId: string, categoryId: string) {
        const ticket = await db.ticket.create({
            data: {
                guild_id: guildId,
                user_id: userId,
                category_id: categoryId,
                status: 'pending',
                opened_at: new Date()
            }
        });

        return ticket;
    }

    async openTicket(ticketId: string, channelId: string) {
        const result = await db.ticket.update({
            where: { ticket_id: ticketId },
            data: {
                status: 'open',
                channel_id: channelId,
                opened_at: new Date()
            }
        });

        this.invalidateCache(channelId);
        return result;
    }

    async claimTicket(ticketId: string, staffId: string) {
        return await db.ticket.updateMany({
            where: {
                ticket_id: ticketId,
                status: 'open'
            },
            data: {
                status: 'claimed',
                claimed_by: staffId
            }
        });
    }

    async unclaimTicket(ticketId: string) {
        return await db.ticket.update({
            where: { ticket_id: ticketId },
            data: {
                status: 'open',
                claimed_by: null
            }
        });
    }

    async closeTicket(ticketId: string) {
        const result = await db.ticket.update({
            where: { ticket_id: ticketId },
            data: {
                status: 'closed',
                closed_at: new Date()
            }
        });

        if (result && result.channel_id) {
            this.invalidateCache(result.channel_id);
        }
        return result;
    }

    async getTicketMessages(ticketId: string) {
        return await db.ticketMessage.findMany({
            where: { ticket_id: ticketId },
            orderBy: { created_at: 'asc' }
        });
    }

    async getClaimedTickets(guildId: string) {
        return await db.ticket.findMany({
            where: {
                guild_id: guildId,
                status: 'claimed'
            }
        });
    }

    async getInactiveTickets(guildId: string, olderThan: Date) {
        return await db.ticket.findMany({
            where: {
                guild_id: guildId,
                status: { in: ['open', 'claimed'] },
                AND: [
                    {
                        OR: [
                            { last_user_message_at: { lt: olderThan } },
                            { last_user_message_at: null, opened_at: { lt: olderThan } }
                        ]
                    },
                    {
                        OR: [
                            { last_staff_message_at: { lt: olderThan } },
                            { last_staff_message_at: null, opened_at: { lt: olderThan } }
                        ]
                    }
                ]
            }
        });
    }

    async logMessage(
        ticketId: string,
        senderType: 'user' | 'staff' | string,
        senderId: string,
        content: string,
        metadata: {
            attachments?: any[],
            embeds?: any[],
            author_name?: string,
            author_avatar?: string,
            author_role_color?: string
        } = {}
    ) {
        const updateField = senderType === 'user' ? 'last_user_message_at' : 'last_staff_message_at';

        return await db.$transaction([
            db.ticket.update({
                where: { ticket_id: ticketId },
                data: {
                    [updateField]: new Date()
                }
            }),
            db.ticketMessage.create({
                data: {
                    ticket_id: ticketId,
                    sender_type: senderType,
                    sender_id: senderId,
                    content: content,
                    attachments: metadata.attachments ? JSON.stringify(metadata.attachments) : undefined,
                    embeds: metadata.embeds ? JSON.stringify(metadata.embeds) : undefined,
                    author_name: metadata.author_name,
                    author_avatar: metadata.author_avatar,
                    author_role_color: metadata.author_role_color
                }
            })
        ]);
    }
}

export const mailService = new MailService();
