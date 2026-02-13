import { Client } from 'discord.js';
import { GiveawaySchedulerService } from './GiveawaySchedulerService';

let giveawayScheduler: GiveawaySchedulerService | null = null;

export function initializeGiveawaySystem(client: Client) {
    giveawayScheduler = new GiveawaySchedulerService(client);
    giveawayScheduler.start();
    console.log('[Giveaway] Scheduler started');
}

export function stopGiveawaySystem() {
    if (giveawayScheduler) {
        giveawayScheduler.stop();
        console.log('[Giveaway] Scheduler stopped');
    }
}

export function getGiveawayScheduler(): GiveawaySchedulerService | null {
    return giveawayScheduler;
}
