import { db } from '../../data/db';
import { mailService } from './MailService';
import { TextChannel } from 'discord.js';
import { client } from '../../core/discord';

/**
 * Fetch and send pending message when ticket is opened
 */
export async function sendPendingMessage(
    ticketId: string,
    guildId: string,
    userId: string,
    channel: TextChannel,
    username: string,
    avatarURL: string
) {
    const pendingMessage = await db.pendingMailMessage.findUnique({
        where: {
            guild_id_user_id: {
                guild_id: guildId,
                user_id: userId
            }
        }
    });

    if (!pendingMessage) return;

    // Log the message to ticket history
    await mailService.logMessage(ticketId, 'user', userId, pendingMessage.content, {
        attachments: pendingMessage.attachments as any,
        author_name: username,
        author_avatar: avatarURL,
        author_role_color: '#f2f3f5'
    });

    // Send via webhook for better formatting
    try {
        const webhooks = await channel.fetchWebhooks();
        let webhook = webhooks.find(w => w.name === 'MailBot Relay');

        if (!webhook) {
            webhook = await channel.createWebhook({
                name: 'MailBot Relay',
                avatar: client.user?.displayAvatarURL()
            });
        }

        const attachments = pendingMessage.attachments as any;
        await webhook.send({
            username: username,
            avatarURL: avatarURL,
            content: pendingMessage.content,
            files: attachments?.map((a: any) => a.url) || []
        });
    } catch (err) {
        // Fallback to regular message
        await channel.send(`**${username}**: ${pendingMessage.content}`);
    }

    // Delete the pending message
    await db.pendingMailMessage.delete({
        where: {
            guild_id_user_id: {
                guild_id: guildId,
                user_id: userId
            }
        }
    });
}
