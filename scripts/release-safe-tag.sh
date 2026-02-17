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
timestamp="$(date +%Y%m%d-%H%M%S)"
tag="${1:-safe-${timestamp}}"

if git rev-parse -q --verify "refs/tags/${tag}" >/dev/null; then
  echo "Tag '${tag}' already exists. Use a different tag."
  exit 1
fi

git tag -a "${tag}" -m "Safe checkpoint from ${branch} at ${timestamp}"
git push origin "${tag}"

echo "Safe tag created and pushed: ${tag}"
echo "Branch: ${branch}"
echo "Commit: $(git rev-parse --short HEAD)"
