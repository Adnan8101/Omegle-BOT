import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

export const stickyCommand = new SlashCommandBuilder()
    .setName('sticky')
    .setDescription('Manage sticky messages')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addSubcommand(sub =>
        sub.setName('add')
            .setDescription('Create a new sticky message')
            .addStringOption(option =>
                option.setName('content')
                    .setDescription('The content of the sticky message')
                    .setRequired(true)
            )
    )
    .addSubcommand(sub =>
        sub.setName('edit')
            .setDescription('Edit an existing sticky message')
            .addStringOption(option =>
                option.setName('content')
                    .setDescription('The new content')
                    .setRequired(true)
            )
    )
    .addSubcommand(sub =>
        sub.setName('remove')
            .setDescription('Remove the sticky message from this channel')
    )
    .addSubcommand(sub =>
        sub.setName('list')
            .setDescription('List all sticky messages in this server')
    )
    .addSubcommand(sub =>
        sub.setName('enable')
            .setDescription('Enable the sticky message in this channel')
    )
    .addSubcommand(sub =>
        sub.setName('disable')
            .setDescription('Disable the sticky message in this channel')
    )
    .addSubcommand(sub =>
        sub.setName('cooldown')
            .setDescription('Set the cooldown for the sticky message')
            .addIntegerOption(option =>
                option.setName('seconds')
                    .setDescription('Cooldown in seconds')
                    .setRequired(true)
                    .setMinValue(0)
            )
    );
