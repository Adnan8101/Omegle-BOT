import {
    ButtonInteraction,
    ModalSubmitInteraction,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    EmbedBuilder,
    Colors,
    TextChannel
} from 'discord.js';
import { db } from '../../data/db';

export class SuggestionInteractionHandler {
    /**
     * Handle the "Suggest" button click
     */
    static async handleSuggestButton(interaction: ButtonInteraction): Promise<void> {
        if (!interaction.guild) return;

        // Check if suggestion system is enabled
        const config = await db.suggestionConfig.findUnique({
            where: { guild_id: interaction.guild.id }
        });

        if (!config || !config.enabled) {
            await interaction.reply({
                content: 'Suggestion system is not enabled in this server.',
                ephemeral: true
            });
            return;
        }

        if (!config.channel_id) {
            await interaction.reply({
                content: 'Suggestion channel is not configured.',
                ephemeral: true
            });
            return;
        }

        // Show modal for suggestion input
        const modal = new ModalBuilder()
            .setCustomId('suggest_modal')
            .setTitle('Submit a Suggestion');

        const suggestionInput = new TextInputBuilder()
            .setCustomId('suggestion_text')
            .setLabel('Your Suggestion')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Enter your suggestion here...')
            .setRequired(true)
            .setMaxLength(1000);

        const actionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(suggestionInput);
        modal.addComponents(actionRow);

        await interaction.showModal(modal);
    }

    /**
     * Handle the suggestion modal submission
     */
    static async handleSuggestModal(interaction: ModalSubmitInteraction): Promise<void> {
        if (!interaction.guild) return;

        // Defer immediately to prevent timeout
        await interaction.deferReply({ ephemeral: true });

        try {
            const suggestionText = interaction.fields.getTextInputValue('suggestion_text').trim();

            if (!suggestionText) {
                await interaction.editReply({
                    content: 'Please provide a valid suggestion.'
                });
                return;
            }

            // Get config
            const config = await db.suggestionConfig.findUnique({
                where: { guild_id: interaction.guild.id }
            });

            if (!config || !config.enabled || !config.channel_id) {
                await interaction.editReply({
                    content: 'Suggestion system is not properly configured.'
                });
                return;
            }

            // Get the suggestion channel
            const suggestionChannel = await interaction.guild.channels.fetch(config.channel_id).catch(() => null);

            if (!suggestionChannel || !suggestionChannel.isTextBased()) {
                await interaction.editReply({
                    content: 'Suggestion channel not found or is invalid.'
                });
                return;
            }

            // Generate incremental suggestion number
            const lastSuggestion = await db.suggestion.findFirst({
                where: { guild_id: interaction.guild.id },
                orderBy: { suggestion_number: 'desc' }
            });

            const suggestionNumber = (lastSuggestion?.suggestion_number || 0) + 1;

            // Create suggestion record
            const suggestionRecord = await db.suggestion.create({
                data: {
                    guild_id: interaction.guild.id,
                    channel_id: config.channel_id,
                    author_id: interaction.user.id,
                    suggestion: suggestionText,
                    suggestion_number: suggestionNumber,
                    message_id: '', // Will update after sending
                    status: 'pending'
                }
            });

            // Create embed
            const embed = new EmbedBuilder()
                
                .setColor(0x2b2d31)
            .setAuthor({
                    name: interaction.user.username,
                    iconURL: interaction.user.displayAvatarURL()
                })
                .setTitle(`Suggestion #${suggestionNumber}`)
                .setDescription(suggestionText)
                .setFooter({ text: `Suggestion #${suggestionNumber}` })
                .setTimestamp();

            // Send to suggestion channel
            const suggestionMessage = await (suggestionChannel as TextChannel).send({ embeds: [embed] });

            // Add voting reactions
            await suggestionMessage.react('⬆️');
            await suggestionMessage.react('⬇️');

            // Update the record with message ID
            await db.suggestion.update({
                where: { id: suggestionRecord.id },
                data: { message_id: suggestionMessage.id }
            });

            // Delete old sticky message if exists
            if (config.sticky_message_id) {
                try {
                    const oldSticky = await (suggestionChannel as TextChannel).messages.fetch(config.sticky_message_id);
                    await oldSticky.delete();
                } catch (e) {
                    // Old sticky might already be deleted
                }
            }

            // Create new sticky message
            const stickyEmbed = new EmbedBuilder()
                
                .setColor(0x2b2d31)
            .setTitle('Suggestions')
                .setDescription('Click the button below to submit a suggestion!');

            const button = new ButtonBuilder()
                .setCustomId('suggest_button')
                .setLabel('Suggest')
                .setStyle(ButtonStyle.Secondary);

            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

            const newSticky = await (suggestionChannel as TextChannel).send({
                embeds: [stickyEmbed],
                components: [row]
            });

            // Update config with new sticky message ID
            await db.suggestionConfig.update({
                where: { guild_id: interaction.guild.id },
                data: { sticky_message_id: newSticky.id }
            });

            // Confirm to user
            await interaction.editReply({
                content: `Your suggestion has been submitted as **Suggestion #${suggestionNumber}**!`
            });
        } catch (error) {
            console.error('Error handling suggestion modal:', error);
            await interaction.editReply({
                content: 'An error occurred while processing your suggestion. Please try again.'
            });
        }
    }
}