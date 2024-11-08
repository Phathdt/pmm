#!/usr/bin/env bash

echo "Start server..."

yarn prisma migrate dev

node main.js
