import { ChatInputCommandInteraction, Message, CommandInteractionOption } from 'discord.js';
import { Context, createContext, createContextFromInteraction } from './context';

/**
 * Unified command executor that works with both slash commands and prefix commands
 * Converts slash command interactions to Context for consistent command execution
 */
export class CommandExecutor {
    /**
     * Execute a command function with either a slash interaction or prefix context
     */
    static async execute(
        commandFn: (ctx: Context, args: string[]) => Promise<void>,
        source: ChatInputCommandInteraction | Context,
        args: string[] = []
    ): Promise<void> {
        let ctx: Context;

        // Check if source is already a Context by checking if it has Context properties
        if ('messageId' in source && 'authorIsBot' in source && 'mentions' in source) {
            // Already a context from prefix command
            ctx = source as Context;
        } else {
            // Convert slash command interaction to Context
            ctx = createContextFromInteraction(source as ChatInputCommandInteraction);
        }

        await commandFn(ctx, args);
    }

    /**
     * Extract arguments from a slash command interaction
     */
    static extractSlashArgs(interaction: ChatInputCommandInteraction): string[] {
        const args: string[] = [];

        // Get subcommand if exists
        const subcommand = interaction.options.getSubcommand(false);
        if (subcommand) {
            args.push(subcommand);
        }

        // Get all option values
        interaction.options.data.forEach(option => {
            if (option.type === 1) { // Subcommand
                option.options?.forEach(subOption => {
                    const value = this.getOptionValue(subOption);
                    if (value !== null && value !== undefined) {
                        args.push(String(value));
                    }
                });
            } else {
                const value = this.getOptionValue(option);
                if (value !== null && value !== undefined) {
                    args.push(String(value));
                }
            }
        });

        return args;
    }

    private static getOptionValue(option: CommandInteractionOption): string | number | boolean | undefined {
        if (option.user) return option.user.id;
        if (option.role) return option.role.id;
        if (option.channel) return option.channel.id;
        if (option.member) return option.member instanceof Object && 'id' in option.member ? option.member.id : String(option.member);
        return option.value;
    }
}
