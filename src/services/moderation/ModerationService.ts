import { db } from '../../data/db';
import { Context } from '../../core/context';
import { sendModDm } from '../../util/moderationDm';
import { PrismaClient, Prisma } from '@prisma/client';

type ModAction = 'ban' | 'kick' | 'mute' | 'unmute' | 'warn' | 'unban' | 'manual';

export class ModerationService {

    async createCase(
        ctx: Context,
        targetId: string,
        action: ModAction,
        reason: string | null,
        durationSeconds: number | null,
        discordAction: () => Promise<void>
    ) {
        return await db.$transaction(async (tx: Prisma.TransactionClient) => {
            const caseNum = await this.getNextCaseId(tx, ctx.guildId);

            // Create case first to ensure ID is reserved and valid
            await tx.moderationCase.create({
                data: {
                    guild_id: ctx.guildId,
                    case_number: caseNum,
                    action: action,
                    target_id: targetId,
                    moderator_id: ctx.authorId,
                    reason: reason,
                    duration_seconds: durationSeconds,
                    active: action === 'mute' || action === 'ban',
                    created_at: new Date()
                }
            });

            // Attempt DM before action (best effort)
            await sendModDm(ctx.inner.guild!, targetId, action, reason || 'No reason provided', caseNum);

            // Perform Discord action (ban/kick/mute)
            // If this fails, transaction rolls back, preventing "zombie case"
            // However, a DM might have been sent falsely.
            await discordAction();

            await this.incrementModeratorStats(tx, ctx.guildId, ctx.authorId, action);
            await this.incrementUserStats(tx, ctx.guildId, targetId, action);

            return caseNum;
        });
    }

    private async getNextCaseId(tx: Prisma.TransactionClient, guildId: string): Promise<number> {
        const result = await tx.guildCaseCounter.upsert({
            where: { guild_id: guildId },
            update: { last_case_number: { increment: 1 } },
            create: { guild_id: guildId, last_case_number: 1 }
        });
        return result.last_case_number;
    }

    private async incrementModeratorStats(tx: Prisma.TransactionClient, guildId: string, modId: string, action: ModAction) {
        const col = this.actionToColumn(action);
        if (!col) return;

        const updateData: Record<string, object> = {};
        updateData[col] = { increment: 1 };

        await tx.moderatorStats.upsert({
            where: {
                guild_id_moderator_id: {
                    guild_id: guildId,
                    moderator_id: modId
                }
            },
            update: updateData,
            create: {
                guild_id: guildId,
                moderator_id: modId,
                [col]: 1,
                // Initialize other fields to 0 implicitly via default
            }
        });
    }

    private async incrementUserStats(tx: Prisma.TransactionClient, guildId: string, userId: string, action: ModAction) {
        const col = this.actionToColumn(action);
        if (!col || action === 'unmute' || action === 'unban') return;

        const updateData: Record<string, object> = {};
        updateData[col] = { increment: 1 };

        await tx.userModerationStats.upsert({
            where: {
                guild_id_user_id: {
                    guild_id: guildId,
                    user_id: userId
                }
            },
            update: updateData,
            create: {
                guild_id: guildId,
                user_id: userId,
                [col]: 1
            }
        });
    }

    private actionToColumn(action: ModAction): string | null {
        switch (action) {
            case 'ban': return 'bans';
            case 'kick': return 'kicks';
            case 'mute': return 'mutes';
            case 'unmute': return 'unmutes';
            case 'warn': return 'warns';
            default: return null;
        }
    }

    async getCase(guildId: string, caseNumber: number) {
        return await db.moderationCase.findFirst({
            where: {
                guild_id: guildId,
                case_number: caseNumber
            }
        });
    }

    async getRecentCases(guildId: string, limit: number = 10) {
        return await db.moderationCase.findMany({
            where: { guild_id: guildId },
            orderBy: { case_number: 'desc' },
            take: limit
        });
    }

    async updateCaseReason(guildId: string, caseNumber: number, newReason: string) {
        const c = await this.getCase(guildId, caseNumber);
        if (!c) return null;

        return await db.moderationCase.update({
            where: { id: c.id },
            data: { reason: newReason }
        });
    }

    async deleteCase(guildId: string, caseNumber: number) {
        const c = await this.getCase(guildId, caseNumber);
        if (!c) return null;

        return await db.moderationCase.delete({
            where: { id: c.id }
        });
    }

    async getLeaderboard(guildId: string, limit: number = 10) {
        return await db.$queryRaw`
            SELECT * FROM "moderator_stats"
            WHERE "guild_id" = ${guildId}
            ORDER BY ("bans" + "kicks" + "mutes" + "warns") DESC
            LIMIT ${limit}
        `;
    }

    async getLogs(guildId: string, targetId: string, limit: number = 20) {
        return await db.moderationCase.findMany({
            where: {
                guild_id: guildId,
                target_id: targetId
            },
            orderBy: { created_at: 'desc' },
            take: limit
        });
    }

    async getModeratorStats(guildId: string, modId: string) {
        return await db.moderatorStats.findUnique({
            where: {
                guild_id_moderator_id: {
                    guild_id: guildId,
                    moderator_id: modId
                }
            }
        });
    }

    async getUserStats(guildId: string, userId: string) {
        return await db.userModerationStats.findUnique({
            where: {
                guild_id_user_id: {
                    guild_id: guildId,
                    user_id: userId
                }
            }
        });
    }

    async getRecentAction(guildId: string, userId: string) {
        return await db.moderationCase.findFirst({
            where: {
                guild_id: guildId,
                target_id: userId
            },
            orderBy: { created_at: 'desc' },
            take: 1
        });
    }

}

export const modService = new ModerationService();
