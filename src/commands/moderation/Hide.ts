import { Context } from '../../core/context';
import { EmbedBuilder, PermissionFlagsBits, ChannelType, TextChannel, User } from 'discord.js';
import { Command } from '../../core/command';
import { canPerformAction } from '../../util/rolePermissions';
import { ModLogger } from '../../services/logging/ModLogger';


const TICK = '<:tickYes:1469272837192814623>';
const CROSS = '<:cross:1469273232929456314>';

export const Hide: Command = {
    name: 'hide',
    description: 'Hide a channel from @everyone',
    category: 'Moderation',
    syntax: 'hide [channel]',
    example: 'hide #staff',
    permissions: [PermissionFlagsBits.ManageChannels],
    modAction: 'hide',
    execute: async (ctx: Context, args: string[]) => {
        await ctx.defer();
        const guild = ctx.inner.guild;
        const member = ctx.inner.member;

        if (!guild || !member) {
            const embed = new EmbedBuilder()
                .setColor(0x2b2d31)
            .setDescription(`${CROSS} Server only`);
            await ctx.reply({ embeds: [embed] });
            return;
        }



        let targetChannel: TextChannel | undefined;

        if (args.length > 0) {
            const channelInput = args[0];
            const channelMatch = channelInput.match(/^<#(\d+)>$/);
            const channelId = channelMatch ? channelMatch[1] : channelInput;

            const channel = guild.channels.cache.get(channelId);
            if (channel?.type === ChannelType.GuildText) {
                targetChannel = channel as TextChannel;
            }
        } else {
            const channel = guild.channels.cache.get(ctx.channelId);
            if (channel?.type === ChannelType.GuildText) {
                targetChannel = channel as TextChannel;
            }
        }

        if (!targetChannel) {
            const embed = new EmbedBuilder()
                .setColor(0x2b2d31)
            .setDescription(`${CROSS} Channel not found`);
            await ctx.reply({ embeds: [embed] });
            return;
        }

        try {
            await targetChannel.permissionOverwrites.edit(guild.roles.everyone, {
                ViewChannel: false
            });

            const embed = new EmbedBuilder()
                .setColor(0x2b2d31)
            .setDescription(`👁️ ${TICK} **Hidden** ${targetChannel}`);
            await ctx.reply({ embeds: [embed] });

            // Log action
            await ModLogger.log(guild, member.user as User, targetChannel.toString(), 'Hide', null, { channel: targetChannel.toString() });
        } catch (error: any) {
            const embed = new EmbedBuilder()
                .setColor(0x2b2d31)
            .setDescription(`${CROSS} ${error.message}`);
            await ctx.reply({ embeds: [embed] });
        }
    }
};
