import { Context } from '../../core/context';
import { Command } from '../../core/command';
import { PermissionFlagsBits } from 'discord.js';
// We don't import handleStickyCommand here directly to avoid circular dependency if any, 
// or just because we might want to keep the legacy router logic for sticky acting as "subcommand router".
// But for Help, we just need metadata.

export const StickyCommand: Command = {
    name: 'sticky',
    description: 'Manage sticky messages (add, remove, list, etc.)',
    category: 'Sticky',
    syntax: 'sticky <action> [args]',
    example: 'sticky add This is a sticky message',
    permissions: [PermissionFlagsBits.ManageMessages],
    execute: async (ctx: Context, args: string[]) => {
        // If we want this to actually work via registry dispatch, we need to wire it up.
        // But router.ts handles 'sticky' specifically. 
        // If we remove the specific check in router.ts, we can implement dispatch here.
        // For now, let's keep it simple: this execute might simply be "See !sticky help" or similar if called directly via registry dispatch 
        // BUT, router.ts has a hardcoded check for 'sticky' that calls handleStickyCommand logic.
        // If we want !help to list it, it needs to be in Registry.
        // If we put it in Registry, Router.ts will find it if we remove the hardcode check?
        // Let's rely on router.ts specific check for EXECUTION, but Registry for HELP.
        // So this execute method might technically not be reached by router if router keeps the hardcode.
        // But if we want to be clean, we can make this calls the sticky handler.

        await ctx.reply({ content: 'Use `!sticky add`, `!sticky remove`, etc. Run `!help sticky` for more.' });
    }
};
