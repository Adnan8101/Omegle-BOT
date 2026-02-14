import { Context } from '../../core/context';
import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { Command } from '../../core/command';
import { hasPermission } from '../../util/permissions';
import { hasSrModRole } from '../../util/rolePermissions';

const TICK = '<:tickYes:1469272837192814623>';
const CROSS = '<:cross:1469273232929456314>';

export const CheckPerms: Command = {
    name: 'checkperms',
    description: 'Checks whether the bot has all required permissions',
    category: 'Moderator Utils',
    syntax: 'checkperms <user>',
    example: 'checkperms @User',
    permissions: [PermissionFlagsBits.Administrator],
    modAction: 'checkperms',
    execute: async (ctx: Context, args: string[]) => {
        await ctx.defer();
        if (!ctx.inner.member) return;
        const perms = ctx.inner.member.permissions;
        const hasPerm = hasPermission(perms, PermissionFlagsBits.Administrator);
        const hasSrMod = await hasSrModRole(ctx.guildId, ctx.inner.member);

        if (!hasPerm && !hasSrMod) return;

        const guild = ctx.inner.guild;
        if (!guild) return;

        const botMember = guild.members.me;
        if (!botMember) {
            await ctx.reply({ content: 'Cannot fetch bot member.', ephemeral: true });
            return;
        }

        const requiredPerms = [
            PermissionFlagsBits.ManageGuild,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.KickMembers,
            PermissionFlagsBits.BanMembers,
            PermissionFlagsBits.ModerateMembers,
            PermissionFlagsBits.ManageMessages,
            PermissionFlagsBits.ViewAuditLog,
            PermissionFlagsBits.MoveMembers,
            PermissionFlagsBits.MuteMembers, // Deprecated but widely used alias for voice mute? No, use MuteMembers
            // Wait, MuteMembers is for voice. ModerateMembers is for time out.
            // Let's list critical ones.
        ];

        // Format checks
        const checks = requiredPerms.map(perm => {
            // Retrieve name
            const permName = Object.keys(PermissionFlagsBits).find(key => PermissionFlagsBits[key as keyof typeof PermissionFlagsBits] === perm);
            const has = botMember.permissions.has(perm);
            return `${has ? TICK : CROSS} **${permName}**`;
        });

        const embed = new EmbedBuilder()
            .setColor(0x2b2d31)
        .setDescription(`**Permissions Check**\n\n${checks.join('\n')}`);

        await ctx.reply({ embeds: [embed] });
    }
};
