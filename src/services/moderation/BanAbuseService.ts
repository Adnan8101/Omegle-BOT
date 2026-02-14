import { db } from '../../data/db';
import { Guild, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { client } from '../../core/discord';

// Time windows for pattern detection
const AWARENESS_WINDOW = 5 * 60 * 1000; // 5 minutes
const AWARENESS_THRESHOLD = 5; // 5 bans in 5 minutes triggers awareness

const INTERVENTION_WINDOW = 10 * 60 * 1000; // 10 minutes
const INTERVENTION_THRESHOLD = 10; // 10 bans in 10 minutes triggers intervention

const COOLDOWN_DURATION = 10 * 60 * 1000; // 10 minutes

// Risk level weights for scoring
const RISK_WEIGHTS = {
    low: 0.3,      // Raid, scam, bot attack - expected in emergencies
    medium: 1.0,   // Normal violations
    high: 2.0      // No reason, unclear, personal
};

// Low-risk keywords
const LOW_RISK_KEYWORDS = ['raid', 'scam', 'bot', 'spam', 'alt', 'flood', 'attack', 'mass'];
// High-risk indicators
const HIGH_RISK_INDICATORS = ['no reason', 'other', 'idk', 'dunno', 'just because'];

export class BanAbuseService {
    
    /**
     * Categorize ban reason into risk levels
     */
    private categorizeReason(reason: string): 'low' | 'medium' | 'high' {
        if (!reason || reason.trim().length === 0) return 'high';
        
        const lowerReason = reason.toLowerCase();
        
        // Check for high-risk indicators first
        if (HIGH_RISK_INDICATORS.some(indicator => lowerReason.includes(indicator))) {
            return 'high';
        }
        
        // Check for low-risk keywords
        if (LOW_RISK_KEYWORDS.some(keyword => lowerReason.includes(keyword))) {
            return 'low';
        }
        
        // Default to medium risk
        return 'medium';
    }

    /**
     * Check if moderator is a protected safety admin
     */
    private async isSafetyAdmin(guildId: string, moderatorId: string): Promise<boolean> {
        const safetyAdmin = await db.safetyAdmin.findUnique({
            where: {
                guild_id_user_id: {
                    guild_id: guildId,
                    user_id: moderatorId
                }
            }
        });
        
        return !!safetyAdmin;
    }

    /**
     * Check if emergency mode is active
     */
    private async isEmergencyMode(guildId: string): Promise<boolean> {
        const emergency = await db.emergencyMode.findUnique({
            where: { guild_id: guildId }
        });
        
        return emergency?.enabled || false;
    }

    /**
     * Calculate weighted ban score based on risk levels
     */
    private calculateBanScore(bans: any[]): number {
        return bans.reduce((score, ban) => {
            const weight = RISK_WEIGHTS[ban.risk_level as keyof typeof RISK_WEIGHTS] || 1.0;
            return score + weight;
        }, 0);
    }

    /**
     * Track a ban action with reason-aware evaluation
     */
    async trackBan(
        guildId: string, 
        moderatorId: string, 
        targetId: string, 
        reason: string
    ): Promise<{ blocked: boolean; message?: string }> {
        // Safety admin bypass
        if (await this.isSafetyAdmin(guildId, moderatorId)) {
            return { blocked: false };
        }

        // Emergency mode bypass
        if (await this.isEmergencyMode(guildId)) {
            await this.trackBanOnly(guildId, moderatorId, targetId, reason);
            return { blocked: false };
        }

        // Check if moderator is on cooldown
        const cooldown = await db.moderatorCooldown.findUnique({
            where: {
                guild_id_moderator_id: {
                    guild_id: guildId,
                    moderator_id: moderatorId
                }
            }
        });

        if (cooldown && new Date(cooldown.cooldown_until) > new Date()) {
            const timeLeft = Math.ceil((new Date(cooldown.cooldown_until).getTime() - Date.now()) / 1000 / 60);
            return { 
                blocked: true, 
                message: `Ban command temporarily paused for safety review.\nThis is not a punishment and will auto-restore in ${timeLeft} minutes.`
            };
        }

        // Categorize and track the ban
        const riskLevel = this.categorizeReason(reason);
        await db.banTracking.create({
            data: {
                guild_id: guildId,
                moderator_id: moderatorId,
                target_id: targetId,
                reason: reason,
                risk_level: riskLevel,
                timestamp: new Date()
            }
        });

        // Evaluate behavior patterns
        await this.evaluateModeratorBehavior(guildId, moderatorId);

        return { blocked: false };
    }

    /**
     * Track ban without evaluation (for safety admins/emergency mode)
     */
    private async trackBanOnly(guildId: string, moderatorId: string, targetId: string, reason: string) {
        const riskLevel = this.categorizeReason(reason);
        await db.banTracking.create({
            data: {
                guild_id: guildId,
                moderator_id: moderatorId,
                target_id: targetId,
                reason: reason,
                risk_level: riskLevel,
                timestamp: new Date()
            }
        });
    }

    /**
     * Evaluate moderator behavior with multi-stage response
     */
    private async evaluateModeratorBehavior(guildId: string, moderatorId: string) {
        const guild = client.guilds.cache.get(guildId);
        if (!guild) return;

        // Stage 1: Awareness Check (5 bans in 5 minutes)
        const awarenessTime = new Date(Date.now() - AWARENESS_WINDOW);
        const recentBans = await db.banTracking.findMany({
            where: {
                guild_id: guildId,
                moderator_id: moderatorId,
                timestamp: { gte: awarenessTime }
            },
            orderBy: { timestamp: 'desc' }
        });

        const awarenessScore = this.calculateBanScore(recentBans);

        // Check if awareness alert already sent recently
        const hasRecentAlert = recentBans.some(ban => ban.alert_sent);

        if (awarenessScore >= AWARENESS_THRESHOLD && !hasRecentAlert) {
            await this.sendAwarenessAlert(guild, moderatorId, recentBans);
            
            // Mark alerts as sent
            await db.banTracking.updateMany({
                where: {
                    guild_id: guildId,
                    moderator_id: moderatorId,
                    timestamp: { gte: awarenessTime }
                },
                data: { alert_sent: true }
            });
        }

        // Stage 2: Intervention Check (10 bans in 10 minutes with continued suspicious pattern)
        const interventionTime = new Date(Date.now() - INTERVENTION_WINDOW);
        const interventionBans = await db.banTracking.findMany({
            where: {
                guild_id: guildId,
                moderator_id: moderatorId,
                timestamp: { gte: interventionTime }
            },
            orderBy: { timestamp: 'desc' }
        });

        const interventionScore = this.calculateBanScore(interventionBans);

        if (interventionScore >= INTERVENTION_THRESHOLD) {
            await this.applyControlledIntervention(guild, moderatorId, interventionBans);
        }
    }

    /**
     * Stage 1: Send gentle awareness alerts
     */
    private async sendAwarenessAlert(guild: Guild, moderatorId: string, bans: any[]) {
        const moderator = await guild.members.fetch(moderatorId).catch(() => null);
        
        // Alert to moderator
        if (moderator) {
            const modEmbed = new EmbedBuilder()
                .setColor(0x2b2d31)
            .setTitle('🔔 Safety Check')
                .setDescription(
                    `You've been performing many bans quickly.\n\n` +
                    `This is just a safety check — no action taken.\n` +
                    `Continue as needed if this is an emergency.`
                )
                .setFooter({ text: 'Automated safety system' });
            
            try {
                await moderator.send({ embeds: [modEmbed] });
            } catch (err) {
                console.log(`Cannot DM moderator ${moderatorId}`);
            }
        }

        // Alert to admins
        await this.notifyAdmins(guild, moderatorId, bans, 'awareness');
    }

    /**
     * Stage 2: Apply controlled intervention
     */
    private async applyControlledIntervention(guild: Guild, moderatorId: string, bans: any[]) {
        const cooldownUntil = new Date(Date.now() + COOLDOWN_DURATION);
        
        await db.moderatorCooldown.upsert({
            where: {
                guild_id_moderator_id: {
                    guild_id: guild.id,
                    moderator_id: moderatorId
                }
            },
            update: {
                cooldown_until: cooldownUntil,
                reason: 'Repeated suspicious ban pattern detected'
            },
            create: {
                guild_id: guild.id,
                moderator_id: moderatorId,
                cooldown_until: cooldownUntil,
                reason: 'Repeated suspicious ban pattern detected'
            }
        });

        // Notify moderator
        const moderator = await guild.members.fetch(moderatorId).catch(() => null);
        if (moderator) {
            const modEmbed = new EmbedBuilder()
                .setColor(0x2b2d31)
            .setTitle('⚠️ Temporary Safety Pause')
                .setDescription(
                    `Ban command temporarily paused for safety review.\n\n` +
                    `**This is not a punishment** and will auto-restore in 10 minutes.\n\n` +
                    `If this is a genuine emergency, ask an admin to enable Emergency Mode.`
                )
                .setFooter({ text: 'Automated safety system' });
            
            try {
                await moderator.send({ embeds: [modEmbed] });
            } catch (err) {
                console.log(`Cannot DM moderator ${moderatorId}`);
            }
        }

        // Notify admins
        await this.notifyAdmins(guild, moderatorId, bans, 'intervention');
    }

    /**
     * Notify server administrators with context
     */
    private async notifyAdmins(guild: Guild, moderatorId: string, bans: any[], stage: 'awareness' | 'intervention') {
        const adminMembers = (await guild.members.fetch())
            .filter(m => 
                !m.user.bot && 
                (m.permissions.has(PermissionFlagsBits.Administrator) || 
                 m.permissions.has(PermissionFlagsBits.ManageGuild))
            );

        const banDetails = bans
            .slice(0, 5)
            .map((ban, idx) => {
                const riskEmoji = ban.risk_level === 'low' ? '🟢' : ban.risk_level === 'high' ? '🔴' : '🟡';
                return `${riskEmoji} <@${ban.target_id}> - ${ban.reason || 'No reason'} - <t:${Math.floor(ban.timestamp.getTime() / 1000)}:R>`;
            })
            .join('\n');

        const color = stage === 'awareness' ? 0x5865F2 : 0xFEE75C;
        const title = stage === 'awareness' 
            ? '🔔 Awareness: Unusual Ban Activity' 
            : '⚠️ Intervention: Cooldown Applied';
        
        const description = stage === 'awareness'
            ? `**Heads up:** <@${moderatorId}> has performed an unusually high number of bans.\n\n` +
              `Please review if needed. No action taken yet.`
            : `**Cooldown applied:** <@${moderatorId}> ban command paused for 10 minutes.\n\n` +
              `Review the pattern below. You can enable Emergency Mode if this is legitimate.`;

        const embed = new EmbedBuilder()
            .setColor(0x2b2d31)
        .setTitle(title)
            .setDescription(description)
            .addFields({
                name: 'Recent Bans',
                value: banDetails || 'No details',
                inline: false
            })
            .setFooter({ text: 'Automated safety system' })
            .setTimestamp();

        for (const [, member] of adminMembers) {
            try {
                await member.send({ embeds: [embed] });
            } catch (error) {
                console.log(`Failed to DM admin ${member.id}`);
            }
        }
    }

    /**
     * Check if a moderator is on cooldown
     */
    async isOnCooldown(guildId: string, moderatorId: string): Promise<Date | null> {
        const cooldown = await db.moderatorCooldown.findUnique({
            where: {
                guild_id_moderator_id: {
                    guild_id: guildId,
                    moderator_id: moderatorId
                }
            }
        });

        if (cooldown && new Date(cooldown.cooldown_until) > new Date()) {
            return new Date(cooldown.cooldown_until);
        }

        return null;
    }

    /**
     * Clean up old records
     */
    async cleanupOldRecords(guildId: string) {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        await db.banTracking.deleteMany({
            where: {
                guild_id: guildId,
                timestamp: { lt: oneDayAgo }
            }
        });

        // Clean expired cooldowns
        await db.moderatorCooldown.deleteMany({
            where: {
                guild_id: guildId,
                cooldown_until: { lt: new Date() }
            }
        });
    }
}

export const banAbuseService = new BanAbuseService();
