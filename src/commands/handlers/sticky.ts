import { ChatInputCommandInteraction } from 'discord.js';
import { CommandExecutor } from '../../core/commandExecutor';
import { StickyAdd } from '../sticky/StickyAdd';
import { StickyEdit } from '../sticky/StickyEdit';
import { StickyRemove } from '../sticky/StickyRemove';
import { StickyList } from '../sticky/StickyList';
import { StickyEnable } from '../sticky/StickyEnable';
import { StickyDisable } from '../sticky/StickyDisable';
import { StickyCooldown } from '../sticky/StickyCooldown';

export async function handleStickyCommand(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();

    let args: string[] = [];

    // Map Slash Options to Legacy Args
    if (subcommand === 'add' || subcommand === 'edit') {
        const content = interaction.options.getString('content', true);
        args = [content];
    } else if (subcommand === 'cooldown') {
        const seconds = interaction.options.getInteger('seconds', true);
        args = [seconds.toString()];
    }

    // Dispatch
    switch (subcommand) {
        case 'add': return CommandExecutor.execute(StickyAdd, interaction, args);
        case 'edit': return CommandExecutor.execute(StickyEdit, interaction, args);
        case 'remove': return CommandExecutor.execute(StickyRemove, interaction, args);
        case 'list': return CommandExecutor.execute(StickyList, interaction, args);
        case 'enable': return CommandExecutor.execute(StickyEnable, interaction, args);
        case 'disable': return CommandExecutor.execute(StickyDisable, interaction, args);
        case 'cooldown': return CommandExecutor.execute(StickyCooldown, interaction, args);
        default:
            await interaction.reply({ content: 'Unknown subcommand', ephemeral: true });
    }
}
