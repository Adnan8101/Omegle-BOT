import { Context } from '../../core/context';
import { mailService } from '../../services/mail/MailService';
import { PermissionFlagsBits } from 'discord.js';
import { Command } from '../../core/command';

export const Unclaim: Command = {
    name: 'unclaim',
    description: 'Release claim on the current ticket',
    category: 'Mail',
    syntax: 'unclaim',
    example: 'unclaim',
    permissions: [PermissionFlagsBits.ManageMessages],
    execute: async (ctx: Context, args: string[]) => {
        if (!ctx.inner.guild || !ctx.inner.channel || !ctx.inner.member) return;

        const ticket = await mailService.getTicketByChannel(ctx.inner.channel.id);
        if (!ticket) {
            await ctx.reply({ content: 'This is not a ticket channel.', ephemeral: true });
            return;
        }

        if (ticket.status !== 'claimed') {
            await ctx.reply({ content: 'Ticket is not claimed.', ephemeral: true });
            return;
        }

        // Only claimer or admin
        const perms = ctx.inner.member.permissions;
        const isAdmin = typeof perms !== 'string' && perms.has(PermissionFlagsBits.Administrator);

        if (ticket.claimed_by !== ctx.authorId && !isAdmin) {
            await ctx.reply({ content: 'You can only unclaim your own tickets.', ephemeral: true });
            return;
        }

        await mailService.unclaimTicket(ticket.ticket_id);
        await ctx.reply('Ticket unclaimed. Now open for others.');
    }
};
