#!/bin/bash

# Script to remove all black embed colors and commit to git

echo "🎨 Removing all black embed colors..."
echo ""

node scripts/remove-embed-colors.js

if [ $? -ne 0 ]; then
    echo "❌ Failed to remove colors!"
    exit 1
fi

echo ""
echo "📝 Checking git status..."

# Check if there are any changes
if ! git diff --quiet; then
    echo "✅ Changes detected"
    echo ""
    echo "📦 Adding files to git..."
    git add .
    
    echo "💾 Committing changes..."
    git commit -m "style: remove black embed colors, make embeds colorless"
    
    echo ""
    echo "🚀 Pushing to remote..."
    git push
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ Successfully pushed changes!"
    else
        echo ""
        echo "⚠️  Push failed. You may need to push manually."
        exit 1
    fi
else
    echo "ℹ️  No changes to commit"
fi

echo ""
echo "✨ Done!"
