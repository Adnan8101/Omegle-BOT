import { Context } from '../../core/context';
import { mailService } from '../../services/mail/MailService';
import { PermissionFlagsBits, TextChannel, EmbedBuilder } from 'discord.js';
import { Command } from '../../core/command';
import { client } from '../../core/discord';
import { TranscriptGenerator } from '../../services/mail/TranscriptGenerator';

const TICK = '<:tickYes:1469272837192814623>';

export const Close: Command = {
    name: 'close',
    description: 'Close the current ticket',
    category: 'Mail',
    syntax: 'close',
    example: 'close',
    permissions: [PermissionFlagsBits.ManageMessages],
    execute: async (ctx: Context, args: string[]) => {
        if (!ctx.inner.guild || !ctx.inner.channel) return;

        const ticket = await mailService.getTicketByChannel(ctx.inner.channel.id);
        if (!ticket) {
            await ctx.reply({ content: 'This is not a ticket channel.', ephemeral: true });
            return;
        }

        if (ticket.status === 'closed') {
            await ctx.reply({ content: 'Ticket already closed.', ephemeral: true });
            return;
        }

        await mailService.closeTicket(ticket.ticket_id);

        // Generate Transcript
        const messages = await mailService.getTicketMessages(ticket.ticket_id);
        const html = TranscriptGenerator.generateHTML(messages as any, ticket.ticket_id, ctx.inner.guild.name);

        const config = await mailService.getGuildConfig(ctx.guildId);
        if (config?.transcript_channel_id) {
            const tChannel = client.channels.cache.get(config.transcript_channel_id) as TextChannel;
            if (tChannel) {
                const targetUser = await client.users.fetch(ticket.user_id).catch(() => null);
                const transcriptEmbed = new EmbedBuilder()
                    .setColor(0x2B2D31)
                    .setDescription(
                        `${TICK} **Ticket Closed**\n\n` +
                        `**User:** ${targetUser ? `${targetUser.username} (\`${ticket.user_id}\`)` : ticket.user_id}\n` +
                        `**Closed by:** <@${ctx.authorId}>\n` +
                        `**Ticket ID:** ${ticket.ticket_id}`
                    )
                    .setTimestamp();

                await tChannel.send({
                    embeds: [transcriptEmbed],
                    files: [{
                        attachment: Buffer.from(html),
                        name: `transcript-${ticket.ticket_id}.html`
                    }]
                });
            }
        }

        await ctx.reply({ content: `${TICK} Ticket closed. Transcript saved. Channel will be deleted in 5 seconds.` });

        // Auto-delete channel after 5 seconds
        const channel = ctx.inner.channel as TextChannel;
        setTimeout(async () => {
            try {
                await channel.delete();
            } catch (err) {
                console.error('Failed to delete ticket channel:', err);
            }
        }, 5000);
    }
};
