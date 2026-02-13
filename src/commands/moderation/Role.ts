import { Context } from '../../core/context';
import { EmbedBuilder, PermissionFlagsBits, Role, GuildMember, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, ButtonInteraction, Message, User } from 'discord.js';
import { Command } from '../../core/command';
import { ModLogger } from '../../services/logging/ModLogger';
import { findBestRoleMatch, isExactRoleMatch } from '../../util/fuzzyMatch';

const TICK = '<:tickYes:1469272837192814623>';
const CROSS = '<:cross:1469273232929456314>';

export const RoleCommand: Command = {
    name: 'role',
    description: 'Manage user roles',
    category: 'Moderation',
    syntax: 'role <member> <role>',
    example: 'role @User Moderator',
    permissions: [PermissionFlagsBits.ManageRoles],
    modAction: 'role',
    execute: async (ctx: Context, args: string[]) => {
        await ctx.defer();
        const guild = ctx.inner.guild;
        const member = ctx.inner.member;

        if (!guild || !member) {
            const embed = new EmbedBuilder()
                .setDescription(`${CROSS} This command can only be used in a server.`);
            await ctx.reply({ embeds: [embed] });
            return;
        }

        // Check bot permissions
        if (!guild.members.me?.permissions.has(PermissionFlagsBits.ManageRoles)) {
            const embed = new EmbedBuilder()
                .setDescription(`${CROSS} I need the **Manage Roles** permission to do this.`);
            await ctx.reply({ embeds: [embed] });
            return;
        }

        if (args.length < 2) {
            const embed = new EmbedBuilder()
                .setDescription(`${CROSS} **Usage:** \`!role <member> <role>\`\n**Example:** \`!role @User Moderator\``);
            await ctx.reply({ embeds: [embed] });
            return;
        }

        // Parse member
        const memberInput = args[0];
        const roleInput = args.slice(1).join(' ');

        let targetMember: GuildMember | undefined;

        // Try to resolve member by mention, ID, or username
        const memberMatch = memberInput.match(/^<@!?(\d+)>$/);
        if (memberMatch) {
            targetMember = await guild.members.fetch(memberMatch[1]).catch(() => undefined);
        } else {
            targetMember = await guild.members.fetch(memberInput).catch(() => undefined);
        }

        if (!targetMember) {
            // Try by username
            const members = await guild.members.fetch();
            targetMember = members.find((m: GuildMember) =>
                m.user.username.toLowerCase() === memberInput.toLowerCase() ||
                m.user.tag.toLowerCase() === memberInput.toLowerCase()
            );
        }

        if (!targetMember) {
            const embed = new EmbedBuilder()
                .setDescription(`${CROSS} Could not find member: **${memberInput}**`);
            await ctx.reply({ embeds: [embed] });
            return;
        }

        // Parse role
        let targetRole: Role | undefined;
        const roles = await guild.roles.fetch();
        const roleCollection = roles.filter((r: Role) => r.id !== guild.id); // Exclude @everyone

        // Check for role mention
        const roleMatch = roleInput.match(/^<@&(\d+)>$/);
        if (roleMatch) {
            targetRole = roles.get(roleMatch[1]);
        } else if (/^\d{17,19}$/.test(roleInput)) {
            // Check if it's a role ID
            targetRole = roles.get(roleInput);
        } else {
            // Check for exact name match first
            targetRole = roleCollection.find((r: Role) => r.name.toLowerCase() === roleInput.toLowerCase());
        }

        // Helper to perform toggle
        const performToggle = async (ctx: Context, tMember: GuildMember, tRole: Role) => {
            if (tMember.roles.cache.has(tRole.id)) {
                return await removeRoleFromMember(ctx, tMember, tRole);
            } else {
                return await addRoleToMember(ctx, tMember, tRole);
            }
        };

        // If exact match found, proceed immediately
        if (targetRole && isExactRoleMatch(roleInput, targetRole)) {
            return await performToggle(ctx, targetMember, targetRole);
        }

        // If not exact match, try fuzzy matching
        if (!targetRole) {
            const fuzzyMatch = findBestRoleMatch(roleInput, Array.from(roleCollection.values()), 0.5);

            if (!fuzzyMatch) {
                const embed = new EmbedBuilder()
                    .setDescription(`${CROSS} Could not find role: **${roleInput}**`);
                await ctx.reply({ embeds: [embed] });
                return;
            }

            targetRole = fuzzyMatch.role;

            // Determine dynamic action for confirmation message
            const hasRole = targetMember.roles.cache.has(targetRole.id);
            const actionText = hasRole ? 'remove' : 'give';
            const preposition = hasRole ? 'from' : 'to';

            // If similarity is less than 100%, ask for confirmation
            if (fuzzyMatch.similarity < 0.95) {
                const embed = new EmbedBuilder()
                    .setDescription(
                        `⚠️ **Role Confirmation**\n\n` +
                        `Did you mean to ${actionText} <@&${targetRole.id}> ${preposition} ${targetMember.user}?\n\n` +
                        `**You typed:** \`${roleInput}\`\n` +
                        `**Best match:** <@&${targetRole.id}>\n\n` +
                        `*Click Agree to proceed or Cancel to abort.*`
                    );

                const row = new ActionRowBuilder<ButtonBuilder>()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('role_confirm_agree')
                            .setLabel('Agree')
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId('role_confirm_cancel')
                            .setLabel('Cancel')
                            .setStyle(ButtonStyle.Danger)
                    );

                const response = await ctx.reply({ embeds: [embed], components: [row] });

                // Wait for button interaction
                try {
                    const collector = response.createMessageComponentCollector({
                        componentType: ComponentType.Button,
                        time: 30000 // 30 seconds timeout
                    });

                    collector.on('collect', async (interaction: ButtonInteraction) => {
                        // Check if the interaction is from the command author
                        if (interaction.user.id !== ctx.authorId) {
                            await interaction.reply({
                                content: `${CROSS} Only the command author can use these buttons.`,
                                ephemeral: true
                            });
                            return;
                        }

                        if (interaction.customId === 'role_confirm_agree') {
                            await interaction.deferUpdate();
                            collector.stop('agreed');

                            // Update the message to show processing
                            const processingEmbed = new EmbedBuilder()
                                .setDescription('⏳ Processing role assignment...');
                            await interaction.editReply({ embeds: [processingEmbed], components: [] });

                            // Execute the role action
                            if (!targetRole) {
                                const errorEmbed = new EmbedBuilder()
                                    .setDescription(`${CROSS} Role not found.`);
                                await interaction.editReply({ embeds: [errorEmbed], components: [] });
                                return;
                            }

                            // Check existence again for button action
                            if (targetMember!.roles.cache.has(targetRole.id)) {
                                await removeRoleFromMemberWithMessage(interaction, targetMember!, targetRole);
                            } else {
                                await addRoleToMemberWithMessage(interaction, targetMember!, targetRole);
                            }

                        } else if (interaction.customId === 'role_confirm_cancel') {
                            await interaction.deferUpdate();
                            collector.stop('cancelled');

                            const cancelEmbed = new EmbedBuilder()
                                .setDescription(`${CROSS} Role assignment cancelled.`);
                            await interaction.editReply({ embeds: [cancelEmbed], components: [] });
                        }
                    });

                    collector.on('end', async (_collected: any, reason: string) => {
                        if (reason === 'time') {
                            const timeoutEmbed = new EmbedBuilder()
                                .setDescription('⏱️ Role confirmation timed out.');

                            try {
                                await response.edit({ embeds: [timeoutEmbed], components: [] });
                            } catch (error) {
                                // Message might be deleted
                            }
                        }
                    });
                } catch (error) {
                    console.error('Error handling role confirmation:', error);
                }

                return;
            }
        }

        await performToggle(ctx, targetMember, targetRole);
    }
};

