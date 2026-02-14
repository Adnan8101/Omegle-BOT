import { Context } from '../../core/context';
import { modService } from '../../services/moderation/ModerationService';
import { Resolver } from '../../util/Resolver';
import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { Command } from '../../core/command';
import { hasPermission } from '../../util/permissions';
import { hasModRole } from '../../util/modRole';
import { parseSmartDuration } from '../../util/time';
import { db } from '../../data/db';

const ITEMS_PER_PAGE = 6;

function formatTimeSince(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
}

function capitalizeAction(action: string): string {
    return action.charAt(0).toUpperCase() + action.slice(1);
}

export const ModStats: Command = {
    name: 'modstats',
    description: 'View statistics and detailed actions for a moderator',
    category: 'Admin',
    syntax: 'modstats [user]',
    example: 'modstats @User',
    permissions: [PermissionFlagsBits.ManageMessages],
    modAction: 'modstats',
    execute: async (ctx: Context, args: string[]) => {
        await ctx.defer();
        if (!ctx.inner.member) return;
        const perms = ctx.inner.member.permissions;
        const hasPerm = ModStats.permissions.some(p => hasPermission(perms, p));

        const hasRole = await hasModRole(ctx.guildId, ctx.inner.member);

        if (!hasPerm && !hasRole) return;

        // Parse arguments: [user] [time]
        let targetId = ctx.authorId;
        let timeFilterSeconds: number | null = null;

        // First try to resolve user
        if (args[0]) {
            const u = await Resolver.getUser(args[0]);
            if (u) {
                targetId = u.id;
                args = args.slice(1); // Remove user from args
            }
        }

        // Now check for time filter in remaining args
        if (args.length > 0) {
            const { durationSeconds, remainingArgs } = parseSmartDuration(args);
            if (durationSeconds) {
                timeFilterSeconds = durationSeconds;
            }
        }

        try {
            const stats = await modService.getModeratorStats(ctx.guildId, targetId);

            if (!stats) {
                await ctx.reply({ content: 'No stats found for this user.', ephemeral: true });
                return;
            }

            // Fetch detailed actions
            const whereClause: any = {
                guild_id: ctx.guildId,
                moderator_id: targetId
            };

            // Apply time filter if specified
            if (timeFilterSeconds) {
                const cutoffDate = new Date(Date.now() - timeFilterSeconds * 1000);
                whereClause.created_at = {
                    gte: cutoffDate
                };
            }

            const allActions = await db.moderationCase.findMany({
                where: whereClause,
                orderBy: { created_at: 'desc' }
            });

            const total = (stats.bans || 0) + (stats.kicks || 0) + (stats.mutes || 0) + (stats.warns || 0);

            // Calculate filtered stats if time filter is provided
            let filteredBans = stats.bans || 0;
            let filteredKicks = stats.kicks || 0;
            let filteredMutes = stats.mutes || 0;
            let filteredWarns = stats.warns || 0;
            let filteredTotal = total;

            if (timeFilterSeconds) {
                // Count actions by type in the filtered period
                filteredBans = allActions.filter(a => a.action === 'ban').length;
                filteredKicks = allActions.filter(a => a.action === 'kick').length;
                filteredMutes = allActions.filter(a => a.action === 'mute').length;
                filteredWarns = allActions.filter(a => a.action === 'warn').length;
                filteredTotal = allActions.length;
            }

            // Show summary stats (with or without time filter)
            const timeLabel = timeFilterSeconds ?
                (timeFilterSeconds < 60 ? `${timeFilterSeconds}s` :
                    timeFilterSeconds < 3600 ? `${Math.floor(timeFilterSeconds / 60)}m` :
                        timeFilterSeconds < 86400 ? `${Math.floor(timeFilterSeconds / 3600)}h` :
                            `${Math.floor(timeFilterSeconds / 86400)}d`) : '';

            const targetUser = await ctx.inner.guild?.members.fetch(targetId).catch(() => null);
            const userName = targetUser?.user.tag || targetId;

            const embed = new EmbedBuilder()
                .setColor(0x2b2d31)
                .setAuthor({ name: userName })
                .setDescription(
                    `**Ban:** ${timeLabel ? filteredBans : stats.bans || 0} • **Kick:** ${timeLabel ? filteredKicks : stats.kicks || 0}\n` +
                    `**Mute:** ${timeLabel ? filteredMutes : stats.mutes || 0} • **Warn:** ${timeLabel ? filteredWarns : stats.warns || 0}\n\n` +
                    `**Total:** ${timeLabel ? filteredTotal : total}`
                )
                .setFooter({ text: timeLabel ? `Last ${timeLabel}` : 'All time' });

            await ctx.reply({ embeds: [embed] });

        } catch (err: any) {
            await ctx.reply({ content: `Failed to fetch stats: ${err.message}`, ephemeral: true });
        }
    }
};
