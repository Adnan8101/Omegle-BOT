import { Context } from '../../core/context';
import { modService } from '../../services/moderation/ModerationService';
import { EmbedBuilder, PermissionFlagsBits, User } from 'discord.js';
import { Command } from '../../core/command';
import { sendModDm } from '../../util/moderationDm';
import { ModLogger } from '../../services/logging/ModLogger';

const TICK = '<:tickYes:1469272837192814623>';

export const DelCase: Command = {
    name: 'delcase',
    description: 'Delete a moderation case',
    category: 'Admin',
    syntax: 'delcase <case_number>',
    example: 'delcase 123',
    permissions: [PermissionFlagsBits.Administrator],
    modAction: 'delcase',
    execute: async (ctx: Context, args: string[]) => {
        await ctx.defer();
        if (!ctx.inner.member) return;

        const caseNumStr = args[0];
        if (!caseNumStr || isNaN(parseInt(caseNumStr))) {
            await ctx.reply({ content: 'Please provide a valid case number.', ephemeral: true });
            return;
        }

        const caseNum = parseInt(caseNumStr);

        try {
            // Fetch case first to get user ID for DM
            const existingCase = await modService.getCase(ctx.guildId, caseNum);

            if (existingCase && ctx.inner.guild) {
                await sendModDm(ctx.inner.guild, existingCase.target_id, 'delcase', 'Case Deleted/Pardoned', caseNum);
            }

            const result = await modService.deleteCase(ctx.guildId, caseNum);

            if (!result) {
                await ctx.reply({ content: 'Case not found.', ephemeral: true });
                return;
            }

            const embed = new EmbedBuilder()
                .setColor(0x2b2d31)
            .setDescription(`${TICK} **Case #${caseNum} Deleted**\n\nCase pardoned`);

            await ctx.reply({ embeds: [embed] });

            // Log action
            await ModLogger.log(ctx.inner.guild!, ctx.inner.member.user as User, `Case #${caseNum}`, 'DelCase', null, {
                messages: caseNum
            });
        } catch (err: any) {
            await ctx.reply({ content: `Failed to delete case: ${err.message}`, ephemeral: true });
        }
    }
};
