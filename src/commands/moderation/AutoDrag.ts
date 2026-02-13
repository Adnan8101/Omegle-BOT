import { Message, VoiceChannel, PermissionFlagsBits } from 'discord.js';
import { Command } from '../../core/command';
import { Context } from '../../core/context';

interface PendingDrag {
    targetUserId: string;
    targetVoiceChannelId: string | null;
    executorVoiceChannelId: string | null;
    executorId: string;
    messageId: string;
    channelId: string;
    guildId: string;
    expiresAt: number;
}

export const pendingDrags = new Map<string, PendingDrag>();

// Cleanup expired drags every minute
setInterval(() => {
    const now = Date.now();
    for (const [key, drag] of pendingDrags.entries()) {
        if (now > drag.expiresAt) {
            pendingDrags.delete(key);
        }
    }
}, 60000);

export const AutoDrag: Command = {
    name: 'ad',
    description: 'Auto-drag a user to your VC or specified VC when they join',
    category: 'Moderation',
    syntax: 'ad <user> [vc_id/name]',
    example: 'ad @user 123456789 or ad @user Voice Channel',
    permissions: [PermissionFlagsBits.MoveMembers],
    modAction: 'autodrag',
    execute: async (ctx: Context, args: string[]): Promise<void> => {
        await ctx.defer();
        const message = ctx.inner as Message;
        if (!message.guild || !message.member) return;

        // Check if user has Move Members permission
        if (!message.member.permissions.has(PermissionFlagsBits.MoveMembers)) {
            await message.react('❌');
            return;
        }

        if (args.length === 0) {
            await message.reply('Usage: `!ad <user> [vc_id/name]`');
            return;
        }

        // Parse target user
        const userMention = args[0];
        const userId = userMention.replace(/[<@!>]/g, '');
        const targetMember = await message.guild.members.fetch(userId).catch(() => null);

        if (!targetMember) {
            await message.reply('User not found.');
            return;
        }

        let targetVoiceChannel: VoiceChannel | null = null;

        // Check if VC is provided
        if (args.length > 1) {
            const vcIdentifier = args.slice(1).join(' ');

            // Try to find by ID first
            targetVoiceChannel = message.guild.channels.cache.get(vcIdentifier) as VoiceChannel;

            // If not found by ID, try regex search by name
            if (!targetVoiceChannel || targetVoiceChannel.type !== 2) {
                const regex = new RegExp(vcIdentifier, 'i');
                const channels = message.guild.channels.cache.filter(
                    ch => ch.type === 2 && regex.test(ch.name)
                );

                if (channels.size > 0) {
                    targetVoiceChannel = channels.first() as VoiceChannel;
                }
            }

            if (!targetVoiceChannel) {
                await message.reply('Voice channel not found.');
                return;
            }

            // Check bot permissions for target VC
            const botMember = message.guild.members.me;
            if (!botMember) return;

            const botPermissions = targetVoiceChannel.permissionsFor(botMember);
            if (!botPermissions?.has(PermissionFlagsBits.MoveMembers) ||
                !botPermissions?.has(PermissionFlagsBits.Connect)) {
                await message.react('❌');
                await message.reply('I don\'t have permissions to move members to that voice channel.');
                return;
            }
        } else {
            // No VC provided, use executor's current VC
            if (!message.member.voice.channel) {
                await message.reply('You must be in a voice channel to use this command without specifying a target VC.');
                return;
            }
            targetVoiceChannel = message.member.voice.channel as VoiceChannel;
        }

        // Check if target user is already in a VC
        if (targetMember.voice.channel) {
            // Immediate drag
            try {
                await targetMember.voice.setChannel(targetVoiceChannel);
                await message.react('✅');
                await message.reply(`${targetMember.user.username} dragged to ${targetVoiceChannel.name}`);
            } catch (error) {
                await message.react('❌');
                await message.reply('Failed to move user. Check permissions.');
            }
        } else {
            // Setup pending drag
            const dragId = `${message.guild.id}-${targetMember.id}`;
            const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

            pendingDrags.set(dragId, {
                targetUserId: targetMember.id,
                targetVoiceChannelId: targetVoiceChannel.id,
                executorVoiceChannelId: message.member.voice.channel?.id || null,
                executorId: message.author.id,
                messageId: message.id,
                channelId: message.channel.id,
                guildId: message.guild.id,
                expiresAt
            });

            await message.react('⏳');
            await message.reply(
                `Waiting for ${targetMember.user.username} to join a voice channel. ` +
                `Will drag them to ${targetVoiceChannel.name}. Expires in 5 minutes.`
            );
        }
    }
}
