import { db } from '../../data/db';
import { Prisma } from '@prisma/client';

export class ActivityLogService {

    async logVoiceJoin(guildId: string, userId: string, channelId: string) {
        // Just insert a new record with joined_at = now
        await db.voiceLog.create({
            data: {
                guild_id: guildId,
                user_id: userId,
                channel_id: channelId,
                joined_at: new Date()
            }
        });
    }

    async logVoiceLeave(guildId: string, userId: string, channelId: string) {
        // Find the specific active session (latest one for this user/channel that has no left_at)
        const session = await db.voiceLog.findFirst({
            where: {
                guild_id: guildId,
                user_id: userId,
                channel_id: channelId,
                left_at: null
            },
            orderBy: {
                joined_at: 'desc'
            }
        });

        if (session) {
            const now = new Date();
            const joinedAt = new Date(session.joined_at);
            const duration = Math.floor((now.getTime() - joinedAt.getTime()) / 1000);

            await db.voiceLog.update({
                where: { id: session.id },
                data: {
                    left_at: now,
                    duration_seconds: duration
                }
            });
        }
    }

    async logChatActivity(guildId: string, userId: string, channelId: string, messageId: string, contentLength: number) {
        await db.chatLog.create({
            data: {
                guild_id: guildId,
                user_id: userId,
                channel_id: channelId,
                message_id: messageId,
                content_length: contentLength
            }
        });
    }

    async getVoiceLogs(guildId: string, userId: string, limit: number = 20) {
        return await db.voiceLog.findMany({
            where: {
                guild_id: guildId,
                user_id: userId
            },
            orderBy: {
                joined_at: 'desc'
            },
            take: limit
        });
    }

    async getChatLogs(guildId: string, userId: string, limit: number = 20) {
        return await db.chatLog.findMany({
            where: {
                guild_id: guildId,
                user_id: userId
            },
            orderBy: {
                created_at: 'desc'
            },
            take: limit
        });
    }

    async getChatStats(guildId: string, userId: string) {
        const total = await db.chatLog.count({
            where: {
                guild_id: guildId,
                user_id: userId
            }
        });

        const topChannelsGroup = await db.chatLog.groupBy({
            by: ['channel_id'],
            where: {
                guild_id: guildId,
                user_id: userId
            },
            _count: {
                _all: true
            },
            orderBy: {
                _count: {
                    channel_id: 'desc'
                }
            },
            take: 5
        });

        // Map format
        const topChannels = topChannelsGroup.map((g: any) => ({
            channel_id: g.channel_id,
            count: g._count._all
        }));

        return {
            totalMessages: total,
            topChannels: topChannels
        };
    }

    async compareVoiceLogs(guildId: string, userId1: string, userId2: string, timeSeconds: number) {
        const since = new Date(Date.now() - timeSeconds * 1000);

        // Fetch logs for both users within the timeframe
        const logs1 = await db.voiceLog.findMany({
            where: {
                guild_id: guildId,
                user_id: userId1,
                joined_at: {
                    gte: since
                }
            },
            orderBy: {
                joined_at: 'asc'
            }
        });

        const logs2 = await db.voiceLog.findMany({
            where: {
                guild_id: guildId,
                user_id: userId2,
                joined_at: {
                    gte: since
                }
            },
            orderBy: {
                joined_at: 'asc'
            }
        });

        interface Interaction {
            channel_id: string;
            overlap_start: Date;
            overlap_end: Date;
            overlap_duration: number;
        }

        const interactions: Interaction[] = [];

        // Compare sessions to find overlaps
        for (const log1 of logs1) {
            const start1 = new Date(log1.joined_at);
            const end1 = log1.left_at ? new Date(log1.left_at) : new Date(); // If still in VC, use current time

            for (const log2 of logs2) {
                // Must be in same channel
                if (log1.channel_id !== log2.channel_id) continue;

                const start2 = new Date(log2.joined_at);
                const end2 = log2.left_at ? new Date(log2.left_at) : new Date();

                // Calculate overlap
                const overlapStart = start1 > start2 ? start1 : start2;
                const overlapEnd = end1 < end2 ? end1 : end2;

                // Check if there's an actual overlap
                if (overlapStart < overlapEnd) {
                    const durationSeconds = Math.floor((overlapEnd.getTime() - overlapStart.getTime()) / 1000);
                    
                    if (durationSeconds > 0) {
                        interactions.push({
                            channel_id: log1.channel_id,
                            overlap_start: overlapStart,
                            overlap_end: overlapEnd,
                            overlap_duration: durationSeconds
                        });
                    }
                }
            }
        }

        // Calculate total overlap time
        const totalOverlapTime = interactions.reduce((sum, i) => sum + i.overlap_duration, 0);

        return {
            interactions,
            totalOverlapTime
        };
    }
}

export const activityLogService = new ActivityLogService();
