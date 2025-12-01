#!/usr/bin/env sh
set -e

echo "Start server..."

echo "Running migrations..."
./node_modules/.bin/prisma migrate deploy
echo "Running migrations successful."

node --preserve-symlinks --preserve-symlinks-main -r tsconfig-paths/register dist/apps/api-server/main.js
