import { Message, PermissionFlagsBits, EmbedBuilder, Colors, ChatInputCommandInteraction, GuildMember, User } from 'discord.js';
import { Command } from '../../core/command';
import { Context } from '../../core/context';
import { db } from '../../data/db';
import { ModLogger } from '../../services/logging/ModLogger';

export const SuggestionAction: Command = {
    name: 'suggestion_action',
    description: 'Manage suggestions (approve, decline, consider, implement)',
    category: 'Moderation',
    syntax: 'suggestion <approve|decline|considered|implemented> <id> [response]',
    example: 'suggestion approve 123 Good idea!',
    permissions: [PermissionFlagsBits.ManageMessages],
    modAction: 'suggestion',
    execute: async (ctx: Context, args: string[]): Promise<void> => {
        // Determine if this is an interaction or message
        const isInteraction = ctx.inner instanceof ChatInputCommandInteraction;
        const interaction = isInteraction ? (ctx.inner as ChatInputCommandInteraction) : null;
        const message = isInteraction ? null : (ctx.inner as Message);

        // CRITICAL: Defer reply immediately for interactions to prevent timeout
        if (isInteraction) {
            await interaction!.deferReply({ ephemeral: true });
        }

        // Get guild and user safely
        const guild = isInteraction ? interaction!.guild : message!.guild;
        const user = isInteraction ? interaction!.user : message!.author;
        const member = isInteraction ? (interaction!.member as GuildMember) : message!.member;

        if (!guild || !member) return;



        // Helper for replying
        const sendReply = async (content: string, ephemeral = true) => {
            if (isInteraction) {
                if (interaction!.deferred || interaction!.replied) {
                    await interaction!.editReply({ content });
                } else {
                    await interaction!.reply({ content, ephemeral });
                }
            } else {
                await message!.reply({ content });
            }
        };



        if (args.length < 2) {
            await sendReply('Usage: `/suggestion action:<approve|decline|considered|implemented> id:<number> response:<optional>`');
            return;
        }

        const suggestionNumber = parseInt(args[0]);
        const action = args[1].toLowerCase();
        const response = args.slice(2).join(' ').trim();

        const validActions = ['approve', 'decline', 'considered', 'implemented', 'approved', 'denied'];
        if (!validActions.includes(action)) {
            await sendReply('Valid actions: approve, decline, considered, implemented');
            return;
        }

        if (isNaN(suggestionNumber)) {
            await sendReply('Please provide a valid suggestion number.');
            return;
        }

        // Map actions to database status
        const actionMap: { [key: string]: string } = {
            'approve': 'approved',
            'approved': 'approved',
            'decline': 'denied',
            'denied': 'denied',
            'considered': 'considered',
            'implemented': 'implemented'
        };

        const dbStatus = actionMap[action];

        // Get suggestion by number
        const suggestion = await db.suggestion.findFirst({
            where: {
                guild_id: guild.id,
                suggestion_number: suggestionNumber
            }
        });

        if (!suggestion) {
            await sendReply('Suggestion not found.');
            return;
        }

        // Update DB
        await db.suggestion.update({
            where: { id: suggestion.id },
            data: {
                status: dbStatus,
                admin_response: response || null,
                reviewed_by: user.id,
                reviewed_at: new Date()
            }
        });

        // Update the original suggestion message
        try {
            const channel = await guild.channels.fetch(suggestion.channel_id);
            if (channel?.isTextBased()) {
                const suggestionMessage = await channel.messages.fetch(suggestion.message_id);

                const statusColors: { [key: string]: number | null } = {
                    'approved': 0x57F287,       // Green
                    'denied': 0xED4245,          // Red
                    'considered': 0xF5A623,      // Peach/Orange
                    'implemented': 0x57F287,     // Green
                    'pending': null
                };

                const author = await guild.members.fetch(suggestion.author_id).catch(() => null);

                // Build title with status for all non-pending statuses
                let title = `Suggestion #${suggestionNumber}`;
                if (dbStatus === 'approved') title += ' | Approved';
                else if (dbStatus === 'denied') title += ' | Denied';
                else if (dbStatus === 'considered') title += ' | Considered';
                else if (dbStatus === 'implemented') title += ' | Implemented';

                const embed = new EmbedBuilder()
                    .setColor(0x2b2d31)
                .setAuthor({
                        name: author?.user.username || 'Unknown User',
                        iconURL: author?.user.displayAvatarURL() || undefined
                    })
                    .setTitle(title)
                    .setDescription(suggestion.suggestion)
                    .setFooter({ text: `Suggestion #${suggestionNumber}` })
                    .setTimestamp();

                // Apply the correct color based on status
                const color = statusColors[dbStatus];
                if (color !== null && color !== undefined) {
                    embed.setColor(color);
                }

                if (response) {
                    embed.addFields({ name: 'Response', value: response });
                }

                await suggestionMessage.edit({ embeds: [embed] });
            }
        } catch (e) {
            console.error('Failed to update suggestion message:', e);
        }

        await sendReply(`Suggestion #${suggestionNumber} marked as **${dbStatus.toUpperCase()}**`);

        // Log action
        // @ts-ignore
        await ModLogger.log(guild, user as User, `Suggestion #${suggestionNumber}`, 'Suggestion', null, {
            channel: `Action: ${dbStatus}`
        });
    }
};
