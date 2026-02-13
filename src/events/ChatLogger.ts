
import { Events, Message } from 'discord.js';
import { client } from '../core/discord';
import { activityLogService } from '../services/logging/ActivityLogService';

client.on(Events.MessageCreate, async (message: Message) => {
    if (message.author.bot || !message.guild) return;

    await activityLogService.logChatActivity(
        message.guild.id,
        message.author.id,
        message.channel.id,
        message.id,
        message.content.length
    );
});
