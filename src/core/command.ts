import { PermissionResolvable } from 'discord.js';
import { Context } from './context';

export interface Command {
    name: string;
    description: string;
    category: string;
    syntax: string;
    example: string;
    permissions: PermissionResolvable[];
    modAction?: string; // Using string to avoid circular imports, validated against ModAction in implementation
    execute: (ctx: Context, args: string[]) => Promise<void>;
}
