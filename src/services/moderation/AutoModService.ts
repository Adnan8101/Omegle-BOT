import { Message, PermissionFlagsBits } from 'discord.js';
import { db } from '../../data/db';
import { hasPermission } from '../../util/permissions';

class AutoModService {
    private cache: Map<string, Set<string>> = new Map();

    async initForGuild(guildId: string) {
        if (this.cache.has(guildId)) return;

        const rows = await db.bannedWord.findMany({
            where: { guild_id: guildId },
            select: { word: true }
        });

        const words = new Set(rows.map((r: { word: string }) => r.word.toLowerCase()));
        this.cache.set(guildId, words);
    }

    async addWords(guildId: string, words: string[], addedBy: string) {
        // Update DB
        const now = new Date();
        for (const word of words) {
            // Prisma doesn't have simple doNothing on create, but we can check existence or ignore error.
            // Or use createMany with skipDuplicates if strict unique constraint exists on [guild_id, word].
            // My schema has PK on id, not composite. It doesn't enforce unique word per guild in schema (I should have added @@unique([guild_id, word])).
            // Assuming we allow duplicates or code should handle it.
            // Kysely code did: onConflict(oc => oc.doNothing()). This implies there IS a unique constraint.
            // I should verify schema.
            // Schema has `id String @id`. It DOES NOT have `@@unique([guild_id, word])`.
            // So Kysely's onConflict would have failed or done nothing if no constraint?
            // Wait, maybe Kysely schema *assumed* it? Or database *has* it?
            // DB reset wiped it. So now there is NO constraint.
            // I should implement check-then-create to avoid dups.
            const existing = await db.bannedWord.findFirst({
                where: { guild_id: guildId, word: word.toLowerCase() }
            });

            if (!existing) {
                await db.bannedWord.create({
                    data: {
                        guild_id: guildId,
                        word: word.toLowerCase(),
                        added_by: addedBy,
                        created_at: now
                    }
                });
            }
        }

        // Update Cache
        if (!this.cache.has(guildId)) {
            await this.initForGuild(guildId);
        } else {
            const cache = this.cache.get(guildId)!;
            words.forEach(w => cache.add(w.toLowerCase()));
        }
    }

    async checkMessage(message: Message) {
        if (!message.guild || message.author.bot) return;

        // 1. Check Permissions (Exempt Moderators+)
        const member = message.member;
        if (member) {
            const perms = member.permissions;
            // Exempt if ModerateMembers or higher
            if (hasPermission(perms, PermissionFlagsBits.ModerateMembers)) return;
        }

        const guildId = message.guild.id;

        // Init cache if needed
        if (!this.cache.has(guildId)) {
            await this.initForGuild(guildId);
        }

        const bannedWords = this.cache.get(guildId);
        if (!bannedWords || bannedWords.size === 0) return;

        const content = message.content.toLowerCase();

        // Check contains
        // Simple check: "does the string contain the banned word?"
        // User said "if a words in any text in in ban list"
        // Strict boundary check usually implies \bWORD\b but users often want strict substring for things like "badword".
        // Let's assume substring search for now as it's stricter.
        // Actually, let's tokenize or check `includes`. `one or more words` in list.

        for (const word of bannedWords) {
            if (content.includes(word)) {
                // Detected
                try {
                    if (message.deletable) {
                        await message.delete();
                        // Optional: Warn user? User said "it will delete the message". Didn't ask for warning.
                        // But silent delete is confusing. I'll check user request: "it will delete the message... check all channels". No specific mention of reply.
                        // I will NOT reply to avoid clutter, as per previous style preferences.
                    }
                } catch (e) {
                    // Ignore delete errors
                }
                return; // Stop checking
            }
        }
    }
}

export const autoModService = new AutoModService();
