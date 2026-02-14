import { Context } from '../../core/context';
import { autoModService } from '../../services/moderation/AutoModService';
import { EmbedBuilder, PermissionFlagsBits, User } from 'discord.js';
import { Command } from '../../core/command';
import { ModLogger } from '../../services/logging/ModLogger';

const TICK = '<:tickYes:1469272837192814623>';

export const BanWord: Command = {
    name: 'banword',
    description: 'Adds one or more words to the server banned words list',
    category: 'Moderator Utils',
    syntax: 'banword <add|remove|list> [word]',
    example: 'banword add badword',
    permissions: [PermissionFlagsBits.ManageMessages],
    modAction: 'banword',
    execute: async (ctx: Context, args: string[]) => {
        await ctx.defer();
        if (!ctx.inner.member) return;

        const input = args.join(' ');
        if (!input) {
            await ctx.reply({ content: 'Please provide words allowed separated by comma.', ephemeral: true });
            return;
        }

        const words = input.split(',').map(w => w.trim()).filter(w => w.length > 0);
        if (words.length === 0) {
            await ctx.reply({ content: 'No valid words provided.', ephemeral: true });
            return;
        }

        try {
            await autoModService.addWords(ctx.guildId, words, ctx.authorId);

            const embed = new EmbedBuilder()
                .setColor(0x2b2d31)
            .setDescription(
                    `${TICK} **Banned Words Added**\n\n` +
                    `Added **${words.length}** words: ${words.join(', ')}`
                );

            await ctx.reply({ embeds: [embed] });

            // Log action
            await ModLogger.log(ctx.inner.guild!, ctx.inner.member.user as User, 'Banned Words', 'BanWord', null, {
                channel: `Added words: ${words.join(', ')}`
            });
        } catch (err: any) {
            await ctx.reply({ content: `Failed to add banned words: ${err.message}`, ephemeral: true });
        }
    }
};
