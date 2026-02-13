import { CommandRegistry } from '../registry';
import { ChatInputCommandInteraction } from 'discord.js';
import { CommandExecutor } from '../../core/commandExecutor';

export async function handleModerationCommand(interaction: ChatInputCommandInteraction) {
    const cmd = interaction.commandName;
    const command = CommandRegistry[cmd];
    if (!command) return;

    // Arg Mapping
    let args: string[] = [];

    // Get common options
    const userOption = interaction.options.getUser('user');
    const reasonOption = interaction.options.getString('reason');
    const durationOption = interaction.options.getString('duration');
    const caseOption = interaction.options.getInteger('case');
    const channelOption = interaction.options.getChannel('channel');
    const messageOption = interaction.options.getString('message') || interaction.options.getString('messageid');

    // Map args based on command
    if (cmd === 'ban' || cmd === 'kick' || cmd === 'warn' || cmd === 'unban' || cmd === 'whois' || cmd === 'av') {
        if (userOption) args.push(userOption.id);
        if (reasonOption) args.push(reasonOption);
    }
    else if (cmd === 'mute') {
        if (userOption) args.push(userOption.id);
        if (durationOption) args.push(durationOption);
        if (reasonOption) args.push(reasonOption);
    }
    else if (cmd === 'unmute') {
        if (userOption) args.push(userOption.id);
        if (reasonOption) args.push(reasonOption);
    }
    else if (cmd === 'reason') {
        if (caseOption) args.push(caseOption.toString());
        if (reasonOption) args.push(reasonOption);
    }
    else if (cmd === 'delcase' || cmd === 'caseinfo') {
        if (caseOption) args.push(caseOption.toString());
    }
    else if (cmd === 'modlogs' || cmd === 'modstats' || cmd === 'checkperms') {
        if (userOption) args.push(userOption.id);
    }
    else if (cmd === 'dm') {
        if (userOption) args.push(userOption.id);
        if (messageOption) args.push(messageOption);
    }
    else if (cmd === 'lock' || cmd === 'unlock' || cmd === 'hide' || cmd === 'unhide') {
        if (channelOption) args.push(channelOption.id);
    }
    else if (cmd === 'move') {
        if (userOption) args.push(userOption.id);
        if (channelOption) args.push(channelOption.id);
    }
    else if (cmd === 'banword') {
        const subcommand = interaction.options.getSubcommand();
        const word = interaction.options.getString('word');
        args.push(subcommand);
        if (word) args.push(word);
    }
    else if (cmd === 'role') {
        const subcommand = interaction.options.getSubcommand();
        const member = interaction.options.getUser('member');
        const role = interaction.options.getRole('role');
        args.push(subcommand);
        if (member) args.push(member.id);
        if (role) args.push(role.id);
    }
    else if (cmd === 'inrole') {
        const role = interaction.options.getRole('role');
        if (role) args.push(role.id);
    }
    else if (cmd === 'suggestion' || cmd === 'suggestion_action') {
        const action = interaction.options.getString('action');
        const id = interaction.options.getString('id') || interaction.options.getInteger('id')?.toString();
        const response = interaction.options.getString('response');
        if (id) args.push(id);
        if (action) args.push(action);
        if (response) args.push(response);
    }

    return CommandExecutor.execute(command.execute, interaction, args);
}
