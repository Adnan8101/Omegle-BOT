import { Context } from '../../core/context';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Command } from '../../core/command';

export const ModSafety: Command = {
    name: 'modsafety',
    description: 'View moderation safety system guide',
    category: 'Admin',
    syntax: 'modsafety',
    example: 'modsafety',
    permissions: [],
    execute: async (ctx: Context, args: string[]) => {
        const embed1 = new EmbedBuilder()
            .setTitle('🛡️ Moderation Safety System')
            .setDescription(
                '**Purpose:** Prevent moderation abuse while allowing legitimate emergency actions.\n\n' +
                '**Core Principles:**\n' +
                '• All bans are logged and monitored\n' +
                '• System observes patterns, not raw numbers\n' +
                '• Humans remain the final authority\n' +
                '• Emergency situations are never blocked'
            );

        const embed2 = new EmbedBuilder()
            .setTitle('📊 How It Works')
            .setDescription(
                '**Stage 1: Awareness (5 bans in 5 min)**\n' +
                '🔔 Gentle private alerts sent to moderator and admins\n' +
                '✅ No punishment, no interruption\n\n' +
                '**Stage 2: Intervention (10 bans in 10 min)**\n' +
                '⚠️ 10-minute ban command cooldown applied\n' +
                '📢 Admins notified with ban details\n' +
                '♻️ Auto-restores when pattern clears'
            );

        const embed3 = new EmbedBuilder()
            .setTitle('🎯 Reason-Aware Scoring')
            .setDescription(
                '**Low Risk (0.3x weight):**\n' +
                'Raid, Scam, Bot attack, Mass spam\n' +
                '*Expected during emergencies*\n\n' +
                '**Medium Risk (1.0x weight):**\n' +
                'Normal rule violations\n\n' +
                '**High Risk (2.0x weight):**\n' +
                'No reason, "Other", Personal reasons\n' +
                '*Triggers faster escalation*'
            );

        const embed4 = new EmbedBuilder()
            .setTitle('🚨 Emergency Mode')
            .setDescription(
                '**Commands:**\n' +
                '`!emergency on raid [reason]` - Enable\n' +
                '`!emergency off` - Disable\n' +
                '`!emergency status` - Check status\n\n' +
                '**When Active:**\n' +
                '• All safety checks disabled\n' +
                '• No cooldowns applied\n' +
                '• Moderators act freely\n\n' +
                '**Types:** raid, scam, bot'
            );

        const embed5 = new EmbedBuilder()
            .setTitle('🔒 Safety Admins')
            .setDescription(
                '**Commands:**\n' +
                '`!safetyadmin add @User` - Add safety admin\n' +
                '`!safetyadmin list` - List safety admins\n' +
                '`!safetyadmin remove @User` - Remove\n\n' +
                '**Benefits:**\n' +
                '• Bypass all safety checks\n' +
                '• Never receive cooldowns\n' +
                '• Top-level protection\n\n' +
                '*Use for owner and trusted co-owners only*'
            );

        const embed6 = new EmbedBuilder()
            .setTitle('✅ Best Practices')
            .setDescription(
                '**For Moderators:**\n' +
                '• Always provide clear ban reasons\n' +
                '• Use emergency keywords during raids\n' +
                '• System alerts are not punishments\n\n' +
                '**For Admins:**\n' +
                '• Enable emergency mode during raids\n' +
                '• Review alerts but trust your team\n' +
                '• Add safety admins sparingly\n\n' +
                '**Transparency:**\n' +
                'All actions are logged with full details'
            );

        await ctx.reply({ embeds: [embed1, embed2, embed3, embed4, embed5, embed6] });
    }
};
