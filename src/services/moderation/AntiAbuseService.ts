import { db } from '../../data/db';
import { Guild, User } from 'discord.js';
import { client } from '../../core/discord';

const RATE_LIMIT_WINDOW_MS = 2 * 60 * 1000; // 2 minutes
const ACTION_THRESHOLD = 5; // 5 actions triggers warning
const IMMUNITY_DURATION_MS = 30 * 60 * 1000; // 30 minutes

class AntiAbuseService {
    /**
     * Track a moderation action and check if limits are exceeded
     */
    async trackAction(guildId: string, moderatorId: string, action: 'ban' | 'kick'): Promise<{
        allowed: boolean;
        warning?: string;
        blocked?: boolean;
    }> {
        // Check if moderator has immunity
        const hasImmunity = await this.hasImmunity(guildId, moderatorId);
        if (hasImmunity) {
            return { allowed: true };
        }

        // Check if moderator is blocked
        const isBlocked = await this.isBlocked(guildId, moderatorId);
        if (isBlocked) {
            return {
                allowed: false,
                blocked: true
            };
        }

        // Record the action
        await db.modActionRateLimit.create({
            data: {
                guild_id: guildId,
                moderator_id: moderatorId,
                action
            }
        });

        // Check if over limit
        const overLimit = await this.isOverLimit(guildId, moderatorId);
        if (overLimit) {
            const recentCount = await this.getRecentActionCount(guildId, moderatorId);

            if (recentCount >= ACTION_THRESHOLD + 5) {
                // Block the moderator for continued abuse
                await this.blockModerator(guildId, moderatorId, `Exceeded rate limit with ${recentCount} actions in 2 minutes`);

                // Notify admins
                const guild = client.guilds.cache.get(guildId);
                if (guild) {
                    await this.notifyAdmins(guild, moderatorId, action, recentCount, true);
                }

                return {
                    allowed: false,
                    blocked: true
                };
            } else {
                // First warning - allow but notify
                const guild = client.guilds.cache.get(guildId);
                if (guild) {
                    await this.notifyAdmins(guild, moderatorId, action, recentCount, false);
                }

                return {
                    allowed: true,
                    warning: `⚠️ Warning: You have performed ${recentCount} ${action} actions in the last 2 minutes. Continued abuse will result in automatic blocking.`
                };
            }
        }

        return { allowed: true };
    }

    /**
     * Check if moderator exceeded rate limit
     */
    async isOverLimit(guildId: string, moderatorId: string): Promise<boolean> {
        const count = await this.getRecentActionCount(guildId, moderatorId);
        return count >= ACTION_THRESHOLD;
    }

    /**
     * Get count of recent actions within the rate limit window
     */
    async getRecentActionCount(guildId: string, moderatorId: string): Promise<number> {
        const cutoffTime = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);

        const count = await db.modActionRateLimit.count({
            where: {
                guild_id: guildId,
                moderator_id: moderatorId,
                timestamp: {
                    gte: cutoffTime
                }
            }
        });

        return count;
    }

    /**
     * Block a moderator from performing mod actions
     */
    async blockModerator(guildId: string, moderatorId: string, reason: string): Promise<void> {
        await db.modActionBlock.upsert({
            where: {
                guild_id_moderator_id: {
                    guild_id: guildId,
                    moderator_id: moderatorId
                }
            },
            create: {
                guild_id: guildId,
                moderator_id: moderatorId,
                reason
            },
            update: {
                blocked_at: new Date(),
                reason
            }
        });
    }

    /**
     * Check if moderator is currently blocked
     */
    async isBlocked(guildId: string, moderatorId: string): Promise<boolean> {
        const block = await db.modActionBlock.findUnique({
            where: {
                guild_id_moderator_id: {
                    guild_id: guildId,
                    moderator_id: moderatorId
                }
            }
        });

        return block !== null;
    }

    /**
     * Check if moderator has immunity (cooldown override)
     */
    async hasImmunity(guildId: string, moderatorId: string): Promise<boolean> {
        const override = await db.modCooldownOverride.findUnique({
            where: {
                guild_id_moderator_id: {
                    guild_id: guildId,
                    moderator_id: moderatorId
                }
            }
        });

        if (!override) return false;

        // Check if expired
        if (new Date() > override.expires_at) {
            // Cleanup expired override
            await db.modCooldownOverride.delete({
                where: {
                    guild_id_moderator_id: {
                        guild_id: guildId,
                        moderator_id: moderatorId
                    }
                }
            });
            return false;
        }

        return true;
    }

    /**
     * Notify all administrators about abuse
     */
    async notifyAdmins(guild: Guild, moderatorId: string, action: string, actionCount: number, blocked: boolean): Promise<void> {
        try {
            const members = await guild.members.fetch();
            const admins = members.filter(m => m.permissions.has('Administrator') && !m.user.bot);

            const moderator = await guild.members.fetch(moderatorId).catch(() => null);
            const moderatorTag = moderator ? moderator.user.tag : moderatorId;

            const message = blocked
                ? `🚨 **MODERATOR BLOCKED**\n\nModerator **${moderatorTag}** (\`${moderatorId}\`) has been automatically blocked from moderation actions.\n\n**Reason:** Exceeded rate limit with **${actionCount}** ${action} actions in 2 minutes.\n\nUse \`!cooldown @${moderatorTag}\` to grant 30-minute immunity if this was legitimate.`
                : `⚠️ **RATE LIMIT WARNING**\n\nModerator **${moderatorTag}** (\`${moderatorId}\`) has performed **${actionCount}** ${action} actions in the last 2 minutes.\n\nThis is a warning. If the pattern continues, they will be automatically blocked.`;

            for (const [, admin] of admins) {
                try {
                    await admin.send(message);
                } catch (err) {
                    console.log(`Could not DM admin ${admin.user.tag}`);
                }
            }
        } catch (error) {
            console.error('Failed to notify admins:', error);
        }
    }

    /**
     * Grant cooldown override (immunity) to a moderator
     */
    async grantCooldownOverride(guildId: string, moderatorId: string, grantedBy: string): Promise<void> {
        const expiresAt = new Date(Date.now() + IMMUNITY_DURATION_MS);

        // Remove any existing block
        await db.modActionBlock.deleteMany({
            where: {
                guild_id: guildId,
                moderator_id: moderatorId
            }
        });

        // Create or update override
        await db.modCooldownOverride.upsert({
            where: {
                guild_id_moderator_id: {
                    guild_id: guildId,
                    moderator_id: moderatorId
                }
            },
            create: {
                guild_id: guildId,
                moderator_id: moderatorId,
                granted_by: grantedBy,
                expires_at: expiresAt
            },
            update: {
                granted_by: grantedBy,
                granted_at: new Date(),
                expires_at: expiresAt
            }
        });
    }

    /**
     * Cleanup expired records
     */
    async cleanupExpiredRecords(): Promise<void> {
        const cutoffTime = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);

        // Remove old rate limit records
        await db.modActionRateLimit.deleteMany({
            where: {
                timestamp: {
                    lt: cutoffTime
                }
            }
        });

        // Remove expired overrides
        await db.modCooldownOverride.deleteMany({
            where: {
                expires_at: {
                    lt: new Date()
                }
            }
        });
    }
}

export const antiAbuseService = new AntiAbuseService();

// Background cleanup every 5 minutes
setInterval(() => {
    antiAbuseService.cleanupExpiredRecords().catch(console.error);
}, 5 * 60 * 1000);
