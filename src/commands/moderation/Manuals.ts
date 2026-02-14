import { Context } from '../../core/context';
import { Command } from '../../core/command';
import { Resolver } from '../../util/Resolver';
import { EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, Message } from 'discord.js';
import { hasPermission } from '../../util/permissions';
import { hasModRole } from '../../util/modRole';
import { manualService } from '../../services/manual/ManualService';
import { client } from '../../core/discord';
import { EMBED_COLOR } from '../../util/embedColors';

const TICK = '<:tickYes:1469272837192814623>';
const CROSS = '<:cross:1469273232929456314>';

/**
 * Build a manual embed for a specific page
 */
async function buildManualPageEmbed(
    guildId: string,
    targetId: string,
    page: number
) {
    const result = await manualService.getUserManualsPaginated(guildId, targetId, page, 1);
    const targetUser = await client.users.fetch(targetId).catch(() => null);

    if (result.total === 0) {
        const embed = new EmbedBuilder()
            .setColor(EMBED_COLOR)
            .setDescription(
                `${TICK} **${targetUser?.username || targetId}**\n\n` +
                `No manuals found for this user.`
            );
        return { embed, total: 0, page: 1, totalPages: 1 };
    }

    const manual = result.manuals[0];
    const moderator = await client.users.fetch(manual.moderator_id).catch(() => null);
    const createdTs = Math.floor(new Date(manual.created_at).getTime() / 1000);

    const embed = new EmbedBuilder()
        .setColor(EMBED_COLOR)
        .setAuthor({
            name: `Manuals | ${targetUser?.username || targetId}`,
            iconURL: targetUser?.displayAvatarURL()
        })
        .setDescription(
            `<@${targetId}>\n\n` +
            `**Manual #${manual.manual_number}**\n\n` +
            `**Offense:** ${manual.offense}\n` +
            `**Action:** ${manual.action}\n` +
            `**Advise:** ${manual.advise || 'N/A'}\n` +
            `**Note / Proof:** ${manual.note_proof || 'N/A'}\n\n` +
            `**Added by:** ${moderator ? `${moderator.username}` : manual.moderator_id}\n` +
            `**Date:** <t:${createdTs}:F> (<t:${createdTs}:R>)`
        )
        .setThumbnail(targetUser?.displayAvatarURL() || null)
        .setFooter({ text: `Manual ${result.page} of ${result.totalPages} • ID: ${manual.manual_number}` });

    return { embed, total: result.total, page: result.page, totalPages: result.totalPages };
}

/**
 * Build pagination buttons for manuals
 */
function buildPaginationRow(targetId: string, authorId: string, page: number, totalPages: number): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`manuals_prev_${targetId}_${authorId}_${page}`)
                .setLabel('◀ Previous')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page <= 1),
            new ButtonBuilder()
                .setCustomId(`manuals_page_${targetId}_${authorId}_${page}`)
                .setLabel(`${page} / ${totalPages}`)
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true),
            new ButtonBuilder()
                .setCustomId(`manuals_next_${targetId}_${authorId}_${page}`)
                .setLabel('Next ▶')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page >= totalPages)
        );
}

export const Manuals: Command = {
    name: 'manuals',
    description: 'View all manuals for a user with pagination',
    category: 'Moderation',
    syntax: 'manuals <user>',
    example: 'manuals @User',
    permissions: [PermissionFlagsBits.ManageMessages],
    modAction: 'manuals',
    execute: async (ctx: Context, args: string[]) => {
        await ctx.defer();
        if (!ctx.inner.member) return;
        const perms = ctx.inner.member.permissions;
        const hasPerm = Manuals.permissions.some(p => hasPermission(perms, p));
        const hasRole = await hasModRole(ctx.guildId, ctx.inner.member);

        if (!hasPerm && !hasRole) {
            await ctx.reply({ content: `${CROSS} You do not have permission to use this command.` });
            return;
        }

        if (!args[0]) {
            await ctx.reply({ content: `${CROSS} Please mention a user or provide a user ID.\n**Usage:** \`!manuals @user\`` });
            return;
        }

        const targetUser = await Resolver.getUser(args[0]);
        if (!targetUser) {
            await ctx.reply({ content: `${CROSS} User not found.` });
            return;
        }

        const { embed, total, page, totalPages } = await buildManualPageEmbed(ctx.guildId, targetUser.id, 1);

        if (total === 0) {
            await ctx.reply({ embeds: [embed] });
            return;
        }

        const row = buildPaginationRow(targetUser.id, ctx.authorId, page, totalPages);
        const message = await ctx.reply({ embeds: [embed], components: [row] });

        // Handle pagination
        const collector = message.createMessageComponentCollector({
            filter: (i: any) => i.customId.startsWith('manuals_') && i.customId.includes(`_${ctx.authorId}_`),
            time: 300000 // 5 minutes
        });

        collector.on('collect', async (interaction: any) => {
            try {
                const parts = interaction.customId.split('_');
                const action = parts[1]; // prev, next, page
                const tId = parts[2];
                const currentPage = parseInt(parts[4]);

                let newPage = currentPage;
                if (action === 'prev') newPage = Math.max(1, currentPage - 1);
                if (action === 'next') newPage = currentPage + 1;

                const result = await buildManualPageEmbed(ctx.guildId, tId, newPage);
                const newRow = buildPaginationRow(tId, ctx.authorId, result.page, result.totalPages);

                await interaction.update({ embeds: [result.embed], components: [newRow] });
            } catch (e) {
                console.error('Error handling manuals pagination:', e);
            }
        });

        collector.on('end', async () => {
            try {
                if (message instanceof Message) {
                    await message.edit({ components: [] }).catch(() => {});
                }
            } catch {}
        });
    }
};

export { buildManualPageEmbed, buildPaginationRow };
