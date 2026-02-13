import { Context } from '../../core/context';
import { Resolver } from '../../util/Resolver';
import { EmbedBuilder, PermissionFlagsBits, User } from 'discord.js';
import { Command } from '../../core/command';
import { hasPermission } from '../../util/permissions';
import { hasModRole } from '../../util/modRole';
import { ModLogger } from '../../services/logging/ModLogger';

const TICK = '<:tickYes:1469272837192814623>';
const CROSS = '<:cross:1469273232929456314>';

export const Dm: Command = {
    name: 'dm',
    description: 'Sends a Direct Message to a specified user via the bot',
    category: 'Moderator Utils',
    syntax: 'dm <@user> <message>',
    example: 'dm @User Hello there',
    permissions: [PermissionFlagsBits.ManageMessages],
    modAction: 'dm',
    execute: async (ctx: Context, args: string[]) => {
        await ctx.defer();
        if (!ctx.inner.member) return;

        if (args.length < 2) {
            await ctx.reply({ content: 'Usage: !dm <user> <message>', ephemeral: true });
            return;
        }

        const targetInput = args[0];
        const messageContent = args.slice(1).join(' ');

        const targetUser = await Resolver.getUser(targetInput);
        if (!targetUser) {
            await ctx.reply({ content: 'User not found.', ephemeral: true });
            return;
        }

        try {
            await targetUser.send(`**Message from ${ctx.inner.guild?.name}:**\n${messageContent}`);

            const embed = new EmbedBuilder()
                .setDescription(`${TICK} **DM Sent**\n\nSent to **${targetUser.tag}**`);

            await ctx.reply({ embeds: [embed] });

            // Log action
            await ModLogger.log(ctx.inner.guild!, ctx.inner.member.user as User, targetUser, 'DM', messageContent);
        } catch (err: any) {
            const embed = new EmbedBuilder()
                .setDescription(`${CROSS} **DM Failed**\n\nFailed to DM **${targetUser.tag}**. DMs might be closed.`);
            await ctx.reply({ embeds: [embed] });
        }
    }
};
