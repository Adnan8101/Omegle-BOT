import { Context } from '../../core/context';
import { Resolver } from '../../util/Resolver';
import { PermissionFlagsBits, GuildMember, ChannelType, BaseGuildVoiceChannel, Message, User } from 'discord.js';
import { Command } from '../../core/command';
import { ModLogger } from '../../services/logging/ModLogger';

const TICK = '<:tickYes:1469272837192814623>';
const SPEAKER_OFF = '🔇';

export const Move: Command = {
    name: 'move',
    description: 'Moves a user to a voice channel',
    category: 'Moderator Utils',
    syntax: 'move <user> [voice_channel_id_or_name]',
    example: 'move @User or move @User 1234567890 or move @User General',
    permissions: [PermissionFlagsBits.MoveMembers],
    modAction: 'move',
    execute: async (ctx: Context, args: string[]) => {
        console.log(`[Move] Command executed by ${ctx.inner.member?.user ? (ctx.inner.member.user as User).username : 'unknown'} with args: [${args.join(', ')}]`);
        
        if (!ctx.inner.guild || !ctx.inner.member) return;

        let targetMember: GuildMember | null = null;
        let targetChannel: BaseGuildVoiceChannel | null = null;
        const requesterMember = ctx.inner.member as GuildMember;

        // 1. Resolve Target User
        if (args.length > 0) {
            // Try to resolve user from first argument
            targetMember = await Resolver.getMember(ctx.inner.guild, args[0]);
        }

        // 2. If no target from args, check if replying to a message
        if (!targetMember && ctx.inner instanceof Message && ctx.inner.reference?.messageId) {
            try {
                const refMsg = await ctx.inner.channel!.messages.fetch(ctx.inner.reference.messageId);
                if (refMsg) {
                    targetMember = await ctx.inner.guild.members.fetch(refMsg.author.id).catch(() => null);
                }
            } catch (e) {
                console.error('[Move] Error fetching reply reference:', e);
            }
        }

        if (!targetMember) {
            console.log(`[Move] No target member found, reacting with mute icon`);
            if (ctx.inner instanceof Message) {
                await ctx.inner.react(SPEAKER_OFF).catch(console.error);
            }
            return;
        }

        console.log(`[Move] Target user: ${targetMember.user.tag}`);

        // Check if target user is in a voice channel
        if (!targetMember.voice.channel) {
            console.log(`[Move] Target user ${targetMember.user.tag} is not in a voice channel`);
            if (ctx.inner instanceof Message) {
                await ctx.inner.react(SPEAKER_OFF).catch(console.error);
            }
            return;
        }

        // 3. Resolve Target Channel
        if (args.length > 1) {
            // Specific channel provided (could be ID or name)
            const channelInput = args.slice(1).join(' ');
            console.log(`[Move] Looking for channel: ${channelInput}`);
            
            // Try by ID first
            let channel = ctx.inner.guild.channels.cache.get(channelInput);
            
            // If not found by ID, try by name using Resolver
            if (!channel) {
                const resolvedChannel = await Resolver.getChannel(ctx.inner.guild, channelInput);
                if (resolvedChannel && resolvedChannel.type !== ChannelType.DM && resolvedChannel.type !== ChannelType.GroupDM) {
                    channel = resolvedChannel;
                }
            }
            
            if (!channel || (channel.type !== ChannelType.GuildVoice && channel.type !== ChannelType.GuildStageVoice)) {
                console.log(`[Move] Voice channel not found: ${channelInput}`);
                if (ctx.inner instanceof Message) {
                    await ctx.inner.react(SPEAKER_OFF).catch(console.error);
                }
                return;
            }
            
            targetChannel = channel as BaseGuildVoiceChannel;
        } else {
            // No channel specified, move to requester's current VC
            if (!requesterMember.voice.channel) {
                console.log(`[Move] Requester not in a voice channel and no channel specified`);
                if (ctx.inner instanceof Message) {
                    await ctx.inner.react(SPEAKER_OFF).catch(console.error);
                }
                return;
            }
            targetChannel = requesterMember.voice.channel;
        }

        console.log(`[Move] Target channel: ${targetChannel.name} (${targetChannel.id})`);

        // Check bot permissions
        const botMember = ctx.inner.guild.members.me;
        if (!botMember) return;
        
        const botPerms = targetChannel.permissionsFor(botMember);
        if (!botPerms || !botPerms.has(PermissionFlagsBits.MoveMembers) || !botPerms.has(PermissionFlagsBits.Connect)) {
            console.log(`[Move] Bot lacks permissions in ${targetChannel.name}`);
            if (ctx.inner instanceof Message) {
                await ctx.inner.react(SPEAKER_OFF).catch(console.error);
            }
            return;
        }

        // Move the user
        try {
            console.log(`[Move] Moving ${targetMember.user.tag} to ${targetChannel.name}`);
            await targetMember.voice.setChannel(targetChannel.id);
            
            // Send success message
            const replyMessage = `${TICK} **${targetMember.user.username}** have been moved to **${targetChannel.name}**`;
            console.log(`[Move] Success: ${replyMessage}`);
            await ctx.reply({ content: replyMessage });

            // Log the action
            console.log(`[Move] Logging moderation action`);
            await ModLogger.log(
                ctx.inner.guild,
                ctx.inner.member.user as User,
                targetMember.user,
                'Move',
                null,
                {
                    channel: targetChannel.name,
                    role: targetChannel.id
                }
            ).catch(e => console.error('[Move] Logging error:', e));
            
        } catch (err: any) {
            console.error(`[Move] Error moving user:`, err);
            if (ctx.inner instanceof Message) {
                await ctx.inner.react(SPEAKER_OFF).catch(console.error);
            }
        }
    }
};
