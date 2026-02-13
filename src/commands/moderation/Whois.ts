import { Context } from '../../core/context';
import { Resolver } from '../../util/Resolver';
import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { Command } from '../../core/command';
import { hasPermission } from '../../util/permissions';
import { hasModRole } from '../../util/modRole';

export const Whois: Command = {
    name: 'whois',
    description: 'Get detailed information about a user',
    category: 'Moderator Utils',
    syntax: 'whois [user]',
    example: 'whois @User',
    permissions: [PermissionFlagsBits.ManageMessages],
    modAction: 'whois',
    execute: async (ctx: Context, args: string[]) => {
        await ctx.defer();
        if (!ctx.inner.member) return;
        const perms = ctx.inner.member.permissions;
        const hasPerm = Whois.permissions.some(p => hasPermission(perms, p));

        const hasRole = await hasModRole(ctx.guildId, ctx.inner.member);

        if (!hasPerm && !hasRole) return;

        const targetInput = args[0] || ctx.authorId;
        const targetUser = await Resolver.getUser(targetInput);

        if (!targetUser) {
            await ctx.reply({ content: 'User not found.', ephemeral: true });
            return;
        }

        const member = await ctx.inner.guild?.members.fetch(targetUser.id).catch(() => null);

        const created = Math.floor(targetUser.createdTimestamp / 1000);
        const joined = member ? Math.floor(member.joinedTimestamp! / 1000) : null;

        const roles = member ? member.roles.cache.filter(r => r.name !== '@everyone').map(r => r.toString()).join(', ') || 'None' : 'N/A';

        const embed = new EmbedBuilder()
            .setThumbnail(targetUser.displayAvatarURL())
            .setDescription(
                `**${targetUser.tag}** • ${targetUser.id}\n\n` +
                `**Created:** <t:${created}:R>\n` +
                `**Joined:** ${joined ? `<t:${joined}:R>` : 'Not in server'}\n\n` +
                `**Roles:** ${roles}`
            );

        await ctx.reply({ embeds: [embed] });
    }
};
