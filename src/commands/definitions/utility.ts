import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

export const vclogsCommand = new SlashCommandBuilder()
    .setName('vclogs')
    .setDescription('Setup or view voice channel logs')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
        sub.setName('setup')
            .setDescription('Setup voice logs channel')
            .addChannelOption(opt => opt.setName('channel').setDescription('Log channel').setRequired(true))
    )
    .addSubcommand(sub =>
        sub.setName('disable')
            .setDescription('Disable voice logs')
    );

export const clogsCommand = new SlashCommandBuilder()
    .setName('clogs')
    .setDescription('Compare voice channel logs between two users')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(opt => 
        opt.setName('user1')
            .setDescription('First user to compare')
            .setRequired(true)
    )
    .addUserOption(opt => 
        opt.setName('user2')
            .setDescription('Second user to compare')
            .setRequired(true)
    )
    .addStringOption(opt => 
        opt.setName('time')
            .setDescription('Time range to check (e.g., 1h, 24h, 7d)')
            .setRequired(false)
    );

export const wvCommand = new SlashCommandBuilder()
    .setName('wv')
    .setDescription('Find which voice channel a user is in or manage allowed roles')
    .addSubcommand(sub =>
        sub.setName('find')
            .setDescription('Find which voice channel a user is in')
            .addUserOption(opt => 
                opt.setName('user')
                    .setDescription('User to find in voice channels')
                    .setRequired(true)
            )
    )
    .addSubcommand(sub =>
        sub.setName('allowed')
            .setDescription('Manage allowed roles for WV command')
            .addStringOption(opt =>
                opt.setName('action')
                    .setDescription('Action to perform')
                    .setRequired(true)
                    .addChoices(
                        { name: 'Show', value: 'show' },
                        { name: 'Add', value: 'add' },
                        { name: 'Remove', value: 'remove' }
                    )
            )
            .addRoleOption(opt =>
                opt.setName('role')
                    .setDescription('Role to add/remove')
                    .setRequired(false)
            )
    );

export const utilityCommands = [
    vclogsCommand, clogsCommand, wvCommand
];
