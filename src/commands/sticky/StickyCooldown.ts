import { Context } from '../../core/context';
import { stickyService } from '../../services/sticky/StickyService';
import { permissions } from '../../services/permissions';

export const StickyCooldown = async (ctx: Context, args: string[]) => {
    const allowed = await permissions.can(ctx, 'sticky.manage');
    if (!allowed) {
        // Silently ignore if user doesn't have permission
        return;
    }

    const { EmbedBuilder, Colors } = require('discord.js');
    const seconds = parseInt(args[0]);
    if (isNaN(seconds)) {
        const embed = new EmbedBuilder()
            .setColor(0x2b2d31)
        .setTitle('Invalid Input')
            .setDescription('Please provide a valid number of seconds.')
            .addFields({ name: 'Usage', value: '`!sticky cooldown <seconds>`' });
        await ctx.reply({ embeds: [embed] });
        return;
    }

    try {
        await stickyService.setCooldown(ctx, seconds);
        const embed = new EmbedBuilder()
            .setColor(0x2b2d31)
        .setTitle('Cooldown Updated')
            .setDescription(`Sticky message cooldown for <#${ctx.channelId}> set to **${seconds} seconds**.`)
            .setTimestamp();
        await ctx.reply({ embeds: [embed] });
    } catch (err: any) {
        const embed = new EmbedBuilder()
            .setColor(0x2b2d31)
        .setTitle('Error')
            .setDescription(err.message || 'Failed to set cooldown.');
        await ctx.reply({ embeds: [embed] });
    }
};
