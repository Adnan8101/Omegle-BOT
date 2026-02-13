import { Guild, GuildMember, User, Channel } from 'discord.js';

export class Resolver {
    static async getUser(input: string): Promise<User | null> {
        if (!input) return null;

        // Mention
        const mentionMatch = input.match(/^<@!?(\d+)>$/);
        if (mentionMatch) return await Resolver.fetchUser(mentionMatch[1]);

        // ID
        if (/^\d{17,19}$/.test(input)) return await Resolver.fetchUser(input);

        // We can't search by username efficiently globally without client cache
        return null;
    }

    private static async fetchUser(id: string): Promise<User | null> {
        try {
            // Need client access. This utility is static. 
            // We usually assume client is available via some global or passed in.
            // But usually we just return ID if we can't fetch?
            // Wait, we need the User object.
            // Let's assume the caller has access or we use a hack if needed.
            // But typical `Resolver` in djs bots uses Client.
            // Here we don't have client reference easily.
            // We'll rely on global `client` if available or refactor.
            // Actually, `ctx.client` is available in command. But here it's static util.
            // Let's rely on the inputs being resolved in Command usually?
            // No, the commands are using `Resolver.getUser(input)`.
            // Let's import client from discord.ts
            const { client } = require('../core/discord');
            return await client.users.fetch(id).catch(() => null);
        } catch {
            return null;
        }
    }

    static async getMember(guild: Guild, input: string): Promise<GuildMember | null> {
        if (!input) return null;

        // Mention
        const mentionMatch = input.match(/^<@!?(\d+)>$/);
        if (mentionMatch) return await guild.members.fetch(mentionMatch[1]).catch(() => null);

        // ID
        if (/^\d{17,19}$/.test(input)) return await guild.members.fetch(input).catch(() => null);

        // Username search (fuzzy or exact)
        // Cache might be partial. Fetch query?
        try {
            const members = await guild.members.search({ query: input, limit: 1 });
            return members.first() || null;
        } catch {
            return null;
        }
    }

    static async getChannel(guild: Guild, input: string): Promise<Channel | null> {
        if (!input) return null;

        // Mention <#ID>
        const mentionMatch = input.match(/^<#(\d+)>$/);
        if (mentionMatch) return await guild.channels.fetch(mentionMatch[1]).catch(() => null);

        // ID
        if (/^\d{17,19}$/.test(input)) return await guild.channels.fetch(input).catch(() => null);

        // Name search (cache)
        return guild.channels.cache.find(c => c.name.toLowerCase() === input.toLowerCase()) || null;
    }
}
