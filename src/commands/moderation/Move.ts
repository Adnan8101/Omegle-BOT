import { Context } from '../../core/context';
import { Resolver } from '../../util/Resolver';
import { PermissionFlagsBits, GuildMember, ChannelType, BaseGuildVoiceChannel, Message, User } from 'discord.js';
import { Command } from '../../core/command';
import { ModLogger } from '../../services/logging/ModLogger';

const TICK = '<:tickYes:1469272837192814623>';
const SPEAKER_OFF = '🔇';

export const Move: Command = {
    name: 'move',
    description: 'Moves a user to a voice channel or to another user\'s VC',
    category: 'Moderator Utils',
    syntax: 'move <user> [channel_or_@user]',
    example: 'move @User | move @User #vc | move @User @User2',
    permissions: [PermissionFlagsBits.MoveMembers],
    modAction: 'move',
    execute: async (ctx: Context, args: string[]) => {
        if (!ctx.inner.guild || !ctx.inner.member) return;

        const guild = ctx.inner.guild;
        const requesterMember = ctx.inner.member as GuildMember;
        let targetMember: GuildMember | null = null;
        let targetChannel: BaseGuildVoiceChannel | null = null;

        // --- 1. Resolve Target User (mention, ID, username, or reply) ---
        if (args.length > 0) {
            targetMember = await Resolver.getMember(guild, args[0]);
        }

        // If no target from args, check if replying to a message
        if (!targetMember && ctx.inner instanceof Message && ctx.inner.reference?.messageId) {
            try {
                const refMsg = await ctx.inner.channel!.messages.fetch(ctx.inner.reference.messageId);
                if (refMsg) {
                    targetMember = await guild.members.fetch(refMsg.author.id).catch(() => null);
                }
            } catch (e) {
                // ignore
            }
        }

        if (!targetMember) {
            if (ctx.inner instanceof Message) await ctx.inner.react(SPEAKER_OFF).catch(() => {});
            return;
        }

        // --- 2. Check target is in a voice channel ---
        if (!targetMember.voice.channel) {
            if (ctx.inner instanceof Message) await ctx.inner.react(SPEAKER_OFF).catch(() => {});
            return;
        }

        // --- 3. Resolve Target Channel ---
        if (args.length > 1) {
            const channelInput = args.slice(1).join(' ');

            // Check if 2nd arg is a user mention/ID → !mv @user1 @user2
            const secondMember = await Resolver.getMember(guild, args[1]);
            if (secondMember) {
                // Dual-user mode: drag first user to second user's VC
                if (!secondMember.voice.channel) {
                    // 2nd user is not in a VC → react speaker off
                    if (ctx.inner instanceof Message) await ctx.inner.react(SPEAKER_OFF).catch(() => {});
                    return;
                }

                targetChannel = secondMember.voice.channel as BaseGuildVoiceChannel;

                // Author must have perms in that VC
                const authorPerms = targetChannel.permissionsFor(requesterMember);
                if (!authorPerms || !authorPerms.has(PermissionFlagsBits.Connect)) {
                    if (ctx.inner instanceof Message) await ctx.inner.react(SPEAKER_OFF).catch(() => {});
                    return;
                }
            } else {
                // Channel mode: try by ID first, then Resolver (name / fuzzy)
                let channel = guild.channels.cache.get(channelInput) ?? null;

                if (!channel) {
                    const resolved = await Resolver.getChannel(guild, channelInput);
                    if (resolved && resolved.type !== ChannelType.DM && resolved.type !== ChannelType.GroupDM) {
                        channel = resolved as any;
                    }
                }

                if (!channel || (channel.type !== ChannelType.GuildVoice && channel.type !== ChannelType.GuildStageVoice)) {
                    if (ctx.inner instanceof Message) await ctx.inner.react(SPEAKER_OFF).catch(() => {});
                    return;
                }

                targetChannel = channel as BaseGuildVoiceChannel;
            }
        } else {
            // Default: move to requester's current VC
            if (!requesterMember.voice.channel) {
                if (ctx.inner instanceof Message) await ctx.inner.react(SPEAKER_OFF).catch(() => {});
                return;
            }
            targetChannel = requesterMember.voice.channel;
        }

        // --- 4. Permission checks ---
        const botMember = guild.members.me;
        if (!botMember) return;

        // Bot permissions in target channel
        const botPerms = targetChannel.permissionsFor(botMember);
        if (!botPerms || !botPerms.has(PermissionFlagsBits.MoveMembers) || !botPerms.has(PermissionFlagsBits.Connect)) {
            if (ctx.inner instanceof Message) await ctx.inner.react(SPEAKER_OFF).catch(() => {});
            return;
        }

        // Author permissions in target channel
        const authorPerms = targetChannel.permissionsFor(requesterMember);
        if (!authorPerms || !authorPerms.has(PermissionFlagsBits.Connect)) {
            if (ctx.inner instanceof Message) await ctx.inner.react(SPEAKER_OFF).catch(() => {});
            return;
        }

        // --- 5. Move the user ---
        try {
            await targetMember.voice.setChannel(targetChannel.id);

            const replyMsg = `${TICK} **${targetMember.user.username}** moved to **${targetChannel.name}**`;
            await ctx.reply({ content: replyMsg });

            // Log to mod log channel
            await ModLogger.log(
                guild,
                requesterMember.user as User,
                targetMember.user,
                'Move',
                null,
                { channel: targetChannel.name }
            ).catch(() => {});
        } catch (err: any) {
            if (ctx.inner instanceof Message) await ctx.inner.react(SPEAKER_OFF).catch(() => {});
        }
    }
};
