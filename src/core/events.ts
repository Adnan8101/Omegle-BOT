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
        console.log('🎯 Initializing Discord event handlers...');
        
        client.on(Events.ClientReady, () => {
            console.log(`Logged in as ${client.user?.tag}!`);
            console.log('🔄 Initializing sticky service...');
            stickyService.initialize().catch(console.error);
            console.log('🎁 Initializing giveaway system...');
            initializeGiveawaySystem(client);
            console.log('✅ All systems initialized and ready!');
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
                console.log(`[Events] Prefix command detected: !${cmdMatch} by ${message.author?.username || 'unknown'} in #${(message.channel as any)?.name || 'unknown'} (${message.guild?.name || 'DM'})`);
                
                if (prefixCommandMap[cmdMatch]) {
                    try {
                        console.log(`[Events] Executing giveaway prefix command: ${cmdMatch} by ${message.author?.username || 'unknown'} in ${message.guild?.name || 'DM'}`);
                        
                        // Validate message object has required properties
                        if (!message.channel) {
                            console.error(`[Events] Message object missing channel property:`, {
                                hasGuild: !!message.guild,
                                hasAuthor: !!message.author,
                                hasChannel: !!message.channel,
                                messageId: message.id
                            });
                            return;
                        }
                        
                        const args = message.content.slice(cmdMatch.length + 2).trim().split(/\s+/).filter(arg => arg.length > 0);
                        console.log(`[Events] Parsed args for ${cmdMatch}:`, args);
                        
                        await prefixCommandMap[cmdMatch].prefixRun(message, args);
                        console.log(`[Events] Giveaway prefix command ${cmdMatch} completed successfully`);
                    } catch (error) {
                        console.error(`[Events] Giveaway prefix command error for ${cmdMatch}:`, error);
                    }
                    return;
                }
            }

            const ctx = createContext(message);
            if (!ctx) return;

            // Log if it's a prefix command
            if (message.content.startsWith('!')) {
                console.log(`[Events] Routing prefix command to router: "${message.content}" by ${message.author.username}`);
            }

            // Process all handlers in parallel — use allSettled so one failure doesn't kill others
            Promise.allSettled([
                router.execute(ctx),
                stickyService.trigger(ctx),
                afkService.handleMessage(message)
            ]).then(results => {
                for (const r of results) {
                    if (r.status === 'rejected') console.error('[Events] Handler error:', r.reason);
                }
            });
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
