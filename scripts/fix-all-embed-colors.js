#!/usr/bin/env node
/**
 * Script to add .setColor(0x2b2d31) to all EmbedBuilder instances missing .setColor()
 * This fixes the black/default embed color issue across the entire codebase.
 */
const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '../src');
const DEFAULT_COLOR = '0x2b2d31';

let filesModified = 0;
let changesCount = 0;

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // Strategy: Find `new EmbedBuilder()` and check if `.setColor(` follows before the next `;` or variable assignment
    // We'll use a regex to find embed builder chains that are missing .setColor()

    // Pattern 1: `new EmbedBuilder()` followed by method chain WITHOUT .setColor()
    // We add .setColor() right after `new EmbedBuilder()`
    
    // First, find all new EmbedBuilder() occurrences
    const embedPattern = /new EmbedBuilder\(\)/g;
    let match;
    const positions = [];
    
    while ((match = embedPattern.exec(content)) !== null) {
        positions.push(match.index);
    }
    
    // Process in reverse order to preserve positions
    for (let i = positions.length - 1; i >= 0; i--) {
        const pos = positions[i];
        const afterEmbed = pos + 'new EmbedBuilder()'.length;
        
        // Look ahead to find the end of the chain (next semicolon or line with no chaining)
        // We need to check if .setColor() exists in the chain
        let searchEnd = Math.min(afterEmbed + 2000, content.length);
        let chainText = content.substring(afterEmbed, searchEnd);
        
        // Find the end of the builder chain
        // Chains typically end with a semicolon or when indentation breaks
        let depth = 0;
        let chainEnd = 0;
        for (let j = 0; j < chainText.length; j++) {
            const ch = chainText[j];
            if (ch === '(') depth++;
            else if (ch === ')') depth--;
            else if (ch === ';' && depth <= 0) {
                chainEnd = j;
                break;
            }
            // Also break on const/let/var/await/return/if/} at start of line
            if (j > 0 && chainText[j-1] === '\n') {
                const restLine = chainText.substring(j).trimStart();
                if (depth <= 0 && (
                    restLine.startsWith('const ') || 
                    restLine.startsWith('let ') || 
                    restLine.startsWith('var ') ||
                    restLine.startsWith('await ') ||
                    restLine.startsWith('return ') ||
                    restLine.startsWith('if ') ||
                    restLine.startsWith('} ') ||
                    restLine.startsWith('}') ||
                    restLine.startsWith('//') ||
                    restLine.startsWith('for ')
                )) {
                    chainEnd = j;
                    break;
                }
            }
        }
        
        if (chainEnd === 0) chainEnd = chainText.length;
        
        const chain = chainText.substring(0, chainEnd);
        
        // Check if .setColor( exists in the chain
        if (!chain.includes('.setColor(')) {
            // Add .setColor() right after new EmbedBuilder()
            // Check what comes right after - usually \n with whitespace + .
            const nextChars = content.substring(afterEmbed, afterEmbed + 50);
            
            if (nextChars.trimStart().startsWith('.')) {
                // There's a method chain, insert .setColor() before it
                // Find the position of the first dot
                const dotOffset = nextChars.indexOf('.');
                const insertPos = afterEmbed + dotOffset;
                
                // Get the indentation
                const lineStart = content.lastIndexOf('\n', pos);
                const currentLine = content.substring(lineStart + 1, pos);
                const indent = currentLine.match(/^(\s*)/)?.[1] || '            ';
                
                // Check if it's on same line or next line
                const beforeDot = nextChars.substring(0, dotOffset);
                if (beforeDot.includes('\n')) {
                    // Multi-line chain - insert on a new line
                    content = content.substring(0, insertPos) + 
                              `.setColor(${DEFAULT_COLOR})\n${indent}` + 
                              content.substring(insertPos);
                } else {
                    // Same line chain - add before next method
                    content = content.substring(0, afterEmbed) + 
                              `\n${indent}    .setColor(${DEFAULT_COLOR})` + 
                              content.substring(afterEmbed);
                }
            } else {
                // No chain, just append .setColor()
                content = content.substring(0, afterEmbed) + 
                          `.setColor(${DEFAULT_COLOR})` + 
                          content.substring(afterEmbed);
            }
            
            modified = true;
            changesCount++;
        }
    }
    
    if (modified) {
        fs.writeFileSync(filePath, content, 'utf8');
        filesModified++;
        console.log(`✅ Fixed: ${path.relative(SRC_DIR, filePath)} (${positions.length} embeds checked)`);
    }
}

function walkDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === 'node_modules' || entry.name === '.git') continue;
            walkDir(fullPath);
        } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.js')) {
            // Skip this script itself
            if (fullPath.includes('fix-all-embed-colors')) continue;
            processFile(fullPath);
        }
    }
}

console.log('🔧 Fixing embed colors across all source files...\n');
walkDir(SRC_DIR);
console.log(`\n📊 Done! Modified ${filesModified} files with ${changesCount} embeds fixed.`);
