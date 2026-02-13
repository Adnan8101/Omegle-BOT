import { Context } from '../../core/context';
import { Resolver } from '../../util/Resolver';
import { EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Command } from '../../core/command';
import { hasPermission } from '../../util/permissions';
import { hasModRole } from '../../util/modRole';
import { modService } from '../../services/moderation/ModerationService';

const TICK = '<:tickYes:1469272837192814623>';
const CROSS = '<:cross:1469273232929456314>';

export const Whois: Command = {
    name: 'whois',
    description: 'Get detailed information about a user',
    category: 'Moderator Utils',
    syntax: 'whois [user]',
    example: 'whois @User',
    permissions: [PermissionFlagsBits.ManageMessages],
    modAction: 'whois',
    execute: async (ctx: Context, args: string[]) => {
        await ctx.defer();
        if (!ctx.inner.member) return;
        const perms = ctx.inner.member.permissions;
        const hasPerm = Whois.permissions.some(p => hasPermission(perms, p));

        const hasRole = await hasModRole(ctx.guildId, ctx.inner.member);

        if (!hasPerm && !hasRole) return;

        const targetInput = args[0] || ctx.authorId;
        const targetUser = await Resolver.getUser(targetInput);

        if (!targetUser) {
            await ctx.reply({ content: 'User not found.', ephemeral: true });
            return;
        }

        const member = await ctx.inner.guild?.members.fetch(targetUser.id).catch(() => null);

        const created = Math.floor(targetUser.createdTimestamp / 1000);
        const joined = member ? Math.floor(member.joinedTimestamp! / 1000) : null;

        // Get roles with count
        const rolesList = member ? member.roles.cache.filter(r => r.name !== '@everyone') : null;
        const rolesCount = rolesList ? rolesList.size : 0;
        const rolesDisplay = rolesList && rolesCount > 0 
            ? rolesList.map(r => r.toString()).join(' ') 
            : 'No roles';

        // Get moderation stats
        const logs = await modService.getLogs(ctx.guildId, targetUser.id);
        const warnCount = logs?.filter(l => l.action === 'warn').length || 0;
        const manualCount = logs?.filter(l => l.action === 'mute' && !l.active).length || 0;

        // Check for active timeout/mute
        const activeMute = logs?.find(l => l.action === 'mute' && l.active);
        let timedOutText = '';
        if (activeMute) {
            const unmuteTime = activeMute.duration_seconds 
                ? Math.floor((new Date(activeMute.created_at).getTime() / 1000) + activeMute.duration_seconds)
                : null;
            timedOutText = `\n**Timed Out**\nUnmute ${unmuteTime ? `<t:${unmuteTime}:R>` : 'permanent'}`;
        }

        const embed = new EmbedBuilder()
            .setThumbnail(targetUser.displayAvatarURL())
            .setDescription(
                `${TICK} **${targetUser.tag}**\n\n` +
                `@${targetUser.username}\n\n` +
                `**Joined**\n` +
                `${joined ? `<t:${joined}:f>` : 'Not in server'}\n` +
                `${joined ? `<t:${joined}:R>` : ''}\n\n` +
                `**Registered**\n` +
                `<t:${created}:f>\n` +
                `<t:${created}:R>\n\n` +
                `**Roles(${rolesCount})**\n${rolesDisplay}` +
                (timedOutText ? `\n\n${timedOutText}` : '') +
                `\n\n**Modlogs**\n` +
                `Warns : ${warnCount}\n` +
                `Manuals : ${manualCount}`
            )
            .setFooter({ text: `${targetUser.id} | Today at ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}` });

        const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`whois_modlogs_${targetUser.id}_${ctx.authorId}`)
                    .setLabel('Modlogs')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`whois_manuals_${targetUser.id}_${ctx.authorId}`)
                    .setLabel('Manuals')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`whois_addmanual_${targetUser.id}_${ctx.authorId}`)
                    .setLabel('Add Manual')
                    .setStyle(ButtonStyle.Secondary)
            );

        const message = await ctx.reply({ embeds: [embed], components: [row] });

        // Handle modlogs button
        const collector = message.createMessageComponentCollector({
            filter: (i: any) => i.customId.startsWith('whois_') && i.customId.endsWith(`_${ctx.authorId}`),
            time: 300000 // 5 minutes
        });

        collector.on('collect', async (interaction: any) => {
            try {
                if (interaction.customId.startsWith('whois_modlogs_')) {
                    // Show modlogs
                    const userId = interaction.customId.split('_')[2];
                    const logs = await modService.getLogs(ctx.guildId, userId);

                    if (!logs || logs.length === 0) {
                        const modlogsEmbed = new EmbedBuilder()
                            .setDescription(
                                `${TICK} **${targetUser.tag}**\n\n` +
                                `Clean record • No history`
                            );

                        const backRow = new ActionRowBuilder<ButtonBuilder>()
                            .addComponents(
                                new ButtonBuilder()
                                    .setCustomId(`whois_back_${targetUser.id}_${ctx.authorId}`)
                                    .setLabel('Back')
                                    .setStyle(ButtonStyle.Secondary)
                            );

                        await interaction.update({ embeds: [modlogsEmbed], components: [backRow] });
                        return;
                    }

                    // Get current active status
                    const activeMute = logs.find(l => l.action === 'mute' && l.active);
                    const activeBan = logs.find(l => l.action === 'ban' && l.active);
                    let status = 'Active';
                    if (activeBan) { status = 'Banned'; }
                    else if (activeMute) { status = 'Muted'; }

                    const logRows = logs.slice(0, 8).map(log => {
                        const timestamp = Math.floor(new Date(log.created_at).getTime() / 1000);
                        return `#${log.case_number} ${log.action} • <t:${timestamp}:R>\n${log.reason || 'No reason'}`;
                    }).join('\n\n');

                    const modlogsEmbed = new EmbedBuilder()
                        .setDescription(
                            `${TICK} **${targetUser.tag}**\n\n` +
                            `**Status:** ${status} • **Cases:** ${logs.length}\n\n` +
                            `${logRows}`
                        );

                    const backRow = new ActionRowBuilder<ButtonBuilder>()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId(`whois_back_${targetUser.id}_${ctx.authorId}`)
                                .setLabel('Back')
                                .setStyle(ButtonStyle.Secondary)
                        );

                    await interaction.update({ embeds: [modlogsEmbed], components: [backRow] });

                } else if (interaction.customId.startsWith('whois_manuals_')) {
                    // Show manuals
                    const userId = interaction.customId.split('_')[2];
                    const logs = await modService.getLogs(ctx.guildId, userId);
                    const manuals = logs?.filter(l => l.action === 'mute') || [];

                    if (manuals.length === 0) {
                        const manualsEmbed = new EmbedBuilder()
                            .setDescription(
                                `${TICK} **${targetUser.tag}**\n\n` +
                                `No manual mutes found`
                            );

                        const backRow = new ActionRowBuilder<ButtonBuilder>()
                            .addComponents(
                                new ButtonBuilder()
                                    .setCustomId(`whois_back_${targetUser.id}_${ctx.authorId}`)
                                    .setLabel('Back')
                                    .setStyle(ButtonStyle.Secondary)
                            );

                        await interaction.update({ embeds: [manualsEmbed], components: [backRow] });
                        return;
                    }

                    const manualRows = manuals.slice(0, 8).map(log => {
                        const timestamp = Math.floor(new Date(log.created_at).getTime() / 1000);
                        const status = log.active ? '🔴 Active' : '✅ Completed';
                        return `#${log.case_number} ${status} • <t:${timestamp}:R>\n${log.reason || 'No reason'}`;
                    }).join('\n\n');

                    const manualsEmbed = new EmbedBuilder()
                        .setDescription(
                            `${TICK} **${targetUser.tag}**\n\n` +
                            `**Manual Mutes:** ${manuals.length}\n\n` +
                            `${manualRows}`
                        );

                    const backRow = new ActionRowBuilder<ButtonBuilder>()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId(`whois_back_${targetUser.id}_${ctx.authorId}`)
                                .setLabel('Back')
                                .setStyle(ButtonStyle.Secondary)
                        );

                    await interaction.update({ embeds: [manualsEmbed], components: [backRow] });

                } else if (interaction.customId.startsWith('whois_addmanual_')) {
                    // Add manual functionality placeholder
                    await interaction.reply({ 
                        content: 'Use `!mute <user> <duration> <reason>` to add a manual mute.', 
                        ephemeral: true 
                    });

                } else if (interaction.customId.startsWith('whois_back_')) {
                    // Show original whois
                    await interaction.update({ embeds: [embed], components: [row] });
                }
            } catch (e) {
                console.error('Error handling whois button:', e);
            }
        });
    }
};
