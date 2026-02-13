import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

export const setupmailCommand = new SlashCommandBuilder()
    .setName('setupmail')
    .setDescription('Setup the mail/ticket system')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(opt => opt.setName('category').setDescription('Category for tickets').setRequired(true))
    .addChannelOption(opt => opt.setName('logchannel').setDescription('Channel for ticket logs').setRequired(true));

export const deletesetupCommand = new SlashCommandBuilder()
    .setName('deletesetup')
    .setDescription('Delete the mail/ticket system setup')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export const ccCommand = new SlashCommandBuilder()
    .setName('cc')
    .setDescription('Manage custom role assignment commands')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
        sub.setName('add')
            .setDescription('Create a custom role command')
            .addStringOption(opt => opt.setName('name').setDescription('Command name (e.g., vip)').setRequired(true))
            .addRoleOption(opt => opt.setName('role').setDescription('Role to assign').setRequired(true))
    )
    .addSubcommand(sub =>
        sub.setName('remove')
            .setDescription('Remove a custom command')
            .addStringOption(opt => opt.setName('name').setDescription('Command name to remove').setRequired(true))
    )
    .addSubcommand(sub =>
        sub.setName('show')
            .setDescription('Show all custom commands')
    );

export const modroleCommand = new SlashCommandBuilder()
    .setName('modrole')
    .setDescription('Manage moderator roles')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
        sub.setName('add')
            .setDescription('Add a moderator role')
            .addRoleOption(opt => opt.setName('role').setDescription('Role to add').setRequired(true))
    )
    .addSubcommand(sub =>
        sub.setName('remove')
            .setDescription('Remove a moderator role')
            .addRoleOption(opt => opt.setName('role').setDescription('Role to remove').setRequired(true))
    )
    .addSubcommand(sub =>
        sub.setName('show')
            .setDescription('Show all moderator roles')
    );

export const staffroleCommand = new SlashCommandBuilder()
    .setName('staffrole')
    .setDescription('Manage staff roles')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
        sub.setName('add')
            .setDescription('Add a staff role')
            .addRoleOption(opt => opt.setName('role').setDescription('Role to add').setRequired(true))
    )
    .addSubcommand(sub =>
        sub.setName('remove')
            .setDescription('Remove a staff role')
            .addRoleOption(opt => opt.setName('role').setDescription('Role to remove').setRequired(true))
    )
    .addSubcommand(sub =>
        sub.setName('show')
            .setDescription('Show all staff roles')
    );

export const srmodroleCommand = new SlashCommandBuilder()
    .setName('srmodrole')
    .setDescription('Manage senior moderator roles')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
        sub.setName('add')
            .setDescription('Add a senior moderator role')
            .addRoleOption(opt => opt.setName('role').setDescription('Role to add').setRequired(true))
    )
    .addSubcommand(sub =>
        sub.setName('remove')
            .setDescription('Remove a senior moderator role')
            .addRoleOption(opt => opt.setName('role').setDescription('Role to remove').setRequired(true))
    )
    .addSubcommand(sub =>
        sub.setName('show')
            .setDescription('Show all senior moderator roles')
    );

export const wvAllowedRoleCommand = new SlashCommandBuilder()
    .setName('wv_allowed_role')
    .setDescription('Manage which roles can use the !wv command')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
        sub.setName('add')
            .setDescription('Add a role that can use !wv')
            .addRoleOption(opt => opt.setName('role').setDescription('Role to add').setRequired(true))
    )
    .addSubcommand(sub =>
        sub.setName('remove')
            .setDescription('Remove a role from using !wv')
            .addRoleOption(opt => opt.setName('role').setDescription('Role to remove').setRequired(true))
    )
    .addSubcommand(sub =>
        sub.setName('show')
            .setDescription('Show all roles that can use !wv')
    );

export const modsafetyCommand = new SlashCommandBuilder()
    .setName('modsafety')
    .setDescription('Toggle mod safety (prevent mods from being moderated)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export const safetyadminCommand = new SlashCommandBuilder()
    .setName('safetyadmin')
    .setDescription('Toggle admin safety (prevent admins from being moderated)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export const emergencyCommand = new SlashCommandBuilder()
    .setName('emergency')
    .setDescription('Toggle emergency mode (lockdown server)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export const suggestionconfigCommand = new SlashCommandBuilder()
    .setName('suggestionconfig')
    .setDescription('Configure the suggestion system')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
        sub.setName('enable')
            .setDescription('Enable the suggestion system')
    )
    .addSubcommand(sub =>
        sub.setName('disable')
            .setDescription('Disable the suggestion system')
    )
    .addSubcommand(sub =>
        sub.setName('channel')
            .setDescription('Set the suggestion channel')
            .addChannelOption(opt => opt.setName('channel').setDescription('Channel for suggestions').setRequired(true))
    )
    .addSubcommand(sub =>
        sub.setName('show')
            .setDescription('Show current suggestion configuration')
    );

export const modlogsetupCommand = new SlashCommandBuilder()
    .setName('modlogsetup')
    .setDescription('Set the channel for moderation logs')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(opt => opt.setName('channel').setDescription('Channel for moderation logs').setRequired(true));

export const adminCommands = [
    setupmailCommand, deletesetupCommand, ccCommand, modroleCommand, 
    staffroleCommand, srmodroleCommand, wvAllowedRoleCommand, modsafetyCommand, safetyadminCommand, emergencyCommand, suggestionconfigCommand, modlogsetupCommand
];
