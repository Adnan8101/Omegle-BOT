import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { hasGiveawayPermissions } from '../../util/giveaway/permissions';
import { Emojis } from '../../util/giveaway/emojis';
import { db as prisma } from '../../data/db';
export default {
    data: new SlashCommandBuilder()
        .setName('gstop')
        .setDescription('Stop/pause a giveaway countdown')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addStringOption(option =>
            option.setName('message_id')
                .setDescription('The message ID of the giveaway')
                .setRequired(true)),
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
        if (!await hasGiveawayPermissions(interaction)) {
            return;
        }
        const messageId = interaction.options.getString('message_id', true);
        try {
            const giveaway = await prisma.giveaway.findUnique({
                where: { messageId }
            });
            if (!giveaway) {
                return interaction.reply({
                    content: `${Emojis.CROSS} Giveaway not found.`,
                    flags: [MessageFlags.Ephemeral]
                });
            }
            if (giveaway.ended) {
                return interaction.reply({
                    content: `${Emojis.CROSS} This giveaway has already ended.`,
                    flags: [MessageFlags.Ephemeral]
                });
            }
            if (giveaway.paused) {
                return interaction.reply({
                    content: `${Emojis.CROSS} This giveaway is already paused.`,
                    flags: [MessageFlags.Ephemeral]
                });
            }
            await prisma.giveaway.update({
                where: { messageId },
                data: {
                    ...(giveaway.hasOwnProperty('paused') ? {
                        paused: true,
                        pausedAt: BigInt(Date.now())
                    } : {})
                } as any,
            });
            const reply = await interaction.editReply({
                content: `${Emojis.TICK} Giveaway paused successfully. Use \`/gresume\` to resume it.`,
            });
            setTimeout(async () => {
                try {
                    await interaction.deleteReply().catch(() => {});
                } catch (e) {}
            }, 3000);
        } catch (error: any) {
            await interaction.editReply({
                content: `${Emojis.CROSS} Failed to pause giveaway: ${error.message}`,
            });
        }
    },
    async prefixRun(message: any, args: string[]) {
        if (!message.member?.permissions.has('ManageGuild')) {
            return;
        }
        if (args.length === 0) {
            return message.reply(`${Emojis.CROSS} Usage: \`!gstop <message_id>\``);
        }
        const messageId = args[0];
        try {
            const giveaway = await prisma.giveaway.findUnique({
                where: { messageId }
            });
            if (!giveaway) {
                return message.reply(`${Emojis.CROSS} Giveaway not found.`);
            }
            if (giveaway.ended) {
                return message.reply(`${Emojis.CROSS} This giveaway has already ended.`);
            }
            if (giveaway.paused) {
                return message.reply(`${Emojis.CROSS} This giveaway is already paused.`);
            }
            await prisma.giveaway.update({
                where: { messageId },
                data: {
                    paused: true,
                    pausedAt: BigInt(Date.now())
                }
            });
            const reply = await message.reply(`${Emojis.TICK} Giveaway paused successfully. Use \`!gresume\` to resume it.`);
            setTimeout(async () => {
                try {
                    await message.delete().catch(() => {});
                    await reply.delete().catch(() => {});
                } catch (e) {}
            }, 3000);
        } catch (error: any) {
            await message.reply(`${Emojis.CROSS} Failed to pause giveaway: ${error.message}`);
        }
    }
};
