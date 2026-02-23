#!/usr/bin/env bash
set -euo pipefail

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Not inside a git repository."
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree is not clean. Commit or stash changes first."
  exit 1
fi

branch="$(git branch --show-current)"
if [[ "${branch}" != "staging" ]]; then
  echo "Current branch is '${branch}'. Switch to 'staging' first."
  exit 1
fi

git fetch origin
git pull --ff-only origin staging
git push origin staging

echo "Staging branch pushed."
echo "Commit: $(git rev-parse --short HEAD)"
echo "Next: deploy staging VPS with scripts/deploy-staging.sh"
