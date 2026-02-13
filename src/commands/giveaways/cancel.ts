import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { GiveawayService } from '../../services/GiveawayService';
import { hasGiveawayPermissions } from '../../util/giveaway/permissions';
import { Emojis } from '../../util/giveaway/emojis';
export default {
    data: new SlashCommandBuilder()
        .setName('gcancel')
        .setDescription('Cancel a giveaway')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addStringOption(option => option.setName('message_id').setDescription('The message ID of the giveaway').setRequired(true)),
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
        if (!await hasGiveawayPermissions(interaction)) {
            return;
        }
        try {
            const service = new GiveawayService(interaction.client);
            await service.cancelGiveaway(interaction.options.getString('message_id', true));
            await interaction.editReply({ content: `${Emojis.TICK} Giveaway cancelled.` });
            setTimeout(async () => {
                try {
                    await interaction.deleteReply().catch(() => {});
                } catch (e) {}
            }, 3000);
        } catch (error: any) {
            await interaction.editReply({ content: `${Emojis.CROSS} ${error.message}` });
        }
    },
    async prefixRun(message: any, args: string[]) {
        if (!message.member?.permissions.has('ManageGuild')) {
            return;
        }
        if (args.length === 0) return message.reply(`${Emojis.CROSS} Usage: \`!gcancel <message_id>\``);
        try {
            const service = new GiveawayService(message.client);
            await service.cancelGiveaway(args[0]);
            const reply = await message.reply(`${Emojis.TICK} Giveaway cancelled.`);
            setTimeout(() => {
                message.delete?.().catch(() => { });
                reply.delete?.().catch(() => { });
            }, 3000);
        } catch (error: any) {
            await message.reply(`${Emojis.CROSS} ${error.message}`);
        }
    }
};
