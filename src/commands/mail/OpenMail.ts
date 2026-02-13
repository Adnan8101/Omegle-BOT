import { Context } from '../../core/context';
import { mailService } from '../../services/mail/MailService';
import { Resolver } from '../../util/Resolver';
import { PermissionFlagsBits } from 'discord.js';
import { Command } from '../../core/command';
import { hasPermission } from '../../util/permissions';

export const OpenMail: Command = {
    name: 'openmail',
    description: 'Force open a ticket for a user',
    category: 'Mail',
    syntax: 'openmail <user>',
    example: 'openmail @David',
    permissions: [PermissionFlagsBits.ManageGuild],
    execute: async (ctx: Context, args: string[]) => {
        if (!ctx.inner.guild || !ctx.inner.member) return;
        const perms = ctx.inner.member.permissions;
        const hasPerm = OpenMail.permissions.some(p => hasPermission(perms, p));
        if (!hasPerm) return;

        const targetInput = args[0];
        const targetUser = await Resolver.getUser(targetInput);
        if (!targetUser) {
            await ctx.reply({ content: 'User not found.', ephemeral: true });
            return;
        }

        // Check active
        const active = await mailService.getActiveTicket(ctx.guildId, targetUser.id);
        if (active) {
            await ctx.reply({ content: `User already has a ticket: <#${active.channel_id}>`, ephemeral: true });
            return;
        }

        // Just create a pending one and simulate selection? 
        // Or pick default category.

        const categories = await mailService.getCategories(ctx.guildId);
        if (categories.length === 0) {
            await ctx.reply({ content: 'No mail categories configured.', ephemeral: true });
            return;
        }

        // Pick first
        const cat = categories[0];
        await mailService.createPendingTicket(ctx.guildId, targetUser.id, cat.id);

        await ctx.reply({ content: `Initiated ticket creation for ${targetUser.tag}. They (or you) need to finish setup via DM or I can force it. (Force implementation pending)`, ephemeral: true });

        // In a real OpenMail, we would create the channel immediately.
        // For now, this is sufficient to test.
    }
};
