import { Context } from '../../core/context';
import { Resolver } from '../../util/Resolver';
import { EmbedBuilder, PermissionFlagsBits, GuildMember, VoiceChannel, ChannelType, StageChannel, BaseGuildVoiceChannel, Message, User } from 'discord.js';
import { Command } from '../../core/command';
import { hasPermission } from '../../util/permissions';
import { hasModRole } from '../../util/modRole';
import { ModLogger } from '../../services/logging/ModLogger';

const TICK = '<:tickYes:1469272837192814623>';

export const Move: Command = {
    name: 'move',
    description: 'Moves a user to a voice channel',
    category: 'Moderator Utils',
    syntax: 'move <user> [voice_channel]',
    example: 'move @User General',
    permissions: [PermissionFlagsBits.MoveMembers],
    modAction: 'move',
    execute: async (ctx: Context, args: string[]) => {
        await ctx.defer();
        if (!ctx.inner.member) return;

        let targetMember: GuildMember | null = null;
        let argsOffset = 0;

        // 1. Resolve Target
        if (args.length > 0) {
            targetMember = await Resolver.getMember(ctx.inner.guild!, args[0]);
            if (targetMember) argsOffset = 1;
        }

        // 2. If no target from args, check Reply
        // Remove 'instanceof Message' check to be safe against potential duplicate djs instances or proxies
        const msg = ctx.inner as Message;
        if (!targetMember && msg.reference?.messageId) {
            try {
                const refMsg = await ctx.inner.channel!.messages.fetch(msg.reference.messageId);
                if (refMsg) {
                    targetMember = await ctx.inner.guild!.members.fetch(refMsg.author.id).catch(() => null);
                }
            } catch (e) {
                console.error('Error fetching reply reference:', e);
            }
        }

        if (!targetMember) {
            await ctx.reply({ content: 'Usage: move <user> [voice_channel] (or reply to a user)', ephemeral: true });
            return;
        }

        if (!targetMember.voice.channel) {
            await ctx.reply({ content: '<:cross:1469273232929456314> Target user is not in a voice channel.', ephemeral: true });
            return;
        }

        // 3. Resolve Target Channel
        let targetChannel: BaseGuildVoiceChannel | null = null;
        const requesterMember = ctx.inner.member as GuildMember;

        // If args exist after target was resolved from args, use them.
        // If target came from Reply, check args from 0.
        // If target came from args[0], check args from 1.

        const channelInput = args.slice(argsOffset).join(' '); // Remaining args

        if (!channelInput) {
            // Option 1: Move to current VC
            if (!requesterMember.voice.channel) {
                await ctx.reply({ content: '<:cross:1469273232929456314> You are not in a voice channel. Please specify a target channel.', ephemeral: true });
                return;
            }
            targetChannel = requesterMember.voice.channel;
        } else {
            // Option 2: Move to specific VC
            const channel = await Resolver.getChannel(ctx.inner.guild!, channelInput);
            if (!channel || (channel.type !== ChannelType.GuildVoice && channel.type !== ChannelType.GuildStageVoice)) {
                await ctx.reply({ content: '<:cross:1469273232929456314> Voice channel not found.', ephemeral: true });
                return;
            }
            targetChannel = channel as BaseGuildVoiceChannel;
        }

        // Logic Check: Check if author has permission in target VC
        if (!targetChannel.permissionsFor(requesterMember).has(PermissionFlagsBits.MoveMembers) && !requesterMember.permissions.has(PermissionFlagsBits.MoveMembers)) {
            if (!targetChannel.permissionsFor(requesterMember).has(PermissionFlagsBits.Connect)) {
                await ctx.reply({ content: '<:cross:1469273232929456314> You do not have access to the target voice channel.', ephemeral: true });
                return;
            }
        }

        try {
            await targetMember.voice.setChannel(targetChannel.id);
            const embed = new EmbedBuilder()
                .setDescription(`${TICK} **Moved** ${targetMember.user.username}\n\nDragged to **${targetChannel.name}**`);

            await ctx.reply({ embeds: [embed] });

            // Log action
            await ModLogger.log(ctx.inner.guild!, ctx.inner.member.user as User, targetMember.user, 'Move', null, {
                channel: targetChannel.name,
                role: targetChannel.id
            });
        } catch (err: any) {
            await ctx.reply({ content: `Failed to move user: ${err.message}`, ephemeral: true });
        }
    }
};
