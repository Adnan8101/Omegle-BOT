import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

export const openmailCommand = new SlashCommandBuilder()
    .setName('openmail')
    .setDescription('Open a support ticket')
    .addStringOption(opt => opt.setName('subject').setDescription('Ticket subject').setRequired(true));

export const closeCommand = new SlashCommandBuilder()
    .setName('close')
    .setDescription('Close the current ticket')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for closing'));

export const claimCommand = new SlashCommandBuilder()
    .setName('claim')
    .setDescription('Claim the current ticket')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

export const unclaimCommand = new SlashCommandBuilder()
    .setName('unclaim')
    .setDescription('Unclaim the current ticket')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

export const ticketpanelCommand = new SlashCommandBuilder()
    .setName('ticketpanel')
    .setDescription('Create a ticket panel')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export const claimedticketsCommand = new SlashCommandBuilder()
    .setName('claimedtickets')
    .setDescription('View all claimed tickets')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

export const inactivemailsCommand = new SlashCommandBuilder()
    .setName('inactivemails')
    .setDescription('List inactive tickets')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

export const ticketclearCommand = new SlashCommandBuilder()
    .setName('ticketclear')
    .setDescription('Clear closed tickets')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export const mailCommands = [
    openmailCommand, closeCommand, claimCommand, unclaimCommand,
    ticketpanelCommand, claimedticketsCommand, inactivemailsCommand, ticketclearCommand
];
