import { Context } from '../../core/context';
import { modService } from '../../services/moderation/ModerationService';
import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { Command } from '../../core/command';
import { hasPermission } from '../../util/permissions';
import { hasSrModRole } from '../../util/rolePermissions';

export const ModLeaderboard: Command = {
    name: 'modleaderboard',
    description: 'Show top moderators by case count',
    category: 'Admin',
    syntax: 'modleaderboard',
    example: 'modleaderboard',
    permissions: [PermissionFlagsBits.Administrator],
    modAction: 'modleaderboard',
    execute: async (ctx: Context, args: string[]) => {
        await ctx.defer();
        if (!ctx.inner.member) return;
        const perms = ctx.inner.member.permissions;
        const hasPerm = hasPermission(perms, PermissionFlagsBits.Administrator);

        const hasSrMod = await hasSrModRole(ctx.guildId, ctx.inner.member);

        if (!hasPerm && !hasSrMod) return;

        try {
            const stats: any[] = await modService.getLeaderboard(ctx.guildId) as any[];

            if (!stats || stats.length === 0) {
                await ctx.reply({ content: 'No moderator stats found.', ephemeral: true });
                return;
            }

            const description = stats.slice(0, 10).map((s: any, i: number) => {
                const total = (s.bans || 0) + (s.kicks || 0) + (s.mutes || 0) + (s.warns || 0);
                return `**${i + 1}.** <@${s.moderator_id}> • ${total} actions`;
            }).join('\n');

            const embed = new EmbedBuilder()
                .setColor(0x2b2d31)
                .setTitle('Moderator Leaderboard')
                .setDescription(description);

            await ctx.reply({ embeds: [embed] });
        } catch (err: any) {
            await ctx.reply({ content: `Failed to fetch leaderboard: ${err.message}`, ephemeral: true });
        }
    }
};
