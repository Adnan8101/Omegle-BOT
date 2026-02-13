import { Context } from '../../core/context';
import { EmbedBuilder, Colors, PermissionFlagsBits } from 'discord.js';
import { Command } from '../../core/command';
import { db } from '../../data/db';

const TICK = '<:tickYes:1469272837192814623>';
const CROSS = '<:cross:1469273232929456314>';

export const StaffRole: Command = {
    name: 'staffrole',
    description: 'Manage staff roles that grant access to kick and mute commands',
    category: 'Admin',
    syntax: 'staffrole <add|show|remove> [role]',
    example: 'staffrole add @Staff',
    permissions: [PermissionFlagsBits.Administrator],
    execute: async (ctx: Context, args: string[]) => {
        const guild = ctx.inner.guild;
        const member = ctx.inner.member;

        if (!guild || !member) {
            const embed = new EmbedBuilder()
                .setDescription(`${CROSS} This command can only be used in a server.`);
            await ctx.reply({ embeds: [embed] });
            return;
        }

        // Check admin permissions
        if (typeof member.permissions === 'string' || !member.permissions.has(PermissionFlagsBits.Administrator)) {
            return;
        }

        const subcommand = args[0]?.toLowerCase();

        if (!subcommand || !['add', 'show', 'list', 'remove'].includes(subcommand)) {
            const embed = new EmbedBuilder()
                .setDescription(
                    `${TICK} **Staff Role Management**\n\n` +
                    '`staffrole add <role>` - Add staff role\n' +
                    '`staffrole show` - List staff roles\n' +
                    '`staffrole remove <role>` - Remove staff role\n\n' +
                    '*Staff can: kick, mute*'
                );
            await ctx.reply({ embeds: [embed] });
            return;
        }

        try {
            if (subcommand === 'show' || subcommand === 'list') {
                const staffRoles = await db.staffRole.findMany({
                    where: { guild_id: ctx.guildId }
                });

                if (staffRoles.length === 0) {
                    const embed = new EmbedBuilder()
                        .setDescription(`${CROSS} No staff roles configured.`);
                    await ctx.reply({ embeds: [embed] });
                    return;
                }

                const roleList = staffRoles
                    .map((sr: any) => `<@&${sr.role_id}>`)
                    .join(', ');

                const embed = new EmbedBuilder()
                    .setDescription(
                        `${TICK} **Staff Roles**\n\n${roleList}\n\n` +
                        `*Can use: kick, mute*`
                    );

                await ctx.reply({ embeds: [embed] });
                return;
            }

            if (subcommand === 'add') {
                if (!args[1]) {
                    const embed = new EmbedBuilder()
                        .setDescription(`${CROSS} Please provide a role.\n**Usage:** \`staffrole add @Role\``);
                    await ctx.reply({ embeds: [embed] });
                    return;
                }

                const roleInput = args[1];
                let roleId: string | null = null;

                const mentionMatch = roleInput.match(/^<@&(\d+)>$/);
                if (mentionMatch) {
                    roleId = mentionMatch[1];
                } else if (/^\d+$/.test(roleInput)) {
                    roleId = roleInput;
                }

                if (!roleId) {
                    const embed = new EmbedBuilder()
                        .setDescription(`${CROSS} Invalid role format.`);
                    await ctx.reply({ embeds: [embed] });
                    return;
                }

                const role = await guild.roles.fetch(roleId).catch(() => null);
                if (!role) {
                    const embed = new EmbedBuilder()
                        .setDescription(`${CROSS} Role not found.`);
                    await ctx.reply({ embeds: [embed] });
                    return;
                }

                const existing = await db.staffRole.findUnique({
                    where: {
                        guild_id_role_id: {
                            guild_id: ctx.guildId,
                            role_id: roleId
                        }
                    }
                });

                if (existing) {
                    const embed = new EmbedBuilder()
                        .setDescription(`${CROSS} <@&${roleId}> is already a staff role.`);
                    await ctx.reply({ embeds: [embed] });
                    return;
                }

                await db.staffRole.create({
                    data: {
                        guild_id: ctx.guildId,
                        role_id: roleId,
                        added_by: ctx.authorId
                    }
                });

                const embed = new EmbedBuilder()
                    .setDescription(
                        `${TICK} **Staff Role Added**\n\n` +
                        `<@&${roleId}> can now use kick & mute commands.`
                    );
                await ctx.reply({ embeds: [embed] });
                return;
            }

            if (subcommand === 'remove') {
                if (!args[1]) {
                    const embed = new EmbedBuilder()
                        .setDescription(`${CROSS} Please provide a role.\n**Usage:** \`staffrole remove @Role\``);
                    await ctx.reply({ embeds: [embed] });
                    return;
                }

                const roleInput = args[1];
                let roleId: string | null = null;

                const mentionMatch = roleInput.match(/^<@&(\d+)>$/);
                if (mentionMatch) {
                    roleId = mentionMatch[1];
                } else if (/^\d+$/.test(roleInput)) {
                    roleId = roleInput;
                }

                if (!roleId) {
                    const embed = new EmbedBuilder()
                        .setDescription(`${CROSS} Invalid role format.`);
                    await ctx.reply({ embeds: [embed] });
                    return;
                }

                const existing = await db.staffRole.findUnique({
                    where: {
                        guild_id_role_id: {
                            guild_id: ctx.guildId,
                            role_id: roleId
                        }
                    }
                });

                if (!existing) {
                    const embed = new EmbedBuilder()
                        .setDescription(`${CROSS} <@&${roleId}> is not a staff role.`);
                    await ctx.reply({ embeds: [embed] });
                    return;
                }

                await db.staffRole.delete({
                    where: {
                        guild_id_role_id: {
                            guild_id: ctx.guildId,
                            role_id: roleId
                        }
                    }
                });

                const embed = new EmbedBuilder()
                    .setDescription(`${TICK} Removed <@&${roleId}> from staff roles.`);
                await ctx.reply({ embeds: [embed] });
                return;
            }

        } catch (error: any) {
            const embed = new EmbedBuilder()
                .setDescription(`${CROSS} Failed: ${error.message}`);
            await ctx.reply({ embeds: [embed] });
        }
    }
};
