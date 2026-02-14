import { db } from '../../data/db';

export class VoiceChannelRoleService {
    /**
     * Add a voice channel to role mapping
     */
    async addMapping(guildId: string, channelId: string, roleId: string) {
        return await db.voiceChannelRole.upsert({
            where: {
                guild_id_channel_id: {
                    guild_id: guildId,
                    channel_id: channelId
                }
            },
            update: {
                role_id: roleId
            },
            create: {
                guild_id: guildId,
                channel_id: channelId,
                role_id: roleId
            }
        });
    }

    /**
     * Get all mappings for a guild
     */
    async getMappings(guildId: string) {
        return await db.voiceChannelRole.findMany({
            where: { guild_id: guildId },
            orderBy: { created_at: 'desc' }
        });
    }

    /**
     * Get mapping for a specific channel
     */
    async getMapping(guildId: string, channelId: string) {
        return await db.voiceChannelRole.findUnique({
            where: {
                guild_id_channel_id: {
                    guild_id: guildId,
                    channel_id: channelId
                }
            }
        });
    }

    /**
     * Remove a voice channel to role mapping
     */
    async removeMapping(guildId: string, channelId: string) {
        return await db.voiceChannelRole.delete({
            where: {
                guild_id_channel_id: {
                    guild_id: guildId,
                    channel_id: channelId
                }
            }
        });
    }

    /**
     * Remove mapping by ID
     */
    async removeMappingById(id: string) {
        return await db.voiceChannelRole.delete({
            where: { id }
        });
    }
}

export const voiceChannelRoleService = new VoiceChannelRoleService();
