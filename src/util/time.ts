export function parseSmartDuration(args: string[]): { durationSeconds: number | null, remainingArgs: string[] } {
    let totalSeconds = 0;
    const timeRegex = /^(\d+)([smhd])$/i;
    const timeSimpleRegex = /^(\d+)$/; // Assume minutes if just number? Or ignore? Mute command usually assumes minutes if just number but `5m` is clearer. 
    // User requested "1m 30s" or "1h30s".
    // 1h30s might be one token or splits?
    // "1h30s" regex: /(\d+)([smhd])/g matches multiple?

    // Strategy:
    // Iterate through args. If an arg matches specific time format, extract and remove it.
    // If it's ambiguous, assume it's part of reason unless strict flag?
    // User example: "idk 5m". "idk" is reason. "5m" is time.
    // User example: "1m 30s". Two tokens.

    const remainingArgs: string[] = [];
    let foundTime = false;

    for (const arg of args) {
        // Check for combined format like 1h30m
        // Regex to match "1h", "30m", "10s" consecutively
        // ^(?:(\d+)([smhd]))+$
        const complexMatch = arg.match(/^(?:(\d+)([smhd]))+$/i);

        if (complexMatch) {
            // It matches the structure. Need to parse all parts.
            const parts = arg.matchAll(/(\d+)([smhd])/gi);
            for (const part of parts) {
                const val = parseInt(part[1]);
                const unit = part[2].toLowerCase();
                if (unit === 's') totalSeconds += val;
                else if (unit === 'm') totalSeconds += val * 60;
                else if (unit === 'h') totalSeconds += val * 3600;
                else if (unit === 'd') totalSeconds += val * 86400;
            }
            foundTime = true;
            continue; // Consumed this arg
        }

        // Check simple format "5m"
        const simpleMatch = arg.match(/^(\d+)([smhd])$/i);
        if (simpleMatch) {
            const val = parseInt(simpleMatch[1]);
            const unit = simpleMatch[2].toLowerCase();
            if (unit === 's') totalSeconds += val;
            else if (unit === 'm') totalSeconds += val * 60;
            else if (unit === 'h') totalSeconds += val * 3600;
            else if (unit === 'd') totalSeconds += val * 86400;
            foundTime = true;
            continue;
        }

        // If just number? "mute @user 5 reason". 
        // Existing logic supported `parseInt(match[1])` then default 'm'.
        // Let's support strict number-only as minutes IF it's one of the args and we haven't found time yet?
        // But "reason 1" might trigger it.
        // Safer to require unit for mixed order.
        // BUT user might stick to "mute @user 5". 
        // Let's assume number-only is time ONLY if it is the FIRST argument (legacy support) OR if explicit unit is missing but it looks like time?
        // The user's request `idk 5m` has unit.
        // Let's stick to requiring unit for "smart scan".

        remainingArgs.push(arg);
    }

    return {
        durationSeconds: foundTime ? totalSeconds : null,
        remainingArgs
    };
}

export function parseTimeString(timeStr: string): number {
    let totalSeconds = 0;
    const parts = timeStr.matchAll(/(\d+)([smhd])/gi);
    let hasMatch = false;
    
    for (const part of parts) {
        hasMatch = true;
        const val = parseInt(part[1]);
        const unit = part[2].toLowerCase();
        if (unit === 's') totalSeconds += val;
        else if (unit === 'm') totalSeconds += val * 60;
        else if (unit === 'h') totalSeconds += val * 3600;
        else if (unit === 'd') totalSeconds += val * 86400;
    }
    
    if (!hasMatch) {
        throw new Error('Invalid time format. Use formats like: 1h, 24h, 7d, 1h30m, etc.');
    }
    
    return totalSeconds;
}
