import { Context } from '../../core/context';
import { EmbedBuilder, PermissionFlagsBits, Message, Collection, TextChannel, ChatInputCommandInteraction, User } from 'discord.js';
import { Command } from '../../core/command';
import { ModLogger } from '../../services/logging/ModLogger';

const TICK = '<:tickYes:1469272837192814623>';
const CROSS = '<:cross:1469273232929456314>';

export const Purge: Command = {
    name: 'purge',
    description: 'Bulk delete messages',
    category: 'Moderation',
    syntax: 'purge [filter] <amount>',
    example: 'purge 10\npurge bots 20\npurge human 50\npurge media 10',
    permissions: [PermissionFlagsBits.ManageMessages],
    modAction: 'purge',
    execute: async (ctx: Context, args: string[]) => {
        if (!ctx.inner.guild || !ctx.inner.channel) return;

        const channel = ctx.inner.channel as TextChannel;
        // Basic check, though router handles it too usually
        if (!channel.permissionsFor(ctx.inner.guild.members.me!)?.has(PermissionFlagsBits.ManageMessages)) {
            await ctx.reply({ content: `${CROSS} I need **Manage Messages** permission in this channel.`, ephemeral: true });
            return;
        }

        let amount = 0;
        let filter: 'all' | 'human' | 'bots' | 'media' = 'all';
        let startAfter: string | undefined;
        let endBefore: string | undefined;

        const isInteraction = ctx.inner instanceof ChatInputCommandInteraction;

        // Parse command-line args (Text Command) / Interaction Args
        if (isInteraction) {
            const interact = ctx.inner as ChatInputCommandInteraction;
            amount = interact.options.getInteger('amount') || 0;
            const typeOpt = interact.options.getString('type');
            if (typeOpt) filter = typeOpt.toLowerCase() as any;
            startAfter = interact.options.getString('start_after') || undefined;
            endBefore = interact.options.getString('end_before') || undefined;
        } else {
            // Text Command Parsing
            if (args.length > 0) {
                const firstArg = args[0].toLowerCase();
                if (['human', 'bots', 'media'].includes(firstArg)) {
                    filter = firstArg as any;
                    amount = parseInt(args[1]);
                } else {
                    amount = parseInt(args[0]);
                }

                // Fallback / Robust parsing for mixed args
                const parsedAmount = args.find(a => /^\d{1,3}$/.test(a) && parseInt(a) > 0 && parseInt(a) <= 100);
                if (parsedAmount && !amount) amount = parseInt(parsedAmount);

                const parsedFilter = args.find(a => ['human', 'bots', 'media'].includes(a.toLowerCase()));
                if (parsedFilter && filter === 'all') filter = parsedFilter.toLowerCase() as any;
            }
        }

        if (!amount || isNaN(amount)) {
            await ctx.reply({ content: 'Please provide a valid number of messages to delete (1-100).', ephemeral: true });
            return;
        }

        if (amount > 100) amount = 100;

        // Handle command message deletion for text commands
        if (!isInteraction && ctx.inner instanceof Message) {
            await ctx.inner.delete().catch(() => { });
        } else if (isInteraction) {
            await ctx.defer(true);
        }

        try {
            const fetchLimit = filter === 'all' ? amount : 100;

            const fetchOptions: any = { limit: fetchLimit };
            if (startAfter) fetchOptions.after = startAfter;
            if (endBefore) fetchOptions.before = endBefore;

            // Explicitly cast or handle the fetch result
            const fetchedMessages = await channel.messages.fetch(fetchOptions);
            const messages = fetchedMessages as unknown as Collection<string, Message<true>>;

            let toDelete = new Collection<string, Message>();

            if (filter === 'all') {
                toDelete = messages;
            } else if (filter === 'human') {
                toDelete = messages.filter(m => !m.author.bot);
            } else if (filter === 'bots') {
                toDelete = messages.filter(m => m.author.bot);
            } else if (filter === 'media') {
                toDelete = messages.filter(m => m.attachments.size > 0 || m.embeds.length > 0);
            }

            const deletionArray = Array.from(toDelete.values()).slice(0, amount);

            if (deletionArray.length === 0) {
                if (isInteraction) {
                    await ctx.reply({ content: `${CROSS} No messages found matching your criteria.` });
                } else {
                    const msg = await channel.send({ content: `${CROSS} No messages found matching your criteria.` });
                    setTimeout(() => msg.delete().catch(() => { }), 3000);
                }
                return;
            }

            const now = Date.now();
            const validDeletion = deletionArray.filter(m => now - m.createdTimestamp < 1209600000);
            const oldMessages = deletionArray.length - validDeletion.length;

            if (validDeletion.length > 0) {
                await channel.bulkDelete(validDeletion);
            }

            let replyText = `${TICK} Deleted **${validDeletion.length}** messages.${filter !== 'all' ? ` (Filter: ${filter})` : ''}`;
            if (oldMessages > 0) {
                replyText += `\n⚠️ Could not delete ${oldMessages} messages older than 14 days.`;
            }
            if (isInteraction) {
                await ctx.reply({ content: replyText });
            } else {
                // Original message is deleted, so we cannot Use ctx.reply (which does message.reply)
                // We must use channel.send
                const msg = await channel.send({ content: replyText });
                setTimeout(() => msg.delete().catch(() => { }), 3000);
            }

            // Log action
            // @ts-ignore
            await ModLogger.log(ctx.inner.guild!, ctx.inner.member.user as User, channel.toString(), 'Purge', null, {
                channel: channel.toString(),
                messages: validDeletion.length
            });

        } catch (error: any) {
            console.error('Purge error:', error);
            const content = `${CROSS} Failed to delete messages: ${error.message}`;
            if (isInteraction) {
                await ctx.reply({ content });
            } else {
                const msg = await channel.send({ content });
                setTimeout(() => msg.delete().catch(() => { }), 5000);
            }
        }
    }
};
