import { Events, Interaction, EmbedBuilder, Colors, InteractionReplyOptions } from 'discord.js';
import { client } from '../core/discord';
import { db } from '../data/db';

// Transient state for setup wizards
// Map<userId_guildId, { openCat?: string, closeCat?: string, transChan?: string }>
const setupState = new Map<string, { openCat?: string, closeCat?: string, transChan?: string }>();

client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    if (!interaction.guildId) return;

    // Check if it's a setup interaction
    if (!interaction.isChannelSelectMenu() && !interaction.isButton()) return;
    if (!interaction.customId.startsWith('setup_')) return;

    const key = `${interaction.user.id}_${interaction.guildId}`;
    let state = setupState.get(key) || {};

    // 1. Handle Channel Selects
    if (interaction.isChannelSelectMenu()) {
        const selectedId = interaction.values[0];

        if (interaction.customId === 'setup_cat_open') {
            state.openCat = selectedId;
            await interaction.reply({ content: `<:tickYes:1469272837192814623> Opening Category selected: <#${selectedId}>`, ephemeral: true });
        }
        else if (interaction.customId === 'setup_cat_close') {
            state.closeCat = selectedId;
            await interaction.reply({ content: `<:tickYes:1469272837192814623> Closing Category selected: <#${selectedId}>`, ephemeral: true });
        }
        else if (interaction.customId === 'setup_chan_trans') {
            state.transChan = selectedId;
            await interaction.reply({ content: `<:tickYes:1469272837192814623> Transcript Channel selected: <#${selectedId}>`, ephemeral: true });
        }

        setupState.set(key, state);
    }

    // 2. Handle Save Button
    if (interaction.isButton() && interaction.customId === 'setup_save') {
        if (!state.openCat || !state.transChan) {
            await interaction.reply({
                content: '<:cross:1469273232929456314> **Missing Required Fields**\nPlease select at least an **Opening Category** and a **Transcript Channel**.',
                ephemeral: true
            });
            return;
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            // Upsert Config
            await db.mailConfig.upsert({
                where: { guild_id: interaction.guildId },
                update: {
                    inbox_category_id: state.openCat,
                    transcript_channel_id: state.transChan,
                    closed_category_id: state.closeCat || null,
                    enabled: true
                },
                create: {
                    guild_id: interaction.guildId,
                    inbox_category_id: state.openCat,
                    transcript_channel_id: state.transChan,
                    closed_category_id: state.closeCat || null,
                    enabled: true,
                    ask_confirmation: true
                }
            });

            // Ensure at least one default category exists if none are present
            const existingCat = await db.mailCategory.findFirst({ where: { guild_id: interaction.guildId } });
            if (!existingCat) {
                // Best effort to find a staff role
                const guild = interaction.guild;
                const staffRole = guild?.roles.cache.find(r => r.name.toLowerCase().includes('mod') || r.permissions.has('BanMembers'));
                const roles = staffRole ? [staffRole.id] : [];

                await db.mailCategory.create({
                    data: {
                        guild_id: interaction.guildId,
                        name: 'Support',
                        channel_category_id: state.openCat, // Use the selected opening category
                        staff_role_ids: roles
                    }
                });
            }

            // Cleanup state
            setupState.delete(key);

            const embed = new EmbedBuilder()
                .setTitle('<:tickYes:1469272837192814623> Setup Saved Successfully')
                .setDescription(`**Configuration:**\n• **Opening Category**: <#${state.openCat}>\n• **Transcript Channel**: <#${state.transChan}>\n• **Closing Category**: ${state.closeCat ? `<#${state.closeCat}>` : 'None'}`)
                .setFooter({ text: 'You can run /deletesetup to reset this.' });

            await interaction.editReply({ embeds: [embed] });

            // Optional: Update origin message to show saved state
            if (interaction.message.channel.isTextBased() && !interaction.message.channel.isDMBased()) {
                await interaction.message.channel.send({ content: 'Setup configuration finalized.' });
            }

        } catch (error: any) {
            console.error(error);
            await interaction.editReply({ content: `Failed to save setup: ${error.message}` });
        }
    }
});
