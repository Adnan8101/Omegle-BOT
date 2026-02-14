import { Events, Interaction, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ChannelType, PermissionFlagsBits, TextChannel, EmbedBuilder, Colors, ButtonBuilder, ButtonStyle, ComponentType, Guild, GuildMember, User } from 'discord.js';
import { client } from '../core/discord';
import { mailService } from '../services/mail/MailService';
import { db } from '../data/db';
import { TranscriptGenerator } from '../services/mail/TranscriptGenerator';
import { modService } from '../services/moderation/ModerationService';
import { activityLogService } from '../services/logging/ActivityLogService';
import { manualService } from '../services/manual/ManualService';
import { EMBED_COLOR } from '../util/embedColors';

const TICK = '<:tickYes:1469272837192814623>';

// ─── Helper: Build the full ticket info embed (replicates all !whois data + last 5 modlogs) ───
async function buildTicketEmbed(
    guild: Guild,
    userId: string,
    displayId: number,
    catName: string,
    staffMessage: string | null | undefined
) {
    const member = await guild.members.fetch(userId).catch(() => null) as GuildMember | null;
    const user = await client.users.fetch(userId).catch(() => null) as User | null;
    const modLogs = await modService.getLogs(guild.id, userId).catch(() => []) as any[];
    const voiceLogs = await activityLogService.getVoiceLogs(guild.id, userId, 5).catch(() => []) as any[];
    const recentAction = await modService.getRecentAction(guild.id, userId);

    const createdAt = user ? Math.floor(user.createdTimestamp / 1000) : 0;
    const joinedAt = member?.joinedTimestamp ? Math.floor(member.joinedTimestamp / 1000) : 0;
    const currentVC = member?.voice.channel ? `<#${member.voice.channel.id}>` : 'None';

    // ── Roles (full list like !whois) ──
    const allRoles = member
        ? member.roles.cache.filter(r => r.name !== '@everyone').map(r => r.toString())
        : [];
    const rolesCount = allRoles.length;
    const rolesDisplay = rolesCount > 0
        ? (rolesCount > 20 ? allRoles.slice(0, 20).join(', ') + ` (+${rolesCount - 20} more)` : allRoles.join(', '))
        : 'None';

    // ── Warn / Manual / Mute counts (matching !whois) ──
    const warnCount = modLogs.filter((l: any) => l.action === 'warn').length;
    const manualCount = await manualService.getManualCount(guild.id, userId);
    const activeMute = modLogs.find((l: any) => l.action === 'mute' && l.active);
    const totalCases = modLogs.length;

    // ── Timeout status ──
    let timeoutText = 'No';
    if (member?.isCommunicationDisabled()) {
        const unmuteTs = Math.floor(member.communicationDisabledUntilTimestamp! / 1000);
        timeoutText = `Yes (expires <t:${unmuteTs}:R>)`;
    }

    // ── Active mute status ──
    let muteText = '';
    if (activeMute) {
        if (activeMute.duration_seconds) {
            const unmuteAt = Math.floor((new Date(activeMute.created_at).getTime() / 1000) + activeMute.duration_seconds);
            muteText = `\n**Active Mute:** Yes (unmutes <t:${unmuteAt}:R>)`;
        } else {
            muteText = `\n**Active Mute:** Yes (permanent)`;
        }
    }

    // ── Build description ──
    let description =
        `**User:** <@${userId}> (\`${userId}\`)\n` +
        `**Category:** ${catName}\n\n` +
        `**Registered:** <t:${createdAt}:F> (<t:${createdAt}:R>)\n` +
        `**Joined:** ${joinedAt ? `<t:${joinedAt}:F> (<t:${joinedAt}:R>)` : 'Not in server'}\n\n` +
        `**Roles [${rolesCount}]:** ${rolesDisplay}\n` +
        `**Current VC:** ${currentVC}\n\n` +
        `**Timed Out:** ${timeoutText}${muteText}\n` +
        `**Warns:** ${warnCount} • **Manual Mutes:** ${manualCount} • **Total Cases:** ${totalCases}`;

    // ── Staff message at the top if configured ──
    if (staffMessage) {
        description = `> ${staffMessage}\n\n${description}`;
    }

    const embed = new EmbedBuilder()
        
        .setColor(0x2b2d31)
    .setAuthor({
            name: `${user?.username || 'Unknown'} | Ticket #${displayId}`,
            iconURL: user?.displayAvatarURL() || undefined
        })
        .setThumbnail(user?.displayAvatarURL() || null)
        .setDescription(description)
        .setFooter({ text: `Ticket ${displayId} • ${catName}` })
        .setTimestamp();

    // ── Last 5 Modlogs (inline field) ──
    if (modLogs.length > 0) {
        const logLines = modLogs.slice(0, 5).map((log: any) => {
            const ts = Math.floor(new Date(log.created_at).getTime() / 1000);
            return `\`#${log.case_number}\` **${log.action.toUpperCase()}** • <t:${ts}:R>\n↳ ${log.reason || 'No reason'}`;
        }).join('\n');
        embed.addFields({ name: `📋 Recent Modlogs (${Math.min(modLogs.length, 5)}/${modLogs.length})`, value: logLines, inline: false });
    } else {
        embed.addFields({ name: '📋 Modlogs', value: 'No modlogs', inline: false });
    }

    // ── Recent VC Activity ──
    if (voiceLogs && voiceLogs.length > 0) {
        const vcLines = voiceLogs.slice(0, 3).map((log: any) => {
            const joined = Math.floor(new Date(log.joined_at).getTime() / 1000);
            let dur = 'Active';
            if (log.duration_seconds && log.duration_seconds > 0) {
                const hrs = Math.floor(log.duration_seconds / 3600);
                const mins = Math.floor((log.duration_seconds % 3600) / 60);
                dur = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
            }
            return `<#${log.channel_id}> • <t:${joined}:R> • ${dur}`;
        }).join('\n');
        embed.addFields({ name: '🔊 Recent VC Activity', value: vcLines, inline: false });
    }

    // ── Manuals Summary ──
    if (manualCount > 0) {
        const recentManuals = await manualService.getUserManualsPaginated(guild.id, userId, 1, 3);
        const manualLines = recentManuals.manuals.map((m: any) => {
            const ts = Math.floor(new Date(m.created_at).getTime() / 1000);
            return `\`#${m.manual_number}\` **${m.offense}** • ${m.action} • <t:${ts}:R>`;
        }).join('\n');
        embed.addFields({ name: `📝 Manuals (${Math.min(recentManuals.total, 3)}/${recentManuals.total})`, value: manualLines, inline: false });
    } else {
        embed.addFields({ name: '📝 Manuals', value: 'No manuals', inline: false });
    }

    return { embed, recentAction };
}

