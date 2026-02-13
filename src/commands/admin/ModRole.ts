import { Context } from '../../core/context';
import { EmbedBuilder, Colors, PermissionFlagsBits } from 'discord.js';
import { Command } from '../../core/command';
import { db } from '../../data/db';

const TICK = '<:tickYes:1469272837192814623>';
const CROSS = '<:cross:1469273232929456314>';

export const ModRole: Command = {
    name: 'modrole',
    description: 'Manage moderator roles that grant access to moderation commands',
    category: 'Admin',
    syntax: 'modrole <add|show|remove> [role]',
    example: 'modrole add @Moderator',
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
                    `${TICK} **Moderator Role Management**\n\n` +
                    '`modrole add <role>` - Add mod role\n' +
                    '`modrole show` - List mod roles\n' +
                    '`modrole remove <role>` - Remove mod role\n\n' +
                    '*Mods can: ban, kick, mute, warn*'
                );
            await ctx.reply({ embeds: [embed] });
            return;
        }

        try {
            if (subcommand === 'show' || subcommand === 'list') {
                const modRoles = await db.modRole.findMany({
                    where: { guild_id: ctx.guildId }
                });

                if (modRoles.length === 0) {
                    const embed = new EmbedBuilder()
                        .setDescription(`${CROSS} No moderator roles configured.`);
                    await ctx.reply({ embeds: [embed] });
                    return;
                }

                const roleList = modRoles
                    .map((mr: any) => `<@&${mr.role_id}>`)
                    .join(', ');

                const embed = new EmbedBuilder()
                    .setDescription(
                        `${TICK} **Moderator Roles**\n\n${roleList}\n\n` +
                        `*Can use: ban, kick, mute, warn*`
                    );

                await ctx.reply({ embeds: [embed] });
                return;
            }

            if (subcommand === 'add') {
                if (!args[1]) {
                    const embed = new EmbedBuilder()
                        .setDescription(`${CROSS} Please provide a role.\n**Usage:** \`modrole add @Role\``);
                    await ctx.reply({ embeds: [embed] });
                    return;
                }

                const roleInput = args[1];
                let roleId: string | null = null;

                // Extract role ID from mention or snowflake
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

                // Check if role exists
                const role = await guild.roles.fetch(roleId).catch(() => null);
                if (!role) {
                    const embed = new EmbedBuilder()
                        .setDescription(`${CROSS} Role not found.`);
                    await ctx.reply({ embeds: [embed] });
                    return;
                }

                // Check if already exists
                const existing = await db.modRole.findUnique({
                    where: {
                        guild_id_role_id: {
                            guild_id: ctx.guildId,
                            role_id: roleId
                        }
                    }
                });

                if (existing) {
                    const embed = new EmbedBuilder()
                        .setDescription(`${CROSS} <@&${roleId}> is already a moderator role.`);
                    await ctx.reply({ embeds: [embed] });
                    return;
                }

                // Add the role
                await db.modRole.create({
                    data: {
                        guild_id: ctx.guildId,
                        role_id: roleId,
                        added_by: ctx.authorId
                    }
                });

                const embed = new EmbedBuilder()
                    .setDescription(
                        `${TICK} **Moderator Role Added**\n\n` +
                        `<@&${roleId}> can now use all moderation commands.`
                    );
                await ctx.reply({ embeds: [embed] });
                return;
            }

            if (subcommand === 'remove') {
                if (!args[1]) {
                    const embed = new EmbedBuilder()
                        .setDescription(`${CROSS} Please provide a role.\n**Usage:** \`modrole remove @Role\``);
                    await ctx.reply({ embeds: [embed] });
                    return;
                }

                const roleInput = args[1];
                let roleId: string | null = null;

                // Extract role ID from mention or snowflake
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

                // Check if exists
                const existing = await db.modRole.findUnique({
                    where: {
                        guild_id_role_id: {
                            guild_id: ctx.guildId,
                            role_id: roleId
                        }
                    }
                });

                if (!existing) {
                    const embed = new EmbedBuilder()
                        .setDescription(`${CROSS} <@&${roleId}> is not a moderator role.`);
                    await ctx.reply({ embeds: [embed] });
                    return;
                }

                // Remove the role
                await db.modRole.delete({
                    where: {
                        guild_id_role_id: {
                            guild_id: ctx.guildId,
                            role_id: roleId
                        }
                    }
                });

                const embed = new EmbedBuilder()
                    .setDescription(`${TICK} Removed <@&${roleId}> from moderator roles.`);
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
