import { Context } from '../../core/context';
import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { Command } from '../../core/command';
import { db } from '../../data/db';

const TICK = '<:tickYes:1469272837192814623>';
const CROSS = '<:cross:1469273232929456314>';

export const EmergencyMode: Command = {
    name: 'emergency',
    description: 'Toggle emergency mode to disable moderation safety checks',
    category: 'Admin',
    syntax: 'emergency <on|off> [raid|scam|bot] [reason]',
    example: 'emergency on raid Mass bot attack',
    permissions: [PermissionFlagsBits.Administrator],
    execute: async (ctx: Context, args: string[]) => {
        const guild = ctx.inner.guild;
        const member = ctx.inner.member;

        if (!guild || !member) return;

        if (typeof member.permissions === 'string' || !member.permissions.has(PermissionFlagsBits.Administrator)) {
            return;
        }

        const action = args[0]?.toLowerCase();

        if (!action || !['on', 'off', 'status'].includes(action)) {
            const embed = new EmbedBuilder()
                .setDescription(
                    `${TICK} **Emergency Mode Management**\n\n` +
                    '`emergency on <type> [reason]` - Enable emergency mode\n' +
                    '`emergency off` - Disable emergency mode\n' +
                    '`emergency status` - Check current status\n\n' +
                    '**Types:** raid, scam, bot\n\n' +
                    '*Disables all moderation safety checks and cooldowns*'
                );
            await ctx.reply({ embeds: [embed] });
            return;
        }

        try {
            if (action === 'status') {
                const emergency = await db.emergencyMode.findUnique({
                    where: { guild_id: ctx.guildId }
                });

                if (!emergency || !emergency.enabled) {
                    const embed = new EmbedBuilder()
                        .setDescription(`${TICK} Emergency mode is **disabled**`);
                    await ctx.reply({ embeds: [embed] });
                    return;
                }

                const enabledBy = `<@${emergency.enabled_by}>`;
                const enabledAt = `<t:${Math.floor(emergency.enabled_at.getTime() / 1000)}:R>`;

                const embed = new EmbedBuilder()
                    .setTitle('🚨 Emergency Mode Active')
                    .setDescription(
                        `**Type:** ${emergency.mode_type || 'general'}\n` +
                        `**Enabled by:** ${enabledBy}\n` +
                        `**Enabled:** ${enabledAt}\n` +
                        `**Reason:** ${emergency.reason || 'Not specified'}\n\n` +
                        `*All moderation safety checks disabled*`
                    );
                await ctx.reply({ embeds: [embed] });
                return;
            }

            if (action === 'on') {
                const modeType = args[1]?.toLowerCase() || 'general';
                const validTypes = ['raid', 'scam', 'bot', 'general'];
                
                if (!validTypes.includes(modeType)) {
                    await ctx.reply({ content: 'Invalid type. Use: raid, scam, bot', ephemeral: true });
                    return;
                }

                const reason = args.slice(2).join(' ') || 'Emergency situation';

                await db.emergencyMode.upsert({
                    where: { guild_id: ctx.guildId },
                    update: {
                        enabled: true,
                        mode_type: modeType,
                        enabled_by: ctx.authorId,
                        enabled_at: new Date(),
                        reason: reason
                    },
                    create: {
                        guild_id: ctx.guildId,
                        enabled: true,
                        mode_type: modeType,
                        enabled_by: ctx.authorId,
                        reason: reason
                    }
                });

                const embed = new EmbedBuilder()
                    .setTitle('🚨 Emergency Mode Enabled')
                    .setDescription(
                        `**Type:** ${modeType}\n` +
                        `**Reason:** ${reason}\n\n` +
                        `All moderation safety checks and cooldowns are now **disabled**.\n` +
                        `Moderators can act without restrictions.\n\n` +
                        `Use \`emergency off\` when the situation is resolved.`
                    );
                await ctx.reply({ embeds: [embed] });
                return;
            }

            if (action === 'off') {
                await db.emergencyMode.upsert({
                    where: { guild_id: ctx.guildId },
                    update: { enabled: false },
                    create: {
                        guild_id: ctx.guildId,
                        enabled: false,
                        enabled_by: ctx.authorId
                    }
                });

                const embed = new EmbedBuilder()
                    .setDescription(
                        `${TICK} **Emergency Mode Disabled**\n\n` +
                        `Safety checks and cooldowns have been restored.`
                    );
                await ctx.reply({ embeds: [embed] });
                return;
            }

        } catch (error: any) {
            const embed = new EmbedBuilder()
                .setDescription(`${CROSS} Failed: ${error.message}`);
            await ctx.reply({ embeds: [embed] });
        }
    }
};
