import { Context } from '../../core/context';
import { Command } from '../../core/command';
import { EmbedBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { hasPermission } from '../../util/permissions';
import { voiceChannelRoleService } from '../../services/voice/VoiceChannelRoleService';
import { EMBED_COLOR } from '../../util/embedColors';

const TICK = '<:tickYes:1469272837192814623>';
const CROSS = '<:cross:1469273232929456314>';

export const CustomVCRole: Command = {
    name: 'custom_vc_role',
    description: 'Manage voice channel role assignments',
    category: 'Admin',
    syntax: 'custom_vc_role <add|show|remove> [channel] [role]',
    example: 'custom_vc_role add #music @DJ',
    permissions: [PermissionFlagsBits.Administrator],
    execute: async (ctx: Context, args: string[]) => {
        await ctx.defer();

        if (!ctx.inner.member) return;
        const perms = ctx.inner.member.permissions;
        const hasAdminPerm = hasPermission(perms, PermissionFlagsBits.Administrator);

        if (!hasAdminPerm) {
            await ctx.reply({ content: `${CROSS} You need Administrator permission to use this command.`, ephemeral: true });
            return;
        }

        const subcommand = args[0]?.toLowerCase();

        // SHOW MAPPINGS
        if (subcommand === 'show' || !subcommand) {
            try {
                const mappings = await voiceChannelRoleService.getMappings(ctx.guildId);

                if (mappings.length === 0) {
                    const embed = new EmbedBuilder()
                        .setColor(EMBED_COLOR)
                        .setTitle('Voice Channel Roles')
                        .setDescription('No voice channel role mappings configured.');

                    await ctx.reply({ embeds: [embed] });
                    return;
                }

                const list = mappings.map((m, i) => 
                    `**${i + 1}.** <#${m.channel_id}> → <@&${m.role_id}>`
                ).join('\n');

                const embed = new EmbedBuilder()
                    .setColor(EMBED_COLOR)
                    .setTitle('Voice Channel Roles')
                    .setDescription(list)
                    .setFooter({ text: `${mappings.length} mapping(s)` });

                await ctx.reply({ embeds: [embed] });
            } catch (err: any) {
                await ctx.reply({ content: `${CROSS} Failed to fetch mappings: ${err.message}`, ephemeral: true });
            }
            return;
        }

        // ADD MAPPING
        if (subcommand === 'add') {
            const channelArg = args[1];
            const roleArg = args[2];

            if (!channelArg || !roleArg) {
                await ctx.reply({ 
                    content: `${CROSS} Usage: \`/custom_vc_role add <channel> <role>\`\nExample: \`/custom_vc_role add #music @DJ\``, 
                    ephemeral: true 
                });
                return;
            }

            // Extract channel ID
            const channelMatch = channelArg.match(/^<#(\d+)>$/) || channelArg.match(/^(\d+)$/);
            const channelId = channelMatch ? channelMatch[1] : null;

            if (!channelId) {
                await ctx.reply({ content: `${CROSS} Invalid channel. Please mention a channel or provide a channel ID.`, ephemeral: true });
                return;
            }

            // Extract role ID
            const roleMatch = roleArg.match(/^<@&(\d+)>$/) || roleArg.match(/^(\d+)$/);
            const roleId = roleMatch ? roleMatch[1] : null;

            if (!roleId) {
                await ctx.reply({ content: `${CROSS} Invalid role. Please mention a role or provide a role ID.`, ephemeral: true });
                return;
            }

            // Verify channel exists and is a voice channel
            const channel = await ctx.inner.guild?.channels.fetch(channelId).catch(() => null);
            if (!channel || channel.type !== ChannelType.GuildVoice) {
                await ctx.reply({ content: `${CROSS} Channel not found or is not a voice channel.`, ephemeral: true });
                return;
            }

            // Verify role exists
            const role = await ctx.inner.guild?.roles.fetch(roleId).catch(() => null);
            if (!role) {
                await ctx.reply({ content: `${CROSS} Role not found.`, ephemeral: true });
                return;
            }

            try {
                await voiceChannelRoleService.addMapping(ctx.guildId, channelId, roleId);

                const embed = new EmbedBuilder()
                    .setColor(EMBED_COLOR)
                    .setDescription(
                        `${TICK} **Voice Channel Role Added**\n\n` +
                        `**Channel:** <#${channelId}>\n` +
                        `**Role:** <@&${roleId}>\n\n` +
                        `Users joining this channel will receive the role automatically.`
                    );

                await ctx.reply({ embeds: [embed] });

                // Check if anyone is already in the channel and give them the role
                const voiceChannel = channel;
                if (voiceChannel.isVoiceBased() && voiceChannel.members.size > 0) {
                    let assignedCount = 0;
                    for (const [memberId, member] of voiceChannel.members) {
                        try {
                            if (!member.roles.cache.has(roleId)) {
                                await member.roles.add(roleId);
                                assignedCount++;
                            }
                        } catch (e) {
                            console.error(`Failed to assign role to ${memberId}:`, e);
                        }
                    }

                    if (assignedCount > 0) {
                        await ctx.reply({ 
                            content: `${TICK} Assigned role to ${assignedCount} user(s) already in the channel.`, 
                            ephemeral: true 
                        });
                    }
                }
            } catch (err: any) {
                await ctx.reply({ content: `${CROSS} Failed to add mapping: ${err.message}`, ephemeral: true });
            }
            return;
        }

        // REMOVE MAPPING
        if (subcommand === 'remove') {
            const channelArg = args[1];

            if (!channelArg) {
                await ctx.reply({ 
                    content: `${CROSS} Usage: \`/custom_vc_role remove <channel>\`\nExample: \`/custom_vc_role remove #music\``, 
                    ephemeral: true 
                });
                return;
            }

            // Extract channel ID
            const channelMatch = channelArg.match(/^<#(\d+)>$/) || channelArg.match(/^(\d+)$/);
            const channelId = channelMatch ? channelMatch[1] : null;

            if (!channelId) {
                await ctx.reply({ content: `${CROSS} Invalid channel. Please mention a channel or provide a channel ID.`, ephemeral: true });
                return;
            }

            try {
                const mapping = await voiceChannelRoleService.getMapping(ctx.guildId, channelId);
                if (!mapping) {
                    await ctx.reply({ content: `${CROSS} No role mapping found for <#${channelId}>.`, ephemeral: true });
                    return;
                }

                await voiceChannelRoleService.removeMapping(ctx.guildId, channelId);

                const embed = new EmbedBuilder()
                    .setColor(EMBED_COLOR)
                    .setDescription(
                        `${TICK} **Voice Channel Role Removed**\n\n` +
                        `**Channel:** <#${channelId}>\n` +
                        `**Role:** <@&${mapping.role_id}>\n\n` +
                        `Role will no longer be assigned automatically.`
                    );

                await ctx.reply({ embeds: [embed] });

                // Remove role from users currently in the channel
                const channel = await ctx.inner.guild?.channels.fetch(channelId).catch(() => null);
                if (channel && channel.isVoiceBased() && channel.members.size > 0) {
                    let removedCount = 0;
                    for (const [memberId, member] of channel.members) {
                        try {
                            if (member.roles.cache.has(mapping.role_id)) {
                                await member.roles.remove(mapping.role_id);
                                removedCount++;
                            }
                        } catch (e) {
                            console.error(`Failed to remove role from ${memberId}:`, e);
                        }
                    }

                    if (removedCount > 0) {
                        await ctx.reply({ 
                            content: `${TICK} Removed role from ${removedCount} user(s) currently in the channel.`, 
                            ephemeral: true 
                        });
                    }
                }
            } catch (err: any) {
                await ctx.reply({ content: `${CROSS} Failed to remove mapping: ${err.message}`, ephemeral: true });
            }
            return;
        }

        // Invalid subcommand
        await ctx.reply({ 
            content: `${CROSS} Invalid subcommand. Use \`add\`, \`show\`, or \`remove\`.`, 
            ephemeral: true 
        });
    }
};
