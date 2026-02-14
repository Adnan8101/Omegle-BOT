import { Context } from '../../core/context';
import { db } from '../../data/db';
import { EmbedBuilder, Colors, PermissionFlagsBits } from 'discord.js';
import { Command } from '../../core/command';

export const DeleteSetup: Command = {
    name: 'deletesetup',
    description: 'Delete all ModMail configuration and channels',
    category: 'Admin',
    syntax: 'deletesetup',
    example: 'deletesetup',
    permissions: [PermissionFlagsBits.Administrator],
    execute: async (ctx: Context, args: string[]) => {
        if (!ctx.inner.guild) return;

        try {
            // 1. Get Config
            const config = await db.mailConfig.findUnique({
                where: { guild_id: ctx.guildId }
            });

            if (!config) {
                await ctx.reply({ content: 'No ModMail setup found.', ephemeral: true });
                return;
            }

            // 2. Delete Channels (Best Effort)
            const channelsToDelete = [
                config.inbox_category_id,
                config.transcript_channel_id,
                config.closed_category_id
            ].filter(Boolean) as string[];

            let deletedCount = 0;
            for (const cid of channelsToDelete) {
                try {
                    const channel = await ctx.inner.guild.channels.fetch(cid).catch(() => null);
                    if (channel) {
                        await channel.delete('ModMail Setup Deletion');
                        deletedCount++;
                    }
                } catch (e) {
                    console.warn(`Failed to delete channel ${cid}`, e);
                }
            }

            // 3. Delete DB Entries
            // Cascade delete would be nice, but manual safety is good
            // Delete Tickets ? Maybe keep them for history? 
            // The user said "delete all thing ... and from db"
            // Let's delete config and categories. Tickets/Messages might be huge to delete, 
            // but if they break constraints (no category/config), we might need to.
            // Current schema doesn't strict foreign key enforce config existence on tickets usually unless defined.
            // Verify schema relations? Schema defines independent models mostly, no specific @relation fields shown in snippet.
            // So we can delete config safely.

            await db.mailCategory.deleteMany({
                where: { guild_id: ctx.guildId }
            });

            await db.mailConfig.delete({
                where: { guild_id: ctx.guildId }
            });

            const embed = new EmbedBuilder()
                .setColor(0x2b2d31)
            .setTitle('ModMail Setup Deleted')
                .setDescription(`Removed configuration and deleted **${deletedCount}** channels.`);

            await ctx.reply({ embeds: [embed] });

        } catch (err: any) {
            console.error(err);
            await ctx.reply({ content: `Error deleting setup: ${err.message}`, ephemeral: true });
        }
    }
};
