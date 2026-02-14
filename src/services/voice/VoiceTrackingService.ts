import { db } from '../../data/db';
import { VoiceState } from 'discord.js';

class VoiceTrackingService {
    /**
     * Handle when a user joins a voice channel
     */
    async handleJoin(guildId: string, userId: string, channelId: string, state: VoiceState): Promise<void> {
        console.log(`[VoiceTracking] 🔵 handleJoin called - Guild: ${guildId}, User: ${userId}, Channel: ${channelId}`);
        try {
            console.log(`[VoiceTracking] 💾 Creating tracking session...`);
            await db.voiceTracking.create({
                data: {
                    guild_id: guildId,
                    user_id: userId,
                    channel_id: channelId,
                    was_muted: state.mute || state.selfMute || false,
                    was_deafened: state.deaf || state.selfDeaf || false,
                    last_state_change: new Date()
                }
            });
            console.log(`[VoiceTracking] ✅ Tracking session created`);

            // Update user stats
            console.log(`[VoiceTracking] 📊 Upserting user stats...`);
            await db.voiceUserStats.upsert({
                where: {
                    guild_id_user_id: {
                        guild_id: guildId,
                        user_id: userId
                    }
                },
                create: {
                    guild_id: guildId,
                    user_id: userId,
                    total_sessions: 1,
                    last_joined_at: new Date()
                },
                update: {
                    total_sessions: { increment: 1 },
                    last_joined_at: new Date()
                }
            });
            console.log(`[VoiceTracking] ✅ User stats updated successfully`);
        } catch (error) {
            console.error('[VoiceTracking] ❌ Error handling voice join:', error);
        }
    }

    /**
     * Handle when a user leaves a voice channel
     */
    async handleLeave(guildId: string, userId: string): Promise<void> {
        console.log(`[VoiceTracking] 🔴 handleLeave called - Guild: ${guildId}, User: ${userId}`);
        try {
            // Find active session
            console.log(`[VoiceTracking] 🔍 Finding active session...`);
            const activeSession = await db.voiceTracking.findFirst({
                where: {
                    guild_id: guildId,
                    user_id: userId,
                    left_at: null
                },
                orderBy: {
                    joined_at: 'desc'
                }
            });

            if (!activeSession) return;

            // Calculate final time deltas
            const now = new Date();
            const timeDelta = Math.floor((now.getTime() - activeSession.last_state_change.getTime()) / 1000);

            let updateData: any = {
                left_at: now
            };

            // Add time to appropriate category based on last state
            if (activeSession.was_deafened) {
                updateData.time_deafened = activeSession.time_deafened + timeDelta;
            } else if (activeSession.was_muted) {
                updateData.time_muted = activeSession.time_muted + timeDelta;
            } else {
                updateData.time_speaking = activeSession.time_speaking + timeDelta;
                updateData.time_listening = activeSession.time_listening + timeDelta;
            }

            // Update the session
            await db.voiceTracking.update({
                where: { id: activeSession.id },
                data: updateData
            });

            // Calculate total session time
            const totalTime = Math.floor((now.getTime() - activeSession.joined_at.getTime()) / 1000);
            console.log(`[VoiceTracking] ⏱️ Total session time: ${totalTime}s`);

            // Update cumulative stats
            console.log(`[VoiceTracking] 📊 Updating cumulative stats...`);
            await db.voiceUserStats.update({
                where: {
                    guild_id_user_id: {
                        guild_id: guildId,
                        user_id: userId
                    }
                },
                data: {
                    total_time_in_vc: { increment: totalTime },
                    total_time_speaking: { increment: updateData.time_speaking || activeSession.time_speaking },
                    total_time_muted: { increment: updateData.time_muted || activeSession.time_muted },
                    total_time_deafened: { increment: updateData.time_deafened || activeSession.time_deafened },
                    total_time_listening: { increment: updateData.time_listening || activeSession.time_listening }
                }
            });
            console.log(`[VoiceTracking] ✅ Successfully updated stats on leave`);
        } catch (error) {
            console.error('[VoiceTracking] ❌ Error handling voice leave:', error);
        }
    }

