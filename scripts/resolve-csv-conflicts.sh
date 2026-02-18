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
  # Strip conflict markers, keep header + unique data rows sorted
  {
    echo "date,to_curr,provider,rate,markup"
    grep -v '^<<<<<<< \|^=======\|^>>>>>>> \|^date,to_curr,provider,rate,markup' "$f" \
      | sort -t, -k1,1 -k2,2 -k3,3 -u
  } > "${f}.resolved"

  mv "${f}.resolved" "$f"
  git add "$f"
  count=$((count + 1))
  echo "✓ $f"
done <<< "$conflicted"

echo ""
echo "Resolved $count CSV file(s). Run 'git merge --continue' to finish."