// Helper functions for button interactions
async function addRoleToMemberWithMessage(interaction: ButtonInteraction, member: GuildMember, role: Role) {
    const guild = interaction.guild!;
    const authorMember = interaction.member as GuildMember;

    if (member.roles.cache.has(role.id)) {
        const embed = new EmbedBuilder()
            .setDescription(`⚠️ ${member.user} already has the <@&${role.id}> role.`);
        await interaction.editReply({ embeds: [embed] });
        return;
    }

    const authorHighestRole = authorMember.roles.highest;
    if (role.position >= authorHighestRole.position && guild.ownerId !== authorMember.id) {
        const embed = new EmbedBuilder()
            .setDescription(`${CROSS} You cannot give a role higher than or equal to your highest role.\n**Your highest role:** <@&${authorHighestRole.id}>`);
        await interaction.editReply({ embeds: [embed] });
        return;
    }

    const botHighestRole = guild.members.me!.roles.highest;
    if (role.position >= botHighestRole.position) {
        const embed = new EmbedBuilder()
            .setDescription(`${CROSS} I cannot give a role higher than or equal to my highest role.\n**My highest role:** <@&${botHighestRole.id}>`);
        await interaction.editReply({ embeds: [embed] });
        return;
    }

    try {
        await member.roles.add(role);
        const embed = new EmbedBuilder()
            .setDescription(`${TICK} **Added** <@&${role.id}> to ${member.user}`);
        await interaction.editReply({ embeds: [embed] });

        // Log action
        await ModLogger.log(guild, authorMember.user as User, member.user, 'Role', 'Role Added via Button', { role: role.toString() });
    } catch (error: any) {
        const embed = new EmbedBuilder()
            .setDescription(`${CROSS} Failed to add role: ${error.message}`);
        await interaction.editReply({ embeds: [embed] });
    }
}

