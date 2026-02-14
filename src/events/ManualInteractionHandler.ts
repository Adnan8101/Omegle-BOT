import { Events, Interaction, ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder, TextChannel, ButtonBuilder, ButtonStyle, Message } from 'discord.js';
import { client } from '../core/discord';
import { manualService } from '../services/manual/ManualService';
import { canPerformAction } from '../util/rolePermissions';
import { EMBED_COLOR } from '../util/embedColors';

const TICK = '<:tickYes:1469272837192814623>';
const CROSS = '<:cross:1469273232929456314>';

/**
 * Build a manual embed for a specific page (used for button pagination)
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
        .setFooter({ text: `Manual ${result.page} of ${result.totalPages} • ID: ${manual.id}` });

    return { embed, total: result.total, page: result.page, totalPages: result.totalPages };
}

/**
 * Build pagination buttons
 */
function buildPaginationRow(targetId: string, authorId: string, page: number, totalPages: number, prefix: string = 'manuals'): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`${prefix}_prev_${targetId}_${authorId}_${page}`)
                .setLabel('◀ Previous')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page <= 1),
            new ButtonBuilder()
                .setCustomId(`${prefix}_page_${targetId}_${authorId}_${page}`)
                .setLabel(`${page} / ${totalPages}`)
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true),
            new ButtonBuilder()
                .setCustomId(`${prefix}_next_${targetId}_${authorId}_${page}`)
                .setLabel('Next ▶')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page >= totalPages)
        );
}

/**
 * Send the manual log to the configured webhook channel
 */
async function sendManualLog(
    guildId: string,
    targetId: string,
    manualData: {
        manual_number: number;
        offense: string;
        action: string;
        advise: string | null;
        note_proof: string | null;
        moderator_id: string;
        id: string;
    },
    isEdit: boolean = false
): Promise<string | null> {
    const config = await manualService.getConfig(guildId);
    if (!config?.log_channel_id) return null;

    const guild = client.guilds.cache.get(guildId);
    if (!guild) return null;

    const channel = guild.channels.cache.get(config.log_channel_id);
    if (!channel || !channel.isTextBased()) return null;

    const textChannel = channel as TextChannel;
    const targetUser = await client.users.fetch(targetId).catch(() => null);
    const moderator = await client.users.fetch(manualData.moderator_id).catch(() => null);

    try {
        // Get or create webhook
        const webhooks = await textChannel.fetchWebhooks();
        let webhook = webhooks.find(w => w.name === 'Manual Logs');

        if (!webhook) {
            webhook = await textChannel.createWebhook({
                name: 'Manual Logs',
                avatar: client.user?.displayAvatarURL()
            });
        }

        const createdTs = Math.floor(Date.now() / 1000);

        const embed = new EmbedBuilder()
            .setColor(EMBED_COLOR)
            .setDescription(
                `**${isEdit ? '📝 Manual Edited' : '📋 New Manual'}**\n\n` +
                `**Manual #${manualData.manual_number}**\n\n` +
                `**Username:** ${targetUser?.username || 'Unknown'}\n` +
                `**User ID:** ${targetId}\n` +
                `**User Mention:** <@${targetId}>\n\n` +
                `**Offense:** ${manualData.offense}\n` +
                `**Action:** ${manualData.action}\n` +
                `**Advise:** ${manualData.advise || 'N/A'}\n` +
                `**Note / Proof:** ${manualData.note_proof || 'N/A'}\n\n` +
                `**${isEdit ? 'Edited' : 'Added'} by:** ${moderator?.username || manualData.moderator_id}\n` +
                `**Date:** <t:${createdTs}:F>`
            )
            .setFooter({ text: `Manual ID: ${manualData.id}` });

        const msg = await webhook.send({
            username: targetUser?.username || 'Unknown User',
            avatarURL: targetUser?.displayAvatarURL() || undefined,
            content: `<@${targetId}>`,
            embeds: [embed]
        });

        return msg.id;
    } catch (err) {
        console.error('Error sending manual log webhook:', err);
        return null;
    }
}

