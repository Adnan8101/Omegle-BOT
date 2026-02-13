import { Message, ChatInputCommandInteraction, InteractionReplyOptions, MessageReplyOptions } from 'discord.js';

export interface Context {
    readonly guildId: string;
    readonly channelId: string;
    readonly messageId: string; // For interaction, this might be interaction.id
    readonly authorId: string;
    readonly authorIsBot: boolean;
    readonly content: string; // For interaction, maybe empty or command name
    readonly mentions: string[];
    readonly timestamp: number;
    readonly inner: Message | ChatInputCommandInteraction;
    reply(options: string | MessageReplyOptions | InteractionReplyOptions): Promise<any>;
    defer(ephemeral?: boolean): Promise<void>;
}

export function createContext(message: Message): Context | null {
    if (!message.guildId) return null;

    return {
        guildId: message.guildId,
        channelId: message.channelId,
        messageId: message.id,
        authorId: message.author.id,
        authorIsBot: message.author.bot,
        content: message.content,
        mentions: message.mentions.users.map(u => u.id),
        timestamp: message.createdTimestamp,
        inner: message,
        reply: (options) => message.reply(options as MessageReplyOptions),
        defer: async (ephemeral?: boolean) => {
            // For messages, defer is a no-op since we're not on interaction
            await Promise.resolve();
        }
    };
}

export function createContextFromInteraction(interaction: ChatInputCommandInteraction): Context {
    return {
        guildId: interaction.guildId!,
        channelId: interaction.channelId!,
        messageId: interaction.id,
        authorId: interaction.user.id,
        authorIsBot: interaction.user.bot,
        content: interaction.commandName,
        mentions: [],
        timestamp: interaction.createdTimestamp,
        inner: interaction,
        reply: async (options) => {
            if (interaction.deferred && !interaction.replied) {
                return interaction.editReply(options as any);
            }
            if (interaction.replied) {
                return interaction.followUp(options as InteractionReplyOptions);
            }
            return interaction.reply(options as InteractionReplyOptions);
        },
        defer: async (ephemeral?: boolean) => {
            if (!interaction.deferred && !interaction.replied) {
                await interaction.deferReply({ ephemeral: ephemeral || false });
            }
        }
    };
}
