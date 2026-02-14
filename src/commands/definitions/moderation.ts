import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';

export const banCommand = new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a user from the server')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption(opt => opt.setName('user').setDescription('The user to ban').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('The reason for the ban'));

export const kickCommand = new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a user from the server')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption(opt => opt.setName('user').setDescription('The user to kick').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('The reason for the kick'));

export const muteCommand = new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Timeout a user')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(opt => opt.setName('user').setDescription('The user to mute').setRequired(true))
    .addStringOption(opt => opt.setName('duration').setDescription('Duration (e.g. 1h, 30m)').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('The reason for the mute'));

export const unmuteCommand = new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Remove timeout from a user')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(opt => opt.setName('user').setDescription('The user to unmute').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('The reason for the unmute'));

export const warnCommand = new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warn a user')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addUserOption(opt => opt.setName('user').setDescription('The user to warn').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('The reason for the warning'));

export const unbanCommand = new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Unban a user ID')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption(opt => opt.setName('user').setDescription('The user ID to unban').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('The reason for the unban'));

export const reasonCommand = new SlashCommandBuilder()
    .setName('reason')
    .setDescription('Update the reason for a case')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption(opt => opt.setName('case').setDescription('Case number').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('New reason').setRequired(true));

export const delcaseCommand = new SlashCommandBuilder()
    .setName('delcase')
    .setDescription('Delete a moderation case')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption(opt => opt.setName('case').setDescription('Case number to delete').setRequired(true));

export const modleaderboardCommand = new SlashCommandBuilder()
    .setName('modleaderboard')
    .setDescription('View moderation leaderboard')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

export const modlogsCommand = new SlashCommandBuilder()
    .setName('modlogs')
    .setDescription('View moderation logs')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addUserOption(opt => opt.setName('user').setDescription('User to view logs for'));

export const modstatsCommand = new SlashCommandBuilder()
    .setName('modstats')
    .setDescription('View your moderation statistics')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addUserOption(opt => opt.setName('user').setDescription('User to view stats for'));

export const whoisCommand = new SlashCommandBuilder()
    .setName('whois')
    .setDescription('Get information about a user')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addUserOption(opt => opt.setName('user').setDescription('User to lookup').setRequired(true));

export const caseinfoCommand = new SlashCommandBuilder()
    .setName('caseinfo')
    .setDescription('View information about a case')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption(opt => opt.setName('case').setDescription('Case number').setRequired(true));

export const avCommand = new SlashCommandBuilder()
    .setName('av')
    .setDescription('Get a user\'s avatar')
    .addUserOption(opt => opt.setName('user').setDescription('User to get avatar from'));

export const banwordCommand = new SlashCommandBuilder()
    .setName('banword')
    .setDescription('Manage banned words')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addSubcommand(sub =>
        sub.setName('add')
            .setDescription('Add a banned word')
            .addStringOption(opt => opt.setName('word').setDescription('Word to ban').setRequired(true))
    )
    .addSubcommand(sub =>
        sub.setName('remove')
            .setDescription('Remove a banned word')
            .addStringOption(opt => opt.setName('word').setDescription('Word to unban').setRequired(true))
    )
    .addSubcommand(sub =>
        sub.setName('list')
            .setDescription('List all banned words')
    );

export const checkpermsCommand = new SlashCommandBuilder()
    .setName('checkperms')
    .setDescription('Check permissions for a user')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addUserOption(opt => opt.setName('user').setDescription('User to check').setRequired(true));

export const dmCommand = new SlashCommandBuilder()
    .setName('dm')
    .setDescription('Send a DM to a user')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addUserOption(opt => opt.setName('user').setDescription('User to DM').setRequired(true))
    .addStringOption(opt => opt.setName('message').setDescription('Message to send').setRequired(true));

