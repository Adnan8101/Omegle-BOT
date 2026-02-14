import { Events, VoiceState, ChannelType } from 'discord.js';
import { client } from '../core/discord';
import { activityLogService } from '../services/logging/ActivityLogService';
import { voiceTrackingService } from '../services/voice/VoiceTrackingService';

// Initialize tracking for users already in voice channels when bot starts
client.once(Events.ClientReady, async () => {
    console.log('🎙️ Initializing voice tracking for existing voice channel members...');
    
    try {
        for (const guild of client.guilds.cache.values()) {
            const voiceChannels = guild.channels.cache.filter(
                ch => ch.type === ChannelType.GuildVoice || ch.type === ChannelType.GuildStageVoice
            );
            
            for (const channel of voiceChannels.values()) {
                if (!('members' in channel)) continue;
                
                for (const member of channel.members.values()) {
                    if (member.user.bot) continue;
                    
                    const voiceState = member.voice;
                    if (voiceState.channelId) {
                        await voiceTrackingService.handleJoin(
                            guild.id,
                            member.id,
                            voiceState.channelId,
                            voiceState
                        );
                    }
                }
            }
        }
        
        console.log('✅ Voice tracking initialized for all existing members');
    } catch (error) {
        console.error('❌ Error initializing voice tracking:', error);
    }
});

client.on(Events.VoiceStateUpdate, async (oldState: VoiceState, newState: VoiceState) => {
    // Determine action
    const member = newState.member || oldState.member;
    if (!member) {
        console.log('[VoiceLogger] ⚠️ No member found in voice state update');
        return;
    }
    if (member.user.bot) {
        console.log(`[VoiceLogger] 🤖 Ignoring bot: ${member.user.username}`);
        return;
    }

    const guildId = member.guild.id;
    const userId = member.id;
    console.log(`[VoiceLogger] 👤 Event for ${member.user.username} (${userId}) in guild ${guildId}`);
    console.log(`[VoiceLogger] 📍 Old channel: ${oldState.channelId || 'none'}, New channel: ${newState.channelId || 'none'}`);

    // Join
    if (!oldState.channelId && newState.channelId) {
        console.log(`[VoiceLogger] ➡️ User JOINED voice channel ${newState.channelId}`);
        await activityLogService.logVoiceJoin(guildId, userId, newState.channelId);
        await voiceTrackingService.handleJoin(guildId, userId, newState.channelId, newState);
    }
    // Leave
    else if (oldState.channelId && !newState.channelId) {
        console.log(`[VoiceLogger] ⬅️ User LEFT voice channel ${oldState.channelId}`);
        await activityLogService.logVoiceLeave(guildId, userId, oldState.channelId);
        await voiceTrackingService.handleLeave(guildId, userId);
    }
    // Switch
    else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
        console.log(`[VoiceLogger] 🔄 User SWITCHED from ${oldState.channelId} to ${newState.channelId}`);
        // Treat as Leave Old -> Join New
        await activityLogService.logVoiceLeave(guildId, userId, oldState.channelId);
        await activityLogService.logVoiceJoin(guildId, userId, newState.channelId);
        await voiceTrackingService.handleLeave(guildId, userId);
        await voiceTrackingService.handleJoin(guildId, userId, newState.channelId, newState);
    }
    // State change (mute/deafen)
    else if (oldState.channelId && newState.channelId) {
        const muteChanged = (oldState.mute !== newState.mute) || (oldState.selfMute !== newState.selfMute);
        const deafenChanged = (oldState.deaf !== newState.deaf) || (oldState.selfDeaf !== newState.selfDeaf);
        
        if (muteChanged || deafenChanged) {
            console.log(`[VoiceLogger] 🎙️ User STATE CHANGED - mute: ${muteChanged}, deafen: ${deafenChanged}`);
            await voiceTrackingService.handleStateChange(guildId, userId, oldState, newState);
        } else {
            console.log(`[VoiceLogger] ℹ️ State update but no mute/deafen change`);
        }
    }
});
