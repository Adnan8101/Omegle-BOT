import { Context } from '../../core/context';
import { EmbedBuilder, PermissionFlagsBits, TextChannel, User } from 'discord.js';
import { Command } from '../../core/command';
import { ModLogger } from '../../services/logging/ModLogger';

const TICK = '<:tickYes:1469272837192814623>';

export const Lock: Command = {
    name: 'lock',
    description: 'Locks the current text channel by disabling message sending for everyone',
    category: 'Moderation',
    syntax: 'lock',
    example: 'lock',
    permissions: [PermissionFlagsBits.ManageChannels],
    modAction: 'lock',
    execute: async (ctx: Context, args: string[]) => {
        await ctx.defer();
        if (!ctx.inner.member) return;

        if (!ctx.inner.member) return;

        const channel = ctx.inner.channel;
        if (!(channel instanceof TextChannel)) {
            await ctx.reply({ content: 'This command only works in text channels.', ephemeral: true });
            return;
        }

        try {
            await channel.permissionOverwrites.edit(ctx.inner.guild!.roles.everyone, {
                SendMessages: false
            });

            const embed = new EmbedBuilder()
                .setColor(0x2b2d31)
            .setDescription(`🔒 ${TICK} **Locked** ${channel}`);

            await ctx.reply({ embeds: [embed] });

            // Log action
            await ModLogger.log(ctx.inner.guild!, ctx.inner.member.user as User, channel.toString(), 'Lock', null, { channel: channel.toString() });
        } catch (err: any) {
            await ctx.reply({ content: `Failed to lock channel: ${err.message}`, ephemeral: true });
        }
    }
};
