import { Context } from '../../core/context';
import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { Command } from '../../core/command';
import { db } from '../../data/db';

const TICK = '<:tickYes:1469272837192814623>';
const CROSS = '<:cross:1469273232929456314>';

export const SafetyAdmin: Command = {
    name: 'safetyadmin',
    description: 'Manage safety admins who bypass all moderation checks',
    category: 'Admin',
    syntax: 'safetyadmin <add|list|remove> [user]',
    example: 'safetyadmin add @Owner',
    permissions: [PermissionFlagsBits.Administrator],
    execute: async (ctx: Context, args: string[]) => {
        const guild = ctx.inner.guild;
        const member = ctx.inner.member;

        if (!guild || !member) return;

        if (typeof member.permissions === 'string' || !member.permissions.has(PermissionFlagsBits.Administrator)) {
            return;
        }

        const subcommand = args[0]?.toLowerCase();

        if (!subcommand || !['add', 'list', 'remove'].includes(subcommand)) {
            const embed = new EmbedBuilder()
                .setColor(0x2b2d31)
            .setDescription(
                    `${TICK} **Safety Admin Management**\n\n` +
                    '`safetyadmin add <user>` - Add safety admin\n' +
                    '`safetyadmin list` - List safety admins\n' +
                    '`safetyadmin remove <user>` - Remove safety admin\n\n' +
                    '*Safety admins bypass all moderation safety checks*'
                );
            await ctx.reply({ embeds: [embed] });
            return;
        }

        try {
            if (subcommand === 'list') {
                const safetyAdmins = await db.safetyAdmin.findMany({
                    where: { guild_id: ctx.guildId }
                });

                if (safetyAdmins.length === 0) {
                    const embed = new EmbedBuilder()
                        .setColor(0x2b2d31)
                    .setDescription(`${CROSS} No safety admins configured.`);
                    await ctx.reply({ embeds: [embed] });
                    return;
                }

                const adminList = safetyAdmins
                    .map((sa: any) => `<@${sa.user_id}>`)
                    .join(', ');

                const embed = new EmbedBuilder()
                    .setColor(0x2b2d31)
                .setDescription(
                        `${TICK} **Safety Admins**\n\n${adminList}\n\n` +
                        `*These users bypass all moderation safety checks*`
                    );

                await ctx.reply({ embeds: [embed] });
                return;
            }

            if (subcommand === 'add') {
                if (!args[1]) {
                    const embed = new EmbedBuilder()
                        .setColor(0x2b2d31)
                    .setDescription(`${CROSS} Please provide a user.\n**Usage:** \`safetyadmin add @User\``);
                    await ctx.reply({ embeds: [embed] });
                    return;
                }

                const userInput = args[1];
                let userId: string | null = null;

                const mentionMatch = userInput.match(/^<@!?(\d+)>$/);
                if (mentionMatch) {
                    userId = mentionMatch[1];
                } else if (/^\d+$/.test(userInput)) {
                    userId = userInput;
                }

                if (!userId) {
                    const embed = new EmbedBuilder()
                        .setColor(0x2b2d31)
                    .setDescription(`${CROSS} Invalid user format.`);
                    await ctx.reply({ embeds: [embed] });
                    return;
                }

                const user = await guild.members.fetch(userId).catch(() => null);
                if (!user) {
                    const embed = new EmbedBuilder()
                        .setColor(0x2b2d31)
                    .setDescription(`${CROSS} User not found.`);
                    await ctx.reply({ embeds: [embed] });
                    return;
                }

                const existing = await db.safetyAdmin.findUnique({
                    where: {
                        guild_id_user_id: {
                            guild_id: ctx.guildId,
                            user_id: userId
                        }
                    }
                });

                if (existing) {
                    const embed = new EmbedBuilder()
                        .setColor(0x2b2d31)
                    .setDescription(`${CROSS} <@${userId}> is already a safety admin.`);
                    await ctx.reply({ embeds: [embed] });
                    return;
                }

                await db.safetyAdmin.create({
                    data: {
                        guild_id: ctx.guildId,
                        user_id: userId,
                        added_by: ctx.authorId
                    }
                });

                const embed = new EmbedBuilder()
                    .setColor(0x2b2d31)
                .setDescription(
                        `${TICK} **Safety Admin Added**\n\n` +
                        `<@${userId}> now bypasses all moderation safety checks.`
                    );
                await ctx.reply({ embeds: [embed] });
                return;
            }

            if (subcommand === 'remove') {
                if (!args[1]) {
                    const embed = new EmbedBuilder()
                        .setColor(0x2b2d31)
                    .setDescription(`${CROSS} Please provide a user.\n**Usage:** \`safetyadmin remove @User\``);
                    await ctx.reply({ embeds: [embed] });
                    return;
                }

                const userInput = args[1];
                let userId: string | null = null;

                const mentionMatch = userInput.match(/^<@!?(\d+)>$/);
                if (mentionMatch) {
                    userId = mentionMatch[1];
                } else if (/^\d+$/.test(userInput)) {
                    userId = userInput;
                }

                if (!userId) {
                    const embed = new EmbedBuilder()
                        .setColor(0x2b2d31)
                    .setDescription(`${CROSS} Invalid user format.`);
                    await ctx.reply({ embeds: [embed] });
                    return;
                }

                const existing = await db.safetyAdmin.findUnique({
                    where: {
                        guild_id_user_id: {
                            guild_id: ctx.guildId,
                            user_id: userId
                        }
                    }
                });

                if (!existing) {
                    const embed = new EmbedBuilder()
                        .setColor(0x2b2d31)
                    .setDescription(`${CROSS} <@${userId}> is not a safety admin.`);
                    await ctx.reply({ embeds: [embed] });
                    return;
                }

                await db.safetyAdmin.delete({
                    where: {
                        guild_id_user_id: {
                            guild_id: ctx.guildId,
                            user_id: userId
                        }
                    }
                });

                const embed = new EmbedBuilder()
                    .setColor(0x2b2d31)
                .setDescription(`${TICK} Removed <@${userId}> from safety admins.`);
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
