import { Events, Interaction, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ChannelType, PermissionFlagsBits, TextChannel, EmbedBuilder, Colors, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import { client } from '../core/discord';
import { mailService } from '../services/mail/MailService';
import { db } from '../data/db';
import { TranscriptGenerator } from '../services/mail/TranscriptGenerator';
import { modService } from '../services/moderation/ModerationService';
import { activityLogService } from '../services/logging/ActivityLogService';

client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;

    const customId = interaction.customId;

    // 1. Create Request (Button in DM)
    if (customId.startsWith('mail_create_')) {
        const guildId = customId.split('_')[2];

        // Check blacklist/active tickets again
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

        // AUTO-SELECT CATEGORY LOGIC
        // If there are categories, just pick the first one (usually 'Support') to avoid extra user steps.
        const defaultCategory = categories[0];
        const categoryId = defaultCategory.id;
        const userId = interaction.user.id;

        // Skip menu, simulate selection
        await interaction.deferUpdate();

        // -- LOGIC COPIED FROM "Category Selected" BLOCK --
        // Create Ticket in DB
        const ticket = await mailService.createPendingTicket(guildId, userId, categoryId);
        if (!ticket) {
            await interaction.followUp({ content: 'Failed to create ticket.', ephemeral: true });
            return;
        }

        // Create Channel in Guild
        const guild = client.guilds.cache.get(guildId);
        if (!guild) return;

        // Get Category Config (we already have defaultCategory, but let's be safe)
        const catConfig = defaultCategory;

        // Create Channel
        try {
            // Generate Random 4-digit ID
            const displayId = Math.floor(1000 + Math.random() * 9000);

            const channel = await guild.channels.create({
                name: `${interaction.user.username}-${displayId}`, // Use display ID in channel name too? Or keep username-ticket
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

            // Update Ticket as OPEN
            await mailService.openTicket(ticket.ticket_id, channel.id);

            // Fetch Recent Mod Action
            const recentAction = await modService.getRecentAction(guildId, userId);

            // Send Control Panel
            const controlEmbed = new EmbedBuilder()
                .setTitle('New Ticket')
                .setThumbnail(interaction.user.displayAvatarURL())
                .setDescription(`**User:** <@${userId}>\n**Category:** ${catConfig.name}\n**Ticket ID:** ${displayId}`)
                .setFooter({ text: 'Staff Controls' });

            // Add Recent Mod Action field if exists
            if (recentAction) {
                const actionTimestamp = Math.floor(new Date(recentAction.created_at).getTime() / 1000);
                const actionText = `**Action:** ${recentAction.action.toUpperCase()}\n**By:** <@${recentAction.moderator_id}>\n**Reason:** ${recentAction.reason || 'No reason provided'}\n**When:** <t:${actionTimestamp}:R>`;
                controlEmbed.addFields({ name: 'Recent Mod Action', value: actionText, inline: false });
            }

            const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId(`mail_claim_${ticket.ticket_id}`).setLabel('Claim').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId(`mail_close_${ticket.ticket_id}`).setLabel('Close').setStyle(ButtonStyle.Danger)
            );

            const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId(`mail_modlogs_${userId}`).setLabel('Mod Logs').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`mail_vclogs_${userId}`).setLabel('VC Logs').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`mail_whois_${userId}`).setLabel('Whois').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`mail_clogs_${userId}`).setLabel('Chat Logs').setStyle(ButtonStyle.Secondary)
            );

            // Build content with moderator ping if recent action exists
            let channelContent = `${catConfig.staff_role_ids.map((r: string) => `<@&${r}>`).join(' ')}`;
            if (recentAction) {
                channelContent += `\n\n**Case reopened via modmail** - <@${recentAction.moderator_id}>, this user had a recent ${recentAction.action} action.`;
            }

            await channel.send({
                content: channelContent,
                embeds: [controlEmbed],
                components: [row1, row2]
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

        // Create Ticket in DB
        const ticket = await mailService.createPendingTicket(guildId, userId, categoryId);
        if (!ticket) {
            await interaction.editReply({ content: 'Failed to create ticket.', components: [] });
            return;
        }

        // Create Channel in Guild
        const guild = client.guilds.cache.get(guildId);
        if (!guild) return;

        // Get Category Config
        const catConfig = (await mailService.getCategories(guildId)).find((c: any) => c.id === categoryId);
        if (!catConfig) return;

        // Create Channel
        try {
            // Generate Random 4-digit ID
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

            // Update Ticket as OPEN
            await mailService.openTicket(ticket.ticket_id, channel.id);

            // Fetch Recent Mod Action
            const recentAction = await modService.getRecentAction(guildId, userId);

            // Send Control Panel
            const controlEmbed = new EmbedBuilder()
                .setTitle('New Ticket')
                .setThumbnail(interaction.user.displayAvatarURL())
                .setDescription(`**User:** <@${userId}>\n**Category:** ${catConfig.name}\n**Ticket ID:** ${displayId}`)
                .setFooter({ text: 'Staff Controls' });

            // Add Recent Mod Action field if exists
            if (recentAction) {
                const actionTimestamp = Math.floor(new Date(recentAction.created_at).getTime() / 1000);
                const actionText = `**Action:** ${recentAction.action.toUpperCase()}\n**By:** <@${recentAction.moderator_id}>\n**Reason:** ${recentAction.reason || 'No reason provided'}\n**When:** <t:${actionTimestamp}:R>`;
                controlEmbed.addFields({ name: 'Recent Mod Action', value: actionText, inline: false });
            }

            const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId(`mail_claim_${ticket.ticket_id}`).setLabel('Claim').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId(`mail_close_${ticket.ticket_id}`).setLabel('Close').setStyle(ButtonStyle.Danger)
            );

            const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId(`mail_modlogs_${userId}`).setLabel('Mod Logs').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`mail_vclogs_${userId}`).setLabel('VC Logs').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`mail_whois_${userId}`).setLabel('Whois').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`mail_clogs_${userId}`).setLabel('Chat Logs').setStyle(ButtonStyle.Secondary)
            );

            // Build content with moderator ping if recent action exists
            let channelContent = `${catConfig.staff_role_ids.map((r: string) => `<@&${r}>`).join(' ')}`;
            if (recentAction) {
                channelContent += `\n\n**Case reopened via modmail** - <@${recentAction.moderator_id}>, this user had a recent ${recentAction.action} action.`;
            }

            await channel.send({
                content: channelContent,
                embeds: [controlEmbed],
                components: [row1, row2]
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

        // Check if already claimed? DB constraint checks status='open' usually, but let's check current state
        // The service method `claimTicket` only updates if status='open'.

        const result = await mailService.claimTicket(ticketId, staffId);

        if (result.count === 0) {
            await interaction.editReply({ content: 'Ticket is not open or already claimed.' });
            return;
        }

        // Update Embed/UI
        if (interaction.channel?.isTextBased() && !interaction.channel.isDMBased()) {
            await interaction.channel.send(`**Claimed by** <@${staffId}>`);
        }

        await interaction.editReply({ content: 'Ticket claimed.' });
    }

    // 4. Close Ticket
    if (customId.startsWith('mail_close_')) {
        const ticketId = customId.split('_')[2];

        await interaction.deferReply();

        const ticket = await mailService.closeTicket(ticketId);
        if (!ticket) {
            await interaction.editReply('Ticket already closed or not found.');
            return;
        }

        const channel = interaction.channel as TextChannel;
        // Lock Channel
        if (channel) {
            await channel.permissionOverwrites.edit(channel.guild.roles.everyone, { SendMessages: false });
            // Remove specific user overwrites if needed, but usually just locking everything handles it
        }

        // Generate Transcript
        const messages = await mailService.getTicketMessages(ticketId);
        // Map Kysely types if needed, but assuming schema matches
        const html = TranscriptGenerator.generateHTML(messages as any, ticket.ticket_id, channel.guild.name);

        // Send to Transcript Channel
        const config = await mailService.getGuildConfig(ticket.guild_id);
        if (config?.transcript_channel_id) {
            const tChannel = client.channels.cache.get(config.transcript_channel_id) as TextChannel;
            if (tChannel) {
                await tChannel.send({
                    content: `Ticket Closed: ${ticket.ticket_id}`,
                    files: [{
                        attachment: Buffer.from(html),
                        name: `transcript-${ticket.ticket_id}.html`
                    }]
                });
            }
        }

        // Rename and Move Channel
        if (channel) {
            try {
                // Rename to closed-username
                const targetUser = await client.users.fetch(ticket.user_id).catch(() => null);
                const username = targetUser ? targetUser.username : 'unknown';

                // Discord channel names are lowercase, no spaces, specialized chars replaced
                const safeName = `closed-${username}`.toLowerCase().replace(/[^a-z0-9-_]/g, '-').substring(0, 100);

                await channel.setName(safeName);

                // Move to closed category if configured
                if (config?.closed_category_id) {
                    await channel.setParent(config.closed_category_id, { lockPermissions: false });
                }
            } catch (err) {
                console.error('Failed to rename/move closed ticket channel:', err);
            }
        }

        await interaction.editReply('Ticket closed. Transcript generated.');
        // Optional: Delete channel after 10s
        // setTimeout(() => channel.delete(), 10000);
    }

    // ================== MODERATION BUTTONS ==================

    // 5. Mod Logs
    if (customId.startsWith('mail_modlogs_')) {
        const targetId = customId.split('_')[2];
        await interaction.deferReply({ ephemeral: true });

        try {
            const logs = await modService.getLogs(interaction.guildId!, targetId);

            if (!logs || logs.length === 0) {
                await interaction.editReply('No moderation logs found for this user.');
                return;
            }

            const targetUser = await client.users.fetch(targetId).catch(() => null);
            const targetTag = targetUser ? targetUser.tag : targetId;

            const logRows = await Promise.all(logs.slice(0, 10).map(async log => {
                const timestamp = Math.floor(new Date(log.created_at).getTime() / 1000);
                const moderator = await client.users.fetch(log.moderator_id).catch(() => null);
                const modName = moderator ? moderator.tag : 'Unknown';

                let durationText = '';
                if (log.duration_seconds && log.duration_seconds > 0) {
                    const hours = Math.floor(log.duration_seconds / 3600);
                    const minutes = Math.floor((log.duration_seconds % 3600) / 60);
                    if (hours > 0) durationText = ` • **Duration:** ${hours}h ${minutes}m`;
                    else if (minutes > 0) durationText = ` • **Duration:** ${minutes}m`;
                    else durationText = ` • **Duration:** ${log.duration_seconds}s`;
                }

                return `**Case #${log.case_number.toString().padStart(4, '0')}** • **${log.action.toUpperCase()}**\n` +
                    `**By:** ${modName} (<@${log.moderator_id}>)\n` +
                    `**When:** <t:${timestamp}:R> (<t:${timestamp}:f>)${durationText}\n` +
                    `**Reason:** ${log.reason || 'No reason provided'}`;
            }));

            const embed = new EmbedBuilder()
                .setAuthor({ name: `Moderation History for ${targetTag}`, iconURL: targetUser?.displayAvatarURL() })
                .setDescription(logRows.join('\n\n'))
                .setFooter({ text: `Total Cases: ${logs.length} | Showing latest ${Math.min(logs.length, 10)}` })
                .setTimestamp();

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
                .setTitle(`VC Logs | ${targetId}`)
                .setDescription(lines.join('\n'));

            await interaction.editReply({ embeds: [embed] });

        } catch (e: any) {
            await interaction.editReply(`Failed to fetch VC logs: ${e.message}`);
        }
    }

    // 7. Whois
    if (customId.startsWith('mail_whois_')) {
        const targetId = customId.split('_')[2];
        await interaction.deferReply({ ephemeral: true });

        try {
            const user = await client.users.fetch(targetId);
            const member = await interaction.guild?.members.fetch(targetId).catch(() => null);

            const created = Math.floor(user.createdTimestamp / 1000);
            const joined = member ? Math.floor(member.joinedTimestamp! / 1000) : null;

            const embed = new EmbedBuilder()
                .setThumbnail(user.displayAvatarURL())
                .setTitle(`Whois | ${user.tag}`)
                .setDescription(`**ID:** ${user.id} | <@${user.id}>`)
                .addFields(
                    { name: 'Created On', value: `<t:${created}:F> (<t:${created}:R>)`, inline: true },
                    { name: 'Joined Server', value: joined ? `<t:${joined}:F> (<t:${joined}:R>)` : 'Not in server', inline: true },
                    { name: 'Roles', value: member ? member.roles.cache.filter(r => r.name !== '@everyone').map(r => r.toString()).join(', ') || 'None' : 'N/A' }
                );

            await interaction.editReply({ embeds: [embed] });
        } catch (e: any) {
            await interaction.editReply(`Failed to fetch user info: ${e.message}`);
        }
    }

    // 8. Chat Logs
    if (customId.startsWith('mail_clogs_')) {
        const targetId = customId.split('_')[2];
        await interaction.deferReply({ ephemeral: true });

        try {
            const stats = await activityLogService.getChatStats(interaction.guildId!, targetId);
            const logs = await activityLogService.getChatLogs(interaction.guildId!, targetId, 10);

            if (!logs || logs.length === 0) {
                await interaction.editReply('No chat activity found.');
                return;
            }

            const topChannels = stats.topChannels.map((c, i) => {
                return `**${i + 1}.** <#${c.channel_id}>: ${c.count} msgs`;
            }).join('\n');

            const activityLines = logs.map(log => {
                const timestamp = Math.floor(new Date(log.created_at).getTime() / 1000);
                return `<#${log.channel_id}> • <t:${timestamp}:R> • Msg ID: ${log.message_id}`;
            }).join('\n');

            const embed = new EmbedBuilder()
                .setTitle(`Chat Logs | ${targetId}`)
                .addFields(
                    { name: 'Overview', value: `Total Messages: **${stats.totalMessages}**`, inline: false },
                    { name: 'Top Active Channels', value: topChannels || 'None' },
                    { name: 'Recent Activity', value: activityLines.substring(0, 1024) || 'None' }
                );

            await interaction.editReply({ embeds: [embed] });

        } catch (e: any) {
            await interaction.editReply(`Failed to fetch chat logs: ${e.message}`);
        }
    }

    // ================== DELETE TICKET CHANNEL ==================
    if (customId.startsWith('mail_delete_')) {
        const ticketId = customId.split('_')[2];
        
        if (!interaction.channel || interaction.channel.isDMBased()) return;

        await interaction.deferReply();
        
        const channel = interaction.channel as TextChannel;
        
        await interaction.editReply('Deleting channel in 3 seconds...');
        
        setTimeout(async () => {
            try {
                await channel.delete();
            } catch (err) {
                console.error('Failed to delete ticket channel:', err);
            }
        }, 3000);
    }
});
