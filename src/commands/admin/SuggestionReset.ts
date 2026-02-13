import { Message, PermissionFlagsBits, EmbedBuilder, Colors } from 'discord.js';
import { Command } from '../../core/command';
import { Context } from '../../core/context';
import { db } from '../../data/db';

export const SuggestionReset: Command = {
    name: 'suggestion_reset',
    description: 'Reset all suggestions and counter (Admin only)',
    category: 'Admin',
    syntax: 'suggestion_reset',
    example: 'suggestion_reset',
    permissions: [PermissionFlagsBits.Administrator],
    execute: async (ctx: Context, args: string[]): Promise<void> => {
        const message = ctx.inner as Message;
        const guild = message.guild;
        if (!guild) return;

        // Double-check admin permission
        if (!message.member?.permissions.has(PermissionFlagsBits.Administrator)) {
            await ctx.reply({ content: '⚠️ This command requires Administrator permission.' });
            return;
        }

        try {
            // Delete all suggestions for this guild
            const deletedCount = await db.suggestion.deleteMany({
                where: { guild_id: guild.id }
            });

            const embed = new EmbedBuilder()
                .setTitle('✅ Suggestions Reset')
                .setDescription(`All suggestions have been cleared and the counter has been reset.`)
                .addFields(
                    { name: 'Deleted', value: `${deletedCount.count} suggestion(s)`, inline: true }
                )
                .setTimestamp();

            await ctx.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error resetting suggestions:', error);
            await ctx.reply({ content: '❌ Failed to reset suggestions. Please try again.' });
        }
    }
};
