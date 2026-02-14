import { Command } from '../core/command';
import { Ban } from './moderation/Ban';
import { Kick } from './moderation/Kick';
import { Warn } from './moderation/Warn';
import { Mute } from './moderation/Mute';
import { Unmute } from './moderation/Unmute';
import { Unban } from './moderation/Unban';
import { Reason } from './moderation/Reason';
import { Help } from './general/Help';
import { StickyCommand } from './sticky/StickyCommand';
import { DelCase } from './moderation/DelCase';
import { ModLeaderboard } from './moderation/ModLeaderboard';
import { ModLogs } from './moderation/ModLogs';
import { ModStats } from './moderation/ModStats';
import { Whois } from './moderation/Whois';
import { CaseInfo } from './moderation/CaseInfo';
import { Afk } from './afk/Afk';
import { AfkClear } from './afk/AfkClear';
import { AfkList } from './afk/AfkList';
import { AfkSettings } from './afk/AfkSettings';
import { Av } from './moderation/Av';
import { BanWord } from './moderation/BanWord';
import { CheckPerms } from './moderation/CheckPerms';
import { Dm } from './moderation/Dm';
import { Lock } from './moderation/Lock';
import { Unlock } from './moderation/Unlock';
import { Hide } from './moderation/Hide';
import { Unhide } from './moderation/Unhide';
import { Move } from './moderation/Move';
import { Purge } from './moderation/Purge';
import { RoleCommand } from './moderation/Role';
import { InRole } from './moderation/InRole';
import { AutoDrag } from './moderation/AutoDrag';
import { Steal } from './moderation/Steal';

import { SetupMail } from './admin/SetupMail';
import { DeleteSetup } from './admin/DeleteSetup';
import { CustomCommandManage } from './admin/CustomCommandManage';
import { ModRole } from './admin/ModRole';
import { StaffRole } from './admin/StaffRole';
import { WvAllowedRole } from './admin/WvAllowedRole';
import { ModSafety } from './admin/ModSafety';
import { SafetyAdmin } from './admin/SafetyAdmin';
import { EmergencyMode } from './admin/EmergencyMode';
import { SrModRole } from './admin/SrModRole';
import { ModLogSetup } from './admin/ModLogSetup';
import { OpenMail } from './mail/OpenMail';
import { Close } from './mail/Close';
import { Claim } from './mail/Claim';
import { Unclaim } from './mail/Unclaim';
import { TicketPanel } from './mail/TicketPanel';
import { ClaimedTickets } from './mail/ClaimedTickets';
import { InactiveMails } from './mail/InactiveMails';
import { VCLogs } from './moderation-utils/VCLogs';
import { CLogs } from './moderation-utils/CLogs';
import { TicketClear } from './mail/TicketClear';
import { WhereVoice } from './utility/WhereVoice';
import { SuggestionConfig } from './admin/SuggestionConfig';
import { SuggestionReset } from './admin/SuggestionReset';
import { SuggestionManage } from './moderation/SuggestionManage';
import { SuggestionAction } from './moderation/SuggestionAction';
import { ModCooldown } from './admin/ModCooldown';
import { Manuals } from './moderation/Manuals';
import { EditManual } from './moderation/EditManual';
import { DeleteManual } from './moderation/DeleteManual';
import { ManualLogsChannel } from './admin/ManualLogsChannel';

// Sticky subcommands
import { StickyAdd } from './sticky/StickyAdd';
import { StickyEdit } from './sticky/StickyEdit';
import { StickyRemove } from './sticky/StickyRemove';
import { StickyList } from './sticky/StickyList';
import { StickyEnable } from './sticky/StickyEnable';
import { StickyDisable } from './sticky/StickyDisable';
import { StickyCooldown } from './sticky/StickyCooldown';

