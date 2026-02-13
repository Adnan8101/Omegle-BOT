import { Message, PermissionFlagsBits, EmbedBuilder, Colors } from 'discord.js';
import { Command } from '../../core/command';
import { Context } from '../../core/context';
import { db } from '../../data/db';
import { Resolver } from '../../util/Resolver';
import { manageWvAllowedRole } from '../admin/WvAllowedRole';

export const WhereVoice: Command = {
    name: 'wv',
    description: 'Find which voice channel a user is in',
    category: 'Utility',
    syntax: 'wv <user> or reply with !wv',
    example: 'wv @user or wv 123456789',
    permissions: [],
    execute: async (ctx: Context, args: string[]): Promise<void> => {
        await ctx.defer();

        // Handle allowed role management
        if (args[0]?.toLowerCase() === 'allowed') {
            await manageWvAllowedRole(ctx, args.slice(1));
            return;
        }

        const guild = ctx.inner.guild;
        if (!guild) return;

        const member = ctx.inner.member;
        if (!member) return;

        const allowedRoles = await db.wVAllowedRole.findMany({
            where: { guild_id: guild.id }
        });

        const memberRoles = Array.from(member.roles instanceof Map ? member.roles.keys() : (member.roles as any).cache.keys());

        // Check if user has moderator/admin permissions
        const hasModerationPerms = typeof member.permissions === 'string'
            ? false
            : (member.permissions.has(PermissionFlagsBits.ModerateMembers) ||
                member.permissions.has(PermissionFlagsBits.Administrator));

        // If no roles configured, only moderators can use it
        // If roles configured, check if user has one of those roles OR is a moderator
        const hasAllowedRole = allowedRoles.length === 0
            ? hasModerationPerms
            : (allowedRoles.some((ar: any) => memberRoles.includes(ar.role_id)) || hasModerationPerms);

        // Check permission
        if (!hasAllowedRole) {
            return;
        }

        // Get target user
        let targetUserId: string | null = null;

        // For Message context, check reply
        const message = ctx.inner as Message;
        if (message.reference) {
            const repliedMessage = await message.channel?.messages.fetch(message.reference.messageId!).catch(() => null);
            if (repliedMessage) {
                targetUserId = repliedMessage.author.id;
            }
        }

        // User mentioned
        if (!targetUserId && message.mentions?.users?.size > 0) {
            targetUserId = message.mentions.users.first()!.id;
        }

        // User ID provided
        if (!targetUserId && args[0]) {
            const user = await Resolver.getUser(args[0]);
            if (user) {
                targetUserId = user.id;
            }
        }

        if (!targetUserId) {
            await ctx.reply('Please mention a user, reply to their message, or provide a user ID.');
            return;
        }

        // Find user in voice
        const targetMember = await guild.members.fetch(targetUserId).catch(() => null);
        if (!targetMember) {
            await ctx.reply('User not found.');
            return;
        }

        if (targetMember.voice.channel) {
            await ctx.reply(`${targetMember.user.username} <#${targetMember.voice.channel.id}>`);
        } else {
            await ctx.reply('🔇 User is not in a voice channel.');
        }
    }
};
