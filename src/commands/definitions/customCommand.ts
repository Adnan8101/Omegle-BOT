import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

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
