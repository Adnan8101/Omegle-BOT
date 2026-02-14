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

            // Try by ID first (fetch if not in cache)
            let channel = guild.channels.cache.get(channelId);
            if (!channel && /^\d+$/.test(channelId)) {
                try {
                    channel = await guild.channels.fetch(channelId);
                } catch (e) {
                    // Channel not found
                }
            }
            
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
                
                // Look for text channel with same name in same parent category
                const associatedTextChannel = guild.channels.cache.find(ch => 
                    ch.type === ChannelType.GuildText &&
                    ch.parentId === voiceChannel.parentId &&
                    (ch.name.toLowerCase() === voiceChannel.name.toLowerCase() ||
                     ch.name.toLowerCase().includes(voiceChannel.name.toLowerCase()))
                ) as TextChannel;
                
                if (associatedTextChannel) {
                    targetChannel = associatedTextChannel;
                }
            }
        } else {
            // Get current channel and handle all text-based types
            let channel = guild.channels.cache.get(ctx.channelId);
            if (!channel) {
                try {
                    channel = await guild.channels.fetch(ctx.channelId);
                } catch (e) {
                    // Channel not found
                }
            }
            
            if (channel?.type === ChannelType.GuildText || 
                channel?.type === ChannelType.PublicThread ||
                channel?.type === ChannelType.PrivateThread) {
                targetChannel = channel as TextChannel;
            }
        }

        if (!targetChannel) {
            const embed = new EmbedBuilder()
                .setColor(0x2b2d31)
                .setDescription(`${CROSS} This command only works in text channels or you need to specify a channel`);
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
