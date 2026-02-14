import { Context } from '../../core/context';
import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { Command } from '../../core/command';
import { db } from '../../data/db';

const TICK = '<:tickYes:1469272837192814623>';
const CROSS = '<:cross:1469273232929456314>';

export const WvAllowedRole: Command = {
    name: 'wv_allowed_role',
    description: 'Manage which roles can use the !wv command',
    category: 'Admin',
    syntax: 'wv_allowed_role <add|show|remove> [role]',
    example: 'wv_allowed_role add @Members',
    permissions: [PermissionFlagsBits.Administrator],
    execute: async (ctx: Context, args: string[]) => {
        await ctx.defer();
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
                    `${TICK} **WV Access Management**\n\n` +
                    '`wv_allowed_role add <role>` - Add allowed role\n' +
                    '`wv_allowed_role show` - List allowed roles\n' +
                    '`wv_allowed_role remove <role>` - Remove allowed role\n\n' +
                    '*Users with these roles can use the !wv command*'
                );
            await ctx.reply({ embeds: [embed] });
            return;
        }

        try {
            if (subcommand === 'show' || subcommand === 'list') {
                const allowedRoles = await db.wVAllowedRole.findMany({
                    where: { guild_id: ctx.guildId }
                });

                if (allowedRoles.length === 0) {
                    const embed = new EmbedBuilder()
                        .setColor(0x2b2d31)
                    .setDescription(`**No roles configured**\nOnly moderators can use !wv`);
                    await ctx.reply({ embeds: [embed] });
                    return;
                }

                const roleList = allowedRoles
                    .map((ar: any) => `<@&${ar.role_id}>`)
                    .join(', ');

                const embed = new EmbedBuilder()
                    .setColor(0x2b2d31)
                .setDescription(
                        `${TICK} **WV Allowed Roles**\n\n${roleList}\n\n` +
                        `*${allowedRoles.length} role(s) can use !wv*`
                    );

                await ctx.reply({ embeds: [embed] });
                return;
            }

            if (subcommand === 'add') {
                if (!args[1]) {
                    const embed = new EmbedBuilder()
                        .setColor(0x2b2d31)
                    .setDescription(`${CROSS} Please provide a role.\n**Usage:** \`wv_allowed_role add @Role\``);
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
                        .setColor(0x2b2d31)
                    .setDescription(`${CROSS} Invalid role format.`);
                    await ctx.reply({ embeds: [embed] });
                    return;
                }

                const role = await guild.roles.fetch(roleId).catch(() => null);
                if (!role) {
                    const embed = new EmbedBuilder()
                        .setColor(0x2b2d31)
                    .setDescription(`${CROSS} Role not found.`);
                    await ctx.reply({ embeds: [embed] });
                    return;
                }

                const existing = await db.wVAllowedRole.findUnique({
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
                    .setDescription(`${CROSS} <@&${roleId}> already has access to !wv`);
                    await ctx.reply({ embeds: [embed] });
                    return;
                }

                await db.wVAllowedRole.create({
                    data: {
                        guild_id: ctx.guildId,
                        role_id: roleId,
                        added_by: ctx.authorId
                    }
                });

                const embed = new EmbedBuilder()
                    .setColor(0x2b2d31)
                .setDescription(
                        `${TICK} **WV Access Granted**\n\n` +
                        `<@&${roleId}> can now use the !wv command.`
                    );
                await ctx.reply({ embeds: [embed] });
                return;
            }

            if (subcommand === 'remove') {
                if (!args[1]) {
                    const embed = new EmbedBuilder()
                        .setColor(0x2b2d31)
                    .setDescription(`${CROSS} Please provide a role.\n**Usage:** \`wv_allowed_role remove @Role\``);
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
                        .setColor(0x2b2d31)
                    .setDescription(`${CROSS} Invalid role format.`);
                    await ctx.reply({ embeds: [embed] });
                    return;
                }

                const existing = await db.wVAllowedRole.findUnique({
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
                    .setDescription(`${CROSS} <@&${roleId}> doesn't have access to !wv`);
                    await ctx.reply({ embeds: [embed] });
                    return;
                }

                await db.wVAllowedRole.delete({
                    where: {
                        guild_id_role_id: {
                            guild_id: ctx.guildId,
                            role_id: roleId
                        }
                    }
                });

                const embed = new EmbedBuilder()
                    .setColor(0x2b2d31)
                .setDescription(`${TICK} Removed <@&${roleId}> from WV access.`);
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
