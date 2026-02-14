import { Context } from '../../core/context';
import { mailService } from '../../services/mail/MailService';
import { EmbedBuilder, Colors, PermissionFlagsBits } from 'discord.js';
import { Command } from '../../core/command';
import { parseSmartDuration } from '../../util/time';

export const InactiveMails: Command = {
    name: 'inactivemails',
    description: 'List tickets with no activity for a specified duration',
    category: 'Mail',
    syntax: 'inactivemails <duration>',
    example: 'inactivemails 24h',
    permissions: [PermissionFlagsBits.ManageMessages],
    execute: async (ctx: Context, args: string[]) => {
        if (!ctx.inner.guild) return;

        const { durationSeconds } = parseSmartDuration(args);

        if (!durationSeconds) {
            await ctx.reply({ content: 'Invalid duration. Use 1h, 1d, etc.', ephemeral: true });
            return;
        }

        const ms = durationSeconds * 1000;
        const durationStr = args.join(' ');

        const olderThan = new Date(Date.now() - ms);
        const tickets = await mailService.getInactiveTickets(ctx.guildId, olderThan);

        if (tickets.length === 0) {
            await ctx.reply({ content: `No inactive tickets found (older than ${durationStr}).`, ephemeral: true });
            return;
        }

        const embed = new EmbedBuilder()
            .setColor(0x2b2d31)
        .setTitle(`Inactive Tickets (> ${durationStr})`)
            .setDescription(tickets.slice(0, 20).map(t => `• <#${t.channel_id}> (User: <@${t.user_id}>)`).join('\n'));

        if (tickets.length > 20) {
            embed.setFooter({ text: `...and ${tickets.length - 20} more.` });
        }

        await ctx.reply({ embeds: [embed] });
    }
};
