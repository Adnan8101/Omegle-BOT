import { Context } from '../../core/context';
import { Resolver } from '../../util/Resolver';
import { EmbedBuilder, PermissionFlagsBits, GuildMember, ButtonBuilder, ButtonStyle, ActionRowBuilder, ComponentType, BaseGuildVoiceChannel, ChannelType, GuildChannel, User } from 'discord.js';
import { Command } from '../../core/command';
import { hasPermission } from '../../util/permissions';
import { hasModRole } from '../../util/modRole';
import { ModLogger } from '../../services/logging/ModLogger';

const TICK = '<:tickYes:1469272837192814623>';
const CROSS = '<:cross:1469273232929456314>';

export const MoveVc: Command = {
    name: 'movevc',
    description: 'Moves all users from one voice channel to another',
    category: 'Moderator Utils',
    syntax: 'movevc <from_vc> <to_vc>',
    example: 'movevc General Gaming',
    permissions: [PermissionFlagsBits.MoveMembers],
    modAction: 'movevc',
    execute: async (ctx: Context, args: string[]) => {
        await ctx.defer();
        if (!ctx.inner.member) return;

        let fromChannel: BaseGuildVoiceChannel | null = null;
        let toChannel: BaseGuildVoiceChannel | null = null;
        const requester = ctx.inner.member as GuildMember;

        if (args.length === 1) {
            // Implicit From = Current
            if (!requester.voice.channel) {
                await ctx.reply({ content: 'You are not in a voice channel. Usage: `movevc <from> <to>` or `movevc <to>` (if in channel)', ephemeral: true });
                return;
            }
            fromChannel = requester.voice.channel;
            const toInput = args[0];
            const toCh = await Resolver.getChannel(ctx.inner.guild!, toInput);
            // Check type manually since getChannel returns Channel
            if (!toCh || ![ChannelType.GuildVoice, ChannelType.GuildStageVoice].includes(toCh.type)) {
                await ctx.reply({ content: 'Target channel not found or invalid.', ephemeral: true });
                return;
            }
            toChannel = toCh as BaseGuildVoiceChannel;

        } else if (args.length >= 2) {
            const fromInput = args[0];
            const toInput = args.slice(1).join(' '); // Remainder

            let ch1 = await Resolver.getChannel(ctx.inner.guild!, fromInput);
            if (!ch1 || ![ChannelType.GuildVoice, ChannelType.GuildStageVoice].includes(ch1.type)) {
                await ctx.reply({ content: 'Source channel not found or invalid.', ephemeral: true });
                return;
            }
            fromChannel = ch1 as BaseGuildVoiceChannel;

            let ch2 = await Resolver.getChannel(ctx.inner.guild!, toInput);
            if (!ch2 || ![ChannelType.GuildVoice, ChannelType.GuildStageVoice].includes(ch2.type)) {
                await ctx.reply({ content: 'Target channel not found or invalid.', ephemeral: true });
                return;
            }
            toChannel = ch2 as BaseGuildVoiceChannel;
        } else {
            await ctx.reply({ content: 'Usage: `movevc <from> <to>`', ephemeral: true });
            return;
        }

        if (!fromChannel || !toChannel) return;
        if (fromChannel.id === toChannel.id) {
            await ctx.reply({ content: 'Source and Target channels are the same.', ephemeral: true });
            return;
        }

        const membersToMove = fromChannel.members;
        const count = membersToMove.size;

        if (count === 0) {
            await ctx.reply({ content: 'Source channel is empty.', ephemeral: true });
            return;
        }

        // Confirmation Embed
        const embed = new EmbedBuilder()
            .setDescription(
                `⚠️ **Move Users**\n\n` +
                `Moving **${count}** users to **${toChannel.name}**?\n` +
                `Confirm?`
            );

        const yesBtn = new ButtonBuilder().setCustomId('movevc_yes').setLabel('Yes').setStyle(ButtonStyle.Success);
        const noBtn = new ButtonBuilder().setCustomId('movevc_no').setLabel('No').setStyle(ButtonStyle.Danger);
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(yesBtn, noBtn);

        const response = await ctx.reply({ embeds: [embed], components: [row] });
        const message = response instanceof require('discord.js').Message ? response : await (ctx.inner as any).fetchReply();

        try {
            const confirmation = await message.awaitMessageComponent({
                filter: (i: any) => i.user.id === ctx.authorId,
                time: 10000 // 10s
            });

            if (confirmation.customId === 'movevc_yes') {
                await confirmation.update({ content: 'Moving users...', components: [] });

                let moved = 0;
                for (const [id, member] of membersToMove) {
                    try {
                        await member.voice.setChannel(toChannel.id); // Fix: Use ID
                        moved++;
                    } catch (e) { }
                }

                const successEmbed = new EmbedBuilder()
                    .setDescription(`${TICK} **Users Moved**\n\nMoved **${moved}** users to **${toChannel.name}**`);

                await message.edit({ content: '', embeds: [successEmbed] });

                // Log action
                if (moved > 0) {
                    await ModLogger.log(ctx.inner.guild!, ctx.inner.member.user as User, `${moved} Users`, 'MoveVC', null, {
                        channel: `From ${fromChannel.name} to ${toChannel.name}`,
                        messages: moved
                    });
                }
            } else {
                await confirmation.update({ content: `${CROSS} **Move operation cancelled**`, components: [], embeds: [] });
            }

        } catch (e) {
            // Timeout
            await message.edit({ content: `${CROSS} **Move operation cancelled**`, components: [], embeds: [] });
        }
    }
};