export const CommandRegistry: Record<string, Command> = {
    // Moderation Commands
    'ban': Ban,
    'kick': Kick,
    'warn': Warn,
    'mute': Mute,
    'unmute': Unmute,
    'unban': Unban,
    'reason': Reason,
    'delcase': DelCase,
    'modleaderboard': ModLeaderboard,
    'modlogs': ModLogs,
    'modstats': ModStats,
    'whois': Whois,
    'w': Whois,
    'caseinfo': CaseInfo,
    'av': Av,
    'banword': BanWord,
    'checkperms': CheckPerms,
    'dm': Dm,
    'lock': Lock,
    'unlock': Unlock,
    'hide': Hide,
    'unhide': Unhide,
    'move': Move,
    'mv': Move,
    'purge': Purge,
    'clear': Purge,
    'role': RoleCommand,
    'inrole': InRole,
    'ad': AutoDrag,
    'autodrag': AutoDrag,
    'steal': Steal,

    // AFK Commands
    'afk': Afk,
    'afkclear': AfkClear,
    'afklist': AfkList,
    'afksettings': AfkSettings,

    // Admin Commands
    'setupmail': SetupMail,
    'deletesetup': DeleteSetup,
    'cc': CustomCommandManage,
    'modrole': ModRole,
    'staffrole': StaffRole,
    'wv_allowed_role': WvAllowedRole,
    'modsafety': ModSafety,
    'safetyadmin': SafetyAdmin,
    'emergency': EmergencyMode,
    'srmodrole': SrModRole,
    'modlogsetup': ModLogSetup,

    // Mail Commands
    'openmail': OpenMail,
    'close': Close,
    'claim': Claim,
    'unclaim': Unclaim,
    'ticketpanel': TicketPanel,
    'claimedtickets': ClaimedTickets,
    'inactivemails': InactiveMails,
    'ticket-clear': TicketClear,

    // Utility Commands
    'vclogs': VCLogs,
    'clogs': CLogs,
    'wv': WhereVoice,

    // Suggestion System
    'suggestionconfig': SuggestionConfig,
    'suggestion_reset': SuggestionReset,
    'suggestion': SuggestionAction,
    'suggestion_action': SuggestionAction,
    'cooldown': ModCooldown,

    // Manual System
    'manuals': Manuals,
    'edit-manual': EditManual,
    'editmanual': EditManual,
    'delete-manual': DeleteManual,
    'deletemanual': DeleteManual,
    'manual-logs-channel': ManualLogsChannel,
    'manuallogschannel': ManualLogsChannel,

    // Sticky Commands (Main + Subcommands for Help display)
    'sticky': StickyCommand,
    'sticky-add': {
        name: 'sticky add',
        description: 'Create a new sticky message in the current channel',
        category: 'Sticky',
        syntax: 'sticky add <content>',
        example: 'sticky add Welcome to our server!',
        permissions: [],
        execute: StickyAdd
    },
    'sticky-edit': {
        name: 'sticky edit',
        description: 'Edit the existing sticky message in the current channel',
        category: 'Sticky',
        syntax: 'sticky edit <content>',
        example: 'sticky edit Updated message',
        permissions: [],
        execute: StickyEdit
    },
    'sticky-remove': {
        name: 'sticky remove',
        description: 'Remove the sticky message from the current channel',
        category: 'Sticky',
        syntax: 'sticky remove',
        example: 'sticky remove',
        permissions: [],
        execute: StickyRemove
    },
    'sticky-list': {
        name: 'sticky list',
        description: 'List all sticky messages in this server',
        category: 'Sticky',
        syntax: 'sticky list',
        example: 'sticky list',
        permissions: [],
        execute: StickyList
    },
    'sticky-enable': {
        name: 'sticky enable',
        description: 'Enable the sticky message in the current channel',
        category: 'Sticky',
        syntax: 'sticky enable',
        example: 'sticky enable',
        permissions: [],
        execute: StickyEnable
    },
    'sticky-disable': {
        name: 'sticky disable',
        description: 'Disable the sticky message in the current channel',
        category: 'Sticky',
        syntax: 'sticky disable',
        example: 'sticky disable',
        permissions: [],
        execute: StickyDisable
    },
    'sticky-cooldown': {
        name: 'sticky cooldown',
        description: 'Set the cooldown for the sticky message in seconds',
        category: 'Sticky',
        syntax: 'sticky cooldown <seconds>',
        example: 'sticky cooldown 60',
        permissions: [],
        execute: StickyCooldown
    },

    // Help Command
    'help': {
        name: 'help',
        description: 'Show help information',
        category: 'General',
        syntax: 'help [command]',
        example: 'help ban',
        permissions: ['ManageMessages'],
        execute: Help
    }
};
