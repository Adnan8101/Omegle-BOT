import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { GiveawayService } from '../../services/GiveawayService';
import { hasGiveawayPermissions } from '../../util/giveaway/permissions';
import { Emojis } from '../../util/giveaway/emojis';
export default {
    data: new SlashCommandBuilder()
        .setName('greroll')
        .setDescription('Reroll a winner for an ended giveaway')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addStringOption(option => option.setName('message_id').setDescription('Message ID of the giveaway').setRequired(true)),
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
        if (!await hasGiveawayPermissions(interaction)) {
            return;
        }
        await this.run(interaction, interaction.options.getString('message_id', true));
    },
    async prefixRun(message: any, args: string[]) {
        if (!message.member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
            return;
        }
        if (args.length < 1) return message.reply(`${Emojis.CROSS} Usage: \`!greroll <message_id>\``);
        await this.run(message, args[0]);
    },
    async run(ctx: any, messageId: string) {
        try {
            const client = ctx.client || (ctx.inner && ctx.inner.client) || (ctx.guild && ctx.guild.client);
            if (!client) throw new Error('Client not available');
            
            const service = new GiveawayService(client);
            const winners = await service.rerollGiveaway(messageId);
            
            if (winners.length > 0) {
                let reply;
                if (ctx.editReply) {
                    reply = await ctx.editReply({ content: `${Emojis.TICK} Successfully rerolled!`, flags: [MessageFlags.Ephemeral] });
                } else if (ctx.reply) {
                    reply = await ctx.reply({ content: `${Emojis.TICK} Successfully rerolled!` });
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
            } else {
                if (ctx.editReply) {
                    await ctx.editReply({ content: `${Emojis.CROSS} Could not find a new winner.`, flags: [MessageFlags.Ephemeral] });
                } else if (ctx.reply) {
                    await ctx.reply({ content: `${Emojis.CROSS} Could not find a new winner.` });
                }
            }
        } catch (error: any) {
            try {
                if (ctx.editReply) {
                    await ctx.editReply({ content: `${Emojis.CROSS} ${error.message || 'Failed to reroll.'}`, flags: [MessageFlags.Ephemeral] });
                } else if (ctx.reply) {
                    await ctx.reply({ content: `${Emojis.CROSS} ${error.message || 'Failed to reroll.'}` });
                }
            } catch (e) {
                console.error('Failed to send error message:', e);
            }
        }
    }
};
