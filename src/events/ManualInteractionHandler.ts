import { Events, Interaction, ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder, TextChannel, ButtonBuilder, ButtonStyle, Message, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, UserSelectMenuBuilder } from 'discord.js';
import { client } from '../core/discord';
import { manualService } from '../services/manual/ManualService';
import { canPerformAction } from '../util/rolePermissions';
import { EMBED_COLOR } from '../util/embedColors';

const TICK = '<:tickYes:1469272837192814623>';
const CROSS = '<:cross:1469273232929456314>';

// Temporary storage for manual preview data
interface ManualPreviewData {
    targetId: string;
    offense: string;
    action: string;
    advise: string | null;
    noteProof: string | null;
    moderatorId: string;
    selectedReviewers: string[];
    selectedMembers: string[];
}

const manualPreviewStore = new Map<string, ManualPreviewData>();

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

    // Get manual log channel and build link
    const config = await manualService.getConfig(guildId);
    let manualLink = `#${manual.manual_number}`;
    if (config?.log_channel_id && manual.log_message_id) {
        manualLink = `[Manual #${manual.manual_number}](https://discord.com/channels/${guildId}/${config.log_channel_id}/${manual.log_message_id})`;
    }

    const embed = new EmbedBuilder()
        .setColor(EMBED_COLOR)
        .setAuthor({
            name: `Manuals | ${targetUser?.username || targetId}`,
            iconURL: targetUser?.displayAvatarURL()
        })
        .setDescription(
            `<@${targetId}>\n\n` +
            `${manualLink}\n\n` +
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
 * Send the manual log as plain message with moderator username/pfp
 */
async function sendManualLog(
    guildId: string,
    targetId: string,
    manualData: {
        id: string;
        manual_number: number;
        offense: string;
        action: string;
        advise: string | null;
        note_proof: string | null;
        moderator_id: string;
        reviewed_by?: string[];
    }
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

        // Build reviewed by text
        let reviewedByText = '';
        if (manualData.reviewed_by && manualData.reviewed_by.length > 0) {
            const reviewers = await Promise.all(
                manualData.reviewed_by.map(id => client.users.fetch(id).catch(() => null))
            );
            const reviewerMentions = reviewers.filter(r => r).map(r => `<@${r!.id}>`).join(', ');
            reviewedByText = `\n\n**Reviewed by:** ${reviewerMentions}`;
        }

        // Plain message format
        const content = 
            `${targetUser?.id || targetId}\n` +
            `${targetUser?.username || 'Unknown User'}\n` +
            `<@${targetId}>\n\n` +
            `• **Offense:** ${manualData.offense}\n` +
            `• **Action:** ${manualData.action}\n` +
            `• **Advise:** ${manualData.advise || 'N/A'}\n` +
            `• **Note/Proof:** ${manualData.note_proof || 'N/A'}${reviewedByText}\n\n` +
            `ManualId : ${manualData.manual_number} | mod : ${manualData.moderator_id}`;

        const msg = await webhook.send({
            username: moderator?.username || 'Moderator',
            avatarURL: moderator?.displayAvatarURL() || undefined,
            content
        });

        return msg.id;
    } catch (err) {
        console.error('Error sending manual log webhook:', err);
        return null;
    }
}

/**
 * Update an existing manual log message
 */
