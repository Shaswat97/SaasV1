#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/presentrag"
APP_NAME="presentrag"

cd "$APP_DIR"

git fetch origin
git checkout main
git pull

npm install
npm run build

pm2 restart "$APP_NAME" --update-env || pm2 start npm --name "$APP_NAME" -- start
pm2 save
