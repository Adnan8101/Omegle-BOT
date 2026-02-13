import { Context } from '../../core/context';
import { modService } from '../../services/moderation/ModerationService';
import { Resolver } from '../../util/Resolver';
import { EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Command } from '../../core/command';
import { hasPermission } from '../../util/permissions';
import { hasModRole } from '../../util/modRole';

const TICK = '<:tickYes:1469272837192814623>';
const CROSS = '<:cross:1469273232929456314>';

export const ModLogs: Command = {
    name: 'modlogs',
    description: 'View moderation logs for a user',
    category: 'Admin',
    syntax: 'modlogs [user]',
    example: 'modlogs @User',
    permissions: [PermissionFlagsBits.ManageMessages],
    modAction: 'modlogs',
    execute: async (ctx: Context, args: string[]) => {
        await ctx.defer();
        if (!ctx.inner.member) return;
        const perms = ctx.inner.member.permissions;
        const hasPerm = ModLogs.permissions.some(p => hasPermission(perms, p));

        const hasRole = await hasModRole(ctx.guildId, ctx.inner.member);

        if (!hasPerm && !hasRole) return;

        const targetInput = args[0];
        if (!targetInput) {
            await ctx.reply({ content: 'Please provide a user to view logs for.', ephemeral: true });
            return;
        }

        const targetUser = await Resolver.getUser(targetInput);
        if (!targetUser) {
            await ctx.reply({ content: 'User not found.', ephemeral: true });
            return;
        }

        try {
            const logs = await modService.getLogs(ctx.guildId, targetUser.id);

            if (!logs || logs.length === 0) {
                const embed = new EmbedBuilder()
                    .setDescription(
                        `${TICK} **${targetUser.tag}**\n\n` +
                        `Clean record • No history`
                    );
                await ctx.reply({ embeds: [embed], ephemeral: true });
                return;
            }

            // Get current active status
            const activeMute = logs.find(l => l.action === 'mute' && l.active);
            const activeBan = logs.find(l => l.action === 'ban' && l.active);
            let status = 'Active';
            let color = 0x5865F2;
            if (activeBan) { status = 'Banned'; color = 0xED4245; }
            else if (activeMute) { status = 'Muted'; color = 0xFEE75C; }

            const logRows = logs.slice(0, 8).map(log => {
                const timestamp = Math.floor(new Date(log.created_at).getTime() / 1000);
                return `#${log.case_number} ${log.action} • <t:${timestamp}:R>\n${log.reason || 'No reason'}`;
            }).join('\n\n');

            const embed = new EmbedBuilder()
                .setDescription(
                    `${TICK} **${targetUser.tag}**\n\n` +
                    `**Status:** ${status} • **Cases:** ${logs.length}\n\n` +
                    `${logRows}`
                );

            const row = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`delete_modlogs_${ctx.authorId}`)
                        .setLabel('🗑️ Delete')
                        .setStyle(ButtonStyle.Danger)
                );

            const message = await ctx.reply({ embeds: [embed], components: [row], ephemeral: true });

            // Handle delete button
            const collector = message.createMessageComponentCollector({
                filter: (i: any) => i.customId.startsWith('delete_modlogs_') && i.user.id === ctx.authorId,
                time: 60000
            });

            collector.on('collect', async (interaction: any) => {
                try {
                    await interaction.update({ content: '✓ Message deleted', embeds: [], components: [] });
                    setTimeout(() => {
                        interaction.deleteReply().catch(() => { });
                    }, 2000);
                } catch (e) {
                    // Already deleted
                }
            });

        } catch (err: any) {
            await ctx.reply({ content: `Failed to fetch logs: ${err.message}`, ephemeral: true });
        }
    }
};
