import { Context } from '../../core/context';
import { modService } from '../../services/moderation/ModerationService';
import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { Command } from '../../core/command';
import { hasPermission } from '../../util/permissions';
import { hasModRole } from '../../util/modRole';

export const CaseInfo: Command = {
    name: 'caseinfo',
    description: 'Get detailed information about a specific moderation case',
    category: 'Admin',
    syntax: 'caseinfo <case_number>',
    example: 'caseinfo 123',
    permissions: [PermissionFlagsBits.ManageMessages],
    modAction: 'caseinfo',
    execute: async (ctx: Context, args: string[]) => {
        await ctx.defer();
        if (!ctx.inner.member) return;
        const perms = ctx.inner.member.permissions;
        const hasPerm = CaseInfo.permissions.some(p => hasPermission(perms, p));

        const hasRole = await hasModRole(ctx.guildId, ctx.inner.member);

        if (!hasPerm && !hasRole) return;

        const caseNumStr = args[0];
        if (!caseNumStr || isNaN(parseInt(caseNumStr))) {
            await ctx.reply({ content: 'Please provide a valid case number.', ephemeral: true });
            return;
        }

        const caseNum = parseInt(caseNumStr);

        try {
            const caseData = await modService.getCase(ctx.guildId, caseNum);

            if (!caseData) {
                await ctx.reply({ content: 'Case not found.', ephemeral: true });
                return;
            }

            const createdTimestamp = Math.floor(caseData.created_at.getTime() / 1000);
            const durationDisplay = caseData.duration_seconds
                ? (caseData.duration_seconds < 3600
                    ? `${caseData.duration_seconds / 60}m`
                    : `${(caseData.duration_seconds / 3600).toFixed(1)}h`)
                : 'N/A';

            const embed = new EmbedBuilder()
                .setColor(0x2b2d31)
            .setDescription(
                    `**Case #${caseData.case_number}** • ${caseData.action}\n\n` +
                    `**Target:** <@${caseData.target_id}>\n` +
                    `**Mod:** <@${caseData.moderator_id}>\n` +
                    `**Duration:** ${durationDisplay}\n` +
                    `**When:** <t:${createdTimestamp}:R>\n\n` +
                    `**Reason:** ${caseData.reason || 'None'}`
                );

            await ctx.reply({ embeds: [embed] });
        } catch (err: any) {
            await ctx.reply({ content: `Failed to fetch case info: ${err.message}`, ephemeral: true });
        }
    }
};
