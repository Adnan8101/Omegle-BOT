#!/bin/bash

# run.sh - Build and deploy bot to PM2

BOT_NAME="omegle-bot"
BUILD_DIR="dist"

echo "🗑️  Deleting build directory..."
if [ -d "$BUILD_DIR" ]; then
    rm -rf "$BUILD_DIR"
    echo "✅ Build directory deleted"
else
    echo "ℹ️  No build directory to delete"
fi

echo ""
echo "🔨 Building project..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

echo "✅ Build completed successfully"
echo ""

# Deploy slash commands
echo "🔧 Registering slash commands..."
npm run deploy

if [ $? -ne 0 ]; then
    echo "❌ Command registration failed!"
    exit 1
fi

echo "✅ Slash commands registered"
echo ""

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo "❌ PM2 is not installed. Please install it with: npm install -g pm2"
    exit 1
fi

# Check if bot is already running in PM2
echo "🔍 Checking if $BOT_NAME is running in PM2..."
if pm2 list | grep -q "$BOT_NAME"; then
    echo "🔄 Bot is running, restarting..."
    pm2 restart "$BOT_NAME"
    echo "✅ Bot restarted successfully"
else
    echo "🚀 Starting bot with PM2..."
    pm2 start dist/index.js --name "$BOT_NAME"
    echo "✅ Bot started successfully"
fi

echo ""
echo "📊 PM2 Status:"
pm2 list