async function removeRoleFromMemberWithMessage(interaction: ButtonInteraction, member: GuildMember, role: Role) {
    const guild = interaction.guild!;
    const authorMember = interaction.member as GuildMember;

    if (!member.roles.cache.has(role.id)) {
        const embed = new EmbedBuilder()
            .setDescription(`⚠️ ${member.user} doesn't have the <@&${role.id}> role.`);
        await interaction.editReply({ embeds: [embed] });
        return;
    }

    const authorHighestRole = authorMember.roles.highest;
    if (role.position >= authorHighestRole.position && guild.ownerId !== authorMember.id) {
        const embed = new EmbedBuilder()
            .setDescription(`${CROSS} You cannot remove a role higher than or equal to your highest role.\n**Your highest role:** <@&${authorHighestRole.id}>`);
        await interaction.editReply({ embeds: [embed] });
        return;
    }

    const botHighestRole = guild.members.me!.roles.highest;
    if (role.position >= botHighestRole.position) {
        const embed = new EmbedBuilder()
            .setDescription(`${CROSS} I cannot remove a role higher than or equal to my highest role.\n**My highest role:** <@&${botHighestRole.id}>`);
        await interaction.editReply({ embeds: [embed] });
        return;
    }

    try {
        await member.roles.remove(role);
        const embed = new EmbedBuilder()
            .setDescription(`${TICK} **Removed** <@&${role.id}> from ${member.user}`);
        await interaction.editReply({ embeds: [embed] });

        // Log action
        await ModLogger.log(guild, authorMember.user as User, member.user, 'Role', 'Role Removed via Button', { role: role.toString() });
    } catch (error: any) {
        const embed = new EmbedBuilder()
            .setDescription(`${CROSS} Failed to remove role: ${error.message}`);
        await interaction.editReply({ embeds: [embed] });
    }
}

