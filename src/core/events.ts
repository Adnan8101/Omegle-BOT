import { client } from './discord';
import { createContext } from './context';
import { router } from '../commands/router';
import { stickyService } from '../services/sticky/StickyService';
import { afkService } from '../services/afk/AfkService';
import { initializeGiveawaySystem } from '../services/GiveawayIntegration';
import { Events } from 'discord.js';
import '../events/VoiceLogger';
import '../events/ChatLogger';
import '../events/MailDMHandler';
import '../events/SetupInteractionHandler';
import '../events/MailInteractionHandler';
import '../events/MailGuildHandler';
import { handleMessageReactionAdd, handleMessageReactionRemove } from '../events/giveawayReactionHandler';
import { giveawayCommands, prefixCommandMap } from '../commands/giveaways';
import { handleVoiceStateUpdate } from '../events/AutoDragHandler';

export const events = {
    init: () => {
        client.on(Events.ClientReady, () => {
            console.log(`Logged in as ${client.user?.tag}!`);
            stickyService.initialize().catch(console.error);
            initializeGiveawaySystem(client);
        });

        client.on(Events.InteractionCreate, async (interaction) => {
            // Handle suggestion button clicks
            if (interaction.isButton() && interaction.customId === 'suggest_button') {
                const { SuggestionInteractionHandler } = await import('../services/suggestion/SuggestionInteractionHandler');
                SuggestionInteractionHandler.handleSuggestButton(interaction).catch(console.error);
                return;
            }

            // Handle suggestion modal submissions
            if (interaction.isModalSubmit() && interaction.customId === 'suggest_modal') {
                const { SuggestionInteractionHandler } = await import('../services/suggestion/SuggestionInteractionHandler');
                SuggestionInteractionHandler.handleSuggestModal(interaction).catch(console.error);
                return;
            }

            if (!interaction.isChatInputCommand()) return;

            // Check if it's a giveaway command
            const giveawayCommand = giveawayCommands[interaction.commandName];
            if (giveawayCommand && giveawayCommand.execute) {
                try {
                    await giveawayCommand.execute(interaction);
                } catch (error) {
                    console.error(error);
                    if (interaction.replied || interaction.deferred) {
                        await interaction.followUp({ content: 'There was an error executing the giveaway command!', ephemeral: true });
                    } else {
                        await interaction.reply({ content: 'There was an error executing the giveaway command!', ephemeral: true });
                    }
                }
                return;
            }

            // Handle other interaction commands
            router.handleInteraction(interaction).catch(console.error);
        });

        client.on(Events.MessageCreate, async (message) => {
            if (message.author.bot) return;

            // Handle giveaway prefix commands
            if (message.content.startsWith('!')) {
                const cmdMatch = message.content.slice(1).split(/\s+/)[0]?.toLowerCase();
                if (prefixCommandMap[cmdMatch]) {
                    try {
                        const args = message.content.slice(cmdMatch.length + 2).trim().split(/\s+/);
                        await prefixCommandMap[cmdMatch].prefixRun(message, args);
                    } catch (error) {
                        console.error('Giveaway prefix command error:', error);
                    }
                    return;
                }
            }

            const ctx = createContext(message);
            if (!ctx) return;

            // Process all handlers in parallel for faster response
            Promise.all([
                router.execute(ctx),
                stickyService.trigger(ctx),
                afkService.handleMessage(message)
            ]).catch(console.error);
        });

        // Giveaway reaction handlers
        client.on(Events.MessageReactionAdd, (reaction, user) => {
            handleMessageReactionAdd(reaction, user, client).catch(console.error);
        });

        client.on(Events.MessageReactionRemove, (reaction, user) => {
            handleMessageReactionRemove(reaction, user, client).catch(console.error);
        });

        // Handle giveaway message deletion
        client.on(Events.MessageDelete, async (message) => {
            try {
                const { db } = await import('../data/db');
                const giveaway = await db.giveaway.findUnique({
                    where: { messageId: message.id }
                });
                if (giveaway) {
                    // Delete giveaway and related data
                    await db.giveawayParticipant.deleteMany({ where: { giveawayId: giveaway.id } });
                    await db.giveawayWinner.deleteMany({ where: { giveawayId: giveaway.id } });
                    await db.giveaway.delete({ where: { id: giveaway.id } });
                    console.log(`[Giveaway] Auto-deleted giveaway #${giveaway.id} - message was deleted`);
                }
            } catch (error) {
                // Silently handle errors
            }
        });

        // Handle voice state updates for auto-drag
        client.on(Events.VoiceStateUpdate, (oldState, newState) => {
            handleVoiceStateUpdate(oldState, newState).catch(console.error);
        });
    }
};
