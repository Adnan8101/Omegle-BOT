import { Context } from '../../core/context';
import { EmbedBuilder, Colors, PermissionFlagsBits } from 'discord.js';
import { Command } from '../../core/command';
import { db } from '../../data/db';

export const CustomCommandManage: Command = {
    name: 'cc',
    description: 'Manage custom role assignment commands',
    category: 'Admin',
    syntax: 'cc <add|remove|show> [name] [role]',
    example: 'cc add vip @VIP',
    permissions: [PermissionFlagsBits.Administrator],
    execute: async (ctx: Context, args: string[]) => {
        const guild = ctx.inner.guild;
        const member = ctx.inner.member;

        if (!guild || !member) {
            const embed = new EmbedBuilder()
                .setColor(0x2b2d31)
            .setDescription('<:cross:1469273232929456314> This command can only be used in a server.');
            await ctx.reply({ embeds: [embed] });
            return;
        }

        // Check admin permissions
        if (typeof member.permissions === 'string' || !member.permissions.has(PermissionFlagsBits.Administrator)) {
            // Silently ignore if user doesn't have permission
            return;
        }

        const subcommand = args[0]?.toLowerCase();

        if (!subcommand || !['add', 'remove', 'show', 'list'].includes(subcommand)) {
            const embed = new EmbedBuilder()
                .setColor(0x2b2d31)
            .setTitle('Custom Command Management')
                .setDescription('<:cross:1469273232929456314> **Usage:**')
                .addFields(
                    { name: 'Add Command', value: '`!cc add <name> <role>`', inline: false },
                    { name: 'Remove Command', value: '`!cc remove <name>`', inline: false },
                    { name: 'Show Commands', value: '`!cc show`', inline: false }
                )
                .setFooter({ text: 'Example: !cc add vip @VIP' });
            await ctx.reply({ embeds: [embed] });
            return;
        }

        // Handle show/list
        if (subcommand === 'show' || subcommand === 'list') {
            const customCommands = await db.customCommand.findMany({
                where: { guild_id: guild.id }
            });

            if (customCommands.length === 0) {
                const embed = new EmbedBuilder()
                    .setColor(0x2b2d31)
                .setDescription('⚠️ No custom commands configured for this server.');
                await ctx.reply({ embeds: [embed] });
                return;
            }

            const commandList = customCommands.map((cmd: any) => {
                const role = guild.roles.cache.get(cmd.role_id);
                return `• **${cmd.name}** → ${role ? `<@&${role.id}>` : `Role ID: ${cmd.role_id}`}`;
            }).join('\n');

            const embed = new EmbedBuilder()
                .setColor(0x2b2d31)
            .setTitle('📋 Custom Commands')
                .setDescription(commandList)
                .setFooter({ text: `Total: ${customCommands.length} custom command${customCommands.length === 1 ? '' : 's'}` })
                .setTimestamp();

            await ctx.reply({ embeds: [embed] });
            return;
        }

        // Handle add
        if (subcommand === 'add') {
            if (args.length < 3) {
                const embed = new EmbedBuilder()
                    .setColor(0x2b2d31)
                .setDescription('<:cross:1469273232929456314> **Usage:** `!cc add <name> <role>`\n**Example:** `!cc add vip @VIP`');
                await ctx.reply({ embeds: [embed] });
                return;
            }

            const commandName = args[1].toLowerCase();
            const roleInput = args.slice(2).join(' ');

            // Validate command name (alphanumeric only, no spaces)
            if (!/^[a-z0-9_-]+$/.test(commandName)) {
                const embed = new EmbedBuilder()
                    .setColor(0x2b2d31)
                .setDescription('<:cross:1469273232929456314> Command name must be alphanumeric (letters, numbers, -, _) with no spaces.');
                await ctx.reply({ embeds: [embed] });
                return;
            }

            // Check if command name conflicts with existing commands
            const reservedNames = ['cc', 'help', 'ban', 'kick', 'mute', 'warn', 'role', 'inrole', 'sticky', 'afk', 'setup'];
            if (reservedNames.includes(commandName)) {
                const embed = new EmbedBuilder()
                    .setColor(0x2b2d31)
                .setDescription(`<:cross:1469273232929456314> The name **${commandName}** is reserved and cannot be used.`);
                await ctx.reply({ embeds: [embed] });
                return;
            }

            // Parse role
            let roleId: string | undefined;
            const roleMatch = roleInput.match(/^<@&(\d+)>$/);
            if (roleMatch) {
                roleId = roleMatch[1];
            } else if (/^\d{17,19}$/.test(roleInput)) {
                roleId = roleInput;
            } else {
                const role = guild.roles.cache.find(r => r.name.toLowerCase() === roleInput.toLowerCase());
                roleId = role?.id;
            }

            if (!roleId) {
                const embed = new EmbedBuilder()
                    .setColor(0x2b2d31)
                .setDescription(`<:cross:1469273232929456314> Could not find role: **${roleInput}**`);
                await ctx.reply({ embeds: [embed] });
                return;
            }

            const role = guild.roles.cache.get(roleId);
            if (!role) {
                const embed = new EmbedBuilder()
                    .setColor(0x2b2d31)
                .setDescription(`<:cross:1469273232929456314> Invalid role ID: **${roleId}**`);
                await ctx.reply({ embeds: [embed] });
                return;
            }

            try {
                // Check if command already exists
                const existing = await db.customCommand.findUnique({
                    where: {
                        guild_id_name: {
                            guild_id: guild.id,
                            name: commandName
                        }
                    }
                });

                if (existing) {
                    // Update existing
                    await db.customCommand.update({
                        where: {
                            guild_id_name: {
                                guild_id: guild.id,
                                name: commandName
                            }
                        },
                        data: {
                            role_id: roleId,
                            created_by: ctx.authorId,
                            updated_at: new Date()
                        }
                    });

                    const embed = new EmbedBuilder()
                        .setColor(0x2b2d31)
                    .setDescription(`<:tickYes:1469272837192814623> Updated custom command **${commandName}** → <@&${roleId}>`)
                        .setTimestamp();
                    await ctx.reply({ embeds: [embed] });
                } else {
                    // Create new
                    await db.customCommand.create({
                        data: {
                            guild_id: guild.id,
                            name: commandName,
                            role_id: roleId,
                            created_by: ctx.authorId
                        }
                    });

                    const embed = new EmbedBuilder()
                        .setColor(0x2b2d31)
                    .setTitle('<:tickYes:1469272837192814623> Custom Command Created')
                        .setDescription(`Created **${commandName}** → <@&${roleId}>`)
                        .addFields({
                            name: 'Usage',
                            value: `Users with **Manage Roles** permission can now use:\n\`!${commandName} @user\` or \`/${commandName} @user\``
                        })
                        .setTimestamp();
                    await ctx.reply({ embeds: [embed] });
                }
            } catch (error: any) {
                const embed = new EmbedBuilder()
                    .setColor(0x2b2d31)
                .setDescription(`<:cross:1469273232929456314> Failed to create custom command: ${error.message}`);
                await ctx.reply({ embeds: [embed] });
            }
            return;
        }

        // Handle remove
        if (subcommand === 'remove') {
            if (args.length < 2) {
                const embed = new EmbedBuilder()
                    .setColor(0x2b2d31)
                .setDescription('<:cross:1469273232929456314> **Usage:** `!cc remove <name>`\n**Example:** `!cc remove vip`');
                await ctx.reply({ embeds: [embed] });
                return;
            }

            const commandName = args[1].toLowerCase();

            try {
                const deleted = await db.customCommand.deleteMany({
                    where: {
                        guild_id: guild.id,
                        name: commandName
                    }
                });

                if (deleted.count === 0) {
                    const embed = new EmbedBuilder()
                        .setColor(0x2b2d31)
                    .setDescription(`⚠️ Custom command **${commandName}** not found.`);
                    await ctx.reply({ embeds: [embed] });
                    return;
                }

                const embed = new EmbedBuilder()
                    .setColor(0x2b2d31)
                .setDescription(`<:tickYes:1469272837192814623> Removed custom command **${commandName}**`)
                    .setTimestamp();
                await ctx.reply({ embeds: [embed] });
            } catch (error: any) {
                const embed = new EmbedBuilder()
                    .setColor(0x2b2d31)
                .setDescription(`<:cross:1469273232929456314> Failed to remove custom command: ${error.message}`);
                await ctx.reply({ embeds: [embed] });
            }
            return;
        }
    }
};
