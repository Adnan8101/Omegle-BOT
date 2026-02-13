import { Context } from '../../core/context';
import { afkService } from '../../services/afk/AfkService';
import {
    EmbedBuilder, Colors, PermissionFlagsBits,
    ActionRowBuilder, StringSelectMenuBuilder, ComponentType,
    ChannelType, RoleSelectMenuBuilder, ChannelSelectMenuBuilder, ButtonBuilder, ButtonStyle
} from 'discord.js';
import { Command } from '../../core/command';
import { hasPermission } from '../../util/permissions';

export const AfkSettings: Command = {
    name: 'afksettings',
    description: 'Configure AFK system settings',
    category: 'AFK',
    syntax: 'afksettings',
    example: 'afksettings',
    permissions: [PermissionFlagsBits.ManageGuild],
    execute: async (ctx: Context, args: string[]) => {
        if (!ctx.inner.member) return;
        const perms = ctx.inner.member.permissions;
        const hasPerm = AfkSettings.permissions.some(p => hasPermission(perms, p));

        if (!hasPerm) return;

        // Fetch current settings
        const settings = await afkService.getSettings(ctx.guildId);

        const getEmbed = (s: typeof settings) => {
            return new EmbedBuilder()
                .setTitle('AFK Configuration')
                .setDescription(
                    `**System Status:** ${s.enabled ? '<:tickYes:1469272837192814623> Enabled' : '<:cross:1469273232929456314> Disabled'}\n\n` +
                    '**Configuration Rules:**\n' +
                    '- **Roles:** strict list. If empty, **NO ONE** can use AFK. Select `@everyone` to allow all.\n' +
                    '- **Channels:** loose list. If empty, AFK works in **ALL** channels.\n\n' +
                    `**Allowed Channels:** ${s.allowed_channels.length ? s.allowed_channels.map((c: string) => `<#${c}>`).join(', ') : 'All'}\n` +
                    `**Allowed Roles:** ${s.allowed_roles.length ? s.allowed_roles.map((r: string) => `<@&${r}>`).join(', ') : 'None (System Paused)'}`
                );
        };

        // Channel Select Menu
        const channelSelect = new ChannelSelectMenuBuilder()
            .setCustomId('afk_allowed_channels')
            .setPlaceholder('Select Allowed Channels (Clear to allow all)')
            .setMinValues(0)
            .setMaxValues(25)
            .addChannelTypes(ChannelType.GuildText);

        // Role Select Menu
        const roleSelect = new RoleSelectMenuBuilder()
            .setCustomId('afk_allowed_roles')
            .setPlaceholder('Select Allowed Roles (Clear to allow all)')
            .setMinValues(0)
            .setMaxValues(25);

        // Toggle Button
        const toggleBtn = new ButtonBuilder()
            .setCustomId('afk_toggle')
            .setLabel(settings.enabled ? 'Disable System' : 'Enable System')
            .setStyle(settings.enabled ? ButtonStyle.Danger : ButtonStyle.Success);

        const row1 = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(channelSelect);
        const row2 = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(roleSelect);
        const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(toggleBtn);

        const response = await ctx.reply({ embeds: [getEmbed(settings)], components: [row1, row2, row3] });

        const message = response instanceof require('discord.js').Message ? response : await (ctx.inner as any).fetchReply();

        const collector = message.createMessageComponentCollector({
            filter: (i: any) => i.user.id === ctx.authorId,
            time: 60000
        });

        collector.on('collect', async (i: any) => {
            // i is Interaction
            let newChannels = settings.allowed_channels;
            let newRoles = settings.allowed_roles;
            let newEnabled = settings.enabled;

            if (i.isAnySelectMenu()) {
                if (i.customId === 'afk_allowed_channels') {
                    newChannels = i.values;
                } else if (i.customId === 'afk_allowed_roles') {
                    newRoles = i.values;
                }
            } else if (i.isButton()) {
                if (i.customId === 'afk_toggle') {
                    newEnabled = newEnabled ? 0 : 1;
                }
            }

            await afkService.updateSettings(ctx.guildId, newChannels, newRoles, newEnabled);

            // Refresh embed
            const newSettings = await afkService.getSettings(ctx.guildId);

            // Update local cache for collector
            settings.allowed_channels = newSettings.allowed_channels;
            settings.allowed_roles = newSettings.allowed_roles;
            settings.enabled = newSettings.enabled;

            // Update components
            const updatedBtn = new ButtonBuilder()
                .setCustomId('afk_toggle')
                .setLabel(newSettings.enabled ? 'Disable System' : 'Enable System')
                .setStyle(newSettings.enabled ? ButtonStyle.Danger : ButtonStyle.Success);

            const updatedRow3 = new ActionRowBuilder<ButtonBuilder>().addComponents(updatedBtn);

            await i.update({ embeds: [getEmbed(newSettings)], components: [row1, row2, updatedRow3] });
        });

        collector.on('end', () => {
            message.edit({ components: [] }).catch(() => { });
        });
    }
};
