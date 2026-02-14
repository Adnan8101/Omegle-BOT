import { Context } from '../../core/context';
import { Command } from '../../core/command';
import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { db } from '../../data/db';
import { Resolver } from '../../util/Resolver';
import { hasModRole } from '../../util/modRole';

const CROSS = '<:cross:1469273232929456314>';

export const Muted: Command = {
    name: 'muted',
    description: 'View list of users currently muted by a specific moderator',
    category: 'Moderation',
    syntax: 'muted [user]',
    example: 'muted\nmuted @Moderator',
    permissions: [PermissionFlagsBits.ManageMessages],
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

        // Check if user has mod role
        if (!(await hasModRole(ctx.guildId, ctx.inner.member))) {
            const embed = new EmbedBuilder()
                .setColor(0x2b2d31)
                .setDescription(`${CROSS} You need Moderator role or higher to use this command.`);
            await ctx.reply({ embeds: [embed] });
            return;
        }

        // Determine target moderator
        let targetUserId = ctx.authorId;
        let targetUser = member.user;

        if (args.length > 0) {
            const resolvedUser = await Resolver.getUser(args[0]);
            if (!resolvedUser) {
                const embed = new EmbedBuilder()
                    .setColor(0x2b2d31)
                    .setDescription(`${CROSS} User not found.`);
                await ctx.reply({ embeds: [embed] });
                return;
            }
            targetUserId = resolvedUser.id;
            targetUser = resolvedUser;
        }

        try {
            // Find all active mute cases by this moderator
            const activeMutes = await db.moderationCase.findMany({
                where: {
                    guild_id: ctx.guildId,
                    moderator_id: targetUserId,
                    action: 'mute',
                    active: true
                },
                orderBy: {
                    created_at: 'desc'
                }
            });

            if (!activeMutes || activeMutes.length === 0) {
                const embed = new EmbedBuilder()
                    .setColor(0x2b2d31)
                    .setDescription(`${CROSS} No active mutes found for ${targetUser.username}.`);
                await ctx.reply({ embeds: [embed] });
                return;
            }

            const embed = new EmbedBuilder()
                .setColor(0x2b2d31)
                .setTitle(`Active Mutes by ${targetUser.username}`)
                .setDescription(`Found ${activeMutes.length} active mute${activeMutes.length === 1 ? '' : 's'}`);

            let muteList = '';
            for (let i = 0; i < activeMutes.length && i < 15; i++) {
                const mute = activeMutes[i];
                const mutedUser = await ctx.inner.client.users.fetch(mute.target_id).catch(() => null);
                const userName = mutedUser ? mutedUser.username : `Unknown User (${mute.target_id})`;
                
                const mutedAt = mute.created_at.toLocaleDateString();
                const duration = mute.duration_seconds 
                    ? mute.duration_seconds < 60 ? `${mute.duration_seconds}s` :
                      mute.duration_seconds < 3600 ? `${Math.floor(mute.duration_seconds / 60)}m` :
                      `${(mute.duration_seconds / 3600).toFixed(1)}h`
                    : 'Permanent';
                const reason = mute.reason || 'No reason provided';
                const caseNum = `#${mute.case_number.toString().padStart(4, '0')}`;

                muteList += `${caseNum} **${userName}**\n`;
                muteList += `   Duration: ${duration} • Muted: ${mutedAt}\n`;
                muteList += `   Reason: ${reason.substring(0, 60)}${reason.length > 60 ? '...' : ''}\n\n`;
            }

            embed.addFields({
                name: 'Muted Users',
                value: muteList || 'None',
                inline: false
            });

            if (activeMutes.length > 15) {
                embed.setFooter({ text: `Showing 15 of ${activeMutes.length} active mutes` });
            }

            await ctx.reply({ embeds: [embed] });
        } catch (error: any) {
            console.error('Error fetching muted users:', error);
            const embed = new EmbedBuilder()
                .setColor(0x2b2d31)
                .setDescription(`${CROSS} Failed to fetch muted users: ${error.message}`);
            await ctx.reply({ embeds: [embed] });
        }
    }
};