async function updateManualLog(
    guildId: string,
    messageId: string,
    targetId: string,
    manualData: {
        id: string;
        manual_number: number;
        offense: string;
        action: string;
        advise: string | null;
        note_proof: string | null;
        moderator_id: string;
        reviewed_by?: string[];
    }
): Promise<void> {
    const config = await manualService.getConfig(guildId);
    if (!config?.log_channel_id) return;

    const guild = client.guilds.cache.get(guildId);
    if (!guild) return;

    const channel = guild.channels.cache.get(config.log_channel_id);
    if (!channel || !channel.isTextBased()) return;

    const textChannel = channel as TextChannel;
    const targetUser = await client.users.fetch(targetId).catch(() => null);

    try {
        const webhooks = await textChannel.fetchWebhooks();
        const webhook = webhooks.find(w => w.name === 'Manual Logs');
        if (!webhook) return;

        // Build reviewed by text
        let reviewedByText = '';
        if (manualData.reviewed_by && manualData.reviewed_by.length > 0) {
            const reviewers = await Promise.all(
                manualData.reviewed_by.map(id => client.users.fetch(id).catch(() => null))
            );
            const reviewerMentions = reviewers.filter(r => r).map(r => `<@${r!.id}>`).join(', ');
            reviewedByText = `\n\n**Reviewed by:** ${reviewerMentions}`;
        }

        const content = 
            `${targetUser?.id || targetId}\n` +
            `${targetUser?.username || 'Unknown User'}\n` +
            `<@${targetId}>\n\n` +
            `• **Offense:** ${manualData.offense}\n` +
            `• **Action:** ${manualData.action}\n` +
            `• **Advise:** ${manualData.advise || 'N/A'}\n` +
            `• **Note/Proof:** ${manualData.note_proof || 'N/A'}${reviewedByText}\n\n` +
            `ManualId : ${manualData.manual_number} | mod : ${manualData.moderator_id}`;

        await webhook.editMessage(messageId, {
            content
        });
    } catch (err) {
        console.error('Error updating manual log:', err);
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
    // 2. HANDLE "ADD MANUAL" MODAL SUBMISSION - SHOW PREVIEW
    // ═══════════════════════════════════════════
    if (interaction.isModalSubmit() && interaction.customId.startsWith('manual_add_modal_')) {
        const targetId = interaction.customId.replace('manual_add_modal_', '');

        await interaction.deferReply({ ephemeral: true });

        try {
            const offense = interaction.fields.getTextInputValue('manual_offense');
            const action = interaction.fields.getTextInputValue('manual_action');
            const advise = interaction.fields.getTextInputValue('manual_advise') || null;
            const noteProof = interaction.fields.getTextInputValue('manual_note') || null;

            const targetUser = await client.users.fetch(targetId).catch(() => null);

            // Check if there's existing preview data to restore
            let existingPreview: ManualPreviewData | undefined;
            for (const [key, value] of manualPreviewStore.entries()) {
                if (value.targetId === targetId && value.moderatorId === interaction.user.id) {
                    existingPreview = value;
                    manualPreviewStore.delete(key); // Remove old entry
                    break;
                }
            }

            // Generate unique preview ID
            const previewId = `${interaction.user.id}_${targetId}_${Date.now()}`;

            // Store preview data, preserving selections if they exist
            manualPreviewStore.set(previewId, {
                targetId,
                offense,
                action,
                advise,
                noteProof,
                moderatorId: interaction.user.id,
                selectedReviewers: existingPreview?.selectedReviewers || [],
                selectedMembers: existingPreview?.selectedMembers || []
            });

            // Auto-cleanup after 10 minutes
            setTimeout(() => manualPreviewStore.delete(previewId), 600000);

            // Show preview with dropdowns
            const previewEmbed = new EmbedBuilder()
                .setColor(EMBED_COLOR)
                .setTitle('Manual Preview')
                .setDescription(
                    `**Target:** ${targetUser ? `${targetUser.username}` : `<@${targetId}>`}\n\n` +
                    `**Offense:** ${offense}\n` +
                    `**Action:** ${action}\n` +
                    `**Advise:** ${advise || 'N/A'}\n` +
                    `**Note/Proof:** ${noteProof || 'N/A'}`
                );

            // Show current selections if any
            let selectionsText = '';
            if (existingPreview?.selectedReviewers && existingPreview.selectedReviewers.length > 0) {
                selectionsText += `\n**Reviewers:** ${existingPreview.selectedReviewers.map(id => `<@${id}>`).join(', ')}`;
            }
            if (existingPreview?.selectedMembers && existingPreview.selectedMembers.length > 0) {
                selectionsText += `\n**Copy to:** ${existingPreview.selectedMembers.map(id => `<@${id}>`).join(', ')}`;
            }

            if (selectionsText) {
                previewEmbed.addFields({ name: 'Current Selections', value: selectionsText });
            }
            
            const modMenu = new UserSelectMenuBuilder()
                .setCustomId(`manual_preview_addmod_${previewId}`)
                .setPlaceholder('Add Moderators (Reviewers)')
                .setMinValues(0)
                .setMaxValues(10);

            const memberMenu = new UserSelectMenuBuilder()
                .setCustomId(`manual_preview_addmember_${previewId}`)
                .setPlaceholder('Add Members (Copy Manual To)')
                .setMinValues(0)
                .setMaxValues(10);

            const buttonRow = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`manual_preview_back_${previewId}`)
                        .setLabel('Back')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId(`manual_preview_send_${previewId}`)
                        .setLabel('Send')
                        .setStyle(ButtonStyle.Primary)
                );

            const modRow = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(modMenu);
            const memberRow = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(memberMenu);

            await interaction.editReply({ 
                embeds: [previewEmbed], 
                components: [modRow, memberRow, buttonRow] 
            });
        } catch (err: any) {
            console.error('Error showing manual preview:', err);
            await interaction.editReply({ content: `${CROSS} Failed to show preview: ${err.message}` });
        }
    }

    // ═══════════════════════════════════════════
    // 2a. HANDLE MODERATOR SELECTION IN PREVIEW
    // ═══════════════════════════════════════════
    if (interaction.isUserSelectMenu() && interaction.customId.startsWith('manual_preview_addmod_')) {
        const previewId = interaction.customId.replace('manual_preview_addmod_', '');
        const previewData = manualPreviewStore.get(previewId);

        if (!previewData) {
            await interaction.reply({ content: `${CROSS} Preview data expired. Please start again.`, ephemeral: true });
            return;
        }

        // Update selected reviewers
        previewData.selectedReviewers = interaction.values;
        manualPreviewStore.set(previewId, previewData);

        await interaction.reply({ 
            content: `${TICK} Selected ${interaction.values.length} moderator(s) as reviewers: ${interaction.values.map(id => `<@${id}>`).join(', ')}`, 
            ephemeral: true 
        });
    }

    // ═══════════════════════════════════════════
    // 2b. HANDLE MEMBER SELECTION IN PREVIEW
    // ═══════════════════════════════════════════
    if (interaction.isUserSelectMenu() && interaction.customId.startsWith('manual_preview_addmember_')) {
        const previewId = interaction.customId.replace('manual_preview_addmember_', '');
        const previewData = manualPreviewStore.get(previewId);

        if (!previewData) {
            await interaction.reply({ content: `${CROSS} Preview data expired. Please start again.`, ephemeral: true });
            return;
        }

        // Update selected members
        previewData.selectedMembers = interaction.values;
        manualPreviewStore.set(previewId, previewData);

        await interaction.reply({ 
            content: `${TICK} Selected ${interaction.values.length} member(s) to copy manual to: ${interaction.values.map(id => `<@${id}>`).join(', ')}`, 
            ephemeral: true 
        });
    }

    // ═══════════════════════════════════════════
    // 2c. HANDLE "BACK" BUTTON FROM PREVIEW
    // ═══════════════════════════════════════════
    if (interaction.isButton() && interaction.customId.startsWith('manual_preview_back_')) {
        const previewId = interaction.customId.replace('manual_preview_back_', '');
        const previewData = manualPreviewStore.get(previewId);

        if (!previewData) {
            await interaction.reply({ content: `${CROSS} Preview data expired. Please start again.`, ephemeral: true });
            return;
        }

        // Re-show the modal with pre-filled data
        const modal = new ModalBuilder()
            .setCustomId(`manual_add_modal_${previewData.targetId}`)
            .setTitle('Edit Manual');

        const offenseInput = new TextInputBuilder()
            .setCustomId('manual_offense')
            .setLabel('Offense')
            .setStyle(TextInputStyle.Short)
            .setValue(previewData.offense)
            .setRequired(true)
            .setMaxLength(500);

        const actionInput = new TextInputBuilder()
            .setCustomId('manual_action')
            .setLabel('Action')
            .setStyle(TextInputStyle.Short)
            .setValue(previewData.action)
            .setRequired(true)
            .setMaxLength(500);

        const adviseInput = new TextInputBuilder()
            .setCustomId('manual_advise')
            .setLabel('Advise')
            .setStyle(TextInputStyle.Paragraph)
            .setValue(previewData.advise || '')
            .setRequired(false)
            .setMaxLength(1000);

        const noteInput = new TextInputBuilder()
            .setCustomId('manual_note')
            .setLabel('Note / Proof')
            .setStyle(TextInputStyle.Paragraph)
            .setValue(previewData.noteProof || '')
            .setRequired(false)
            .setMaxLength(1000);

        modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(offenseInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(actionInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(adviseInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(noteInput)
        );

        // Keep preview data for when modal is resubmitted
        // Don't delete it - we want to preserve the selections

        await interaction.showModal(modal);
    }

    // ═══════════════════════════════════════════
    // 2d. HANDLE "SEND" BUTTON FROM PREVIEW
    // ═══════════════════════════════════════════
    if (interaction.isButton() && interaction.customId.startsWith('manual_preview_send_')) {
        const previewId = interaction.customId.replace('manual_preview_send_', '');
        const previewData = manualPreviewStore.get(previewId);

        if (!previewData) {
            await interaction.reply({ content: `${CROSS} Preview data expired. Please start again.`, ephemeral: true });
            return;
        }

        await interaction.deferUpdate();

        try {
            // Create the manual
            const manual = await manualService.createManual(
                interaction.guildId!,
                previewData.targetId,
                previewData.moderatorId,
                previewData.offense,
                previewData.action,
                previewData.advise,
                previewData.noteProof
            );

            // Add reviewers if any were selected
            for (const reviewerId of previewData.selectedReviewers) {
                await manualService.addReviewer(manual.id, reviewerId);
            }

            // Update manual with reviewers for webhook
            const updatedManual = await manualService.getManualById(manual.id);

            // Send webhook log
            const logMsgId = await sendManualLog(interaction.guildId!, previewData.targetId, updatedManual || manual);
            if (logMsgId) {
                await manualService.setLogMessageId(manual.id, logMsgId);
            }

            // Copy manual to selected members
            for (const memberId of previewData.selectedMembers) {
                const copiedManual = await manualService.copyManualToUser(manual.id, memberId);
                if (copiedManual) {
                    const copiedLogMsgId = await sendManualLog(interaction.guildId!, memberId, copiedManual);
                    if (copiedLogMsgId) {
                        await manualService.setLogMessageId(copiedManual.id, copiedLogMsgId);
                    }
                }
            }

            const targetUser = await client.users.fetch(previewData.targetId).catch(() => null);

            let additionalInfo = '';
            if (previewData.selectedReviewers.length > 0) {
                additionalInfo += `\n**Reviewers:** ${previewData.selectedReviewers.map(id => `<@${id}>`).join(', ')}`;
            }
            if (previewData.selectedMembers.length > 0) {
                additionalInfo += `\n**Also added to:** ${previewData.selectedMembers.map(id => `<@${id}>`).join(', ')}`;
            }

            const successEmbed = new EmbedBuilder()
                .setColor(EMBED_COLOR)
                .setDescription(
                    `${TICK} **Manual Added Successfully**\n\n` +
                    `**Manual #${manual.manual_number}** for ${targetUser ? `**${targetUser.username}**` : `<@${previewData.targetId}>`}\n\n` +
                    `**Offense:** ${previewData.offense}\n` +
                    `**Action:** ${previewData.action}\n` +
                    `**Advise:** ${previewData.advise || 'N/A'}\n` +
                    `**Note / Proof:** ${previewData.noteProof || 'N/A'}${additionalInfo}`
                )
                .setFooter({ text: `Manual ID: ${manual.manual_number}` });

            await interaction.editReply({ embeds: [successEmbed], components: [] });

            // Clean up preview data
            manualPreviewStore.delete(previewId);
        } catch (err: any) {
            console.error('Error sending manual:', err);
            await interaction.followUp({ content: `${CROSS} Failed to send manual: ${err.message}`, ephemeral: true });
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

            // Edit the original webhook message
            if (updated.log_message_id) {
                await updateManualLog(interaction.guildId!, updated.log_message_id, updated.target_id, updated);
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
                .setFooter({ text: `Manual ID: ${updated.manual_number}` });

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

    // ═══════════════════════════════════════════
    // 6. HANDLE "ADD MODERATOR" BUTTON (from manual log)
    // ═══════════════════════════════════════════
    if (interaction.isButton() && interaction.customId.startsWith('manual_addmod_')) {
        const manualId = interaction.customId.replace('manual_addmod_', '');

        const menu = new UserSelectMenuBuilder()
            .setCustomId(`manual_selectmod_${manualId}`)
            .setPlaceholder('Select moderator to add as reviewer')
            .setMinValues(1)
            .setMaxValues(1);

        const row = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(menu);

        await interaction.reply({ content: 'Select a moderator to add as reviewer:', components: [row], ephemeral: true });
    }

    // ═══════════════════════════════════════════
    // 7. HANDLE "ADD MEMBER" BUTTON (from manual log)
    // ═══════════════════════════════════════════
    if (interaction.isButton() && interaction.customId.startsWith('manual_addmember_')) {
        const manualId = interaction.customId.replace('manual_addmember_', '');

        const menu = new UserSelectMenuBuilder()
            .setCustomId(`manual_selectmember_${manualId}`)
            .setPlaceholder('Select member to copy manual to')
            .setMinValues(1)
            .setMaxValues(1);

        const row = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(menu);

        await interaction.reply({ content: 'Select a member to add the same manual to:', components: [row], ephemeral: true });
    }

    // ═══════════════════════════════════════════
    // 8. HANDLE MODERATOR SELECTION (Add reviewer)
    // ═══════════════════════════════════════════
    if (interaction.isUserSelectMenu() && interaction.customId.startsWith('manual_selectmod_')) {
        const manualId = interaction.customId.replace('manual_selectmod_', '');
        const selectedUserId = interaction.values[0];

        await interaction.deferUpdate();

        try {
            const updated = await manualService.addReviewer(manualId, selectedUserId);
            if (!updated) {
                await interaction.followUp({ content: `${CROSS} Manual not found.`, ephemeral: true });
                return;
            }

            // Update webhook message
            if (updated.log_message_id) {
                await updateManualLog(interaction.guildId!, updated.log_message_id, updated.target_id, updated);
            }

            await interaction.editReply({ content: `${TICK} Added <@${selectedUserId}> as reviewer.`, components: [] });
        } catch (err: any) {
            console.error('Error adding reviewer:', err);
            await interaction.followUp({ content: `${CROSS} Failed to add reviewer: ${err.message}`, ephemeral: true });
        }
    }

    // ═══════════════════════════════════════════
    // 9. HANDLE MEMBER SELECTION (Copy manual)
    // ═══════════════════════════════════════════
    if (interaction.isUserSelectMenu() && interaction.customId.startsWith('manual_selectmember_')) {
        const originalManualId = interaction.customId.replace('manual_selectmember_', '');
        const newTargetId = interaction.values[0];

        await interaction.deferUpdate();

        try {
            const newManual = await manualService.copyManualToUser(originalManualId, newTargetId);
            if (!newManual) {
                await interaction.followUp({ content: `${CROSS} Failed to copy manual.`, ephemeral: true });
                return;
            }

            // Send new webhook log
            const logMsgId = await sendManualLog(interaction.guildId!, newTargetId, newManual);
            if (logMsgId) {
                await manualService.setLogMessageId(newManual.id, logMsgId);
            }

            const targetUser = await client.users.fetch(newTargetId).catch(() => null);
            await interaction.editReply({ 
                content: `${TICK} Manual #${newManual.manual_number} created for ${targetUser ? `**${targetUser.username}**` : `<@${newTargetId}>`}`, 
                components: [] 
            });
        } catch (err: any) {
            console.error('Error copying manual:', err);
            await interaction.followUp({ content: `${CROSS} Failed to copy manual: ${err.message}`, ephemeral: true });
        }
    }
});

export { sendManualLog };
