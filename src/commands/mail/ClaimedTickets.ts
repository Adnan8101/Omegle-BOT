import { Context } from '../../core/context';
import { mailService } from '../../services/mail/MailService';
import { EmbedBuilder, Colors, PermissionFlagsBits } from 'discord.js';
import { Command } from '../../core/command';

export const ClaimedTickets: Command = {
    name: 'claimedtickets',
    description: 'List all currently claimed tickets',
    category: 'Mail',
    syntax: 'claimedtickets',
    example: 'claimedtickets',
    permissions: [PermissionFlagsBits.ManageMessages],
    execute: async (ctx: Context, args: string[]) => {
        if (!ctx.inner.guild) return;

        const tickets = await mailService.getClaimedTickets(ctx.guildId);

        if (tickets.length === 0) {
            await ctx.reply({ content: 'No claimed tickets found.', ephemeral: true });
            return;
        }

        const embed = new EmbedBuilder()
            .setColor(0x2b2d31)
        .setTitle(`Claimed Tickets (${tickets.length})`);

        // Group by staff? or just list
        // Let's just list top 20 for now to avoid size limits
        const list = tickets.slice(0, 20).map(t => {
            return `• <#${t.channel_id}> - Claimed by <@${t.claimed_by}>`;
        }).join('\n');

        embed.setDescription(list);
        if (tickets.length > 20) {
            embed.setFooter({ text: `...and ${tickets.length - 20} more.` });
        }

        await ctx.reply({ embeds: [embed] });
    }
};
