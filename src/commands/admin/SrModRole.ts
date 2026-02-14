import { Context } from '../../core/context';
import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { Command } from '../../core/command';
import { db } from '../../data/db';

const TICK = '<:tickYes:1469272837192814623>';
const CROSS = '<:cross:1469273232929456314>';

export const SrModRole: Command = {
    name: 'srmodrole',
    description: 'Manage senior moderator roles',
    category: 'Admin',
    syntax: 'srmodrole <add|show|remove> [role]',
    example: 'srmodrole add @SrMod',
    permissions: [PermissionFlagsBits.Administrator],
    execute: async (ctx: Context, args: string[]) => {
        const guild = ctx.inner.guild;
        const member = ctx.inner.member;

        if (!guild || !member) {
            const embed = new EmbedBuilder()
                .setColor(0x2b2d31)
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
                .setColor(0x2b2d31)
            .setDescription(
                    `${TICK} **Senior Moderator Role Management**\n\n` +
                    '`srmodrole add <role>` - Add senior mod role\n' +
                    '`srmodrole show` - List senior mod roles\n' +
                    '`srmodrole remove <role>` - Remove senior mod role\n\n' +
                    '*Sr Mods have full access to all standard + exclusive moderation commands.*\n' +
                    '*Exclusive: caseinfo, delcase, banword, checkperms, dm, modleaderboard, modstats, role, inrole, suggestion*'
                );
            await ctx.reply({ embeds: [embed] });
            return;
        }

        try {
            if (subcommand === 'show' || subcommand === 'list') {
                const srModRoles = await db.srModRole.findMany({
                    where: { guild_id: ctx.guildId }
                });

                if (srModRoles.length === 0) {
                    const embed = new EmbedBuilder()
                        .setColor(0x2b2d31)
                    .setDescription(`${CROSS} No senior moderator roles configured.`);
                    await ctx.reply({ embeds: [embed] });
                    return;
                }

                const roleList = srModRoles
                    .map((mr: any) => `<@&${mr.role_id}>`)
                    .join(', ');

                const embed = new EmbedBuilder()
                    .setColor(0x2b2d31)
                .setDescription(
                        `${TICK} **Senior Moderator Roles**\n\n${roleList}\n\n` +
                        `*Full access to all moderation commands including exclusive commands:*\n` +
                        `*Standard: ban, unban, kick, warn, mute, unmute, purge, lock, unlock, hide, unhide, move, ad, reason, modlogs, whois, av*\n` +
                        `*Exclusive: caseinfo, delcase, banword, checkperms, dm, modleaderboard, modstats, role, inrole, suggestion*`
                    );

                await ctx.reply({ embeds: [embed] });
                return;
            }

            if (subcommand === 'add') {
                if (!args[1]) {
                    const embed = new EmbedBuilder()
                        .setColor(0x2b2d31)
                    .setDescription(`${CROSS} Please provide a role.\n**Usage:** \`srmodrole add @Role\``);
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
                        .setColor(0x2b2d31)
                    .setDescription(`${CROSS} Invalid role format.`);
                    await ctx.reply({ embeds: [embed] });
                    return;
                }

                // Check if role exists
                const role = await guild.roles.fetch(roleId).catch(() => null);
                if (!role) {
                    const embed = new EmbedBuilder()
                        .setColor(0x2b2d31)
                    .setDescription(`${CROSS} Role not found.`);
                    await ctx.reply({ embeds: [embed] });
                    return;
                }

                // Check if already exists
                const existing = await db.srModRole.findUnique({
                    where: {
                        guild_id_role_id: {
                            guild_id: ctx.guildId,
                            role_id: roleId
                        }
                    }
                });

                if (existing) {
                    const embed = new EmbedBuilder()
                        .setColor(0x2b2d31)
                    .setDescription(`${CROSS} <@&${roleId}> is already a senior moderator role.`);
                    await ctx.reply({ embeds: [embed] });
                    return;
                }

                // Add the role
                await db.srModRole.create({
                    data: {
                        guild_id: ctx.guildId,
                        role_id: roleId,
                        added_by: ctx.authorId
                    }
                });

                const embed = new EmbedBuilder()
                    .setColor(0x2b2d31)
                .setDescription(
                        `${TICK} **Senior Moderator Role Added**\n\n` +
                        `<@&${roleId}> can now use **all** moderation commands.`
                    );
                await ctx.reply({ embeds: [embed] });
                return;
            }

            if (subcommand === 'remove') {
                if (!args[1]) {
                    const embed = new EmbedBuilder()
                        .setColor(0x2b2d31)
                    .setDescription(`${CROSS} Please provide a role.\n**Usage:** \`srmodrole remove @Role\``);
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
                        .setColor(0x2b2d31)
                    .setDescription(`${CROSS} Invalid role format.`);
                    await ctx.reply({ embeds: [embed] });
                    return;
                }

                // Check if exists
                const existing = await db.srModRole.findUnique({
                    where: {
                        guild_id_role_id: {
                            guild_id: ctx.guildId,
                            role_id: roleId
                        }
                    }
                });

                if (!existing) {
                    const embed = new EmbedBuilder()
                        .setColor(0x2b2d31)
                    .setDescription(`${CROSS} <@&${roleId}> is not a senior moderator role.`);
                    await ctx.reply({ embeds: [embed] });
                    return;
                }

                // Remove the role
                await db.srModRole.delete({
                    where: {
                        guild_id_role_id: {
                            guild_id: ctx.guildId,
                            role_id: roleId
                        }
                    }
                });

                const embed = new EmbedBuilder()
                    .setColor(0x2b2d31)
                .setDescription(`${TICK} Removed <@&${roleId}> from senior moderator roles.`);
                await ctx.reply({ embeds: [embed] });
                return;
            }

        } catch (error: any) {
            const embed = new EmbedBuilder()
                .setColor(0x2b2d31)
            .setDescription(`${CROSS} Failed: ${error.message}`);
            await ctx.reply({ embeds: [embed] });
        }
    }
};