export const lockCommand = new SlashCommandBuilder()
    .setName('lock')
    .setDescription('Lock a channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addChannelOption(opt => opt.setName('channel').setDescription('Channel to lock'));

export const unlockCommand = new SlashCommandBuilder()
    .setName('unlock')
    .setDescription('Unlock a channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addChannelOption(opt => opt.setName('channel').setDescription('Channel to unlock'));

export const hideCommand = new SlashCommandBuilder()
    .setName('hide')
    .setDescription('Hide a channel from @everyone')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addChannelOption(opt => opt.setName('channel').setDescription('Channel to hide'));

export const unhideCommand = new SlashCommandBuilder()
    .setName('unhide')
    .setDescription('Unhide a channel to @everyone')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addChannelOption(opt => opt.setName('channel').setDescription('Channel to unhide'));

export const moveCommand = new SlashCommandBuilder()
    .setName('move')
    .setDescription('Move a user to another voice channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.MoveMembers)
    .addUserOption(opt => opt.setName('user').setDescription('User to move').setRequired(true))
    .addChannelOption(opt => 
        opt.setName('channel')
           .setDescription('Target voice channel')
           .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
           .setRequired(false)
    );

export const roleCommand = new SlashCommandBuilder()
    .setName('role')
    .setDescription('Manage user roles')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand(sub =>
        sub.setName('add')
            .setDescription('Add a role to a member')
            .addUserOption(opt => opt.setName('member').setDescription('Member to give role to').setRequired(true))
            .addRoleOption(opt => opt.setName('role').setDescription('Role to add').setRequired(true))
    )
    .addSubcommand(sub =>
        sub.setName('remove')
            .setDescription('Remove a role from a member')
            .addUserOption(opt => opt.setName('member').setDescription('Member to remove role from').setRequired(true))
            .addRoleOption(opt => opt.setName('role').setDescription('Role to remove').setRequired(true))
    );

export const inroleCommand = new SlashCommandBuilder()
    .setName('inrole')
    .setDescription('List all members with a specific role')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addRoleOption(opt => opt.setName('role').setDescription('Role to check').setRequired(true));

export const suggestionCommand = new SlashCommandBuilder()
    .setName('suggestion')
    .setDescription('Manage suggestions')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addStringOption(opt =>
        opt.setName('action')
            .setDescription('Action to perform')
            .setRequired(true)
            .addChoices(
                { name: 'Approve', value: 'approve' },
                { name: 'Decline', value: 'decline' },
                { name: 'Considered', value: 'considered' },
                { name: 'Implemented', value: 'implemented' }
            )
    )
    .addStringOption(opt =>
        opt.setName('id')
            .setDescription('Suggestion ID')
            .setRequired(true)
    )
    .addStringOption(opt =>
        opt.setName('response')
            .setDescription('Admin response to the suggestion')
            .setRequired(false)
    );

export const purgeCommand = new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Bulk delete messages')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption(opt => opt.setName('amount').setDescription('Number of messages to delete').setRequired(true).setMinValue(1).setMaxValue(100))
    .addStringOption(opt =>
        opt.setName('type')
            .setDescription('Filter messages by type')
            .addChoices(
                { name: 'All', value: 'all' },
                { name: 'Human', value: 'human' },
                { name: 'Bots', value: 'bots' },
                { name: 'Media', value: 'media' }
            )
    )
    .addStringOption(opt => opt.setName('start_after').setDescription('Delete messages starting after this message ID'))
    .addStringOption(opt => opt.setName('end_before').setDescription('Delete messages ending before this message ID'));

export const editManualCommand = new SlashCommandBuilder()
    .setName('edit-manual')
    .setDescription('Edit an existing manual entry')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption(opt => opt.setName('id').setDescription('Manual number to edit').setRequired(true));

export const modCommands = [
    banCommand, kickCommand, muteCommand, unmuteCommand, warnCommand, unbanCommand, reasonCommand,
    delcaseCommand, modleaderboardCommand, modlogsCommand, modstatsCommand, whoisCommand, caseinfoCommand,
    avCommand, banwordCommand, checkpermsCommand, dmCommand, lockCommand, unlockCommand, hideCommand, unhideCommand,
    moveCommand, roleCommand, inroleCommand, suggestionCommand, purgeCommand, editManualCommand
];
