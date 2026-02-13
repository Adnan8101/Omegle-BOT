import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { GiveawayService } from '../../services/GiveawayService';
import { hasGiveawayPermissions } from '../../util/giveaway/permissions';
import { Emojis } from '../../util/giveaway/emojis';
export default {
    data: new SlashCommandBuilder()
        .setName('gdelete')
        .setDescription('Delete a giveaway completely')
        .addStringOption(option =>
            option.setName('message_id').setDescription('Message ID (active) or ID (scheduled)').setRequired(true)),
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
        if (!await hasGiveawayPermissions(interaction)) {
            return;
        }
        const inputId = interaction.options.getString('message_id', true);
        await this.run(interaction, inputId);
    },
    async prefixRun(message: any, args: string[]) {
        if (!message.member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
            return;
        }
        if (args.length < 1) {
            return message.reply(`${Emojis.CROSS} Usage: \`!gdelete <message_id>\``);
        }
        await this.run(message, args[0]);
    },
    async run(ctx: any, inputId: string) {
        try {
            const client = ctx.client || (ctx.inner && ctx.inner.client) || (ctx.guild && ctx.guild.client);
            if (!client) throw new Error('Client not available');
            
            const service = new GiveawayService(client);
            
            if (/^\d+$/.test(inputId) && inputId.length < 10) {
                const id = parseInt(inputId);
                try {
                    await service.deleteScheduledGiveaway(id);
                    const msg = `${Emojis.TICK} Scheduled giveaway **#${id}** cancelled and deleted.`;
                    if (ctx.editReply) {
                        await ctx.editReply({ content: msg, flags: [MessageFlags.Ephemeral] });
                    } else if (ctx.reply) {
                        await ctx.reply({ content: msg });
                    }
                    setTimeout(async () => {
                        try {
                            if (ctx.deleteReply) await ctx.deleteReply().catch(() => {});
                        } catch (e) { }
                    }, 3000);
                    return;
                } catch (e) { }
            }
            
            await service.deleteGiveaway(inputId);
            const msg = `${Emojis.TICK} Giveaway deleted.`;
            if (ctx.editReply) {
                await ctx.editReply({ content: msg, flags: [MessageFlags.Ephemeral] });
            } else if (ctx.reply) {
                await ctx.reply({ content: msg });
            }
            setTimeout(async () => {
                try {
                    if (ctx.deleteReply) await ctx.deleteReply().catch(() => {});
                } catch (e) { }
            }, 3000);
        } catch (error) {
            try {
                const msg = `${Emojis.CROSS} Failed to delete giveaway. Check ID.`;
                if (ctx.editReply) {
                    await ctx.editReply({ content: msg, flags: [MessageFlags.Ephemeral] });
                } else if (ctx.reply) {
                    await ctx.reply({ content: msg });
                }
            } catch (e) {
                console.error('Failed to send error message:', e);
            }
        }
    }
};
