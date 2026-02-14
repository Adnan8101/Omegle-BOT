import { Context } from '../../core/context';
import { afkService } from '../../services/afk/AfkService';
import { EmbedBuilder, Colors } from 'discord.js';
import { Command } from '../../core/command';

export const AfkList: Command = {
    name: 'afklist',
    description: 'List all AFK users',
    category: 'AFK',
    syntax: 'afklist',
    example: 'afklist',
    permissions: [],
    execute: async (ctx: Context, args: string[]) => {
        try {
            const afkUsers = await afkService.getAllAfk(ctx.guildId);

            if (afkUsers.length === 0) {
                await ctx.reply({ content: 'No users are currently AFK.', ephemeral: true });
                return;
            }

            const description = afkUsers.map(u => {
                const time = Math.floor(new Date(u.timestamp).getTime() / 1000);
                return `<@${u.user_id}>: **${u.reason}** (<t:${time}:R>)`;
            }).join('\n');

            const embed = new EmbedBuilder()
                .setColor(0x2b2d31)
            .setTitle(`AFK Users (${afkUsers.length})`)
                .setDescription(description.substring(0, 4000));

            await ctx.reply({ embeds: [embed] });
        } catch (err: any) {
            await ctx.reply({ content: `Failed to list AFK users: ${err.message}`, ephemeral: true });
        }
    }
};
