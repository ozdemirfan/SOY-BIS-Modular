#!/usr/bin/env bash
# Single script for cPanel Git deploy (one shell session; env vars between .cpanel.yml tasks may not persist).
# Adjust REPOPATH/DEPLOYPATH if your hosting user or clone directory differs.
set -euo pipefail

REPOPATH=/home/u2626680/repositories/SOY-BIS-Modular
DEPLOYPATH=/home/u2626680/public_html/

cd "$REPOPATH"

# Node.js: nvm (common on cPanel SSH) or cPanel EasyApache NodeJS binaries
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [[ -s "$NVM_DIR/nvm.sh" ]]; then
  # shellcheck disable=SC1090
  source "$NVM_DIR/nvm.sh"
  nvm use 18 >/dev/null 2>&1 || nvm use 20 >/dev/null 2>&1 || nvm use node >/dev/null 2>&1 || true
fi
if ! command -v node >/dev/null 2>&1; then
  for p in /opt/cpanel/ea-nodejs20/bin /opt/cpanel/ea-nodejs18/bin /opt/cpanel/ea-nodejs16/bin; do
    if [[ -x "$p/node" ]]; then
      export PATH="$p:$PATH"
      break
    fi
  done
fi
if ! command -v node >/dev/null 2>&1; then
  echo "cpanel-deploy: Node.js not found. Install Node (cPanel 'Setup Node.js App', EasyApache, or nvm)." >&2
  exit 1
fi

npm ci
npm run build

# First deploy only: create api/config.php from example (gitignored). Edit MySQL credentials afterward.
if [[ ! -f api/config.php ]]; then
  cp api/config.example.php api/config.php
fi

/bin/mkdir -p "$DEPLOYPATH"
# Copy Vite output (contents of dist/, including hidden files if any)
/bin/cp -R "$REPOPATH/dist/." "$DEPLOYPATH"
/bin/cp -R "$REPOPATH/api" "$DEPLOYPATH"
