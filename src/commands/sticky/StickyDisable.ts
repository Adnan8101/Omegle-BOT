import { Context } from '../../core/context';
import { stickyService } from '../../services/sticky/StickyService';
import { permissions } from '../../services/permissions';

export const StickyDisable = async (ctx: Context, args: string[]) => {
    const allowed = await permissions.can(ctx, 'sticky.manage');
    if (!allowed) {
        // Silently ignore if user doesn't have permission
        return;
    }

    const { EmbedBuilder, Colors } = require('discord.js');
    try {
        await stickyService.toggle(ctx, false);
        const embed = new EmbedBuilder()
            .setColor(0x2b2d31)
        .setTitle('Sticky Message Disabled')
            .setDescription(`Sticky message in <#${ctx.channelId}> has been **disabled**.`)
            .setTimestamp();
        await ctx.reply({ embeds: [embed] });
    } catch (err: any) {
        const embed = new EmbedBuilder()
            .setColor(0x2b2d31)
        .setTitle('Error')
            .setDescription(err.message || 'Failed to disable sticky message.');
        await ctx.reply({ embeds: [embed] });
    }
};
