import { Events, Message, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, TextChannel } from 'discord.js';
import { client } from '../core/discord';
import { mailService } from '../services/mail/MailService';
import { db } from '../data/db';

const DM_COOLDOWN = new Set<string>();

client.on(Events.MessageCreate, async (message: Message) => {
    // 1. Basic Filters
    if (message.author.bot) return;
    if (message.channel.type !== ChannelType.DM) return;

    const userId = message.author.id;

    // 2. Rate Limit (Simple)
    if (DM_COOLDOWN.has(userId)) return;
    DM_COOLDOWN.add(userId);
    setTimeout(() => DM_COOLDOWN.delete(userId), 2000); // 2s cooldown

    try {
        // Store the last message from user for pending tickets
        // This will be used when the ticket is opened
        const guildsToStorePending = [];
        for (const [id, guild] of client.guilds.cache) {
            try {
                const member = await guild.members.fetch(userId).catch(() => null);
                if (member) {
                    const config = await mailService.getGuildConfig(id);
                    if (config?.enabled) {
                        guildsToStorePending.push({ id, name: guild.name, config });

                        // Store pending message for this guild
                        await db.pendingMailMessage.upsert({
                            where: {
                                guild_id_user_id: {
                                    guild_id: id,
                                    user_id: userId
                                }
                            },
                            update: {
                                content: message.content,
                                attachments: message.attachments.map(a => ({ url: a.url, name: a.name }))
                            },
                            create: {
                                guild_id: id,
                                user_id: userId,
                                content: message.content,
                                attachments: message.attachments.map(a => ({ url: a.url, name: a.name }))
                            }
                        });
                    }
                }
            } catch (e) { }
        }

        // 3. Check for existing active tickets across ALL guilds
        const activeTickets = await db.ticket.findMany({
            where: {
                user_id: userId,
                status: { in: ['pending', 'open', 'claimed'] }
            }
        });

        if (activeTickets.length === 1) {
            const ticket = activeTickets[0];
            // Relay Message
            if (ticket.status === 'pending') {
                await message.reply('Please finish selecting a category above.');
                return;
            }

            // Send to Ticket Channel (webhook only, no duplicate logging)
            if (ticket.channel_id) {
                const guild = client.guilds.cache.get(ticket.guild_id);
                const channel = guild?.channels.cache.get(ticket.channel_id);

                if (channel) {
                    if (channel.type === ChannelType.GuildText) {
                        try {
                            const textChannel = channel as TextChannel;
                            const webhooks = await textChannel.fetchWebhooks();
                            let webhook = webhooks.find(w => w.name === 'MailBot Relay');

                            if (!webhook) {
                                webhook = await textChannel.createWebhook({
                                    name: 'MailBot Relay',
                                    avatar: client.user?.displayAvatarURL()
                                });
                            }

                            await webhook.send({
                                username: message.author.username,
                                avatarURL: message.author.displayAvatarURL(),
                                content: message.content,
                                files: message.attachments.map(a => a.url)
                            });

                            // Log to database after successful webhook send
                            await mailService.logMessage(ticket.ticket_id, 'user', userId, message.content, {
                                attachments: message.attachments.map(a => ({ url: a.url, name: a.name, contentType: a.contentType })),
                                embeds: message.embeds.map(e => e.toJSON()),
                                author_name: message.author.username,
                                author_avatar: message.author.displayAvatarURL(),
                                author_role_color: '#f2f3f5'
                            });

                            await message.react('✅');
                        } catch (err) {
                            console.error('Webhook failed, falling back to standard message:', err);
                            await channel.send({
                                content: `**${message.author.username}**: ${message.content}`,
                                files: message.attachments.map(a => a.url)
                            });

                            // Log to database
                            await mailService.logMessage(ticket.ticket_id, 'user', userId, message.content, {
                                attachments: message.attachments.map(a => ({ url: a.url, name: a.name, contentType: a.contentType })),
                                embeds: message.embeds.map(e => e.toJSON()),
                                author_name: message.author.username,
                                author_avatar: message.author.displayAvatarURL(),
                                author_role_color: '#f2f3f5'
                            });

                            await message.react('✅');
                        }
                    } else if (channel.isTextBased()) {
                        await channel.send({
                            content: `**${message.author.username}**: ${message.content}`,
                            files: message.attachments.map(a => a.url)
                        });

                        // Log to database
                        await mailService.logMessage(ticket.ticket_id, 'user', userId, message.content, {
                            attachments: message.attachments.map(a => ({ url: a.url, name: a.name, contentType: a.contentType })),
                            embeds: message.embeds.map(e => e.toJSON()),
                            author_name: message.author.username,
                            author_avatar: message.author.displayAvatarURL(),
                            author_role_color: '#f2f3f5'
                        });

                        await message.react('✅');
                    }
                } else {
                    await message.reply('Ticket channel not found. Please contact an admin.');
                }
            }
            return;
        }

        if (activeTickets.length > 1) {
            await message.reply('You have multiple open tickets. Please close one before sending messages.');
            return;
        }

        // New Ticket Flow
        // Find mutual guilds where mail is enabled
        const mutualGuilds = [];
        for (const [id, guild] of client.guilds.cache) {
            try {
                const member = await guild.members.fetch(userId).catch(() => null);
                if (member) {
                    const config = await mailService.getGuildConfig(id);
                    if (config?.enabled) {
                        mutualGuilds.push({ id, name: guild.name, config });
                    }
                }
            } catch (e) { }
        }

        if (mutualGuilds.length === 0) {
            await message.reply('No servers found with ModMail enabled.');
            return;
        }

        // For now, let's handle the single guild case automatically, or first one
        // In robust systems, we'd show a dropdown.
        const target = mutualGuilds[0];

        if (target.config.ask_confirmation) {
            const row = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`mail_create_${target.id}`)
                        .setLabel(`Open Ticket in ${target.name}`)
                        .setStyle(ButtonStyle.Success)
                );

            const prompt = await message.reply({
                content: `Do you want to contact the staff of **${target.name}**?`,
                components: [row]
            });
        } else {
            // Auto open (not implemented yet, safer to always confirm)
            // Just simulate button click flow
        }

    } catch (e) {
        console.error('DM Error:', e);
    }
});
