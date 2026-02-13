import { Context } from '../../core/context';
import { stickyService } from '../../services/sticky/StickyService';
import { permissions } from '../../services/permissions';

export const StickyRemove = async (ctx: Context, args: string[]) => {
    const allowed = await permissions.can(ctx, 'sticky.manage');
    if (!allowed) {
        // Silently ignore if user doesn't have permission
        return;
    }

    const { EmbedBuilder, Colors } = require('discord.js');
    try {
        await stickyService.remove(ctx);
        const embed = new EmbedBuilder()
            .setTitle('Sticky Message Removed')
            .setDescription(`The sticky message for <#${ctx.channelId}> has been deleted.`)
            .setTimestamp();
        await ctx.reply({ embeds: [embed] });
    } catch (err: any) {
        const embed = new EmbedBuilder()
            .setTitle('Error')
            .setDescription(err.message || 'Failed to remove sticky message.');
        await ctx.reply({ embeds: [embed] });
    }
};
