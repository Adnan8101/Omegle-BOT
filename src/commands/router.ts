import { Context } from '../core/context';
import { parser } from './parser';
import { ChatInputCommandInteraction, Message } from 'discord.js';
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

const SPEAKER_OFF = '🔇';

export type CommandHandler = (ctx: Context, args: string[]) => Promise<void>;


// Define command categories for routing
const moderationCommands = ['ban', 'kick', 'mute', 'unmute', 'warn', 'unban', 'reason',
    'delcase', 'modleaderboard', 'modlogs', 'modstats', 'whois', 'caseinfo',
    'av', 'banword', 'checkperms', 'dm', 'lock', 'unlock', 'hide', 'unhide',
    'move', 'mv', 'role', 'inrole', 'ad', 'autodrag', 'suggestion',
    'manuals', 'edit-manual', 'editmanual', 'delete-manual', 'deletemanual'];
const afkCommands = ['afk', 'afkclear', 'afklist', 'afksettings'];
const mailCommands = ['openmail', 'close', 'claim', 'unclaim', 'ticketpanel',
    'claimedtickets', 'inactivemails', 'ticketclear'];
const adminCommands = ['setupmail', 'deletesetup', 'cc', 'modrole', 'staffrole', 'srmodrole',
    'modsafety', 'safetyadmin', 'emergency', 'suggestionconfig', 'modlogsetup',
    'manual-logs-channel', 'manuallogschannel'];
const utilityCommands = ['vclogs', 'clogs', 'wv', 'help'];
const giveawayCommandNames = ['gcreate', 'gstart', 'gend', 'greroll', 'gcancel',
    'gdelete', 'glist', 'ghistory', 'grefresh', 'gresume', 'gstop', 'gschedule'];

// Commands that use subcommands (parser should extract subcommand only for these)
const SUBCOMMAND_COMMANDS = ['sticky', 'banword', 'role', 'suggestion', 'suggestion_action', 'cc', 'afksettings'];

export class CommandRouter {
    async handleInteraction(interaction: ChatInputCommandInteraction) {
        if (!interaction.isChatInputCommand()) return;

        const { commandName } = interaction;
        console.log(`[Router] Slash command received: /${commandName} by ${interaction.user.tag} in ${interaction.guild?.name || 'DM'}`);

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
            } else {
                console.log(`[Router] Unknown slash command: /${commandName}`);
            }
        } catch (error) {
            console.error(`[Router] Error executing slash command /${commandName}:`, error);
            // Don't reply with error messages, just log
        }
    }

    async execute(ctx: Context) {
        const parsed = parser.parse(ctx.content);
        if (!parsed) return;

        const command = parsed.command;
        console.log(`[Router] Prefix command received: !${command} by user ${ctx.authorId} in guild ${ctx.guildId}`);
        console.log(`[Router] Parsed: command=${command}, subcommand=${parsed.subcommand}, args=[${parsed.args.join(', ')}]`);

        // Check if it's a giveaway prefix command
        if (prefixCommandMap[command] && prefixCommandMap[command].prefixRun) {
            try {
                console.log(`[Router] Routing to giveaway handler: ${command}`);
                await prefixCommandMap[command].prefixRun(ctx.inner as any, parsed.args);
                return;
            } catch (err: any) {
                console.error(`[Router] Giveaway command error for !${command}:`, err);
                if (ctx.inner instanceof Message) {
                    await ctx.inner.react(SPEAKER_OFF).catch(() => {});
                }
                return;
            }
        }

        // Dynamic dispatch via Registry
        const commandDef = CommandRegistry[command];

        if (commandDef) {
            console.log(`[Router] Found command in registry: ${commandDef.name} (category: ${commandDef.category})`);
            try {
                // Build effective args - only extract subcommand for commands that use subcommands
                let effectiveArgs: string[] = [];
                if (SUBCOMMAND_COMMANDS.includes(command) && parsed.subcommand) {
                    effectiveArgs.push(parsed.subcommand);
                    if (parsed.args) effectiveArgs.push(...parsed.args);
                } else {
                    // For normal commands, put subcommand back as regular arg
                    if (parsed.subcommand) effectiveArgs.push(parsed.subcommand);
                    if (parsed.args) effectiveArgs.push(...parsed.args);
                }

                console.log(`[Router] Effective args for !${command}: [${effectiveArgs.join(', ')}]`);

                // Global permission check
                if (commandDef.permissions && commandDef.permissions.length > 0) {
                    if (ctx.inner.member) {
                        const perms = ctx.inner.member.permissions;
                        // Check if user has at least one of the required permissions
                        const hasPerm = commandDef.permissions.some(p => hasPermission(perms, p));

                        if (!hasPerm) {
                            // Check for role-based override if modAction is defined
                            if (commandDef.modAction) {
                                const canRole = await canPerformAction(ctx.guildId, ctx.inner.member, commandDef.modAction as ModAction);
                                if (canRole) {
                                    console.log(`[Router] Permission granted via role override for !${command}`);
                                } else {
                                    console.log(`[Router] Permission denied for !${command} - user ${ctx.authorId} lacks perms and role override`);
                                    return; // Rejected by both
                                }
                            } else {
                                console.log(`[Router] Permission denied for !${command} - user ${ctx.authorId} lacks required perms`);
                                return; // Rejected
                            }
                        } else {
                            console.log(`[Router] Permission granted via Discord perms for !${command}`);
                        }
                    } else {
                        console.log(`[Router] No member context for !${command} - rejecting`);
                        return;
                    }
                }

                console.log(`[Router] Executing command: !${command}`);
                await commandDef.execute(ctx, effectiveArgs);
                console.log(`[Router] Command !${command} executed successfully`);
            } catch (err: any) {
                console.error(`[Router] Error executing command !${command}:`, err);
                // React with speaker off instead of sending error message
                if (ctx.inner instanceof Message) {
                    await ctx.inner.react(SPEAKER_OFF).catch(() => {});
                }
            }
        } else {
            // Check if it's a custom command
            console.log(`[Router] Command !${command} not in registry, checking custom commands...`);
            try {
                let effectiveArgs: string[] = [];
                if (parsed.subcommand) effectiveArgs.push(parsed.subcommand);
                if (parsed.args) effectiveArgs.push(...parsed.args);

                await executeCustomCommand(ctx, command, effectiveArgs);
            } catch (err: any) {
                console.error(`[Router] Custom command error for !${command}:`, err);
            }
        }
    }
}

export const router = new CommandRouter();
