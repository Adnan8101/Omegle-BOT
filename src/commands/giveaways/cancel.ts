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
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
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
        console.log(`[Giveaway] Prefix cancel command executed by ${message.author?.tag || 'unknown'} with args: ${args}`);
        
        if (!message.member?.permissions?.has?.('ManageGuild')) {
            console.log(`[Giveaway] Prefix cancel command - permission denied for ${message.author?.tag}`);
            return message.reply(`${Emojis.CROSS} You need Manage Guild permission to use this command.`).catch(console.error);
        }
        
        if (args.length === 0) {
            return message.reply(`${Emojis.CROSS} Usage: \`!gcancel <message_id>\``).catch(console.error);
        }
        
        // Validate message ID format
        if (!/^\d{17,19}$/.test(args[0])) {
            return message.reply(`${Emojis.CROSS} Invalid message ID format. Please provide a valid Discord message ID.`).catch(console.error);
        }
        
        try {
            console.log(`[Giveaway] Attempting to cancel giveaway with message ID: ${args[0]}`);
            const service = new GiveawayService(message.client);
            await service.cancelGiveaway(args[0]);
            console.log(`[Giveaway] Giveaway ${args[0]} cancelled successfully`);
            
            const reply = await message.reply(`${Emojis.TICK} Giveaway cancelled.`).catch((err: any) => {
                console.error(`[Giveaway] Failed to reply to cancel message:`, err);
                // Try alternative reply
                if (message.channel && message.channel.send) {
                    return message.channel.send(`${Emojis.TICK} Giveaway cancelled.`);
                }
                throw err;
            });
            
            setTimeout(() => {
                message.delete?.().catch(() => { });
                reply.delete?.().catch(() => { });
            }, 3000);
        } catch (error: any) {
            console.error(`[Giveaway] Error cancelling giveaway ${args[0]}:`, error);
            await message.reply(`${Emojis.CROSS} ${error.message || 'Failed to cancel giveaway. Please check the message ID.'}`).catch(console.error);
        }
    }
};
