import { Context } from '../../core/context';
import { mailService } from '../../services/mail/MailService';
import { PermissionFlagsBits } from 'discord.js';
import { Command } from '../../core/command';

export const Claim: Command = {
    name: 'claim',
    description: 'Claim the current ticket',
    category: 'Mail',
    syntax: 'claim',
    example: 'claim',
    permissions: [PermissionFlagsBits.ManageMessages],
    execute: async (ctx: Context, args: string[]) => {
        if (!ctx.inner.guild || !ctx.inner.channel) return;

        const ticket = await mailService.getTicketByChannel(ctx.inner.channel.id);
        if (!ticket) {
            await ctx.reply({ content: 'This is not a ticket channel.', ephemeral: true });
            return;
        }

        if (ticket.status !== 'open') {
            await ctx.reply({ content: 'Ticket is not open for claiming.', ephemeral: true });
            return;
        }

        await mailService.claimTicket(ticket.ticket_id, ctx.authorId);
        await ctx.reply(`<:tickYes:1469272837192814623> Ticket claimed by <@${ctx.authorId}>.`);
    }
};
