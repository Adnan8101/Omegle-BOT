import { Events, VoiceState } from 'discord.js';
import { client } from '../core/discord';
import { voiceChannelRoleService } from '../services/voice/VoiceChannelRoleService';

client.on(Events.VoiceStateUpdate, async (oldState: VoiceState, newState: VoiceState) => {
    if (!newState.guild) return;

    const guildId = newState.guild.id;
    const member = newState.member;
    if (!member) return;

    // User left a voice channel
    if (oldState.channelId && (!newState.channelId || oldState.channelId !== newState.channelId)) {
        try {
            const mapping = await voiceChannelRoleService.getMapping(guildId, oldState.channelId);
            if (mapping && member.roles.cache.has(mapping.role_id)) {
                await member.roles.remove(mapping.role_id).catch((err) => {
                    console.error(`Failed to remove role ${mapping.role_id} from ${member.id}:`, err);
                });
            }
        } catch (err) {
            console.error('Error handling voice channel leave:', err);
        }
    }

    // User joined a voice channel
    if (newState.channelId && (!oldState.channelId || oldState.channelId !== newState.channelId)) {
        try {
            const mapping = await voiceChannelRoleService.getMapping(guildId, newState.channelId);
            if (mapping && !member.roles.cache.has(mapping.role_id)) {
                await member.roles.add(mapping.role_id).catch((err) => {
                    console.error(`Failed to add role ${mapping.role_id} to ${member.id}:`, err);
                });
            }
        } catch (err) {
            console.error('Error handling voice channel join:', err);
        }
    }
});

export {};
