import { CommandInteraction, ButtonInteraction, ModalSubmitInteraction, InteractionReplyOptions, MessagePayload } from 'discord.js';

export class ReplyHelper {
    /**
     * Safely replies to an interaction, deferring if not already deferred.
     * Use this when your operation might take more than 3 seconds.
     */
    static async handleSafeReply(
        interaction: CommandInteraction | ButtonInteraction | ModalSubmitInteraction,
        action: () => Promise<string | InteractionReplyOptions | MessagePayload>,
        ephemeral = true
    ): Promise<void> {
        try {
            // 1. Defer immediately if not already deferred or replied
            if (!interaction.deferred && !interaction.replied) {
                await interaction.deferReply({ ephemeral });
            }

            // 2. Execute the action
            const result = await action();

            // 3. Edit the deferred reply
            await interaction.editReply(result as any);

        } catch (error: any) {
            console.error('Interaction handling error:', error);

            // Standard error message
            const errorMessage = {
                content: `❌ An unexpected error occurred: ${error.message || 'Unknown error'}`,
                ephemeral: true
            };

            // Attempt to send error to user
            try {
                if (interaction.deferred || interaction.replied) {
                    await interaction.editReply(errorMessage);
                } else {
                    await interaction.reply(errorMessage);
                }
            } catch (replyError) {
                console.error('Failed to send error message to user:', replyError);
            }
        }
    }
}
