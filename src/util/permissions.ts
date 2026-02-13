import { PermissionResolvable, PermissionsBitField } from 'discord.js';

export function hasPermission(userPerms: any, requiredPerm: PermissionResolvable): boolean {
    const userBitField = new PermissionsBitField(userPerms);
    return userBitField.has(requiredPerm);
}
