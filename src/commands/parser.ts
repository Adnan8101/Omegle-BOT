export interface ParsedCommand {
    command: string;
    subcommand: string | null;
    args: string[];
}

export class PrefixParser {
    private prefix = '!'; // Hardcoded for now, could be DB driven

    parse(content: string): ParsedCommand | null {
        if (!content.startsWith(this.prefix)) return null;

        const parts = content.slice(this.prefix.length).trim().split(/\s+/);
        if (parts.length === 0) return null;

        const command = parts[0].toLowerCase();
        const args = parts.slice(1);

        // Simple subcommand detection (only for 'sticky' command usually)
        let subcommand: string | null = null;

        if (parts.length > 1) {
            subcommand = parts[1].toLowerCase();
        }

        // Adjust args if subcommand exists
        // If command is 'sticky' and we have 'add', args should start after 'add'
        const finalArgs = subcommand ? args.slice(1) : args;

        return {
            command,
            subcommand: subcommand,
            args: finalArgs
        };
    }
}

export const parser = new PrefixParser();
