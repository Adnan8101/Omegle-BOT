import { Context } from '../../core/context';
import { stickyService } from '../../services/sticky/StickyService';
import { permissions } from '../../services/permissions';

export const StickyAdd = async (ctx: Context, args: string[]) => {
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
            .setDescription('Please provide the content for the sticky message.')
            .addFields({ name: 'Usage', value: '`!sticky add <content>`' });
        await ctx.reply({ embeds: [embed] });
        return;
    }

    try {
        await stickyService.add(ctx, content);
        const embed = new EmbedBuilder()
            .setColor(0x2b2d31)
        .setTitle('Sticky Message Created')
            .setDescription(`Successfully created sticky message in <#${ctx.channelId}>.`)
            .addFields({ name: 'Content', value: content.substring(0, 1024) })
            .setTimestamp();
        await ctx.reply({ embeds: [embed] });
    } catch (err: any) {
        const embed = new EmbedBuilder()
            .setColor(0x2b2d31)
        .setTitle('Error')
            .setDescription(err.message || 'Failed to create sticky message.');
        await ctx.reply({ embeds: [embed] });
    }
};
