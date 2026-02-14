import { Events, VoiceState } from 'discord.js';
import { client } from '../core/discord';
import { activityLogService } from '../services/logging/ActivityLogService';
import { voiceTrackingService } from '../services/voice/VoiceTrackingService';

client.on(Events.VoiceStateUpdate, async (oldState: VoiceState, newState: VoiceState) => {
    // Determine action
    const member = newState.member || oldState.member;
    if (!member || member.user.bot) return;

    const guildId = member.guild.id;
    const userId = member.id;

    // Join
    if (!oldState.channelId && newState.channelId) {
        await activityLogService.logVoiceJoin(guildId, userId, newState.channelId);
        await voiceTrackingService.handleJoin(guildId, userId, newState.channelId, newState);
    }
    // Leave
    else if (oldState.channelId && !newState.channelId) {
        await activityLogService.logVoiceLeave(guildId, userId, oldState.channelId);
        await voiceTrackingService.handleLeave(guildId, userId);
    }
    // Switch
    else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
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
            await voiceTrackingService.handleStateChange(guildId, userId, oldState, newState);
        }
    }
});
