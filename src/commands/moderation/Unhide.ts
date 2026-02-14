import { Context } from '../../core/context';
import { EmbedBuilder, PermissionFlagsBits, ChannelType, TextChannel, VoiceChannel, User } from 'discord.js';
import { Command } from '../../core/command';
import { canPerformAction } from '../../util/rolePermissions';
import { ModLogger } from '../../services/logging/ModLogger';


const TICK = '<:tickYes:1469272837192814623>';
const CROSS = '<:cross:1469273232929456314>';

export const Unhide: Command = {
    name: 'unhide',
    description: 'Unhide a channel to @everyone',
    category: 'Moderation',
    syntax: 'unhide [channel]',
    example: 'unhide\nunhide #general\nunhide 123456789',
    permissions: [PermissionFlagsBits.ManageChannels],
    modAction: 'unhide',
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
            const channelInput = args.join(' ');
            
            // Try channel mention
            const channelMatch = channelInput.match(/^<#(\d+)>$/);
            const channelId = channelMatch ? channelMatch[1] : channelInput;

            // Try by ID first
            let channel = guild.channels.cache.get(channelId);
            
            // If not found, try by name
            if (!channel) {
                channel = guild.channels.cache.find(ch => 
                    ch.name.toLowerCase() === channelInput.toLowerCase().replace('#', '')
                );
            }

            if (channel?.type === ChannelType.GuildText) {
                targetChannel = channel as TextChannel;
            } else if (channel?.type === ChannelType.GuildVoice) {
                // For voice channels, find the associated text channel
                const voiceChannel = channel as VoiceChannel;
                const textChannels = guild.channels.cache.filter(ch => 
                    ch.type === ChannelType.GuildText && 
                    ch.parentId === voiceChannel.id
                );
                if (textChannels.size > 0) {
                    targetChannel = textChannels.first() as TextChannel;
                }
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
                ViewChannel: null
            });

            const embed = new EmbedBuilder()
                .setColor(0x2b2d31)
                .setDescription(`${TICK} **Unhidden** ${targetChannel}`);
            await ctx.reply({ embeds: [embed] });

            // Log action
            await ModLogger.log(guild, member.user as User, targetChannel.toString(), 'Unhide', null, { channel: targetChannel.toString() });
        } catch (error: any) {
            const embed = new EmbedBuilder()
                .setColor(0x2b2d31)
                .setDescription(`${CROSS} ${error.message}`);
            await ctx.reply({ embeds: [embed] });
        }
    }
};
