import { Context } from '../../core/context';
import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { Command } from '../../core/command';
import { db } from '../../data/db';

const TICK = '<:tickYes:1469272837192814623>';
const CROSS = '<:cross:1469273232929456314>';

export const ModLogSetup: Command = {
    name: 'modlogsetup',
    description: 'Set the channel for moderation logs',
    category: 'Admin',
    syntax: 'modlogsetup <channel>',
    example: 'modlogsetup #mod-logs',
    permissions: [PermissionFlagsBits.Administrator],
    execute: async (ctx: Context, args: string[]) => {
        if (!ctx.inner.guild) return;

        const channelInput = args[0];
        if (!channelInput) {
            const embed = new EmbedBuilder()
                .setDescription(`${CROSS} Please provide a channel for mod logs.\n**Usage:** \`modlogsetup #channel\``);
            await ctx.reply({ embeds: [embed] });
            return;
        }

        const channelId = channelInput.replace(/^<#|>/g, '');
        const channel = ctx.inner.guild.channels.cache.get(channelId);

        if (!channel || !channel.isTextBased()) {
            const embed = new EmbedBuilder()
                .setDescription(`${CROSS} Invalid channel. Please provide a valid text channel.`);
            await ctx.reply({ embeds: [embed] });
            return;
        }

        try {
            // @ts-ignore - modConfig is generated
            await db.modConfig.upsert({
                where: { guild_id: ctx.guildId },
                update: { log_channel_id: channelId },
                create: { guild_id: ctx.guildId, log_channel_id: channelId }
            });

            const embed = new EmbedBuilder()
                .setDescription(`${TICK} Moderation logs will now be sent to <#${channelId}>.`);
            await ctx.reply({ embeds: [embed] });

        } catch (error: any) {
            const embed = new EmbedBuilder()
                .setDescription(`${CROSS} Failed to set log channel: ${error.message}`);
            await ctx.reply({ embeds: [embed] });
        }
    }
};
