import { Context } from '../../core/context';
import { Resolver } from '../../util/Resolver';
import { EmbedBuilder, User, PermissionFlagsBits } from 'discord.js';
import { Command } from '../../core/command';
import { canPerformAction } from '../../util/rolePermissions';
import { ModLogger } from '../../services/logging/ModLogger';

const TICK = '<:tickYes:1469272837192814623>';

export const Unban: Command = {
    name: 'unban',
    description: 'Unban a user by ID',
    category: 'Moderation',
    syntax: 'unban <user_id> [reason]',
    example: 'unban 123456789012345678 Appeal approved',
    permissions: [PermissionFlagsBits.BanMembers],
    modAction: 'unban',
    execute: async (ctx: Context, args: string[]) => {
        await ctx.defer();
        if (!ctx.inner.member) return;

        const targetInput = args[0];
        if (!targetInput) {
            await ctx.reply({ content: 'Please provide a user to unban.', ephemeral: true });
            return;
        }

        let targetUser = await Resolver.getUser(targetInput);
        let targetId = targetUser?.id || targetInput;

        const reason = args.slice(1).join(' ') || 'No reason provided';
        const guild = ctx.inner.guild;
        if (!guild) return;

        try {
            await guild.members.unban(targetId, `Unbanned: ${reason} - by ${ctx.authorId}`);

            const embed = new EmbedBuilder()
                .setColor(0x2b2d31)
            .setDescription(
                    `${TICK} **Unbanned** ${targetUser ? targetUser.tag : targetId}\n` +
                    `**Reason:** ${reason}`
                );

            await ctx.reply({ embeds: [embed] });

            // Log action
            await ModLogger.log(guild, ctx.inner.member.user as User, targetUser || targetId, 'Unban', reason);
        } catch (err: any) {
            await ctx.reply({ content: `Failed to unban user: ${err.message}`, ephemeral: true });
        }
    }
};
