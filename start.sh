#!/bin/bash
cd "$(dirname "$0")"
echo "Starting Movie Watcher App..."
(cd server && npm run dev) &
(cd client && npm run dev) &
wait
