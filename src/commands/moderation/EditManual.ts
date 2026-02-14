import { Context } from '../../core/context';
import { Command } from '../../core/command';
import { EmbedBuilder, PermissionFlagsBits, ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle, ChatInputCommandInteraction } from 'discord.js';
import { hasPermission } from '../../util/permissions';
import { hasModRole } from '../../util/modRole';
import { manualService } from '../../services/manual/ManualService';
import { client } from '../../core/discord';
import { EMBED_COLOR } from '../../util/embedColors';

const TICK = '<:tickYes:1469272837192814623>';
const CROSS = '<:cross:1469273232929456314>';

export const EditManual: Command = {
    name: 'edit-manual',
    description: 'Edit an existing manual entry',
    category: 'Moderation',
    syntax: 'edit-manual <id>',
    example: '/edit-manual id:5',
    permissions: [PermissionFlagsBits.ManageMessages],
    modAction: 'edit-manual',
    execute: async (ctx: Context, args: string[]) => {
        if (!ctx.inner.member) return;
        const perms = ctx.inner.member.permissions;
        const hasPerm = EditManual.permissions.some(p => hasPermission(perms, p));
        const hasRole = await hasModRole(ctx.guildId, ctx.inner.member);

        if (!hasPerm && !hasRole) {
            await ctx.reply({ content: `${CROSS} You do not have permission to use this command.`, ephemeral: true });
            return;
        }

        if (!args[0]) {
            await ctx.reply({ content: `${CROSS} Please provide a manual number.\n**Usage:** \`/edit-manual id:5\``, ephemeral: true });
            return;
        }

        const manualNumber = parseInt(args[0]);
        if (isNaN(manualNumber)) {
            await ctx.reply({ content: `${CROSS} Invalid manual number. Please provide a valid number.`, ephemeral: true });
            return;
        }

        const manual = await manualService.getManual(ctx.guildId, manualNumber);
        if (!manual) {
            await ctx.reply({ content: `${CROSS} Manual #${manualNumber} not found.`, ephemeral: true });
            return;
        }

        // If this is a slash command interaction, show modal
        if (ctx.inner instanceof ChatInputCommandInteraction) {
            const interaction = ctx.inner as ChatInputCommandInteraction;
            
            const modal = new ModalBuilder()
                .setCustomId(`manual_edit_modal_${manual.id}`)
                .setTitle(`Edit Manual #${manual.manual_number}`);

            const offenseInput = new TextInputBuilder()
                .setCustomId('manual_offense')
                .setLabel('Offense')
                .setStyle(TextInputStyle.Short)
                .setValue(manual.offense)
                .setRequired(true)
                .setMaxLength(500);

            const actionInput = new TextInputBuilder()
                .setCustomId('manual_action')
                .setLabel('Action')
                .setStyle(TextInputStyle.Short)
                .setValue(manual.action)
                .setRequired(true)
                .setMaxLength(500);

            const adviseInput = new TextInputBuilder()
                .setCustomId('manual_advise')
                .setLabel('Advise')
                .setStyle(TextInputStyle.Paragraph)
                .setValue(manual.advise || '')
                .setRequired(false)
                .setMaxLength(1000);

            const noteInput = new TextInputBuilder()
                .setCustomId('manual_note')
                .setLabel('Note / Proof')
                .setStyle(TextInputStyle.Paragraph)
                .setValue(manual.note_proof || '')
                .setRequired(false)
                .setMaxLength(1000);

            modal.addComponents(
                new ActionRowBuilder<TextInputBuilder>().addComponents(offenseInput),
                new ActionRowBuilder<TextInputBuilder>().addComponents(actionInput),
                new ActionRowBuilder<TextInputBuilder>().addComponents(adviseInput),
                new ActionRowBuilder<TextInputBuilder>().addComponents(noteInput)
            );

            await interaction.showModal(modal);
        } else {
            // For prefix commands, just show current data
            const targetUser = await client.users.fetch(manual.target_id).catch(() => null);
            const moderator = await client.users.fetch(manual.moderator_id).catch(() => null);
            const createdTs = Math.floor(new Date(manual.created_at).getTime() / 1000);

            const embed = new EmbedBuilder()
                .setColor(EMBED_COLOR)
                .setDescription(
                    `${TICK} **Manual #${manual.manual_number}**\n\n` +
                    `**User:** ${targetUser ? `${targetUser.username}` : manual.target_id}\n` +
                    `**Offense:** ${manual.offense}\n` +
                    `**Action:** ${manual.action}\n` +
                    `**Advise:** ${manual.advise || 'N/A'}\n` +
                    `**Note / Proof:** ${manual.note_proof || 'N/A'}\n\n` +
                    `**Added by:** ${moderator ? `${moderator.username}` : manual.moderator_id}\n` +
                    `**Date:** <t:${createdTs}:F>\n\n` +
                    `> Use the slash command \`/edit-manual\` to edit this manual via modal.`
                )
                .setFooter({ text: `Manual ID: ${manual.manual_number}` });

            await ctx.reply({ embeds: [embed] });
        }
    }
};
