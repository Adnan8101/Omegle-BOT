import { REST, Routes } from 'discord.js';
import { config } from '../config/env';
import { stickyCommand } from './definitions/sticky';
import { modCommands } from './definitions/moderation';
import { afkCommands } from './definitions/afk';
import { mailCommands } from './definitions/mail';
import { adminCommands } from './definitions/admin';
import { utilityCommands } from './definitions/utility';
import { generalCommands } from './definitions/general';
import { giveawayCommands } from './giveaways';

// Collect giveaway command definitions
const giveawayCommandData = Object.values(giveawayCommands)
    .filter((cmd: any) => cmd.data)
    .map((cmd: any) => cmd.data.toJSON());

const commands = [
    stickyCommand.toJSON(),
    ...modCommands.map(c => c.toJSON()),
    ...afkCommands.map(c => c.toJSON()),
    ...mailCommands.map(c => c.toJSON()),
    ...adminCommands.map(c => c.toJSON()),
    ...utilityCommands.map(c => c.toJSON()),
    ...generalCommands.map(c => c.toJSON()),
    ...giveawayCommandData
];

const rest = new REST({ version: '10' }).setToken(config.DISCORD_TOKEN);

(async () => {
    try {
        console.log(`Started refreshing ${commands.length} application (/) commands.`);

        // Global registration
        const data = await rest.put(
            Routes.applicationCommands(config.CLIENT_ID || 'GET_CLIENT_ID_FROM_TOKEN_AUTOMATICALLY_IF_POSSIBLE_OR_ENV'),
            { body: commands },
        );

        console.log(`Successfully reloaded ${commands.length} application (/) commands.`);
    } catch (error) {
        console.error(error);
    }
})();
