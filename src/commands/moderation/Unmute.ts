import { Context } from '../../core/context';
import { Resolver } from '../../util/Resolver';
import { EmbedBuilder, User, PermissionFlagsBits } from 'discord.js';
import { Command } from '../../core/command';
import { canPerformAction } from '../../util/rolePermissions';
import { ModLogger } from '../../services/logging/ModLogger';

const TICK = '<:tickYes:1469272837192814623>';

export const Unmute: Command = {
    name: 'unmute',
    description: 'Remove timeout from a user',
    category: 'Moderation',
    syntax: 'unmute <user> [reason]',
    example: 'unmute @David Appeal accepted',
    permissions: [PermissionFlagsBits.ModerateMembers],
    modAction: 'unmute',
    execute: async (ctx: Context, args: string[]) => {
        await ctx.defer();
        if (!ctx.inner.member) return;

        const targetInput = args[0];
        if (!targetInput) {
            await ctx.reply({ content: 'Please provide a user to unmute.', ephemeral: true });
            return;
        }

        const targetUser = await Resolver.getUser(targetInput);
        if (!targetUser) {
            await ctx.reply({ content: 'User not found.', ephemeral: true });
            return;
        }

        const reason = args.slice(1).join(' ') || 'No reason provided';
        const guild = ctx.inner.guild;
        if (!guild) return;

        try {
            const member = await guild.members.fetch(targetUser.id).catch(() => null);
            if (!member) {
                await ctx.reply({ content: 'Member not found in guild.', ephemeral: true });
                return;
            }

            await member.timeout(null, `Unmuted: ${reason} - by ${ctx.authorId}`);

            const embed = new EmbedBuilder()
                .setDescription(
                    `${TICK} **Unmuted** ${targetUser.tag}\n` +
                    `**Reason:** ${reason}`
                );

            await ctx.reply({ embeds: [embed] });

            // Log action
            await ModLogger.log(guild, ctx.inner.member.user as User, targetUser, 'Unmute', reason);
        } catch (err: any) {
            await ctx.reply({ content: `Failed to unmute user: ${err.message}`, ephemeral: true });
        }
    }
};
