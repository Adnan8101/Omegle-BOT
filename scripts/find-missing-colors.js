const fs = require('fs');
const { execSync } = require('child_process');

const files = execSync('find src -name "*.ts" -type f', { cwd: process.cwd() })
    .toString().trim().split('\n');

const results = [];

for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line.includes('new EmbedBuilder()')) continue;

        // Extract variable name
        const varMatch = line.match(/(?:const|let|var)\s+(\w+)\s*=\s*new\s+EmbedBuilder\(\)/);
        const returnMatch = line.match(/return\s+new\s+EmbedBuilder\(\)/);

        let hasSetColor = false;

        // Collect the chained statement block starting from this line
        let chainBlock = '';
        for (let k = i; k < Math.min(i + 30, lines.length); k++) {
            chainBlock += lines[k] + '\n';
            const trimmed = lines[k].trim();
            // End of chain: line ends with semicolon
            if (trimmed.endsWith(';')) break;
            // If we hit a new statement (not a chained method), stop
            if (k > i && !trimmed.startsWith('.') && !trimmed.startsWith('//')) {
                // Could be continuation of template literal or other - check if previous line ended with method call
                const prevTrimmed = lines[k-1] ? lines[k-1].trim() : '';
                if (!prevTrimmed.endsWith(',') && !prevTrimmed.endsWith('(') && !prevTrimmed.endsWith('+') && !prevTrimmed.endsWith('`')) {
                    break;
                }
            }
        }

        if (chainBlock.includes('.setColor(')) {
            hasSetColor = true;
        }

        // If variable assigned, also check for separate .setColor() calls on that variable
        if (!hasSetColor && varMatch) {
            const varName = varMatch[1];
            // Search the rest of the function scope (next 80 lines) for varName.setColor
            for (let k = i + 1; k < Math.min(i + 80, lines.length); k++) {
                if (lines[k].includes(varName + '.setColor(')) {
                    hasSetColor = true;
                    break;
                }
                // If we see the same variable reassigned, stop
                if (lines[k].match(new RegExp('(?:const|let|var)\\s+' + varName + '\\s*='))) {
                    break;
                }
            }
        }

        if (!hasSetColor) {
            // Collect snippet (up to 8 lines or until semicolon)
            let snippet = '';
            for (let k = i; k < Math.min(i + 8, lines.length); k++) {
                snippet += lines[k] + '\n';
                if (lines[k].trim().endsWith(';')) break;
            }
            results.push({
                file: file,
                line: i + 1,
                snippet: snippet.trimEnd()
            });
        }
    }
}

// Group by file for display
const grouped = {};
for (const r of results) {
    if (!grouped[r.file]) grouped[r.file] = [];
    grouped[r.file].push(r);
}

let total = 0;
for (const [file, items] of Object.entries(grouped)) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`FILE: ${file} (${items.length} missing)`);
    console.log('='.repeat(80));
    for (const item of items) {
        total++;
        console.log(`\n  Line ${item.line}:`);
        const snippetLines = item.snippet.split('\n');
        for (const sl of snippetLines) {
            console.log(`    ${sl}`);
        }
    }
}

console.log(`\n\n${'='.repeat(80)}`);
console.log(`TOTAL EMBEDS WITHOUT .setColor(): ${total}`);
console.log('='.repeat(80));
