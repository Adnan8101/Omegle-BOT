import { Context } from '../../core/context';
import { PermissionFlagsBits, Message, EmbedBuilder, parseEmoji } from 'discord.js';
import { Command } from '../../core/command';

const TICK = '<:tickYes:1469272837192814623>';
const CROSS = '<:cross:1469273232929456314>';

// Regex to match custom Discord emojis: <:name:id> or <a:name:id>
const CUSTOM_EMOJI_REGEX = /<(a?):(\w+):(\d+)>/g;
// Regex to match sticker from a replied message (handled via API)

export const Steal: Command = {
    name: 'steal',
    description: 'Steal emojis or stickers and add them to this server',
    category: 'Moderator Utils',
    syntax: 'steal <emoji> [emoji...] | reply to a message with emojis/sticker',
    example: 'steal :emoji1: :emoji2: | reply to sticker message',
    permissions: [PermissionFlagsBits.ManageGuildExpressions],
    execute: async (ctx: Context, args: string[]) => {
        if (!ctx.inner.guild || !ctx.inner.member) return;
        const guild = ctx.inner.guild;
        const message = ctx.inner instanceof Message ? ctx.inner : null;

        const emojisToSteal: { name: string; url: string; animated: boolean }[] = [];
        let stickersToSteal: { name: string; url: string; }[] = [];

        // --- 1. Parse emojis from args ---
        const fullArgs = args.join(' ');
        let match: RegExpExecArray | null;
        const emojiRegex = new RegExp(CUSTOM_EMOJI_REGEX.source, 'g');

        while ((match = emojiRegex.exec(fullArgs)) !== null) {
            const animated = match[1] === 'a';
            const name = match[2];
            const id = match[3];
            const ext = animated ? 'gif' : 'png';
            emojisToSteal.push({
                name,
                url: `https://cdn.discordapp.com/emojis/${id}.${ext}?size=128&quality=lossless`,
                animated
            });
        }

        // --- 2. Parse emojis/stickers from replied message ---
        if (message && message.reference?.messageId) {
            try {
                const refMsg = await message.channel.messages.fetch(message.reference.messageId);

                // Extract emojis from the replied message content
                const refRegex = new RegExp(CUSTOM_EMOJI_REGEX.source, 'g');
                while ((match = refRegex.exec(refMsg.content)) !== null) {
                    const animated = match[1] === 'a';
                    const name = match[2];
                    const id = match[3];
                    const ext = animated ? 'gif' : 'png';
                    // Avoid duplicates
                    if (!emojisToSteal.find(e => e.url.includes(id))) {
                        emojisToSteal.push({
                            name,
                            url: `https://cdn.discordapp.com/emojis/${id}.${ext}?size=128&quality=lossless`,
                            animated
                        });
                    }
                }

                // Extract stickers from the replied message
                if (refMsg.stickers.size > 0) {
                    for (const [, sticker] of refMsg.stickers) {
                        stickersToSteal.push({
                            name: sticker.name,
                            url: sticker.url
                        });
                    }
                }
            } catch (e) {
                // ignore
            }
        }

        // --- 3. Nothing to steal ---
        if (emojisToSteal.length === 0 && stickersToSteal.length === 0) {
            if (message) await message.react('❌').catch(() => {});
            return;
        }

        // --- 4. Steal emojis ---
        const results: string[] = [];
        let successCount = 0;
        let failCount = 0;

        for (const emoji of emojisToSteal) {
            try {
                const created = await guild.emojis.create({
                    attachment: emoji.url,
                    name: emoji.name
                });
                results.push(`${TICK} \`${emoji.name}\` → <${emoji.animated ? 'a' : ''}:${created.name}:${created.id}>`);
                successCount++;
            } catch (err: any) {
                results.push(`${CROSS} \`${emoji.name}\` → ${err.message?.includes('maximum') ? 'Server emoji limit reached' : 'Failed'}`);
                failCount++;
            }
        }

        // --- 5. Steal stickers ---
        for (const sticker of stickersToSteal) {
            try {
                const response = await fetch(sticker.url);
                if (!response.ok) throw new Error('Failed to download sticker');

                const buffer = Buffer.from(await response.arrayBuffer());

                await guild.stickers.create({
                    file: buffer,
                    name: sticker.name,
                    tags: '🔥'
                });
                results.push(`${TICK} Sticker \`${sticker.name}\` added`);
                successCount++;
            } catch (err: any) {
                results.push(`${CROSS} Sticker \`${sticker.name}\` → ${err.message?.includes('maximum') ? 'Server sticker limit reached' : 'Failed'}`);
                failCount++;
            }
        }

        // --- 6. Response ---
        const embed = new EmbedBuilder()
            .setTitle('Steal Results')
            .setDescription(results.join('\n'))
            .setColor(failCount === 0 ? 0x57F287 : successCount === 0 ? 0xED4245 : 0xFEE75C)
            .setFooter({ text: `${successCount} added • ${failCount} failed` })
            .setTimestamp();

        await ctx.reply({ embeds: [embed] });
    }
};
