import { Context } from '../../core/context';
import { CommandRegistry } from '../registry';
import { EmbedBuilder, Colors, PermissionsBitField } from 'discord.js';

export const Help = async (ctx: Context, args: string[]) => {
    // Permission check: Only server moderators or above can use this command
    if (!ctx.inner.member) {
        await ctx.reply('This command can only be used in a server.');
        return;
    }

    const memberPermissions = typeof ctx.inner.member.permissions === 'string'
        ? new PermissionsBitField(BigInt(ctx.inner.member.permissions))
        : ctx.inner.member.permissions;

    const hasModPerms = memberPermissions.has(PermissionsBitField.Flags.Administrator) ||
                        memberPermissions.has(PermissionsBitField.Flags.ManageMessages);

    if (!hasModPerms) {
        // Silently ignore if user doesn't have permission
        return;
    }

    // If specific command requested
    const commandName = args[0]?.toLowerCase();

    if (commandName && CommandRegistry[commandName]) {
        const cmd = CommandRegistry[commandName];

        // Format Permissions
        let perms = 'None';
        if (cmd.permissions && cmd.permissions.length > 0) {
            perms = 'Requires Moderation Permissions';
        }

        const details = `**Description**\n${cmd.description}\n\n` +
            `**Permissions Required**\n${perms}\n\n` +
            `**Syntax**\n\`!${cmd.syntax}\`\n\n` +
            `**Example**\n\`!${cmd.example}\``;

        const embed = new EmbedBuilder()
            .setTitle(`Help: ${cmd.name.charAt(0).toUpperCase() + cmd.name.slice(1)}`)
            .setDescription(details)
            .setFooter({ text: 'Use !help for all commands' });

        await ctx.reply({ embeds: [embed] });
        return;
    }

    // List all commands in organized format
    const embed = new EmbedBuilder()
        .setTitle('📚 Available Commands')
        .setDescription('Here are all available commands:')
        .setFooter({ text: 'Use !help <command> for detailed information about a specific command.' });

    // General Commands
    embed.addFields({
        name: '**General Commands**',
        value: '`!help`',
        inline: false
    });

    // Mail Commands
    embed.addFields({
        name: '**Mail Commands**',
        value: '`!openmail`, `!close`, `!claim`, `!unclaim`, `!ticketpanel`, `!claimedtickets`, `!inactivemails`, `!ticket-clear`',
        inline: false
    });

    // Admin Commands
    embed.addFields({
        name: '**Admin Commands**',
        value: '`!delcase`, `!modleaderboard`, `!modlogs`, `!modstats`, `!caseinfo`, `!setupmail`, `!deletesetup`, `!cc`, `!modrole`, `!staffrole`, `!wv_allowed_role`, `!suggestionconfig`',
        inline: false
    });

    // Moderation Commands
    embed.addFields({
        name: '**Moderation Commands**',
        value: '`!ban`, `!kick`, `!warn`, `!mute`, `!unmute`, `!unban`, `!lock`, `!unlock`, `!hide`, `!unhide`, `!role`, `!inrole`, `!suggestion`',
        inline: false
    });

    // Sticky Commands
    embed.addFields({
        name: '**Sticky Commands**',
        value: '`!sticky`\n**Subcommands:** `!sticky add`, `!sticky edit`, `!sticky remove`, `!sticky list`, `!sticky enable`, `!sticky disable`, `!sticky cooldown`',
        inline: false
    });

    // AFK Commands
    embed.addFields({
        name: '**AFK Commands**',
        value: '`!afk`, `!afkclear`, `!afklist`, `!afksettings`',
        inline: false
    });

    // Moderator Utils Commands
    embed.addFields({
        name: '**Moderator Utils Commands**',
        value: '`!reason`, `!whois`, `!av`, `!banword`, `!checkperms`, `!dm`, `!move`, `!vclogs`, `!clogs`, `!wv`',
        inline: false
    });

    // Suggestion System
    embed.addFields({
        name: '**Suggestion System**',
        value: 'Type `+suggestion Your idea here` to submit a suggestion',
        inline: false
    });

    await ctx.reply({ embeds: [embed] });
};
