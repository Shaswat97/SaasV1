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

git fetch origin

current_branch="$(git branch --show-current)"

git checkout staging
git pull --ff-only origin staging

staging_commit="$(git rev-parse --short HEAD)"

git checkout main
git pull --ff-only origin main
git merge --ff-only staging
git push origin main

echo "Main promoted from staging."
echo "Staging commit: ${staging_commit}"
echo "Main commit: $(git rev-parse --short HEAD)"
echo "Next: deploy production VPS with scripts/deploy-prod.sh"

git checkout "${current_branch}" >/dev/null 2>&1 || true
