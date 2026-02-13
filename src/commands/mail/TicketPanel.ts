import { Context } from '../../core/context';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, Colors, ChannelType } from 'discord.js';
import { Command } from '../../core/command';

export const TicketPanel: Command = {
    name: 'ticketpanel',
    description: 'Send the ticket creation panel',
    category: 'Mail',
    syntax: 'ticketpanel [title]',
    example: 'ticketpanel "Contact Support"',
    permissions: [PermissionFlagsBits.Administrator],
    execute: async (ctx: Context, args: string[]) => {
        if (!ctx.inner.guild) return;

        const title = args.length > 0 ? args.join(' ') : 'Create a Ticket';

        const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription('Click the button below to contact support.')
            .setFooter({ text: ctx.inner.guild.name, iconURL: ctx.inner.guild.iconURL() || undefined });

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`mail_create_${ctx.guildId}`)
                .setLabel('Create Ticket')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('📩')
        );

        const channel = ctx.inner.channel;
        if (channel && channel.type === ChannelType.GuildText) {
            await channel.send({ embeds: [embed], components: [row] });
            await ctx.reply({ content: 'Panel sent!', ephemeral: true });
        } else {
            await ctx.reply({ content: 'Could not send panel to this channel (must be a text channel).', ephemeral: true });
        }
    }
};
