import { Context } from '../../core/context';
import { afkService } from '../../services/afk/AfkService';
import { EmbedBuilder, Colors, PermissionFlagsBits } from 'discord.js';
import { Command } from '../../core/command';
import { Resolver } from '../../util/Resolver';
import { hasPermission } from '../../util/permissions';

export const AfkClear: Command = {
    name: 'afkclear',
    description: 'Clear AFK status for a user',
    category: 'AFK',
    syntax: 'afkclear <user>',
    example: 'afkclear @David',
    permissions: [PermissionFlagsBits.ModerateMembers],
    execute: async (ctx: Context, args: string[]) => {
        if (!ctx.inner.member) return;
        const perms = ctx.inner.member.permissions;
        const hasPerm = AfkClear.permissions.some(p => hasPermission(perms, p));

        if (!hasPerm) return;

        const targetInput = args[0];
        if (!targetInput) {
            await ctx.reply({ content: 'Please provide a user.', ephemeral: true });
            return;
        }

        const targetUser = await Resolver.getUser(targetInput);
        if (!targetUser) {
            await ctx.reply({ content: 'User not found.', ephemeral: true });
            return;
        }

        try {
            await afkService.removeAfk(ctx.guildId, targetUser.id);
            const embed = new EmbedBuilder()
                .setDescription(`Cleared AFK status for <@${targetUser.id}>.`);
            await ctx.reply({ embeds: [embed] });
        } catch (err: any) {
            await ctx.reply({ content: `Failed to clear AFK: ${err.message}`, ephemeral: true });
        }
    }
};
