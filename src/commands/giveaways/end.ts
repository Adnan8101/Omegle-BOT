import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { GiveawayService } from '../../services/GiveawayService';
import { hasGiveawayPermissions, hasGiveawayPermissionsMessage } from '../../util/giveaway/permissions';
import { Emojis } from '../../util/giveaway/emojis';
export default {
    data: new SlashCommandBuilder()
        .setName('gend')
        .setDescription('End a giveaway immediately')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addStringOption(option => option.setName('message_id').setDescription('Message ID of the giveaway').setRequired(true)),
    requiresPermissions: true,
    async checkPermissions(message: any): Promise<boolean> {
        return await hasGiveawayPermissionsMessage(message);
    },
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
        if (!await hasGiveawayPermissions(interaction)) {
            return;
        }
        await this.run(interaction, interaction.options.getString('message_id', true));
    },
    async prefixRun(message: any, args: string[]) {
        if (args.length < 1) return message.reply(`${Emojis.CROSS} Usage: \`!gend <message_id>\``);
        await this.run(message, args[0]);
    },
    async run(ctx: any, messageId: string) {
        try {
            // Get client from ctx or ctx.client
            const client = ctx.client || (ctx.inner && ctx.inner.client) || (ctx.guild && ctx.guild.client);
            if (!client) {
                throw new Error('Client not available');
            }
            
            const service = new GiveawayService(client);
            await service.endGiveaway(messageId);
            
            // Handle reply for both interaction and message contexts
            let reply;
            if (ctx.editReply) {
                // Interaction context
                reply = await ctx.editReply({ content: `${Emojis.TICK} Giveaway ended.`, flags: [MessageFlags.Ephemeral] });
            } else if (ctx.reply) {
                // Message context
                reply = await ctx.reply({ content: `${Emojis.TICK} Giveaway ended.` });
            }
            
            setTimeout(async () => {
                try {
                    if (ctx.deleteReply) {
                        await ctx.deleteReply().catch(() => {});
                    } else if (reply && typeof reply.delete === 'function') {
                        await reply.delete().catch(() => {});
                    }
                } catch (e) {}
            }, 3000);
        } catch (error) {
            try {
                if (ctx.editReply) {
                    await ctx.editReply({ content: `${Emojis.CROSS} Failed to end giveaway. Check ID.`, flags: [MessageFlags.Ephemeral] });
                } else if (ctx.reply) {
                    await ctx.reply({ content: `${Emojis.CROSS} Failed to end giveaway. Check ID.` });
                }
            } catch (e) {
                console.error('Failed to send error message:', e);
            }
        }
    }
};
