import { Context } from '../../core/context';
import { Command } from '../../core/command';
import { PermissionFlagsBits, Message } from 'discord.js';
import { Resolver } from '../../util/Resolver';
import { antiAbuseService } from '../../services/moderation/AntiAbuseService';

export const ModCooldown: Command = {
    name: 'cooldown',
    description: 'Grant 30-minute immunity from anti-abuse system to a moderator',
    category: 'Admin',
    syntax: 'cooldown <@user>',
    example: 'cooldown @Moderator',
    permissions: [PermissionFlagsBits.Administrator],
    execute: async (ctx: Context, args: string[]) => {
        const guild = ctx.inner.guild;
        if (!guild) return;

        // Get message for permission checking
        const message = ctx.inner as Message;
        if (!message.member) return;

        const targetInput = args[0];
        if (!targetInput) {
            await ctx.reply({ content: '❌ Please specify a user to grant cooldown immunity.' });
            return;
        }

        // Resolve target user
        const targetUser = await Resolver.getUser(targetInput);
        if (!targetUser) {
            await ctx.reply({ content: '❌ User not found.' });
            return;
        }

        // Fetch members
        const callerMember = message.member;
        const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

        if (!targetMember) {
            await ctx.reply({ content: '❌ Target user is not in this server.' });
            return;
        }

        // Check permissions
        const hasAdmin = callerMember.permissions.has(PermissionFlagsBits.Administrator);
        const hasHigherRole = callerMember.roles.highest.position > targetMember.roles.highest.position;

        if (!hasAdmin && !hasHigherRole) {
            await ctx.reply({ content: '❌ You need Administrator permission or a higher role position to grant cooldown immunity.' });
            return;
        }

        try {
            // Grant immunity
            await antiAbuseService.grantCooldownOverride(
                ctx.guildId,
                targetUser.id,
                ctx.authorId
            );

            // Send DM to target user
            try {
                await targetUser.send(
                    `✅ You have been granted **30 minutes of immunity** from the anti-abuse system in **${guild.name}**.\n\n` +
                    `Granted by: <@${ctx.authorId}>\n\n` +
                    `During this time, rate limits will not apply to your moderation actions.`
                );
            } catch (dmError) {
                console.log(`Could not DM user ${targetUser.username} about cooldown grant`);
            }

            await ctx.reply({
                content: `✅ Granted **30-minute immunity** to <@${targetUser.id}>.\n\n` +
                    `• Any existing blocks have been cleared\n` +
                    `• Rate limits will not apply for 30 minutes\n` +
                    `• Immunity will automatically expire after 30 minutes`
            });

        } catch (error: any) {
            console.error('Error granting cooldown:', error);
            await ctx.reply({ content: `❌ Failed to grant cooldown: ${error.message}` });
        }
    }
};