    /**
     * Handle voice state changes (mute/unmute/deafen/undeafen)
     */
    async handleStateChange(guildId: string, userId: string, oldState: VoiceState, newState: VoiceState): Promise<void> {
        console.log(`[VoiceTracking] 🟡 handleStateChange called - Guild: ${guildId}, User: ${userId}`);
        try {
            // Find active session
            const activeSession = await db.voiceTracking.findFirst({
                where: {
                    guild_id: guildId,
                    user_id: userId,
                    left_at: null
                },
                orderBy: {
                    joined_at: 'desc'
                }
            });

            if (!activeSession) return;

            const now = new Date();
            const timeDelta = Math.floor((now.getTime() - activeSession.last_state_change.getTime()) / 1000);

            const wasMuted = oldState.mute || oldState.selfMute || false;
            const wasDeafened = oldState.deaf || oldState.selfDeaf || false;
            const isMuted = newState.mute || newState.selfMute || false;
            const isDeafened = newState.deaf || newState.selfDeaf || false;
            console.log(`[VoiceTracking] 🎤 State: wasMuted=${wasMuted}, wasDeaf=${wasDeafened} -> isMuted=${isMuted}, isDeaf=${isDeafened}, timeDelta=${timeDelta}s`);

            // Calculate time for previous state
            let updateData: any = {
                last_state_change: now,
                was_muted: isMuted,
                was_deafened: isDeafened
            };

            // Add time to appropriate category
            if (wasDeafened) {
                updateData.time_deafened = activeSession.time_deafened + timeDelta;
            } else if (wasMuted) {
                updateData.time_muted = activeSession.time_muted + timeDelta;
            } else {
                updateData.time_speaking = activeSession.time_speaking + timeDelta;
                updateData.time_listening = activeSession.time_listening + timeDelta;
            }

            await db.voiceTracking.update({
                where: { id: activeSession.id },
                data: updateData
            });
            console.log(`[VoiceTracking] ✅ State change tracked successfully`);
        } catch (error) {
            console.error('[VoiceTracking] ❌ Error handling voice state change:', error);
        }
    }

    /**
     * Get voice statistics for a user
     */
    async getUserStats(guildId: string, userId: string): Promise<any> {
        console.log(`[VoiceTracking] 📊 Getting stats for Guild: ${guildId}, User: ${userId}`);
        const stats = await db.voiceUserStats.findUnique({
            where: {
                guild_id_user_id: {
                    guild_id: guildId,
                    user_id: userId
                }
            }
        });
        console.log(`[VoiceTracking] ${stats ? '✅ Stats found' : '⚠️ No stats found'} for user ${userId}`);
        if (stats) {
            console.log(`[VoiceTracking] Stats: ${stats.total_sessions} sessions, ${stats.total_time_in_vc}s total time`);
        }
        return stats;
    }

    /**
     * Get leaderboard by total time in voice
     */
    async getLeaderboard(guildId: string, limit: number = 10): Promise<any[]> {
        return await db.voiceUserStats.findMany({
            where: {
                guild_id: guildId,
                total_time_in_vc: { gt: 0 }
            },
            orderBy: {
                total_time_in_vc: 'desc'
            },
            take: limit
        });
    }

    /**
     * Get leaderboard by speaking time
     */
    async getSpeakingLeaderboard(guildId: string, limit: number = 10): Promise<any[]> {
        return await db.voiceUserStats.findMany({
            where: {
                guild_id: guildId,
                total_time_speaking: { gt: 0 }
            },
            orderBy: {
                total_time_speaking: 'desc'
            },
            take: limit
        });
    }

    /**
     * Reset stats for a user
     */
    async resetUserStats(guildId: string, userId: string): Promise<void> {
        await db.voiceUserStats.deleteMany({
            where: {
                guild_id: guildId,
                user_id: userId
            }
        });
    }

    /**
     * Reset all stats for a guild
     */
    async resetGuildStats(guildId: string): Promise<void> {
        await db.voiceUserStats.deleteMany({
            where: { guild_id: guildId }
        });
        await db.voiceTracking.deleteMany({
            where: { guild_id: guildId }
        });
    }
}

export const voiceTrackingService = new VoiceTrackingService();
