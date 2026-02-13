import { Events, VoiceState } from 'discord.js';
import { client } from '../core/discord';
import { activityLogService } from '../services/logging/ActivityLogService';

client.on(Events.VoiceStateUpdate, async (oldState: VoiceState, newState: VoiceState) => {
    // Determine action
    const member = newState.member || oldState.member;
    if (!member || member.user.bot) return;

    const guildId = member.guild.id;
    const userId = member.id;

    // Join
    if (!oldState.channelId && newState.channelId) {
        await activityLogService.logVoiceJoin(guildId, userId, newState.channelId);
    }
    // Leave
    else if (oldState.channelId && !newState.channelId) {
        await activityLogService.logVoiceLeave(guildId, userId, oldState.channelId);
    }
    // Switch
    else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
        // Treat as Leave Old -> Join New
        await activityLogService.logVoiceLeave(guildId, userId, oldState.channelId);
        await activityLogService.logVoiceJoin(guildId, userId, newState.channelId);
    }
});
