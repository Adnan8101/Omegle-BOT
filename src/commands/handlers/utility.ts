import { ChatInputCommandInteraction } from 'discord.js';
import { CommandRegistry } from '../registry';
import { CommandExecutor } from '../../core/commandExecutor';

export async function handleUtilityCommand(interaction: ChatInputCommandInteraction) {
    const cmd = interaction.commandName;
    const command = CommandRegistry[cmd];
    if (!command) return;
    
    let args: string[] = [];
    
    // Handle wv command (wherevoice)
    if (cmd === 'wv') {
        const subcommand = interaction.options.getSubcommand();
        
        if (subcommand === 'find') {
            const user = interaction.options.getUser('user', true);
            args.push(user.id);
        } else if (subcommand === 'allowed') {
            args.push('allowed');
            const action = interaction.options.getString('action', true);
            const role = interaction.options.getRole('role');
            
            args.push(action);
            if (role) args.push(role.id);
        }
        
        return CommandExecutor.execute(command.execute, interaction, args);
    }
    
    // Handle help command
    if (cmd === 'help') {
        const cmdName = interaction.options.getString('command');
        if (cmdName) args.push(cmdName);
        
        return CommandExecutor.execute(command.execute, interaction, args);
    }
    
    // Handle clogs command (compare voice logs)
    if (cmd === 'clogs') {
        const user1 = interaction.options.getUser('user1');
        const user2 = interaction.options.getUser('user2');
        const time = interaction.options.getString('time');
        
        if (user1) args.push(user1.id);
        if (user2) args.push(user2.id);
        if (time) args.push(time);
        
        return CommandExecutor.execute(command.execute, interaction, args);
    }
    
    // Handle vclogs command (has subcommands)
    const subcommand = interaction.options.getSubcommand();
    args = [subcommand];
    
    // Map slash options to args
    if (subcommand === 'setup') {
        const channel = interaction.options.getChannel('channel', true);
        args.push(channel.id);
    }
    
    return CommandExecutor.execute(command.execute, interaction, args);
}
