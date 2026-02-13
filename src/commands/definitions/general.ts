import { SlashCommandBuilder } from 'discord.js';

export const helpCommand = new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show available commands')
    .addStringOption(opt => opt.setName('command').setDescription('Specific command to get help for'));

export const generalCommands = [
    helpCommand
];
