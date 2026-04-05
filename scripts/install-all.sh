#!/usr/bin/env bash
set -euo pipefail

REPO="https://github.com/mikkelkrogsholm/skills"
RAW_BASE="https://raw.githubusercontent.com/mikkelkrogsholm/skills/main"

# Require curl
if ! command -v curl &>/dev/null; then
    echo "Error: curl is required" >&2
    exit 1
fi

# Pick a package runner (bunx preferred, falls back to npx)
if command -v bun &>/dev/null; then
    PKG_RUNNER="bunx"
elif command -v npx &>/dev/null; then
    PKG_RUNNER="npx --yes"
else
    echo "Error: bun or npx is required to install skills" >&2
    exit 1
fi

# Pick a JSON parser
JS_SNIPPET="
let d = '';
process.stdin.on('data', c => d += c).on('end', () => {
    const o = JSON.parse(d);
    for (const [name, info] of Object.entries(o.skills))
        if (info.sourceType === 'local') process.stdout.write(name + '\n');
});
"

if command -v python3 &>/dev/null; then
    parse_skills() {
        python3 -c "
import json, sys
data = json.load(sys.stdin)
for name, info in data['skills'].items():
    if info.get('sourceType') == 'local':
        print(name)
"
    }
elif command -v bun &>/dev/null; then
    parse_skills() { bun -e "$JS_SNIPPET"; }
elif command -v node &>/dev/null; then
    parse_skills() { node -e "$JS_SNIPPET"; }
else
    echo "Error: python3, bun, or node is required to parse the skill list" >&2
    exit 1
fi

echo "Fetching skill list..."
SKILLS=$(curl -fsSL "$RAW_BASE/skills-lock.json" | parse_skills)
TOTAL=$(echo "$SKILLS" | grep -c .)

echo "Installing $TOTAL skills from $REPO"
echo ""

# Build --skill flags for each skill
SKILL_FLAGS=()
for skill in $SKILLS; do
    SKILL_FLAGS+=(--skill "$skill")
done

echo "Installing $TOTAL skills: $(echo "$SKILLS" | tr '\n' ' ')"
echo ""
$PKG_RUNNER skills add "$REPO" "${SKILL_FLAGS[@]}"

echo ""
echo "Done. $TOTAL skills installed."
