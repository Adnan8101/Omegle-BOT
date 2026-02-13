import { Context } from '../../core/context';
import { EmbedBuilder, Colors, PermissionFlagsBits, GuildMember } from 'discord.js';
import { db } from '../../data/db';

/**
 * Execute a custom command to assign a role to a user
 */
export async function executeCustomCommand(ctx: Context, commandName: string, args: string[]) {
    const guild = ctx.inner.guild;
    const member = ctx.inner.member;

    if (!guild || !member) {
        const embed = new EmbedBuilder()
            .setDescription('<:cross:1469273232929456314> This command can only be used in a server.');
        await ctx.reply({ embeds: [embed] });
        return;
    }

    // Check if user has Manage Roles permission
    if (typeof member.permissions === 'string' || !member.permissions.has(PermissionFlagsBits.ManageRoles)) {
        // Silently ignore if user doesn't have permission
        return;
    }

    // Check if bot has Manage Roles permission
    if (!guild.members.me?.permissions.has(PermissionFlagsBits.ManageRoles)) {
        const embed = new EmbedBuilder()
            .setDescription('<:cross:1469273232929456314> I need the **Manage Roles** permission to do this.');
        await ctx.reply({ embeds: [embed] });
        return;
    }

    // Get custom command from database
    const customCommand = await db.customCommand.findUnique({
        where: {
            guild_id_name: {
                guild_id: guild.id,
                name: commandName
            }
        }
    });

    if (!customCommand) {
        // Command not found, silently ignore (it's not a custom command)
        return;
    }

    // Check if user provided a target
    if (args.length === 0) {
        const role = guild.roles.cache.get(customCommand.role_id);
        const embed = new EmbedBuilder()
            .setDescription(`<:cross:1469273232929456314> **Usage:** \`!${commandName} @user\``)
            .addFields({
                name: 'This command assigns',
                value: role ? `<@&${role.id}>` : `Role ID: ${customCommand.role_id}`
            });
        await ctx.reply({ embeds: [embed] });
        return;
    }

    // Parse target member
    const memberInput = args[0];
    let targetMember: GuildMember | undefined;

    const memberMatch = memberInput.match(/^<@!?(\d+)>$/);
    if (memberMatch) {
        targetMember = await guild.members.fetch(memberMatch[1]).catch(() => undefined);
    } else {
        targetMember = await guild.members.fetch(memberInput).catch(() => undefined);
    }

    if (!targetMember) {
        const embed = new EmbedBuilder()
            .setDescription(`<:cross:1469273232929456314> Could not find member: **${memberInput}**`);
        await ctx.reply({ embeds: [embed] });
        return;
    }

    // Get the role
    const role = guild.roles.cache.get(customCommand.role_id);
    if (!role) {
        const embed = new EmbedBuilder()
            .setDescription(`<:cross:1469273232929456314> Role not found. The role may have been deleted.\nUse \`!cc remove ${commandName}\` to remove this command.`);
        await ctx.reply({ embeds: [embed] });
        return;
    }

    // Check if member already has the role
    if (targetMember.roles.cache.has(role.id)) {
        const embed = new EmbedBuilder()
            .setDescription(`⚠️ ${targetMember.user} already has the <@&${role.id}> role.`);
        await ctx.reply({ embeds: [embed] });
        return;
    }

    // Check role hierarchy - command author cannot give roles higher than their own
    let authorMember = member as GuildMember;

    // If member is APIInteractionGuildMember (from slash command), fetch the real GuildMember
    if (!(authorMember instanceof GuildMember)) {
        try {
            authorMember = await guild.members.fetch(member.user.id);
        } catch (e) {
            const embed = new EmbedBuilder()
                .setDescription('<:cross:1469273232929456314> Failed to fetch your member profile.');
            await ctx.reply({ embeds: [embed] });
            return;
        }
    }

    const authorHighestRole = authorMember.roles.highest;

    if (role.position >= authorHighestRole.position && guild.ownerId !== authorMember.id) {
        const embed = new EmbedBuilder()
            .setDescription(`<:cross:1469273232929456314> You cannot give a role higher than or equal to your highest role.\n**Your highest role:** <@&${authorHighestRole.id}>`);
        await ctx.reply({ embeds: [embed] });
        return;
    }

    // Check bot role hierarchy
    const botHighestRole = guild.members.me!.roles.highest;
    if (role.position >= botHighestRole.position) {
        const embed = new EmbedBuilder()
            .setDescription(`<:cross:1469273232929456314> I cannot give a role higher than or equal to my highest role.\n**My highest role:** <@&${botHighestRole.id}>`);
        await ctx.reply({ embeds: [embed] });
        return;
    }

    try {
        await targetMember.roles.add(role);

        const embed = new EmbedBuilder()
            .setDescription(`<:tickYes:1469272837192814623> Added <@&${role.id}> to ${targetMember.user}`)
            .setTimestamp();

        await ctx.reply({ embeds: [embed] });
    } catch (error: unknown) {
        let errorMessage = 'Unknown error';
        if (error instanceof Error) errorMessage = error.message;

        const embed = new EmbedBuilder()
            .setDescription(`<:cross:1469273232929456314> Failed to add role: ${errorMessage}`);
        await ctx.reply({ embeds: [embed] });
    }
}
