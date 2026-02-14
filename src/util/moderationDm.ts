import { EmbedBuilder, Colors, Guild } from 'discord.js';

export async function sendModDm(
    guild: Guild,
    targetId: string,
    action: string,
    reason: string,
    caseId: number
) {
    try {
        const user = await guild.client.users.fetch(targetId).catch(() => null);
        if (!user) return;

        const isGreen = ['unban', 'unmute', 'delcase'].includes(action);
        const color = isGreen ? Colors.Green : Colors.Red;

        const verbMap: Record<string, string> = {
            'ban': 'banned',
            'kick': 'kicked',
            'mute': 'muted',
            'unmute': 'unmuted',
            'warn': 'warned',
            'unban': 'unbanned',
            'delcase': 'pardoned'
        };
        const verb = verbMap[action.toLowerCase()] || action;

        const titleMap: Record<string, string> = {
            'ban': 'Banned',
            'kick': 'Kicked',
            'mute': 'Muted',
            'unmute': 'Unmuted',
            'warn': 'Warned',
            'unban': 'Unbanned',
            'delcase': 'Case Deleted'
        };
        const prefix = titleMap[action.toLowerCase()] || 'Notice';

        const embed = new EmbedBuilder()
            .setColor(0x2b2d31)
        .setTitle(`${prefix} | ${guild.name}`)
            .setDescription(`You have been ${verb} from **${guild.name}**${reason ? `\nReason: ${reason}` : ''}`)
            .setFooter({ text: `Case ID : ${caseId.toString().padStart(4, '0')}` })
            .setTimestamp();

        await user.send({ embeds: [embed] }).catch(() => null);
    } catch (e) {
    }
}
