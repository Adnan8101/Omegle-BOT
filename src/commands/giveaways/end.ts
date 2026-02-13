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
        console.log(`[Giveaway] End command executed by ${interaction.user.tag} with message ID: ${interaction.options.getString('message_id', true)}`);
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        if (!await hasGiveawayPermissions(interaction)) {
            console.log(`[Giveaway] End command - permission denied for ${interaction.user.tag}`);
            return;
        }
        await this.run(interaction, interaction.options.getString('message_id', true));
    },
    async prefixRun(message: any, args: string[]) {
        console.log(`[Giveaway] Prefix end command executed by ${message.author?.tag || 'unknown'} with args: ${args}`);
        
        if (!message.member?.permissions?.has?.('ManageGuild')) {
            console.log(`[Giveaway] Prefix end command - permission denied for ${message.author?.tag}`);
            return message.reply(`${Emojis.CROSS} You need Manage Guild permission to use this command.`).catch(console.error);
        }
        
        if (args.length < 1) {
            return message.reply(`${Emojis.CROSS} Usage: \`!gend <message_id>\``).catch(console.error);
        }
        
        await this.run(message, args[0]);
    },
    async run(ctx: any, messageId: string) {
        console.log(`[Giveaway] Attempting to end giveaway with message ID: ${messageId}`);
        
        try {
            // Validate message ID format
            if (!messageId || !/^\d{17,19}$/.test(messageId)) {
                throw new Error('Invalid message ID format. Please provide a valid Discord message ID.');
            }
            
            // Get client from ctx or ctx.client
            const client = ctx.client || (ctx.inner && ctx.inner.client) || (ctx.guild && ctx.guild.client);
            if (!client) {
                console.error(`[Giveaway] Client not available from context:`, { 
                    hasClient: !!ctx.client, 
                    hasInner: !!ctx.inner, 
                    hasGuild: !!ctx.guild 
                });
                throw new Error('Bot client not available');
            }
            
            console.log(`[Giveaway] Creating service and ending giveaway...`);
            const service = new GiveawayService(client);
            await service.endGiveaway(messageId);
            console.log(`[Giveaway] Giveaway ${messageId} ended successfully`);
            
            // Handle reply for both interaction and message contexts
            let reply: any = null;
            const successMessage = `${Emojis.TICK} Giveaway ended successfully.`;
            
            if (ctx.editReply) {
                // Interaction context (slash command)
                console.log(`[Giveaway] Sending success reply via interaction editReply`);
                reply = await ctx.editReply({ content: successMessage, flags: MessageFlags.Ephemeral });
            } else if (ctx.reply) {
                // Message context (prefix command)
                console.log(`[Giveaway] Sending success reply via message reply`);
                reply = await ctx.reply({ content: successMessage }).catch((err: any) => {
                    console.error(`[Giveaway] Failed to reply to message:`, err);
                    // Try alternative reply if regular reply fails
                    if (ctx.channel && ctx.channel.send) {
                        return ctx.channel.send(successMessage);
                    }
                    throw err;
                });
            } else {
                console.error(`[Giveaway] No reply method available on context`);
                throw new Error('Unable to send reply - no reply method available');
            }
            
            // Auto-delete success message after 3 seconds
            setTimeout(async () => {
                try {
                    if (ctx.deleteReply && typeof ctx.deleteReply === 'function') {
                        await ctx.deleteReply().catch(() => {});
                    } else if (reply && typeof reply.delete === 'function') {
                        await reply.delete().catch(() => {});
                    }
                } catch (e) {
                    // Silently handle deletion errors
                }
            }, 3000);
            
        } catch (error: any) {
            console.error(`[Giveaway] Error ending giveaway ${messageId}:`, error);
            
            const errorMessage = error.message || 'Failed to end giveaway. Please check the message ID and try again.';
            const fullErrorMessage = `${Emojis.CROSS} ${errorMessage}`;
            
            try {
                if (ctx.editReply && typeof ctx.editReply === 'function') {
                    await ctx.editReply({ content: fullErrorMessage, flags: MessageFlags.Ephemeral });
                } else if (ctx.reply && typeof ctx.reply === 'function') {
                    await ctx.reply({ content: fullErrorMessage }).catch((replyErr: any) => {
                        console.error(`[Giveaway] Failed to send error reply:`, replyErr);
                        // Try alternative error sending
                        if (ctx.channel && ctx.channel.send) {
                            return ctx.channel.send(fullErrorMessage);
                        }
                    });
                } else {
                    console.error(`[Giveaway] No reply method available for error message`);
                }
            } catch (replyError) {
                console.error(`[Giveaway] Failed to send error message:`, replyError);
            }
        }
    }
};
