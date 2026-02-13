import { Context } from '../../core/context';
import { modService } from '../../services/moderation/ModerationService';
import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { Command } from '../../core/command';
import { hasPermission } from '../../util/permissions';
import { hasModRole } from '../../util/modRole';

const TICK = '<:tickYes:1469272837192814623>';

export const ModLeaderboard: Command = {
    name: 'modleaderboard',
    description: 'Show top moderators by case count',
    category: 'Admin',
    syntax: 'modleaderboard',
    example: 'modleaderboard',
    permissions: [PermissionFlagsBits.ManageMessages],
    modAction: 'modleaderboard',
    execute: async (ctx: Context, args: string[]) => {
        await ctx.defer();
        if (!ctx.inner.member) return;
        const perms = ctx.inner.member.permissions;
        const hasPerm = ModLeaderboard.permissions.some(p => hasPermission(perms, p));

        const hasRole = await hasModRole(ctx.guildId, ctx.inner.member);

        if (!hasPerm && !hasRole) return;

        try {
            const stats: any[] = await modService.getLeaderboard(ctx.guildId) as any[];

            if (!stats || stats.length === 0) {
                await ctx.reply({ content: 'No moderator stats found.', ephemeral: true });
                return;
            }

            const medals = ['🥇', '🥈', '🥉'];
            const description = stats.slice(0, 10).map((s: any, i: number) => {
                const total = (s.bans || 0) + (s.kicks || 0) + (s.mutes || 0) + (s.warns || 0);
                const medal = i < 3 ? medals[i] : `${i + 1}.`;
                return `${medal} <@${s.moderator_id}> • **${total}**`;
            }).join('\n');

            const embed = new EmbedBuilder()
                .setDescription(
                    `${TICK} **Mod Leaderboard**\n\n${description}`
                );

            await ctx.reply({ embeds: [embed] });
        } catch (err: any) {
            await ctx.reply({ content: `Failed to fetch leaderboard: ${err.message}`, ephemeral: true });
        }
    }
};
