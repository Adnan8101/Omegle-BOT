import { Message, PermissionFlagsBits, EmbedBuilder, Colors, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Command } from '../../core/command';
import { Context } from '../../core/context';
import { db } from '../../data/db';

export const SuggestionConfig: Command = {
    name: 'suggestionconfig',
    description: 'Configure the suggestion system',
    category: 'Admin',
    syntax: 'suggestionconfig <enable|disable|channel>',
    example: 'suggestionconfig enable or suggestionconfig channel #suggestions',
    permissions: [PermissionFlagsBits.Administrator],
    execute: async (ctx: Context, args: string[]): Promise<void> => {
        const message = ctx.inner as Message;
        if (!message.guild || !message.member) return;

        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            await message.react('❌');
            return;
        }

        if (args.length === 0) {
            await message.reply('Usage: `!suggestionconfig <enable|disable|channel|show> [channel_id]`');
            return;
        }

        const action = args[0].toLowerCase();

        let config = await db.suggestionConfig.findUnique({
            where: { guild_id: message.guild.id }
        });

        if (action === 'show') {
            if (!config) {
                const embed = new EmbedBuilder()
                    .setTitle('Suggestion System')
                    .setDescription('Not configured yet. Use `!suggestionconfig enable` to get started')
                    .setTimestamp();
                await message.reply({ embeds: [embed] });
                return;
            }

            const statusIcon = config.enabled ? '✅' : '❌';
            const statusText = config.enabled ? 'Enabled' : 'Disabled';

            const embed = new EmbedBuilder()
                .setTitle('Suggestion System')
                .addFields(
                    { name: 'Status', value: `${statusIcon} ${statusText}`, inline: true },
                    { name: 'Channel', value: config.channel_id ? `<#${config.channel_id}>` : 'Not set', inline: true }
                )
                .setFooter({ text: 'Use the Suggest button to submit' })
                .setTimestamp();

            await message.reply({ embeds: [embed] });
            return;
        }

        if (action === 'enable') {
            if (!config) {
                config = await db.suggestionConfig.create({
                    data: {
                        guild_id: message.guild.id,
                        enabled: true
                    }
                });
            } else {
                config = await db.suggestionConfig.update({
                    where: { guild_id: message.guild.id },
                    data: { enabled: true }
                });
            }

            // Create sticky message if channel is configured
            if (config.channel_id) {
                const channel = await message.guild.channels.fetch(config.channel_id).catch(() => null);
                if (channel?.isTextBased()) {
                    // Delete old sticky if exists
                    if (config.sticky_message_id) {
                        try {
                            const oldSticky = await channel.messages.fetch(config.sticky_message_id);
                            await oldSticky.delete();
                        } catch (e) {
                            // Old sticky might already be deleted
                        }
                    }

                    // Create new sticky
                    const stickyEmbed = new EmbedBuilder()
                        .setTitle('Suggestions')
                        .setDescription('Click the button below to submit a suggestion!');

                    const button = new ButtonBuilder()
                        .setCustomId('suggest_button')
                        .setLabel('Suggest')
                        .setStyle(ButtonStyle.Secondary);

                    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

                    const stickyMessage = await channel.send({
                        embeds: [stickyEmbed],
                        components: [row]
                    });

                    // Update config with sticky message ID
                    await db.suggestionConfig.update({
                        where: { guild_id: message.guild.id },
                        data: { sticky_message_id: stickyMessage.id }
                    });
                }
            }

            const embed = new EmbedBuilder()
                .setDescription('Suggestion System Enabled\n\nUsers can now submit suggestions using the button in the configured channel.')
                .setTimestamp();

            await message.reply({ embeds: [embed] });
            return;
        }

        if (action === 'disable') {
            if (!config) {
                await message.reply('Suggestion system is not configured yet.');
                return;
            }

            await db.suggestionConfig.update({
                where: { guild_id: message.guild.id },
                data: { enabled: false }
            });

            const embed = new EmbedBuilder()
                .setDescription('Suggestion System Disabled')
                .setTimestamp();

            await message.reply({ embeds: [embed] });
            return;
        }

        if (action === 'channel') {
            const channelId = args[1]?.replace(/[<#>]/g, '');
            if (!channelId) {
                await message.reply('Please provide a channel ID or mention.');
                return;
            }

            const channel = message.guild.channels.cache.get(channelId);
            if (!channel || !channel.isTextBased()) {
                await message.reply('Invalid text channel.');
                return;
            }

            if (!config) {
                await db.suggestionConfig.create({
                    data: {
                        guild_id: message.guild.id,
                        enabled: false,
                        channel_id: channelId
                    }
                });
            } else {
                await db.suggestionConfig.update({
                    where: { guild_id: message.guild.id },
                    data: { channel_id: channelId }
                });
            }

            const embed = new EmbedBuilder()
                .setDescription(`Channel Set to <#${channelId}>`)
                .setTimestamp();

            await message.reply({ embeds: [embed] });
            return;
        }

        await message.reply('Usage: `!suggestionconfig <enable|disable|channel|show> [channel_id]`');
    }
};
