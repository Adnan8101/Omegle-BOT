import { Context } from '../../core/context';
import { stickyService } from '../../services/sticky/StickyService';
import { permissions } from '../../services/permissions';

export const StickyList = async (ctx: Context, args: string[]) => {
    const allowed = await permissions.can(ctx, 'sticky.manage');
    if (!allowed) {
        // Silently ignore if user doesn't have permission
        return;
    }

    const { EmbedBuilder, Colors } = require('discord.js');
    const stickies = await stickyService.list(ctx);

    if (stickies.length === 0) {
        const embed = new EmbedBuilder()
            .setColor(0x2b2d31)
        .setTitle('No Active Stickies')
            .setDescription('There are no sticky messages configured in this server.');
        await ctx.reply({ embeds: [embed] });
        return;
    }

    const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
    .setTitle('Active Sticky Messages')
        .setDescription(`Found **${stickies.length}** sticky message(s) in this server.`)
        .setTimestamp();

    stickies.forEach((s, i) => {
        if (i < 25) { // Discord limit
            embed.addFields({
                name: `#${s.channel_id} (Channel ID)`,
                value: `**Status**: ${s.enabled ? '<:tickYes:1469272837192814623> Enabled' : '<:cross:1469273232929456314> Disabled'}\n**Cooldown**: ${s.cooldown_seconds}s\n**Content**: ${s.content.substring(0, 100)}${s.content.length > 100 ? '...' : ''}`
            });
        }
    });

    await ctx.reply({ embeds: [embed] });
};
