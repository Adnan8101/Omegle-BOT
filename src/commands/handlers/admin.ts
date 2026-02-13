import { ChatInputCommandInteraction } from 'discord.js';
import { CommandRegistry } from '../registry';
import { CommandExecutor } from '../../core/commandExecutor';

export async function handleAdminCommand(interaction: ChatInputCommandInteraction) {
    const cmd = interaction.commandName;
    const command = CommandRegistry[cmd];
    if (!command) return;
    
    let args: string[] = [];
    
    // Map slash options to args
    if (cmd === 'setupmail') {
        const category = interaction.options.getChannel('category', true);
        const logChannel = interaction.options.getChannel('logchannel', true);
        args.push(category.id, logChannel.id);
    } else if (cmd === 'suggestionconfig') {
        const subcommand = interaction.options.getSubcommand();
        args.push(subcommand);
        
        if (subcommand === 'channel') {
            const channel = interaction.options.getChannel('channel', true);
            args.push(channel.id);
        }
    } else if (cmd === 'modlogsetup') {
        const channel = interaction.options.getChannel('channel', true);
        args.push(channel.id);
    } else if (cmd === 'cc' || cmd === 'modrole' || cmd === 'staffrole' || cmd === 'srmodrole' || cmd === 'wv_allowed_role') {
        const subcommand = interaction.options.getSubcommand();
        args.push(subcommand);
        
        if (subcommand === 'add') {
            if (cmd === 'cc') {
                const name = interaction.options.getString('name', true);
                const role = interaction.options.getRole('role', true);
                args.push(name, role.id);
            } else {
                const role = interaction.options.getRole('role', true);
                args.push(role.id);
            }
        } else if (subcommand === 'remove') {
            if (cmd === 'cc') {
                const name = interaction.options.getString('name', true);
                args.push(name);
            } else {
                const role = interaction.options.getRole('role', true);
                args.push(role.id);
            }
        }
    }
    
    return CommandExecutor.execute(command.execute, interaction, args);
}