async function addRoleToMember(ctx: Context, member: GuildMember, role: Role) {
    const guild = ctx.inner.guild!;
    const authorMember = ctx.inner.member as GuildMember;

    // Check if member already has the role
    if (member.roles.cache.has(role.id)) {
        const embed = new EmbedBuilder()
            .setDescription(`⚠️ ${member.user} already has the <@&${role.id}> role.`);
        await ctx.reply({ embeds: [embed] });
        return;
    }

    // Check role hierarchy - command author cannot give roles higher than their own
    const authorHighestRole = authorMember.roles.highest;

    if (role.position >= authorHighestRole.position && guild.ownerId !== authorMember.id) {
        const embed = new EmbedBuilder()
            .setDescription(`${CROSS} You cannot give a role higher than or equal to your highest role.\n**Your highest role:** <@&${authorHighestRole.id}>`);
        await ctx.reply({ embeds: [embed] });
        return;
    }

    // Check bot role hierarchy
    const botHighestRole = guild.members.me!.roles.highest;


    // Helper functions for button interactions
    async function addRoleToMemberWithMessage(interaction: any, member: GuildMember, role: Role) {
        const guild = interaction.guild!;
        const authorMember = interaction.member as GuildMember;

        if (member.roles.cache.has(role.id)) {
            const embed = new EmbedBuilder()
                .setDescription(`⚠️ ${member.user} already has the <@&${role.id}> role.`);
            await interaction.editReply({ embeds: [embed] });
            return;
        }

        const authorHighestRole = authorMember.roles.highest;
        if (role.position >= authorHighestRole.position && guild.ownerId !== authorMember.id) {
            const embed = new EmbedBuilder()
                .setDescription(`${CROSS} You cannot give a role higher than or equal to your highest role.\n**Your highest role:** <@&${authorHighestRole.id}>`);
            await interaction.editReply({ embeds: [embed] });
            return;
        }

        const botHighestRole = guild.members.me!.roles.highest;
        if (role.position >= botHighestRole.position) {
            const embed = new EmbedBuilder()
                .setDescription(`${CROSS} I cannot give a role higher than or equal to my highest role.\n**My highest role:** <@&${botHighestRole.id}>`);
            await interaction.editReply({ embeds: [embed] });
            return;
        }

        try {
            await member.roles.add(role);
            const embed = new EmbedBuilder()
                .setDescription(`${TICK} **Added** <@&${role.id}> to ${member.user}`);
            await interaction.editReply({ embeds: [embed] });
        } catch (error: any) {
            const embed = new EmbedBuilder()
                .setDescription(`${CROSS} Failed to add role: ${error.message}`);
            await interaction.editReply({ embeds: [embed] });
        }
    }

    async function removeRoleFromMemberWithMessage(interaction: any, member: GuildMember, role: Role) {
        const guild = interaction.guild!;
        const authorMember = interaction.member as GuildMember;

        if (!member.roles.cache.has(role.id)) {
            const embed = new EmbedBuilder()
                .setDescription(`⚠️ ${member.user} doesn't have the <@&${role.id}> role.`);
            await interaction.editReply({ embeds: [embed] });
            return;
        }

        const authorHighestRole = authorMember.roles.highest;
        if (role.position >= authorHighestRole.position && guild.ownerId !== authorMember.id) {
            const embed = new EmbedBuilder()
                .setDescription(`${CROSS} You cannot remove a role higher than or equal to your highest role.\n**Your highest role:** <@&${authorHighestRole.id}>`);
            await interaction.editReply({ embeds: [embed] });
            return;
        }

        const botHighestRole = guild.members.me!.roles.highest;
        if (role.position >= botHighestRole.position) {
            const embed = new EmbedBuilder()
                .setDescription(`${CROSS} I cannot remove a role higher than or equal to my highest role.\n**My highest role:** <@&${botHighestRole.id}>`);
            await interaction.editReply({ embeds: [embed] });
            return;
        }

        try {
            await member.roles.remove(role);
            const embed = new EmbedBuilder()
                .setDescription(`${TICK} **Removed** <@&${role.id}> from ${member.user}`);
            await interaction.editReply({ embeds: [embed] });
        } catch (error: any) {
            const embed = new EmbedBuilder()
                .setDescription(`${CROSS} Failed to remove role: ${error.message}`);
            await interaction.editReply({ embeds: [embed] });
        }
    } if (role.position >= botHighestRole.position) {
        const embed = new EmbedBuilder()
            .setDescription(`${CROSS} I cannot give a role higher than or equal to my highest role.\n**My highest role:** <@&${botHighestRole.id}>`);
        await ctx.reply({ embeds: [embed] });
        return;
    }

    try {
        await member.roles.add(role);

        const embed = new EmbedBuilder()
            .setDescription(`${TICK} **Added** <@&${role.id}> to ${member.user}`);

        await ctx.reply({ embeds: [embed] });

        // Log action
        await ModLogger.log(guild, authorMember.user as User, member.user, 'Role', 'Role Added', { role: role.toString() });
    } catch (error: any) {
        const embed = new EmbedBuilder()
            .setDescription(`${CROSS} Failed to add role: ${error.message}`);
        await ctx.reply({ embeds: [embed] });
    }
}

async function removeRoleFromMember(ctx: Context, member: GuildMember, role: Role) {
    const guild = ctx.inner.guild!;
    const authorMember = ctx.inner.member as GuildMember;

    // Check if member has the role
    if (!member.roles.cache.has(role.id)) {
        const embed = new EmbedBuilder()
            .setDescription(`⚠️ ${member.user} doesn't have the <@&${role.id}> role.`);
        await ctx.reply({ embeds: [embed] });
        return;
    }

    // Check role hierarchy - command author cannot remove roles higher than their own
    const authorHighestRole = authorMember.roles.highest;

    if (role.position >= authorHighestRole.position && guild.ownerId !== authorMember.id) {
        const embed = new EmbedBuilder()
            .setDescription(`${CROSS} You cannot remove a role higher than or equal to your highest role.\n**Your highest role:** <@&${authorHighestRole.id}>`);
        await ctx.reply({ embeds: [embed] });
        return;
    }

    // Check bot role hierarchy
    const botHighestRole = guild.members.me!.roles.highest;
    if (role.position >= botHighestRole.position) {
        const embed = new EmbedBuilder()
            .setDescription(`${CROSS} I cannot remove a role higher than or equal to my highest role.\n**My highest role:** <@&${botHighestRole.id}>`);
        await ctx.reply({ embeds: [embed] });
        return;
    }

    try {
        await member.roles.remove(role);

        const embed = new EmbedBuilder()
            .setDescription(`${TICK} **Removed** <@&${role.id}> from ${member.user}`);

        await ctx.reply({ embeds: [embed] });

        // Log action
        await ModLogger.log(guild, authorMember.user as User, member.user, 'Role', 'Role Removed', { role: role.toString() });
    } catch (error: any) {
        const embed = new EmbedBuilder()
            .setDescription(`${CROSS} Failed to remove role: ${error.message}`);
        await ctx.reply({ embeds: [embed] });
    }
}
