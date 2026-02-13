import { Context } from '../../core/context';
import { db } from '../../data/db';
import { Resolver } from '../../util/Resolver';
import { PermissionFlagsBits, ChannelType } from 'discord.js';
import { Command } from '../../core/command';
import { hasPermission } from '../../util/permissions';
import { client } from '../../core/discord';

export const TicketClear: Command = {
    name: 'ticket-clear',
    description: 'Delete all tickets, channels, and records for a user',
    category: 'Mail',
    syntax: 'ticket-clear <user>',
    example: 'ticket-clear @David',
    permissions: [PermissionFlagsBits.ManageGuild],
    execute: async (ctx: Context, args: string[]) => {
        if (!ctx.inner.guild || !ctx.inner.member) return;
        const perms = ctx.inner.member.permissions;
        const hasPerm = TicketClear.permissions.some(p => hasPermission(perms, p));
        if (!hasPerm) return;

        const targetInput = args[0];
        if (!targetInput) {
            await ctx.reply({ content: 'Please provide a user to clear tickets for.', ephemeral: true });
            return;
        }

        const targetUser = await Resolver.getUser(targetInput);
        if (!targetUser) {
            await ctx.reply({ content: 'User not found.', ephemeral: true });
            return;
        }

        await ctx.reply(`⚠️ **Processing...** Checking tickets for <@${targetUser.id}>...`);

        try {
            // 1. Fetch all tickets for this user in this guild
            const tickets = await db.ticket.findMany({
                where: {
                    guild_id: ctx.guildId,
                    user_id: targetUser.id
                }
            });

            if (tickets.length === 0) {
                await ctx.reply({ content: 'No tickets found for this user.' });
                return;
            }

            let channelsDeleted = 0;
            let ticketsDeleted = 0;

            // 2. Loop and destroy
            for (const ticket of tickets) {
                // A. Delete Channel if exists
                if (ticket.channel_id) {
                    try {
                        const channel = await ctx.inner.guild.channels.fetch(ticket.channel_id).catch(() => null);
                        if (channel) {
                            await channel.delete('Ticket Clear Command');
                            channelsDeleted++;
                        }
                    } catch (e) {
                        console.error(`Failed to delete channel ${ticket.channel_id}:`, e);
                    }
                }

                // B. Messages preserved (User request)
                // await db.ticketMessage.deleteMany({ where: { ticket_id: ticket.ticket_id } });

                // C. Delete Ticket
                await db.ticket.delete({
                    where: { ticket_id: ticket.ticket_id }
                });

                ticketsDeleted++;
            }

            await ctx.reply(`✅ **Success**: Cleared **${ticketsDeleted}** tickets and deleted **${channelsDeleted}** channels for <@${targetUser.id}>.`);

        } catch (e: any) {
            console.error(e);
            await ctx.reply(`❌ Error clearing tickets: ${e.message}`);
        }
    }
};
