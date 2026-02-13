import { Context } from '../../core/context';
import { db } from '../../data/db';
import { EmbedBuilder, Colors, PermissionFlagsBits, ChannelType, ActionRowBuilder, ChannelSelectMenuBuilder, RoleSelectMenuBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
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

        // Check if a staff message is being set via args: !setupmail message <text>
        if (args.length >= 2 && args[0].toLowerCase() === 'message') {
            const staffMessage = args.slice(1).join(' ');
            await db.mailConfig.upsert({
                where: { guild_id: ctx.guildId },
                update: { staff_message: staffMessage },
                create: {
                    guild_id: ctx.guildId,
                    inbox_category_id: '',
                    enabled: false,
                    staff_message: staffMessage
                }
            });
            await ctx.reply({ content: `<:tickYes:1469272837192814623> Staff message updated:\n> ${staffMessage}` });
            return;
        }

        const embed = new EmbedBuilder()
            
            .setTitle('📨 ModMail Setup Wizard')
            .setDescription(
                'Configure the ModMail system using the menus below.\n\n' +
                '**Required:**\n' +
                '• **Opening Category** — Where new tickets are created\n' +
                '• **Transcript Channel** — Where transcripts are sent\n' +
                '• **Staff Roles** — Roles that can see & respond to tickets\n\n' +
                '**Optional:**\n' +
                '• **Closing Category** — Category to move closed tickets to\n\n' +
                '**Staff Message:**\n' +
                'Use `!setupmail message <your message>` to set a custom greeting shown in every new ticket.'
            );

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

        // 4. Staff Role Select
        const row4 = new ActionRowBuilder<RoleSelectMenuBuilder>()
            .addComponents(
                new RoleSelectMenuBuilder()
                    .setCustomId('setup_staff_roles')
                    .setPlaceholder('Select Staff Roles (Required)')
                    .setMinValues(1)
                    .setMaxValues(5)
            );

        // 5. Save Button
        const row5 = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('setup_save')
                    .setLabel('Save Configuration')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('💾')
            );

        await ctx.reply({
            embeds: [embed],
            components: [row1, row2, row3, row4, row5]
        });
    }
};