client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;

    const customId = interaction.customId;

    // 1. Create Request (Button in DM)
    if (customId.startsWith('mail_create_')) {
        const guildId = customId.split('_')[2];

        const active = await mailService.getActiveTicket(guildId, interaction.user.id);
        if (active) {
            await interaction.reply({ content: 'You already have an open ticket.', ephemeral: true });
            return;
        }

        const categories = await mailService.getCategories(guildId);
        if (categories.length === 0) {
            await interaction.reply({ content: 'No ticket categories configured.', ephemeral: true });
            return;
        }

        const defaultCategory = categories[0];
        const categoryId = defaultCategory.id;
        const userId = interaction.user.id;

        await interaction.deferUpdate();

        const ticket = await mailService.createPendingTicket(guildId, userId, categoryId);
        if (!ticket) {
            await interaction.followUp({ content: 'Failed to create ticket.', ephemeral: true });
            return;
        }

        const guild = client.guilds.cache.get(guildId);
        if (!guild) return;

        const catConfig = defaultCategory;

        try {
            const displayId = Math.floor(1000 + Math.random() * 9000);

            const channel = await guild.channels.create({
                name: `${interaction.user.username}-${displayId}`,
                type: ChannelType.GuildText,
                parent: catConfig.channel_category_id,
                topic: `User: ${interaction.user.id} | Ticket: ${ticket.ticket_id} | DisplayID: ${displayId}`,
                permissionOverwrites: [
                    {
                        id: guild.id,
                        deny: [PermissionFlagsBits.ViewChannel]
                    },
                    {
                        id: client.user!.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
                    },
                    ...catConfig.staff_role_ids.map((roleId: string) => ({
                        id: roleId,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
                    }))
                ]
            });

            await mailService.openTicket(ticket.ticket_id, channel.id);

            // Fetch config for staff_message
            const config = await mailService.getGuildConfig(guildId);
            const { embed: controlEmbed, recentAction } = await buildTicketEmbed(guild, userId, displayId, catConfig.name, config?.staff_message);

            // Buttons — Claim/Close + ModLogs/VCLogs + Manuals/Add Manual
            const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId(`mail_claim_${ticket.ticket_id}`).setLabel('Claim').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`mail_close_${ticket.ticket_id}`).setLabel('Close').setStyle(ButtonStyle.Secondary)
            );

            const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId(`mail_modlogs_${userId}`).setLabel('Mod Logs').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`mail_vclogs_${userId}`).setLabel('VC Logs').setStyle(ButtonStyle.Secondary)
            );

            const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId(`mail_manuals_${userId}`).setLabel('Manuals').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`mail_addmanual_${userId}`).setLabel('Add Manual').setStyle(ButtonStyle.Secondary)
            );

            let channelContent = `${catConfig.staff_role_ids.map((r: string) => `<@&${r}>`).join(' ')}`;
            if (recentAction) {
                channelContent += `\n⚠️ <@${recentAction.moderator_id}> — user had a recent **${recentAction.action}** action.`;
            }

            await channel.send({
                content: channelContent,
                embeds: [controlEmbed],
                components: [row1, row2, row3]
            });

            await interaction.editReply({ content: `Ticket created! You can now send messages here.`, components: [] });

        } catch (e) {
            console.error(e);
            await interaction.editReply({ content: `Error creating ticket channel.`, components: [] });
        }
    }

    // 2. Category Selected (Menu in DM)
    if (customId.startsWith('mail_cat_select_')) {
        if (!interaction.isStringSelectMenu()) return;

        const guildId = customId.split('_')[3];
        const categoryId = interaction.values[0];
        const userId = interaction.user.id;

        await interaction.deferUpdate();

        const ticket = await mailService.createPendingTicket(guildId, userId, categoryId);
        if (!ticket) {
            await interaction.editReply({ content: 'Failed to create ticket.', components: [] });
            return;
        }

        const guild = client.guilds.cache.get(guildId);
        if (!guild) return;

        const catConfig = (await mailService.getCategories(guildId)).find((c: any) => c.id === categoryId);
        if (!catConfig) return;

        try {
            const displayId = Math.floor(1000 + Math.random() * 9000);

            const channel = await guild.channels.create({
                name: `${interaction.user.username}-${displayId}`,
                type: ChannelType.GuildText,
                parent: catConfig.channel_category_id,
                topic: `User: ${interaction.user.id} | Ticket: ${ticket.ticket_id} | DisplayID: ${displayId}`,
                permissionOverwrites: [
                    {
                        id: guild.id,
                        deny: [PermissionFlagsBits.ViewChannel]
                    },
                    {
                        id: client.user!.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
                    },
                    ...catConfig.staff_role_ids.map((roleId: string) => ({
                        id: roleId,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
                    }))
                ]
            });

            await mailService.openTicket(ticket.ticket_id, channel.id);

            const config = await mailService.getGuildConfig(guildId);
            const { embed: controlEmbed, recentAction } = await buildTicketEmbed(guild, userId, displayId, catConfig.name, config?.staff_message);

            const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId(`mail_claim_${ticket.ticket_id}`).setLabel('Claim').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`mail_close_${ticket.ticket_id}`).setLabel('Close').setStyle(ButtonStyle.Secondary)
            );

            const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId(`mail_modlogs_${userId}`).setLabel('Mod Logs').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`mail_vclogs_${userId}`).setLabel('VC Logs').setStyle(ButtonStyle.Secondary)
            );

            const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId(`mail_manuals_${userId}`).setLabel('Manuals').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`mail_addmanual_${userId}`).setLabel('Add Manual').setStyle(ButtonStyle.Secondary)
            );

            let channelContent = `${catConfig.staff_role_ids.map((r: string) => `<@&${r}>`).join(' ')}`;
            if (recentAction) {
                channelContent += `\n⚠️ <@${recentAction.moderator_id}> — user had a recent **${recentAction.action}** action.`;
            }

            await channel.send({
                content: channelContent,
                embeds: [controlEmbed],
                components: [row1, row2, row3]
            });

            await interaction.editReply({ content: `Ticket created! You can now send messages here.`, components: [] });

        } catch (e) {
            console.error(e);
            await interaction.editReply({ content: `Error creating ticket channel.`, components: [] });
        }
    }

    // 3. Claim Ticket
    if (customId.startsWith('mail_claim_')) {
        const ticketId = customId.split('_')[2];
        const staffId = interaction.user.id;

        await interaction.deferReply();

        const result = await mailService.claimTicket(ticketId, staffId);

        if (result.count === 0) {
            await interaction.editReply({ content: 'Ticket is not open or already claimed.' });
            return;
        }

        if (interaction.channel?.isTextBased() && !interaction.channel.isDMBased()) {
            await interaction.channel.send(`**Claimed by** <@${staffId}>`);
        }

        await interaction.editReply({ content: 'Ticket claimed.' });
    }

    // 4. Close Ticket — generate transcript then auto-delete channel
    if (customId.startsWith('mail_close_')) {
        const ticketId = customId.split('_')[2];

        await interaction.deferReply();

        const ticket = await mailService.closeTicket(ticketId);
        if (!ticket) {
            await interaction.editReply('Ticket already closed or not found.');
            return;
        }

        const channel = interaction.channel as TextChannel;

        const messages = await mailService.getTicketMessages(ticketId);
        const html = TranscriptGenerator.generateHTML(messages as any, ticket.ticket_id, channel.guild.name);

        const config = await mailService.getGuildConfig(ticket.guild_id);
        if (config?.transcript_channel_id) {
            const tChannel = client.channels.cache.get(config.transcript_channel_id) as TextChannel;
            if (tChannel) {
                const targetUser = await client.users.fetch(ticket.user_id).catch(() => null);
                const transcriptEmbed = new EmbedBuilder()
                    
                    .setColor(0x2b2d31)
                .setDescription(
                        `${TICK} **Ticket Closed**\n\n` +
                        `**User:** ${targetUser ? `${targetUser.username} (\`${ticket.user_id}\`)` : ticket.user_id}\n` +
                        `**Closed by:** <@${interaction.user.id}>\n` +
                        `**Ticket ID:** ${ticket.ticket_id}`
                    )
                    .setTimestamp();

                await tChannel.send({
                    embeds: [transcriptEmbed],
                    files: [{
                        attachment: Buffer.from(html),
                        name: `transcript-${ticket.ticket_id}.html`
                    }]
                });
            }
        }

        await interaction.editReply(`${TICK} Ticket closed. Transcript saved. Channel will be deleted in 5 seconds.`);

        setTimeout(async () => {
            try {
                await channel.delete();
            } catch (err) {
                console.error('Failed to delete ticket channel:', err);
            }
        }, 5000);
    }

    // ================== INFO BUTTONS ==================

    // 5. Mod Logs
    if (customId.startsWith('mail_modlogs_')) {
        const targetId = customId.split('_')[2];
        await interaction.deferReply({ ephemeral: true });

        try {
            const logs = await modService.getLogs(interaction.guildId!, targetId);

            if (!logs || logs.length === 0) {
                await interaction.editReply(`${TICK} Clean record — no moderation history.`);
                return;
            }

            const targetUser = await client.users.fetch(targetId).catch(() => null);
            const targetTag = targetUser ? targetUser.username : targetId;

            const activeMute = logs.find(l => l.action === 'mute' && l.active);
            const activeBan = logs.find(l => l.action === 'ban' && l.active);
            let status = 'Active';
            let color = 0x5865F2;
            if (activeBan) { status = 'Banned'; color = 0xED4245; }
            else if (activeMute) { status = 'Muted'; color = 0xFEE75C; }

            const logRows = logs.slice(0, 8).map(log => {
                const timestamp = Math.floor(new Date(log.created_at).getTime() / 1000);
                return `#${log.case_number} ${log.action} • <t:${timestamp}:R>\n${log.reason || 'No reason'}`;
            }).join('\n\n');

            const allCaseIds = logs.map(l => `#${l.case_number}`).join(', ');

            const embed = new EmbedBuilder()
                .setColor(color)
                .setAuthor({ name: `Mod Logs | ${targetTag}`, iconURL: targetUser?.displayAvatarURL() })
                .setDescription(
                    `**Status:** ${status} • **Cases:** ${logs.length}\n` +
                    `**Case IDs:** ${allCaseIds}\n\n` +
                    logRows
                )
                .setFooter({ text: `Showing ${Math.min(logs.length, 8)} of ${logs.length} cases` });

            await interaction.editReply({ embeds: [embed] });
        } catch (e: any) {
            await interaction.editReply(`Failed to fetch mod logs: ${e.message}`);
        }
    }

    // 6. VC Logs
    if (customId.startsWith('mail_vclogs_')) {
        const targetId = customId.split('_')[2];
        await interaction.deferReply({ ephemeral: true });

        try {
            const logs = await activityLogService.getVoiceLogs(interaction.guildId!, targetId, 15);

            if (!logs || logs.length === 0) {
                await interaction.editReply('No voice activity found.');
                return;
            }

            const targetUser = await client.users.fetch(targetId).catch(() => null);

            const lines = logs.map(log => {
                const joined = Math.floor(new Date(log.joined_at).getTime() / 1000);
                const channel = `<#${log.channel_id}>`;

                let durationStr = 'Active';
                if (log.duration_seconds && log.duration_seconds > 0) {
                    const hrs = Math.floor(log.duration_seconds / 3600);
                    const mins = Math.floor((log.duration_seconds % 3600) / 60);
                    const secs = log.duration_seconds % 60;
                    if (hrs > 0) durationStr = `${hrs}h ${mins}m`;
                    else if (mins > 0) durationStr = `${mins}m ${secs}s`;
                    else durationStr = `${secs}s`;
                }

                return `${channel} • <t:${joined}:R> • **${durationStr}**`;
            });

            const embed = new EmbedBuilder()
                
                .setColor(0x2b2d31)
            .setAuthor({ name: `VC Logs | ${targetUser?.username || targetId}`, iconURL: targetUser?.displayAvatarURL() })
                .setDescription(lines.join('\n'))
                .setFooter({ text: `Showing last ${logs.length} sessions` })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (e: any) {
            await interaction.editReply(`Failed to fetch VC logs: ${e.message}`);
        }
    }
});