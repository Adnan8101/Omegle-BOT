import { Context } from '../core/context';
import { parser } from './parser';
import { ChatInputCommandInteraction } from 'discord.js';
import { handleStickyCommand } from './handlers/sticky';
import { handleModerationCommand } from './handlers/moderation';
import { handleAfkCommand } from './handlers/afk';
import { handleMailCommand } from './handlers/mail';
import { handleAdminCommand } from './handlers/admin';
import { handleUtilityCommand } from './handlers/utility';
import { executeCustomCommand } from './handlers/customCommand';
import { CommandRegistry } from './registry';
import { giveawayCommands, prefixCommandMap } from './giveaways';

import { hasPermission } from '../util/permissions';
import { canPerformAction, ModAction } from '../util/rolePermissions'; // Import fallback check
import { PermissionsBitField } from 'discord.js';

export type CommandHandler = (ctx: Context, args: string[]) => Promise<void>;


// Define command categories for routing
const moderationCommands = ['ban', 'kick', 'mute', 'unmute', 'warn', 'unban', 'reason',
    'delcase', 'modleaderboard', 'modlogs', 'modstats', 'whois', 'caseinfo',
    'av', 'banword', 'checkperms', 'dm', 'lock', 'unlock', 'hide', 'unhide',
    'move', 'movevc', 'role', 'inrole', 'ad', 'autodrag', 'suggestion'];
const afkCommands = ['afk', 'afkclear', 'afklist', 'afksettings'];
const mailCommands = ['openmail', 'close', 'claim', 'unclaim', 'ticketpanel',
    'claimedtickets', 'inactivemails', 'ticketclear'];
const adminCommands = ['setupmail', 'deletesetup', 'cc', 'modrole', 'staffrole', 'srmodrole',
    'modsafety', 'safetyadmin', 'emergency', 'suggestionconfig', 'modlogsetup'];
const utilityCommands = ['vclogs', 'clogs', 'wv', 'help'];
const giveawayCommandNames = ['gcreate', 'gstart', 'gend', 'greroll', 'gcancel',
    'gdelete', 'glist', 'ghistory', 'grefresh', 'gresume', 'gstop', 'gschedule'];

export class CommandRouter {
    async handleInteraction(interaction: ChatInputCommandInteraction) {
        if (!interaction.isChatInputCommand()) return;

        const { commandName } = interaction;

        try {
            // Route to appropriate handler based on command
            if (commandName === 'sticky') {
                await handleStickyCommand(interaction);
            } else if (moderationCommands.includes(commandName)) {
                await handleModerationCommand(interaction);
            } else if (afkCommands.includes(commandName)) {
                await handleAfkCommand(interaction);
            } else if (mailCommands.includes(commandName)) {
                await handleMailCommand(interaction);
            } else if (adminCommands.includes(commandName)) {
                await handleAdminCommand(interaction);
            } else if (utilityCommands.includes(commandName)) {
                await handleUtilityCommand(interaction);
            } else if (giveawayCommandNames.includes(commandName)) {
                const giveawayCmd = giveawayCommands[commandName];
                if (giveawayCmd && giveawayCmd.execute) {
                    await giveawayCmd.execute(interaction);
                }
            }
        } catch (error) {
            console.error(error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
            } else {
                await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
            }
        }
    }

    async execute(ctx: Context) {
        const parsed = parser.parse(ctx.content);
        if (!parsed) return;

        const command = parsed.command;

        // Check if it's a giveaway prefix command
        if (prefixCommandMap[command] && prefixCommandMap[command].prefixRun) {
            try {
                await prefixCommandMap[command].prefixRun(ctx.inner as any, parsed.args);
                return;
            } catch (err: any) {
                console.error(err);
                await ctx.reply({ content: `Error: ${err.message}`, ephemeral: true });
                return;
            }
        }

        // Dynamic dispatch via Registry
        const commandDef = CommandRegistry[command];

        if (commandDef) {
            try {
                let effectiveArgs: string[] = [];
                if (parsed.subcommand) effectiveArgs.push(parsed.subcommand);
                if (parsed.args) effectiveArgs.push(...parsed.args);

                // Global permission check
                if (commandDef.permissions && commandDef.permissions.length > 0) {
                    if (ctx.inner.member) {
                        const perms = ctx.inner.member.permissions;
                        // Check if user has at least one of the required permissions
                        const hasPerm = commandDef.permissions.some(p => hasPermission(perms, p));

                        if (!hasPerm) {
                            // Check for role-based override if modAction is defined
                            if (commandDef.modAction) {
                                // We cast because commandDef.modAction is string, but canPerformAction expects ModAction
                                // Validation relies on developer ensuring string matches ModAction
                                const canRole = await canPerformAction(ctx.guildId, ctx.inner.member, commandDef.modAction as ModAction);
                                if (canRole) {
                                    // Allowed by role override
                                } else {
                                    return; // Rejected by both
                                }
                            } else {
                                return; // Rejected
                            }
                        }
                    } else {
                        // If no member (e.g. DM), strict fail silent for server-only commands
                        return;
                    }
                }

                await commandDef.execute(ctx, effectiveArgs);
            } catch (err: any) {
                console.error(err);
                await ctx.reply({ content: `Error: ${err.message}`, ephemeral: true });
            }
        } else {
            // Check if it's a custom command
            try {
                let effectiveArgs: string[] = [];
                if (parsed.subcommand) effectiveArgs.push(parsed.subcommand);
                if (parsed.args) effectiveArgs.push(...parsed.args);

                await executeCustomCommand(ctx, command, effectiveArgs);
            } catch (err: any) {
                console.error(err);
            }
        }
    }
}

export const router = new CommandRouter();
