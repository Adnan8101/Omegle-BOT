import { Context } from '../../core/context';
import { EmbedBuilder, PermissionFlagsBits, Role, GuildMember } from 'discord.js';
import { Command } from '../../core/command';
import { findBestRoleMatch, isExactRoleMatch } from '../../util/fuzzyMatch';

const TICK = '<:tickYes:1469272837192814623>';
const CROSS = '<:cross:1469273232929456314>';

export const RoleAdd: Command = {
    name: 'roleadd',
    description: 'Add a role to a member',
    category: 'Moderation',
    syntax: 'roleadd <member> <role>',
    example: 'roleadd @User Moderator',
    permissions: [PermissionFlagsBits.ManageRoles],
    execute: async (ctx: Context, args: string[]) => {
        await ctx.defer();
        const guild = ctx.inner.guild;
        const member = ctx.inner.member;
        
        if (!guild || !member) {
            const embed = new EmbedBuilder()
                .setDescription(`${CROSS} This command can only be used in a server.`);
            await ctx.reply({ embeds: [embed] });
            return;
        }

        // Check bot permissions
        if (!guild.members.me?.permissions.has(PermissionFlagsBits.ManageRoles)) {
            const embed = new EmbedBuilder()
                .setDescription(`${CROSS} I need the **Manage Roles** permission to do this.`);
            await ctx.reply({ embeds: [embed] });
            return;
        }

        // Check user permissions
        if (typeof member.permissions === 'string' || !member.permissions.has(PermissionFlagsBits.ManageRoles)) {
            // Silently ignore if user doesn't have permission
            return;
        }

        if (args.length < 2) {
            const embed = new EmbedBuilder()
                .setDescription(`${CROSS} **Usage:** \`!roleadd <member> <role>\`\n**Example:** \`!roleadd @User Moderator\``);
            await ctx.reply({ embeds: [embed] });
            return;
        }

        // Parse member
        const memberInput = args[0];
        const roleInput = args.slice(1).join(' ');

        let targetMember: GuildMember | undefined;
        
        // Try to resolve member by mention, ID, or username
        const memberMatch = memberInput.match(/^<@!?(\d+)>$/);
        if (memberMatch) {
            targetMember = await guild.members.fetch(memberMatch[1]).catch(() => undefined);
        } else {
            targetMember = await guild.members.fetch(memberInput).catch(() => undefined);
        }

        if (!targetMember) {
            // Try by username
            const members = await guild.members.fetch();
            targetMember = members.find((m: GuildMember) => 
                m.user.username.toLowerCase() === memberInput.toLowerCase() ||
                m.user.tag.toLowerCase() === memberInput.toLowerCase()
            );
        }

        if (!targetMember) {
            const embed = new EmbedBuilder()
                .setDescription(`${CROSS} Could not find member: **${memberInput}**`);
            await ctx.reply({ embeds: [embed] });
            return;
        }

        // Parse role
        let targetRole: Role | undefined;
        const roles = await guild.roles.fetch();
        const roleCollection = roles.filter((r: Role) => r.id !== guild.id); // Exclude @everyone

        // Check for role mention
        const roleMatch = roleInput.match(/^<@&(\d+)>$/);
        if (roleMatch) {
            targetRole = roles.get(roleMatch[1]);
        } else if (/^\d{17,19}$/.test(roleInput)) {
            // Check if it's a role ID
            targetRole = roles.get(roleInput);
        } else {
            // Check for exact name match first
            targetRole = roleCollection.find((r: Role) => r.name.toLowerCase() === roleInput.toLowerCase());
        }

        // If exact match found, proceed immediately
        if (targetRole && isExactRoleMatch(roleInput, targetRole)) {
            return await addRoleToMember(ctx, targetMember, targetRole);
        }

        // If not exact match, try fuzzy matching
        if (!targetRole) {
            const fuzzyMatch = findBestRoleMatch(roleInput, Array.from(roleCollection.values()), 0.5);
            
            if (!fuzzyMatch) {
                const embed = new EmbedBuilder()
                    .setDescription(`${CROSS} Could not find role: **${roleInput}**`);
                await ctx.reply({ embeds: [embed] });
                return;
            }

            targetRole = fuzzyMatch.role;

            // If similarity is less than 100%, ask for confirmation
            if (fuzzyMatch.similarity < 0.95) {
                const embed = new EmbedBuilder()
                    .setDescription(
                        `⚠️ **Role Confirmation**\n\n` +
                        `Did you mean to give <@&${targetRole.id}> to ${targetMember.user}?\n\n` +
                        `**You typed:** \`${roleInput}\`\n` +
                        `**Best match:** <@&${targetRole.id}>\n\n` +
                        `*Use the exact role name, mention, or ID to add the role.*`
                    );
                
                await ctx.reply({ embeds: [embed] });
                return;
            }
        }

        await addRoleToMember(ctx, targetMember, targetRole);
    }
};

async function addRoleToMember(ctx: Context, member: GuildMember, role: Role) {
    const guild = ctx.inner.guild!;
    const authorMember = ctx.inner.member as GuildMember;
    
    // Check if member already has the role
    if (member.roles.cache.has(role.id)) {
        const embed = new EmbedBuilder()
            .setDescription(`⚠️ ${member.user} already has the <@&${role.id}> role.`);
        await ctx.reply({ embeds: [embed] });
        return;
    }

    // Check role hierarchy - command author cannot give roles higher than their own
    const authorHighestRole = authorMember.roles.highest;
    
    if (role.position >= authorHighestRole.position && guild.ownerId !== authorMember.id) {
        const embed = new EmbedBuilder()
            .setDescription(`${CROSS} You cannot give a role higher than or equal to your highest role.\n**Your highest role:** <@&${authorHighestRole.id}>`);
        await ctx.reply({ embeds: [embed] });
        return;
    }

    // Check bot role hierarchy
    const botHighestRole = guild.members.me!.roles.highest;
    if (role.position >= botHighestRole.position) {
        const embed = new EmbedBuilder()
            .setDescription(`${CROSS} I cannot give a role higher than or equal to my highest role.\n**My highest role:** <@&${botHighestRole.id}>`);
        await ctx.reply({ embeds: [embed] });
        return;
    }

    try {
        await member.roles.add(role);
        
        const embed = new EmbedBuilder()
            .setDescription(`${TICK} **Added** <@&${role.id}> to ${member.user}`);
        
        await ctx.reply({ embeds: [embed] });
    } catch (error: any) {
        const embed = new EmbedBuilder()
            .setDescription(`${CROSS} Failed to add role: ${error.message}`);
        await ctx.reply({ embeds: [embed] });
    }
}
