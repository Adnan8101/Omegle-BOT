#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '../src');

let filesModified = 0;
let changesCount = 0;

function processFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    let modified = content;
    let hasChanges = false;

    // Remove all .setColor() calls
    const setColorPattern = /\.setColor\([^)]*\)/g;
    const matches = content.match(setColorPattern);
    if (matches) {
        matches.forEach(match => {
            // Skip if it's a variable like .setColor(color) that might be dynamic
            if (!match.includes('color)') && !match.includes('Color)')) {
                modified = modified.replace(match, '');
                hasChanges = true;
                changesCount++;
                console.log(`   - Removed: ${match}`);
            }
        });
    }

    // Remove color properties in embed objects (but not CSS)
    const lines = modified.split('\n');
    const newLines = lines.map(line => {
        // Skip CSS files and HTML color properties
        if (line.includes('background-color:') || line.includes('border-color:') || 
            line.includes('color:') && (line.includes('#') || line.includes('rgb')) && 
            (line.includes('px') || line.includes('{') || line.includes('.'))) {
            return line;
        }
        
        // Remove embed color property
        if (/^\s*color:\s*0x[0-9A-Fa-f]+\s*,?\s*$/.test(line) ||
            /^\s*color:\s*['"`]#[0-9A-Fa-f]+['"`]\s*,?\s*$/.test(line)) {
            hasChanges = true;
            changesCount++;
            console.log(`   - Removed line: ${line.trim()}`);
            return '';
        }
        
        return line;
    });

    if (hasChanges) {
        // Remove empty lines that were created
        modified = newLines.filter((line, i) => {
            // Keep line if it's not empty, or if next line isn't also empty
            return line.trim() !== '' || (newLines[i + 1] && newLines[i + 1].trim() !== '');
        }).join('\n');
        
        fs.writeFileSync(filePath, modified, 'utf8');
        filesModified++;
        console.log(`✅ Modified: ${path.relative(SRC_DIR, filePath)}`);
    }
}

function walkDir(dir) {
    const files = fs.readdirSync(dir);

    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            walkDir(filePath);
        } else if (file.endsWith('.ts') && !file.includes('TranscriptGenerator')) {
            // Skip TranscriptGenerator as it has CSS colors
            processFile(filePath);
        }
    });
}

console.log('🔍 Scanning for embed colors...\n');
walkDir(SRC_DIR);

console.log('\n========================================');
console.log(`✅ Completed!`);
console.log(`📊 Files modified: ${filesModified}`);
console.log(`📊 Total changes: ${changesCount}`);
console.log('========================================\n');

if (filesModified === 0) {
    console.log('ℹ️  No embed colors found. All embeds are already colorless!');
}
