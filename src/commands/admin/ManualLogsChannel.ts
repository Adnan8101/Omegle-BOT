import { Context } from '../../core/context';
import { Command } from '../../core/command';
import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { manualService } from '../../services/manual/ManualService';
import { EMBED_COLOR } from '../../util/embedColors';

const TICK = '<:tickYes:1469272837192814623>';
const CROSS = '<:cross:1469273232929456314>';

export const ManualLogsChannel: Command = {
    name: 'manual-logs-channel',
    description: 'Set the channel for manual logs (webhook)',
    category: 'Admin',
    syntax: 'manual-logs-channel <channel>',
    example: '/manual-logs-channel #manuals-logs',
    permissions: [PermissionFlagsBits.Administrator],
    execute: async (ctx: Context, args: string[]) => {
        await ctx.defer();

        if (!args[0]) {
            // Show current config
            const config = await manualService.getConfig(ctx.guildId);
            if (config?.log_channel_id) {
                const embed = new EmbedBuilder()
                    .setColor(EMBED_COLOR)
                    .setDescription(
                        `${TICK} **Manual Logs Configuration**\n\n` +
                        `**Log Channel:** <#${config.log_channel_id}>`
                    );
                await ctx.reply({ embeds: [embed] });
            } else {
                await ctx.reply({ content: `${CROSS} No manual logs channel configured.\n**Usage:** \`/manual-logs-channel #channel\`` });
            }
            return;
        }

        // Parse channel ID from mention or raw ID
        const channelId = args[0].replace(/<#|>/g, '');
        const channel = ctx.inner.guild?.channels.cache.get(channelId);

        if (!channel) {
            await ctx.reply({ content: `${CROSS} Channel not found.` });
            return;
        }

        if (!channel.isTextBased()) {
            await ctx.reply({ content: `${CROSS} Please select a text channel.` });
            return;
        }

        await manualService.setLogChannel(ctx.guildId, channelId);

        const embed = new EmbedBuilder()
            .setColor(EMBED_COLOR)
            .setDescription(
                `${TICK} **Manual Logs Channel Set**\n\n` +
                `All manual entries will now be logged to <#${channelId}> via webhook.`
            );

        await ctx.reply({ embeds: [embed] });
    }
};
