import { Context } from '../../core/context';
import { stickyService } from '../../services/sticky/StickyService';
import { permissions } from '../../services/permissions';

export const StickyEdit = async (ctx: Context, args: string[]) => {
    const allowed = await permissions.can(ctx, 'sticky.manage');
    if (!allowed) {
        // Silently ignore if user doesn't have permission
        return;
    }

    const { EmbedBuilder, Colors } = require('discord.js');

    const content = args.join(' ');
    if (!content) {
        const embed = new EmbedBuilder()
            .setColor(0x2b2d31)
        .setTitle('Missing Argument')
            .setDescription('Please provide the new content for the sticky message.')
            .addFields({ name: 'Usage', value: '`!sticky edit <new_content>`' });
        await ctx.reply({ embeds: [embed] });
        return;
    }

    try {
        await stickyService.edit(ctx, content);
        const embed = new EmbedBuilder()
            .setColor(0x2b2d31)
        .setTitle('Sticky Message Updated')
            .setDescription(`Successfully updated sticky message in <#${ctx.channelId}>.`)
            .addFields({ name: 'New Content', value: content.substring(0, 1024) })
            .setTimestamp();
        await ctx.reply({ embeds: [embed] });
    } catch (err: any) {
        const embed = new EmbedBuilder()
            .setColor(0x2b2d31)
        .setTitle('Error')
            .setDescription(err.message || 'Failed to update sticky message.');
        await ctx.reply({ embeds: [embed] });
    }
};
