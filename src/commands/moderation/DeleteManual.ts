import { Context } from '../../core/context';
import { Command } from '../../core/command';
import { EmbedBuilder, PermissionFlagsBits, TextChannel } from 'discord.js';
import { hasPermission } from '../../util/permissions';
import { hasSrModRole } from '../../util/rolePermissions';
import { manualService } from '../../services/manual/ManualService';
import { client } from '../../core/discord';
import { EMBED_COLOR } from '../../util/embedColors';

const TICK = '<:tickYes:1469272837192814623>';
const CROSS = '<:cross:1469273232929456314>';

export const DeleteManual: Command = {
    name: 'delete-manual',
    description: 'Delete a manual entry (Sr Mod+ only)',
    category: 'Moderation',
    syntax: 'delete-manual <id>',
    example: '/delete-manual id:5',
    permissions: [PermissionFlagsBits.Administrator],
    modAction: 'edit-manual', // Reuse same permission level as edit
    execute: async (ctx: Context, args: string[]) => {
        await ctx.defer();
        if (!ctx.inner.member) return;
        
        // Check Sr Mod role or Administrator permission
        const perms = ctx.inner.member.permissions;
        const hasAdminPerm = hasPermission(perms, PermissionFlagsBits.Administrator);
        const hasSrMod = await hasSrModRole(ctx.guildId, ctx.inner.member);

        if (!hasAdminPerm && !hasSrMod) {
            await ctx.reply({ content: `${CROSS} You need Sr Mod or Administrator permission to delete manuals.`, ephemeral: true });
            return;
        }

        if (!args[0]) {
            await ctx.reply({ content: `${CROSS} Please provide a manual number.\n**Usage:** \`/delete-manual id:5\``, ephemeral: true });
            return;
        }

        const manualNumber = parseInt(args[0]);
        if (isNaN(manualNumber)) {
            await ctx.reply({ content: `${CROSS} Invalid manual number. Please provide a valid number.`, ephemeral: true });
            return;
        }

        const manual = await manualService.getManual(ctx.guildId, manualNumber);
        if (!manual) {
            await ctx.reply({ content: `${CROSS} Manual #${manualNumber} not found.`, ephemeral: true });
            return;
        }

        // Delete the webhook message if it exists
        if (manual.log_message_id) {
            const config = await manualService.getConfig(ctx.guildId);
            if (config?.log_channel_id) {
                const channel = client.channels.cache.get(config.log_channel_id);
                if (channel && channel.isTextBased()) {
                    const textChannel = channel as TextChannel;
                    try {
                        const webhooks = await textChannel.fetchWebhooks();
                        const webhook = webhooks.find(w => w.name === 'Manual Logs');
                        if (webhook) {
                            await webhook.deleteMessage(manual.log_message_id).catch(() => {
                                console.log('Could not delete webhook message - may already be deleted');
                            });
                        }
                    } catch (err) {
                        console.error('Error deleting manual webhook message:', err);
                    }
                }
            }
        }

        // Delete the manual from database
        await manualService.deleteManual(manual.id);

        const targetUser = await client.users.fetch(manual.target_id).catch(() => null);

        const embed = new EmbedBuilder()
            .setColor(EMBED_COLOR)
            .setDescription(
                `${TICK} **Manual Deleted Successfully**\n\n` +
                `**Manual #${manual.manual_number}** for ${targetUser ? `**${targetUser.username}**` : `<@${manual.target_id}>`}\n\n` +
                `**Offense:** ${manual.offense}\n` +
                `**Action:** ${manual.action}\n\n` +
                `**Deleted by:** <@${ctx.authorId}>`
            )
            .setFooter({ text: `Manual ID: ${manual.manual_number}` });

        await ctx.reply({ embeds: [embed] });
    }
};
