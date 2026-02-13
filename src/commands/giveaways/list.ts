import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { hasGiveawayPermissions } from '../../util/giveaway/permissions';
import { Theme } from '../../util/giveaway/theme';
import { Emojis } from '../../util/giveaway/emojis';
import { db as prisma } from '../../data/db';
export default {
    data: new SlashCommandBuilder()
        .setName('glist')
        .setDescription('List all running and scheduled giveaways')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
        if (!await hasGiveawayPermissions(interaction)) {
            return;
        }
        await this.run(interaction);
    },
    async prefixRun(message: any) {
        if (!message.member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
            return;
        }
        await this.run(message);
    },
    async run(ctx: any) {
        const guildId = ctx.guildId!;
        const giveaways = await prisma.giveaway.findMany({
            where: { guildId, ended: false }
        });
        const scheduled = await prisma.scheduledGiveaway.findMany({
            where: { guildId }
        });
        if (giveaways.length === 0 && scheduled.length === 0) {
            const msg = 'No active or scheduled giveaways.';
            const editFn = ctx.editReply || ctx.reply;
            if (editFn) return editFn({ content: msg, flags: [MessageFlags.Ephemeral] });
            return;
        }
        const embed = new EmbedBuilder()
            .setTitle(`🎉 Active & Scheduled Giveaways`)
            .setFooter({ text: 'Use /gdelete <ID> to remove' });
        let fieldCount = 0;
        const limitedActive = giveaways.slice(0, 15);
        limitedActive.forEach((g: any) => {
            const endTimestamp = Math.floor(Number(g.endTime) / 1000);
            embed.addFields({
                name: `[Active] ${g.prize} (${g.winnersCount} winners)`,
                value: `Ends: <t:${endTimestamp}:R> | Host: <@${g.hostId}> | [Link](https://discord.com/channels/${g.guildId}/${g.channelId}/${g.messageId})`
            });
            fieldCount++;
        });
        const limitedScheduled = scheduled.slice(0, 10);
        limitedScheduled.forEach((g: any) => {
            const startTimestamp = Math.floor(Number(g.startTime) / 1000);
            embed.addFields({
                name: `[Scheduled ID: ${g.id}] ${g.prize}`,
                value: `Starts: <t:${startTimestamp}:R> (<t:${startTimestamp}:F>) | Host: <@${g.hostId}>`
            });
            fieldCount++;
        });
        if (giveaways.length + scheduled.length > 25) {
            embed.setDescription(`Showing ${fieldCount} of ${giveaways.length + scheduled.length} giveaways.`);
        }
        const editFn = ctx.editReply || ctx.reply;
        if (editFn) await editFn({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
    }
};
