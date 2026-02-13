import { ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder, Colors, User } from 'discord.js';
import { Command } from '../../core/command';
import { Context } from '../../core/context';
import { db } from '../../data/db';
import { ModLogger } from '../../services/logging/ModLogger';

export const SuggestionManage: Command = {
    name: 'suggestion',
    description: 'Manage suggestions (approve, decline, etc.)',
    category: 'Moderation',
    syntax: 'suggestion <action> <id>',
    example: 'suggestion approve 1 or suggestion decline 2',
    permissions: [PermissionFlagsBits.ModerateMembers],
    execute: async (ctx: Context, args: string[]): Promise<void> => {
        await ctx.defer();
        const interaction = ctx.inner as ChatInputCommandInteraction;
        const guild = interaction.guild;
        if (!guild) return;

        const member = interaction.member;
        if (!member) return;

        // Check if user has mod perms or mod role
        const hasModPerms = interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers);

        const modRoles = await db.modRole.findMany({
            where: { guild_id: guild.id }
        });

        const memberRoles = member.roles instanceof Array ? member.roles : Array.from((member.roles as any).cache.keys());
        const hasModRole = modRoles.some(mr => memberRoles.includes(mr.role_id));

        if (!hasModPerms && !hasModRole) {
            await interaction.reply({ content: 'You need moderator permissions to use this command.', ephemeral: true });
            return;
        }

        if (args.length < 2) {
            await interaction.reply({
                content: 'Usage: `/suggestion <approve|decline|considered|implemented> <id>`',
                ephemeral: true
            });
            return;
        }

        const action = args[0].toLowerCase();
        const suggestionId = args[1];

        const validActions = ['approve', 'decline', 'considered', 'implemented'];
        if (!validActions.includes(action)) {
            await interaction.reply({
                content: 'Valid actions: approve, decline, considered, implemented',
                ephemeral: true
            });
            return;
        }

        // Get suggestion by custom ID (we'll use a counter system)
        // For simplicity, we'll search by a number extracted from the suggestion ID
        const suggestion = await db.suggestion.findFirst({
            where: {
                guild_id: guild.id,
                id: suggestionId
            }
        });

        if (!suggestion) {
            await interaction.reply({ content: 'Suggestion not found.', ephemeral: true });
            return;
        }

        // Update the suggestion status
        const statusMap: { [key: string]: string } = {
            'approve': 'approved',
            'decline': 'declined',
            'considered': 'considered',
            'implemented': 'implemented'
        };

        const newStatus = statusMap[action];

        await db.suggestion.update({
            where: { id: suggestion.id },
            data: {
                status: newStatus,
                reviewed_by: interaction.user.id,
                reviewed_at: new Date()
            }
        });

        // Update the original message
        try {
            const channel = await guild.channels.fetch(suggestion.channel_id);
            if (channel?.isTextBased()) {
                const message = await channel.messages.fetch(suggestion.message_id);

                const statusEmoji: { [key: string]: string } = {
                    'approved': '✅',
                    'declined': '❌',
                    'considered': '💭',
                    'implemented': '🎉',
                    'pending': '⏳'
                };

                const statusColors: { [key: string]: number } = {
                    'approved': 0x57F287,       // Green
                    'declined': 0xED4245,        // Red
                    'considered': 0xF5A623,      // Peach/Orange
                    'implemented': 0x57F287,     // Green
                    'pending': 0x5865F2          // Blurple
                };

                const author = await guild.members.fetch(suggestion.author_id).catch(() => null);

                // Calculate suggestion number (simplified - using first 8 chars of ID)
                const suggestionNumber = suggestion.id.substring(0, 8);

                const embed = new EmbedBuilder()
                    .setAuthor({
                        name: author?.user.username || 'Unknown User',
                        iconURL: author?.user.displayAvatarURL() || undefined
                    })
                    .setTitle(`Suggestion #${suggestionNumber}`)
                    .setDescription(suggestion.suggestion)
                    
                    .addFields({ name: 'Status', value: `${statusEmoji[newStatus]} **${newStatus.toUpperCase()}**`, inline: true })
                    .setFooter({ text: `Reviewed by ${interaction.user.username}` })
                    .setTimestamp();

                await message.edit({ embeds: [embed] });
            }
        } catch (e) {
            console.error('Failed to update suggestion message:', e);
        }

        await interaction.reply({
            content: `✅ Suggestion **#${suggestionId.substring(0, 8)}** marked as **${newStatus.toUpperCase()}**`,
            ephemeral: true
        });

        // Log action
        await ModLogger.log(guild, interaction.user as User, `Suggestion #${suggestion.id.substring(0, 8)}`, 'Suggestion', null, {
            channel: `Action: ${newStatus}`
        });
    }
};