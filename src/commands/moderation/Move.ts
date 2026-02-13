import { Context } from '../../core/context';
import { Resolver } from '../../util/Resolver';
import { PermissionFlagsBits, GuildMember, ChannelType, BaseGuildVoiceChannel, Message, User } from 'discord.js';
import { Command } from '../../core/command';
import { ModLogger } from '../../services/logging/ModLogger';

const TICK = '<:tickYes:1469272837192814623>';
const SPEAKER_OFF = '🔇';

export const Move: Command = {
    name: 'move',
    description: 'Moves a user to a voice channel',
    category: 'Moderator Utils',
    syntax: 'move <user> [voice_channel_id_or_name]',
    example: 'move @User or move @User 1234567890 or move @User General',
    permissions: [PermissionFlagsBits.MoveMembers],
    modAction: 'move',
    execute: async (ctx: Context, args: string[]) => {
        console.log(`[Move] Command executed by ${ctx.inner.member?.user ? (ctx.inner.member.user as User).username : 'unknown'} with args: [${args.join(', ')}]`);

        if (!ctx.inner.guild || !ctx.inner.member) return;

        const guild = ctx.inner.guild;
        const requesterMember = ctx.inner.member as GuildMember;
        let targetMember: GuildMember | null = null;
        let targetChannel: BaseGuildVoiceChannel | null = null;

        // --- 1. Resolve Target User (mention, ID, username, or reply) ---
        if (args.length > 0) {
            targetMember = await Resolver.getMember(guild, args[0]);
            console.log(`[Move] Resolver result for "${args[0]}": ${targetMember ? targetMember.user.tag : 'null'}`);
        }

        // If no target from args, check if replying to a message
        if (!targetMember && ctx.inner instanceof Message && ctx.inner.reference?.messageId) {
            try {
                console.log(`[Move] Checking reply reference: ${ctx.inner.reference.messageId}`);
                const refMsg = await ctx.inner.channel!.messages.fetch(ctx.inner.reference.messageId);
                if (refMsg) {
                    targetMember = await guild.members.fetch(refMsg.author.id).catch(() => null);
                    console.log(`[Move] Reply reference resolved to: ${targetMember ? targetMember.user.tag : 'null'}`);
                }
            } catch (e) {
                console.error('[Move] Error fetching reply reference:', e);
            }
        }

        if (!targetMember) {
            console.log(`[Move] No target member found, reacting with speaker off`);
            if (ctx.inner instanceof Message) await ctx.inner.react(SPEAKER_OFF).catch(console.error);
            return;
        }

        // --- 2. Check target is in a voice channel ---
        if (!targetMember.voice.channel) {
            console.log(`[Move] Target ${targetMember.user.tag} is not in a voice channel`);
            if (ctx.inner instanceof Message) await ctx.inner.react(SPEAKER_OFF).catch(console.error);
            return;
        }

        // --- 3. Resolve Target Channel ---
        if (args.length > 1) {
            const channelInput = args.slice(1).join(' ');
            console.log(`[Move] Resolving target channel: "${channelInput}"`);

            // Try by ID first, then Resolver (name / fuzzy)
            let channel = guild.channels.cache.get(channelInput) ?? null;

            if (!channel) {
                const resolved = await Resolver.getChannel(guild, channelInput);
                if (resolved && resolved.type !== ChannelType.DM && resolved.type !== ChannelType.GroupDM) {
                    channel = resolved as any;
                }
            }

            if (!channel || (channel.type !== ChannelType.GuildVoice && channel.type !== ChannelType.GuildStageVoice)) {
                console.log(`[Move] Voice channel not found or wrong type: "${channelInput}"`);
                if (ctx.inner instanceof Message) await ctx.inner.react(SPEAKER_OFF).catch(console.error);
                return;
            }

            targetChannel = channel as BaseGuildVoiceChannel;
        } else {
            // Default: move to requester's current VC
            if (!requesterMember.voice.channel) {
                console.log(`[Move] Author not in a VC and no channel specified`);
                if (ctx.inner instanceof Message) await ctx.inner.react(SPEAKER_OFF).catch(console.error);
                return;
            }
            targetChannel = requesterMember.voice.channel;
        }

        console.log(`[Move] Target channel: ${targetChannel.name} (${targetChannel.id})`);

        // --- 4. Permission checks ---
        const botMember = guild.members.me;
        if (!botMember) return;

        // Bot permissions in target channel
        const botPerms = targetChannel.permissionsFor(botMember);
        if (!botPerms || !botPerms.has(PermissionFlagsBits.MoveMembers) || !botPerms.has(PermissionFlagsBits.Connect)) {
            console.log(`[Move] Bot lacks MoveMembers/Connect in #${targetChannel.name}`);
            if (ctx.inner instanceof Message) await ctx.inner.react(SPEAKER_OFF).catch(console.error);
            return;
        }

        // Author permissions in target channel
        const authorPerms = targetChannel.permissionsFor(requesterMember);
        if (!authorPerms || !authorPerms.has(PermissionFlagsBits.Connect)) {
            console.log(`[Move] Author lacks Connect permission in #${targetChannel.name}`);
            if (ctx.inner instanceof Message) await ctx.inner.react(SPEAKER_OFF).catch(console.error);
            return;
        }

        // --- 5. Move the user ---
        try {
            console.log(`[Move] Moving ${targetMember.user.tag} -> #${targetChannel.name}`);
            await targetMember.voice.setChannel(targetChannel.id);

            const replyMsg = `${TICK} **${targetMember.user.username}** have been moved to **${targetChannel.name}**`;
            console.log(`[Move] Success: ${replyMsg}`);
            await ctx.reply({ content: replyMsg });

            // Log to mod log channel
            await ModLogger.log(
                guild,
                requesterMember.user as User,
                targetMember.user,
                'Move',
                null,
                { channel: targetChannel.name }
            ).catch(e => console.error('[Move] ModLogger error:', e));
        } catch (err: any) {
            console.error(`[Move] Failed to move user:`, err);
            if (ctx.inner instanceof Message) await ctx.inner.react(SPEAKER_OFF).catch(console.error);
        }
    }
};
