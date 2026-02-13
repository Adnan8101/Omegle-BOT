import { Context } from '../../core/context';
import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { Command } from '../../core/command';
import { Resolver } from '../../util/Resolver';
import { hasPermission } from '../../util/permissions';
import { hasModRole } from '../../util/modRole';

export const Av: Command = {
    name: 'av',
    description: 'Displays the avatar of a user in high resolution',
    category: 'Moderator Utils',
    syntax: 'av [@user | userID]',
    example: 'av @User',
    permissions: [PermissionFlagsBits.ModerateMembers],
    modAction: 'av',
    execute: async (ctx: Context, args: string[]) => {
        await ctx.defer();
        if (!ctx.inner.member) return;
        const perms = ctx.inner.member.permissions;
        const hasPerm = Av.permissions.some(p => hasPermission(perms, p));
        const hasRole = await hasModRole(ctx.guildId, ctx.inner.member);

        if (!hasPerm && !hasRole) return;

        const targetInput = args[0] || ctx.authorId;
        const targetUser = await Resolver.getUser(targetInput);

        if (!targetUser) {
            await ctx.reply({ content: 'User not found.', ephemeral: true });
            return;
        }

        const avatarUrl = targetUser.displayAvatarURL({ size: 4096, extension: 'png' }); // High res

        const embed = new EmbedBuilder()
            .setDescription(`**Avatar** • ${targetUser.username}`)
            .setImage(avatarUrl);

        await ctx.reply({ embeds: [embed] });
    }
};
