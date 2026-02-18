#!/usr/bin/env bash
# Resolve merge conflicts in db/**/*.csv files by:
#   1. Stripping conflict markers (keeping both sides)
#   2. Deduplicating rows
#   3. Sorting by date, to_curr, provider
set -euo pipefail

conflicted=$(git diff --name-only --diff-filter=U -- 'db/*.csv' 'db/**/*.csv' 2>/dev/null || true)

if [ -z "$conflicted" ]; then
  echo "No conflicted CSV files found."
  exit 0
fi

count=0
while IFS= read -r f; do
  # Strip conflict markers, keep header + data rows sorted
  sorted=$(grep -v '^<<<<<<< \|^=======\|^>>>>>>> \|^date,to_curr,provider,rate,markup' "$f" \
    | sort -t, -k1,1 -k2,2 -k3,3)

  # Check for duplicate keys (date,to_curr,provider) with differing rate/markup
  dupes=$(echo "$sorted" | awk -F, '{key=$1","$2","$3} seen[key] && seen[key]!=$0 {print key" has conflicting values"; err=1} {seen[key]=$0} END {exit err?1:0}') || {
    echo "✗ $f — conflicting values for duplicate keys:"
    echo "$dupes"
    exit 1
  }

  {
    echo "date,to_curr,provider,rate,markup"
    echo "$sorted" | sort -t, -k1,1 -k2,2 -k3,3 -u
  } > "${f}.resolved"

  mv "${f}.resolved" "$f"
  git add "$f"
  count=$((count + 1))
  echo "✓ $f"
done <<< "$conflicted"

echo ""
echo "Resolved $count CSV file(s). Run 'git merge --continue' to finish."
