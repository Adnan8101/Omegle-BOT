import { Context } from '../../core/context';
import { EmbedBuilder, PermissionFlagsBits, Role } from 'discord.js';
import { Command } from '../../core/command';

const CROSS = '<:cross:1469273232929456314>';

export const InRole: Command = {
    name: 'inrole',
    description: 'List all members with a specific role',
    category: 'Moderation',
    syntax: 'inrole <role>',
    example: 'inrole @Admin',
    permissions: [PermissionFlagsBits.ManageRoles],
    modAction: 'inrole',
    execute: async (ctx: Context, args: string[]) => {
        await ctx.defer();
        const guild = ctx.inner.guild;

        if (!guild) {
            const embed = new EmbedBuilder()
                .setDescription(`${CROSS} This command can only be used in a server.`);
            await ctx.reply({ embeds: [embed] });
            return;
        }

        if (args.length === 0) {
            const embed = new EmbedBuilder()
                .setDescription(`${CROSS} **Usage:** \`!inrole <role>\`\n**Example:** \`!inrole Moderator\``);
            await ctx.reply({ embeds: [embed] });
            return;
        }

        const roleInput = args.join(' ');
        let targetRole: Role | undefined;
        const roles = await guild.roles.fetch();

        // Check for role mention
        const roleMatch = roleInput.match(/^<@&(\d+)>$/);
        if (roleMatch) {
            targetRole = roles.get(roleMatch[1]);
        } else if (/^\d{17,19}$/.test(roleInput)) {
            // Check if it's a role ID
            targetRole = roles.get(roleInput);
        } else {
            // Check for exact name match (case insensitive)
            targetRole = roles.find((r: Role) => r.name.toLowerCase() === roleInput.toLowerCase());
        }

        if (!targetRole) {
            const embed = new EmbedBuilder()
                .setDescription(`${CROSS} Could not find role: **${roleInput}**`);
            await ctx.reply({ embeds: [embed] });
            return;
        }

        // Fetch all members to ensure we have complete data
        await guild.members.fetch();

        const membersWithRole = targetRole.members;

        if (membersWithRole.size === 0) {
            const embed = new EmbedBuilder()
                .setDescription(`⚠️ No members have the <@&${targetRole.id}> role.`);
            await ctx.reply({ embeds: [embed] });
            return;
        }

        // Create paginated list
        const memberList = Array.from(membersWithRole.values())
            .map(m => `• ${m.user.username} (${m.user.id})`)
            .slice(0, 20); // Limit to first 20 to avoid embed limits

        const showingNote = membersWithRole.size > 20 ? `\n\n*Showing first 20 of ${membersWithRole.size} members*` : '';

        const embed = new EmbedBuilder()
            .setDescription(
                `**Members with** <@&${targetRole.id}>\n\n` +
                memberList.join('\n') +
                `\n\n**Total:** ${membersWithRole.size} member${membersWithRole.size === 1 ? '' : 's'}` +
                showingNote
            );

        await ctx.reply({ embeds: [embed] });
    }
};
