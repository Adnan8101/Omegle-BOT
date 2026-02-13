import { Events, Message, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import { client } from '../core/discord';
import { mailService } from '../services/mail/MailService';
import { db } from '../data/db';

client.on(Events.MessageCreate, async (message: Message) => {
    if (message.author.bot) return;
    if (message.channel.type === ChannelType.DM) return;

    const ticket = await mailService.getTicketByChannel(message.channel.id);
    if (!ticket) return;

    if (ticket.status === 'closed') return;

    if (message.content.trim().startsWith('!')) {
        await mailService.logMessage(ticket.ticket_id, 'staff', message.author.id, message.content, {
            attachments: message.attachments.map(a => ({ url: a.url, name: a.name, contentType: a.contentType })),
            embeds: message.embeds.map(e => e.toJSON()),
            author_name: message.author.username,
            author_avatar: message.author.displayAvatarURL(),
            author_role_color: message.member?.displayHexColor || '#f2f3f5'
        });
        await message.react('🚫');
        return;
    }

    const targetUser = await client.users.fetch(ticket.user_id).catch(() => null);
    if (!targetUser) {
        await message.react('❌');
        return;
    }

    try {
        await targetUser.send({
            content: `${message.content}`,
            files: message.attachments.map(a => a.url)
        });

        await mailService.logMessage(ticket.ticket_id, 'staff', message.author.id, message.content, {
            attachments: message.attachments.map(a => ({ url: a.url, name: a.name, contentType: a.contentType })),
            embeds: message.embeds.map(e => e.toJSON()),
            author_name: message.author.username,
            author_avatar: message.author.displayAvatarURL(),
            author_role_color: message.member?.displayHexColor || '#f2f3f5'
        });
        await message.react('✅');

    } catch (e: any) {
        await message.reply(`Failed to send DM: ${e.message}`);
    }
});
