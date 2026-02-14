import { Context } from '../../core/context';
import { afkService } from '../../services/afk/AfkService';
import { EmbedBuilder, Colors, Message, ChatInputCommandInteraction, PermissionsBitField } from 'discord.js';
import { Command } from '../../core/command';

// Helper to handle temporary reply
async function replyWarning(ctx: Context, content: string) {
    const embed = new EmbedBuilder()
        .setColor(0x2b2d31).setDescription(content);

    // Delete user message if possible (Context usually wraps Message)
    if (ctx.inner instanceof Message && ctx.inner.deletable) {
        await ctx.inner.delete().catch(() => { });
    }

    const msg = await ctx.inner.reply({ embeds: [embed] });

    // Attempt deletion after 3s
    setTimeout(async () => {
        try {
            if (msg instanceof Message) {
                await msg.delete().catch(() => { });
            } else {
                // Interaction response (if reply returns InteractionResponse which lacks delete in djs v14 typings sometimes or differs)
                // But ctx.inner.reply returns Response. 
                // Whatever, catch errors.
                if ('delete' in msg) await (msg as any).delete().catch(() => { });
            }
        } catch (e) {
            // ignore
        }
    }, 3000);
}

export const Afk: Command = {
    name: 'afk',
    description: 'Set your status to AFK',
    category: 'AFK',
    syntax: 'afk <reason>',
    example: 'afk Lunch',
    permissions: [],
    execute: async (ctx: Context, args: string[]) => {
        if (!ctx.inner.guild || !ctx.inner.member) return;

        // 1. Check Permissions (Allowed Channels/Roles)
        const roles = ctx.inner.member.roles instanceof Array
            ? ctx.inner.member.roles
            : Array.from(ctx.inner.member.roles.cache.keys()); // Handle API vs CACHE member

        // If member.roles is array (APIInteractionGuildMember), it's list of strings. 
        // If GuildMember, it's GuildMemberRoleManager -> cache -> keys.
        let roleIds: string[] = [];
        if (Array.isArray(roles)) {
            roleIds = roles as string[];
        } else {
            // It's a Manager
            roleIds = Array.from((ctx.inner.member as any).roles.cache.keys());
        }

        const isAllowed = await afkService.isAllowed(ctx.guildId, ctx.channelId, roleIds);
        if (!isAllowed) return; // PROMPT: "if not allowed simplly ignore"

        const reason = args.join(' ') || 'AFK';

        // Security Check: Forbidden mentions
        // 1. Everyone/Here
        if (/@(everyone|here)/i.test(reason)) {
            await replyWarning(ctx, 'Not allowed. (Everyone/Here mention)');
            return;
        }

        // 2. Roles (<@&ID>)
        if (/<@&\d+>/.test(reason)) {
            await replyWarning(ctx, 'Not allowed. (Role mention)');
            return;
        }

        // 3. Users (<@ID> or <@!ID>)
        if (/<@!?\d+>/.test(reason)) {
            await replyWarning(ctx, 'Not allowed. (User mention)');
            return;
        }

        try {
            await afkService.setAfk(ctx.guildId, ctx.authorId, reason);

            // Get username safely
            let username = 'User';
            if (ctx.inner.member && 'user' in ctx.inner.member) {
                username = (ctx.inner.member as any).user.username;
            } else if (ctx.inner.member && 'displayName' in ctx.inner.member) {
                username = (ctx.inner.member as any).displayName;
            } else {
                username = ctx.authorId;
            }

            // Plain text response as requested ("no embeds")
            await ctx.reply({
                content: `**${username}** is now AFK: ${reason}`,
                allowedMentions: { parse: [] }
            });
        } catch (err: any) {
            await ctx.reply({ content: `Failed to set AFK: ${err.message}`, ephemeral: true });
        }
    }
};
