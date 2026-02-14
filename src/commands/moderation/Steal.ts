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
                let errorReason = 'Unknown error';
                
                if (err.message?.includes('maximum') || err.code === 30008) {
                    errorReason = 'Server emoji limit reached (50 static, 50 animated)';
                } else if (err.code === 50035) {
                    errorReason = 'Invalid emoji file or name';
                } else if (err.code === 50013) {
                    errorReason = 'Missing MANAGE_GUILD_EXPRESSIONS permission';
                } else if (err.code === 50001) {
                    errorReason = 'Missing access to emoji';
                } else if (err.message?.includes('File cannot be larger')) {
                    errorReason = 'Emoji file too large (max 256KB)';
                } else if (err.message) {
                    errorReason = `${err.message} ${err.code ? `(Code: ${err.code})` : ''}`.trim();
                }
                
                results.push(`${CROSS} \`${emoji.name}\` → ${errorReason}`);
                failCount++;
            }
        }

        // --- 5. Steal stickers ---
        for (const sticker of stickersToSteal) {
            try {
                const response = await fetch(sticker.url);
                if (!response.ok) throw new Error(`Failed to download sticker (HTTP ${response.status})`);

                const buffer = Buffer.from(await response.arrayBuffer());

                // Validate sticker requirements
                const fileSizeKB = (buffer.length / 1024).toFixed(2);
                if (buffer.length > 512000) { // 500KB limit
                    throw new Error(`File too large (${fileSizeKB}KB, max 500KB)`);
                }

                await guild.stickers.create({
                    file: buffer,
                    name: sticker.name,
                    tags: '🔥'
                });
                results.push(`${TICK} Sticker \`${sticker.name}\` added (${fileSizeKB}KB)`);
                successCount++;
            } catch (err: any) {
                // Detailed error reasons
                let errorReason = 'Unknown error';
                
                if (err.message?.includes('maximum') || err.code === 30039) {
                    errorReason = 'Server sticker limit reached (max 5 for non-boosted)';
                } else if (err.message?.includes('File too large')) {
                    errorReason = err.message;
                } else if (err.code === 50035) {
                    errorReason = 'Invalid sticker file format';
                } else if (err.code === 50013) {
                    errorReason = 'Missing MANAGE_GUILD_EXPRESSIONS permission';
                } else if (err.code === 50001) {
                    errorReason = 'Missing access to sticker';
                } else if (err.message?.includes('download')) {
                    errorReason = err.message;
                } else if (err.message?.includes('ENOTFOUND') || err.message?.includes('ECONNREFUSED')) {
                    errorReason = 'Network error: Could not reach sticker URL';
                } else if (err.message) {
                    errorReason = `${err.message} ${err.code ? `(Code: ${err.code})` : ''}`.trim();
                }
                
                results.push(`${CROSS} Sticker \`${sticker.name}\` → ${errorReason}`);
                failCount++;
            }
        }

        // --- 6. Response ---
        const embed = new EmbedBuilder()
            .setColor(0x2b2d31)
        .setTitle('Steal Results')
            .setDescription(results.join('\n'))
            .setFooter({ text: `${successCount} added • ${failCount} failed` })
            .setTimestamp();

        // Add troubleshooting guide if there were failures
        if (failCount > 0) {
            embed.addFields({
                name: '🔧 Common Issues & Solutions',
                value: [
                    '**Permission Error:** Bot needs `MANAGE_GUILD_EXPRESSIONS` permission',
                    '**Limit Reached:** Server can have max 5 stickers (or more with boosts)',
                    '**File Size:** Stickers must be under 500KB, Emojis under 256KB',
                    '**Format:** Stickers must be PNG/APNG/Lottie, Emojis must be PNG/GIF',
                    '**Network:** Make sure Discord CDN is accessible',
                    '**Boost Level:** Higher server boost = more sticker/emoji slots'
                ].join('\n')
            });
        }

        await ctx.reply({ embeds: [embed] });
    }
};