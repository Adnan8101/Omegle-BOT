import { VoiceState, TextChannel, PermissionFlagsBits } from 'discord.js';
import { pendingDrags } from '../commands/moderation/AutoDrag';

export async function handleVoiceStateUpdate(oldState: VoiceState, newState: VoiceState) {
    // Check if user joined a voice channel
    if (!oldState.channel && newState.channel) {
        const dragId = `${newState.guild.id}-${newState.member?.id}`;
        const pendingDrag = pendingDrags.get(dragId);

        if (!pendingDrag) return;

        // Check if drag has expired
        if (Date.now() > pendingDrag.expiresAt) {
            pendingDrags.delete(dragId);
            return;
        }

        try {
            const targetChannel = newState.guild.channels.cache.get(pendingDrag.targetVoiceChannelId!);
            
            if (!targetChannel || targetChannel.type !== 2) {
                pendingDrags.delete(dragId);
                return;
            }

            // Check bot permissions
            const botMember = newState.guild.members.me;
            if (!botMember) return;

            const botPermissions = targetChannel.permissionsFor(botMember);
            if (!botPermissions?.has(PermissionFlagsBits.MoveMembers) || 
                !botPermissions?.has(PermissionFlagsBits.Connect)) {
                pendingDrags.delete(dragId);
                
                // Notify executor
                const notifyChannel = newState.guild.channels.cache.get(pendingDrag.channelId) as TextChannel;
                if (notifyChannel) {
                    await notifyChannel.send(`Failed to drag <@${pendingDrag.targetUserId}>: Missing permissions.`);
                }
                return;
            }

            // Move the user
            await newState.member?.voice.setChannel(targetChannel);

            // Clean up
            pendingDrags.delete(dragId);

            // Notify executor
            const notifyChannel = newState.guild.channels.cache.get(pendingDrag.channelId) as TextChannel;
            if (notifyChannel) {
                const message = await notifyChannel.messages.fetch(pendingDrag.messageId).catch(() => null);
                if (message) {
                    await message.react('✅');
                }
                await notifyChannel.send(
                    `Successfully dragged <@${pendingDrag.targetUserId}> to ${targetChannel.name}`
                );
            }
        } catch (error) {
            pendingDrags.delete(dragId);
            
            // Notify executor of failure
            const notifyChannel = newState.guild.channels.cache.get(pendingDrag.channelId) as TextChannel;
            if (notifyChannel) {
                await notifyChannel.send(`Failed to drag <@${pendingDrag.targetUserId}>: ${error}`);
            }
        }
    }
}