client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    if (!interaction.guildId) return;

    // ═══════════════════════════════════════════
    // 1. HANDLE "ADD MANUAL" BUTTON (from !w or modmail)
    // ═══════════════════════════════════════════
    if (interaction.isButton() && interaction.customId.startsWith('whois_addmanual_')) {
        const parts = interaction.customId.split('_');
        const targetId = parts[2];
        const authorId = parts[3];

        // Permission check
        if (!interaction.member) return;
        const canDo = await canPerformAction(interaction.guildId, interaction.member as any, 'manual');
        if (!canDo) {
            await interaction.reply({ content: `${CROSS} You do not have permission to add manuals.`, ephemeral: true });
            return;
        }

        // Show modal
        const modal = new ModalBuilder()
            .setCustomId(`manual_add_modal_${targetId}`)
            .setTitle('Add Manual');

        const offenseInput = new TextInputBuilder()
            .setCustomId('manual_offense')
            .setLabel('Offense')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('What was the offense?')
            .setRequired(true)
            .setMaxLength(500);

        const actionInput = new TextInputBuilder()
            .setCustomId('manual_action')
            .setLabel('Action')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('What action was taken?')
            .setRequired(true)
            .setMaxLength(500);

        const adviseInput = new TextInputBuilder()
            .setCustomId('manual_advise')
            .setLabel('Advise')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Any advice for the user? (optional)')
            .setRequired(false)
            .setMaxLength(1000);

        const noteInput = new TextInputBuilder()
            .setCustomId('manual_note')
            .setLabel('Note / Proof')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Any notes or proof? (optional)')
            .setRequired(false)
            .setMaxLength(1000);

        modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(offenseInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(actionInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(adviseInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(noteInput)
        );

        await interaction.showModal(modal);
    }

    // ═══════════════════════════════════════════
    // 1b. HANDLE "ADD MANUAL" BUTTON (from modmail)
    // ═══════════════════════════════════════════
    if (interaction.isButton() && interaction.customId.startsWith('mail_addmanual_')) {
        const targetId = interaction.customId.split('_')[2];

        if (!interaction.member) return;
        const canDo = await canPerformAction(interaction.guildId, interaction.member as any, 'manual');
        if (!canDo) {
            await interaction.reply({ content: `${CROSS} You do not have permission to add manuals.`, ephemeral: true });
            return;
        }

        const modal = new ModalBuilder()
            .setCustomId(`manual_add_modal_${targetId}`)
            .setTitle('Add Manual');

        const offenseInput = new TextInputBuilder()
            .setCustomId('manual_offense')
            .setLabel('Offense')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('What was the offense?')
            .setRequired(true)
            .setMaxLength(500);

        const actionInput = new TextInputBuilder()
            .setCustomId('manual_action')
            .setLabel('Action')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('What action was taken?')
            .setRequired(true)
            .setMaxLength(500);

        const adviseInput = new TextInputBuilder()
            .setCustomId('manual_advise')
            .setLabel('Advise')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Any advice for the user? (optional)')
            .setRequired(false)
            .setMaxLength(1000);

        const noteInput = new TextInputBuilder()
            .setCustomId('manual_note')
            .setLabel('Note / Proof')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Any notes or proof? (optional)')
            .setRequired(false)
            .setMaxLength(1000);

        modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(offenseInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(actionInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(adviseInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(noteInput)
        );

        await interaction.showModal(modal);
    }

    // ═══════════════════════════════════════════
    // 2. HANDLE "ADD MANUAL" MODAL SUBMISSION
    // ═══════════════════════════════════════════
    if (interaction.isModalSubmit() && interaction.customId.startsWith('manual_add_modal_')) {
        const targetId = interaction.customId.replace('manual_add_modal_', '');

        await interaction.deferReply({ ephemeral: true });

        try {
            const offense = interaction.fields.getTextInputValue('manual_offense');
            const action = interaction.fields.getTextInputValue('manual_action');
            const advise = interaction.fields.getTextInputValue('manual_advise') || null;
            const noteProof = interaction.fields.getTextInputValue('manual_note') || null;

            const manual = await manualService.createManual(
                interaction.guildId!,
                targetId,
                interaction.user.id,
                offense,
                action,
                advise,
                noteProof
            );

            // Send webhook log
            const logMsgId = await sendManualLog(interaction.guildId!, targetId, manual);
            if (logMsgId) {
                await manualService.setLogMessageId(manual.id, logMsgId);
            }

            const targetUser = await client.users.fetch(targetId).catch(() => null);

            const embed = new EmbedBuilder()
                .setColor(EMBED_COLOR)
                .setDescription(
                    `${TICK} **Manual Added Successfully**\n\n` +
                    `**Manual #${manual.manual_number}** for ${targetUser ? `**${targetUser.username}**` : `<@${targetId}>`}\n\n` +
                    `**Offense:** ${offense}\n` +
                    `**Action:** ${action}\n` +
                    `**Advise:** ${advise || 'N/A'}\n` +
                    `**Note / Proof:** ${noteProof || 'N/A'}`
                )
                .setFooter({ text: `Manual ID: ${manual.id}` });

            await interaction.editReply({ embeds: [embed] });
        } catch (err: any) {
            console.error('Error adding manual:', err);
            await interaction.editReply({ content: `${CROSS} Failed to add manual: ${err.message}` });
        }
    }

    // ═══════════════════════════════════════════
    // 3. HANDLE "EDIT MANUAL" MODAL SUBMISSION
    // ═══════════════════════════════════════════
    if (interaction.isModalSubmit() && interaction.customId.startsWith('manual_edit_modal_')) {
        const manualId = interaction.customId.replace('manual_edit_modal_', '');

        await interaction.deferReply({ ephemeral: true });

        try {
            const offense = interaction.fields.getTextInputValue('manual_offense');
            const action = interaction.fields.getTextInputValue('manual_action');
            const advise = interaction.fields.getTextInputValue('manual_advise') || null;
            const noteProof = interaction.fields.getTextInputValue('manual_note') || null;

            const updated = await manualService.updateManual(manualId, {
                offense,
                action,
                advise,
                note_proof: noteProof
            });

            // Send updated webhook log
            const logMsgId = await sendManualLog(interaction.guildId!, updated.target_id, {
                manual_number: updated.manual_number,
                offense: updated.offense,
                action: updated.action,
                advise: updated.advise,
                note_proof: updated.note_proof,
                moderator_id: updated.moderator_id,
                id: updated.id
            }, true);

            if (logMsgId) {
                await manualService.setLogMessageId(updated.id, logMsgId);
            }

            const targetUser = await client.users.fetch(updated.target_id).catch(() => null);

            const embed = new EmbedBuilder()
                .setColor(EMBED_COLOR)
                .setDescription(
                    `${TICK} **Manual Updated Successfully**\n\n` +
                    `**Manual #${updated.manual_number}** for ${targetUser ? `**${targetUser.username}**` : `<@${updated.target_id}>`}\n\n` +
                    `**Offense:** ${offense}\n` +
                    `**Action:** ${action}\n` +
                    `**Advise:** ${advise || 'N/A'}\n` +
                    `**Note / Proof:** ${noteProof || 'N/A'}`
                )
                .setFooter({ text: `Manual ID: ${updated.id}` });

            await interaction.editReply({ embeds: [embed] });
        } catch (err: any) {
            console.error('Error editing manual:', err);
            await interaction.editReply({ content: `${CROSS} Failed to edit manual: ${err.message}` });
        }
    }

    // ═══════════════════════════════════════════
    // 4. HANDLE "VIEW MANUALS" BUTTON (from !w or modmail)
    // ═══════════════════════════════════════════
    if (interaction.isButton() && (
        interaction.customId.startsWith('whois_manuals_') ||
        interaction.customId.startsWith('mail_manuals_')
    )) {
        const parts = interaction.customId.split('_');
        const targetId = parts[2];

        await interaction.deferReply({ ephemeral: true });

        try {
            const { embed, total, page, totalPages } = await buildManualPageEmbed(interaction.guildId!, targetId, 1);

            if (total === 0) {
                await interaction.editReply({ embeds: [embed] });
                return;
            }

            const prefix = interaction.customId.startsWith('whois_') ? 'wmanuals' : 'mmanuals';
            const row = buildPaginationRow(targetId, interaction.user.id, page, totalPages, prefix);
            await interaction.editReply({ embeds: [embed], components: [row] });
        } catch (e: any) {
            await interaction.editReply({ content: `${CROSS} Failed to fetch manuals: ${e.message}` });
        }
    }

    // ═══════════════════════════════════════════
    // 5. HANDLE MANUAL PAGINATION BUTTONS
    // ═══════════════════════════════════════════
    if (interaction.isButton() && (
        interaction.customId.startsWith('manuals_prev_') ||
        interaction.customId.startsWith('manuals_next_') ||
        interaction.customId.startsWith('wmanuals_prev_') ||
        interaction.customId.startsWith('wmanuals_next_') ||
        interaction.customId.startsWith('mmanuals_prev_') ||
        interaction.customId.startsWith('mmanuals_next_')
    )) {
        const parts = interaction.customId.split('_');
        const prefix = parts[0]; // manuals, wmanuals, or mmanuals
        const direction = parts[1]; // prev or next
        const targetId = parts[2];
        const authorId = parts[3];
        const currentPage = parseInt(parts[4]);

        // Only the original author can paginate
        if (interaction.user.id !== authorId) {
            await interaction.reply({ content: `${CROSS} Only the command author can use these buttons.`, ephemeral: true });
            return;
        }

        let newPage = currentPage;
        if (direction === 'prev') newPage = Math.max(1, currentPage - 1);
        if (direction === 'next') newPage = currentPage + 1;

        try {
            const { embed, page, totalPages } = await buildManualPageEmbed(interaction.guildId!, targetId, newPage);
            const row = buildPaginationRow(targetId, authorId, page, totalPages, prefix);

            await interaction.update({ embeds: [embed], components: [row] });
        } catch (e: any) {
            console.error('Error handling manual pagination:', e);
        }
    }
});

export { sendManualLog };
