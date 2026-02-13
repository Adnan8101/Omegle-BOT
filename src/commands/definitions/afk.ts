import { SlashCommandBuilder } from 'discord.js';

export const afkCommand = new SlashCommandBuilder()
    .setName('afk')
    .setDescription('Set yourself as AFK')
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for being AFK'));

export const afkclearCommand = new SlashCommandBuilder()
    .setName('afkclear')
    .setDescription('Clear your AFK status');

export const afklistCommand = new SlashCommandBuilder()
    .setName('afklist')
    .setDescription('List all AFK users in this server');

export const afksettingsCommand = new SlashCommandBuilder()
    .setName('afksettings')
    .setDescription('Configure AFK settings for this server')
    .setDefaultMemberPermissions(0n); // Admin only

export const afkCommands = [
    afkCommand, afkclearCommand, afklistCommand, afksettingsCommand
];
