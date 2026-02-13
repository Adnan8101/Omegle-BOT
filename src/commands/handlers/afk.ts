import { ChatInputCommandInteraction } from 'discord.js';
import { CommandRegistry } from '../registry';
import { CommandExecutor } from '../../core/commandExecutor';

export async function handleAfkCommand(interaction: ChatInputCommandInteraction) {
    const cmd = interaction.commandName;
    const command = CommandRegistry[cmd];
    if (!command) return;
    
    let args: string[] = [];
    
    // Map slash options to args
    if (cmd === 'afk') {
        const reason = interaction.options.getString('reason');
        if (reason) args.push(reason);
    }
    
    return CommandExecutor.execute(command.execute, interaction, args);
}
