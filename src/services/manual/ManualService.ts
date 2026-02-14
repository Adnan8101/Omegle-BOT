import { db } from '../../data/db';
import { Prisma } from '@prisma/client';

export class ManualService {

    /**
     * Get the next manual number for a guild (auto-incrementing per guild)
     */
    private async getNextManualNumber(tx: Prisma.TransactionClient, guildId: string): Promise<number> {
        const result = await tx.manualCounter.upsert({
            where: { guild_id: guildId },
            update: { last_manual_number: { increment: 1 } },
            create: { guild_id: guildId, last_manual_number: 1 }
        });
        return result.last_manual_number;
    }

    /**
     * Create a new manual entry
     */
    async createManual(
        guildId: string,
        targetId: string,
        moderatorId: string,
        offense: string,
        action: string,
        advise: string | null,
        noteProof: string | null
    ) {
        return await db.$transaction(async (tx: Prisma.TransactionClient) => {
            const manualNumber = await this.getNextManualNumber(tx, guildId);

            const manual = await tx.manual.create({
                data: {
                    manual_number: manualNumber,
                    guild_id: guildId,
                    target_id: targetId,
                    moderator_id: moderatorId,
                    offense,
                    action,
                    advise: advise || null,
                    note_proof: noteProof || null
                }
            });

            return { ...manual, manual_number: manualNumber };
        });
    }

    /**
     * Get a specific manual by guild + manual number
     */
    async getManual(guildId: string, manualNumber: number) {
        return await db.manual.findFirst({
            where: {
                guild_id: guildId,
                manual_number: manualNumber
            }
        });
    }

    /**
     * Get a manual by its UUID
     */
    async getManualById(id: string) {
        return await db.manual.findUnique({
            where: { id }
        });
    }

    /**
     * Get all manuals for a specific user in a guild
     */
    async getUserManuals(guildId: string, targetId: string) {
        return await db.manual.findMany({
            where: {
                guild_id: guildId,
                target_id: targetId
            },
            orderBy: { created_at: 'desc' }
        });
    }

    /**
     * Get manuals for a user with pagination
     */
    async getUserManualsPaginated(guildId: string, targetId: string, page: number = 1, pageSize: number = 1) {
        const total = await db.manual.count({
            where: {
                guild_id: guildId,
                target_id: targetId
            }
        });

        const manuals = await db.manual.findMany({
            where: {
                guild_id: guildId,
                target_id: targetId
            },
            orderBy: { created_at: 'desc' },
            skip: (page - 1) * pageSize,
            take: pageSize
        });

        return {
            manuals,
            total,
            page,
            totalPages: Math.ceil(total / pageSize)
        };
    }

    /**
     * Update a manual entry
     */
    async updateManual(
        id: string,
        data: {
            offense?: string;
            action?: string;
            advise?: string | null;
            note_proof?: string | null;
        }
    ) {
        return await db.manual.update({
            where: { id },
            data
        });
    }

    /**
     * Update the log message ID for a manual (after webhook is sent)
     */
    async setLogMessageId(id: string, messageId: string) {
        return await db.manual.update({
            where: { id },
            data: { log_message_id: messageId }
        });
    }

    /**
     * Delete a manual entry
     */
    async deleteManual(id: string) {
        return await db.manual.delete({
            where: { id }
        });
    }

    /**
     * Get the manual logs channel config for a guild
     */
    async getConfig(guildId: string) {
        return await db.manualConfig.findUnique({
            where: { guild_id: guildId }
        });
    }

    /**
     * Set the manual logs channel for a guild
     */
    async setLogChannel(guildId: string, channelId: string) {
        return await db.manualConfig.upsert({
            where: { guild_id: guildId },
            update: { log_channel_id: channelId },
            create: { guild_id: guildId, log_channel_id: channelId }
        });
    }

    /**
     * Get the count of manuals for a user in a guild
     */
    async getManualCount(guildId: string, targetId: string): Promise<number> {
        return await db.manual.count({
            where: {
                guild_id: guildId,
                target_id: targetId
            }
        });
    }
}

export const manualService = new ManualService();
