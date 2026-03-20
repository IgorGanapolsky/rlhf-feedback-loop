#!/bin/bash
# bin/memory.sh - Injects live git context into primer.md

PRIMER_FILE="primer.md"

if [ ! -f "$PRIMER_FILE" ]; then
  echo "Error: $PRIMER_FILE not found."
  exit 1
fi

echo "🤖 [Memory Stack] Injecting live Git context into $PRIMER_FILE..."

# Capture git context
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
LAST_COMMITS=$(git log -n 5 --oneline)
DIRTY_FILES=$(git status --short)

# Use a temporary file to rebuild the primer
TEMP_FILE=$(mktemp)

# Read primer until "## Live Git Context"
sed -n '1,/## Live Git Context/p' "$PRIMER_FILE" > "$TEMP_FILE"

# Append the live data
echo "" >> "$TEMP_FILE"
echo "### Branch: $CURRENT_BRANCH" >> "$TEMP_FILE"
echo "" >> "$TEMP_FILE"
echo "### Last 5 Commits:" >> "$TEMP_FILE"
echo '```' >> "$TEMP_FILE"
echo "$LAST_COMMITS" >> "$TEMP_FILE"
echo '```' >> "$TEMP_FILE"
echo "" >> "$TEMP_FILE"
echo "### Modified Files:" >> "$TEMP_FILE"
if [ -z "$DIRTY_FILES" ]; then
  echo "_None (Clean working tree)_" >> "$TEMP_FILE"
else
  echo '```' >> "$TEMP_FILE"
  echo "$DIRTY_FILES" >> "$TEMP_FILE"
  echo '```' >> "$TEMP_FILE"
fi

mv "$TEMP_FILE" "$PRIMER_FILE"
echo "✅ Done."
