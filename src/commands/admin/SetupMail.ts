import { Context } from '../../core/context';
import { db } from '../../data/db';
import { EmbedBuilder, Colors, PermissionFlagsBits, ChannelType, ActionRowBuilder, ChannelSelectMenuBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import { Command } from '../../core/command';

export const SetupMail: Command = {
    name: 'setupmail',
    description: 'Configure the ModMail system interactively',
    category: 'Admin',
    syntax: 'setupmail',
    example: 'setupmail',
    permissions: [PermissionFlagsBits.Administrator],
    execute: async (ctx: Context, args: string[]) => {
        if (!ctx.inner.guild) return;

        const embed = new EmbedBuilder()
            .setTitle('📨 ModMail Setup Wizard')
            .setDescription('Please configure the ModMail system using the menus below.\n\n**Required:**\n• **Opening Category**: Where new tickets are created.\n• **Transcript Channel**: Where transcripts are sent.\n\n**Optional:**\n• **Closing Category**: Category to move closed tickets to (if enabled).');

        // 1. Inbox Category Select
        const row1 = new ActionRowBuilder<ChannelSelectMenuBuilder>()
            .addComponents(
                new ChannelSelectMenuBuilder()
                    .setCustomId('setup_cat_open')
                    .setPlaceholder('Select Opening Category (Required)')
                    .setChannelTypes(ChannelType.GuildCategory)
            );

        // 2. Closed Category Select
        const row2 = new ActionRowBuilder<ChannelSelectMenuBuilder>()
            .addComponents(
                new ChannelSelectMenuBuilder()
                    .setCustomId('setup_cat_close')
                    .setPlaceholder('Select Closing Category (Optional)')
                    .setChannelTypes(ChannelType.GuildCategory)
            );

        // 3. Transcript Channel Select
        const row3 = new ActionRowBuilder<ChannelSelectMenuBuilder>()
            .addComponents(
                new ChannelSelectMenuBuilder()
                    .setCustomId('setup_chan_trans')
                    .setPlaceholder('Select Transcript Channel (Required)')
                    .setChannelTypes(ChannelType.GuildText)
            );

        // 4. Save Button
        const row4 = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('setup_save')
                    .setLabel('Save Configuration')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('💾')
            );

        await ctx.reply({
            embeds: [embed],
            components: [row1, row2, row3, row4]
        });
    }
};
