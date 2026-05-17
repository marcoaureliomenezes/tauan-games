#!/usr/bin/env bash
# lint-cesium-isolation.sh
#
# Enforces LD-15 / SPEC §10: only Source/AeroFightersGeoref/ may reference
# Cesium symbols. Run from the repository root.
#
# Exit codes:
#   0 — clean (or Source/ not present yet — vacuous pass)
#   1 — violations found

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SOURCE_DIR="$REPO_ROOT/aero-fighters-v2/Source"
ALLOWED_MODULE="AeroFightersGeoref"
ALLOWED_DIR="$SOURCE_DIR/$ALLOWED_MODULE"

# Vacuous-pass: Source/ not present yet (pre-Wave-2 state).
if [ ! -d "$SOURCE_DIR" ]; then
    echo "lint-cesium-isolation: SKIP (Source/ not present yet)"
    exit 0
fi

# Collect all .cpp / .h files outside the allowed module.
mapfile -t FILES < <(
    find "$SOURCE_DIR" -type f \( -name "*.cpp" -o -name "*.h" \) \
        | grep -v "^$ALLOWED_DIR/"
)

FILE_COUNT="${#FILES[@]}"
HITS=0

emit_error() {
    local file="$1"
    local line="$2"
    local match="$3"
    local rel="${file#$REPO_ROOT/}"
    echo "ERROR: ${rel}:${line}: Cesium symbol leaked outside ${ALLOWED_MODULE} — ${match}"
    if [ "${CI:-}" = "true" ]; then
        echo "::error file=${rel},line=${line}::Cesium symbol leaked outside ${ALLOWED_MODULE}"
    fi
}

if [ "$FILE_COUNT" -gt 0 ]; then
    # Pattern A: Cesium header include
    while IFS= read -r hit; do
        [ -z "$hit" ] && continue
        file="${hit%%:*}"
        rest="${hit#*:}"
        line="${rest%%:*}"
        match="${rest#*:}"
        emit_error "$file" "$line" "$match"
        HITS=$(( HITS + 1 ))
    done < <(
        grep -rn --include="*.cpp" --include="*.h" \
            -E '#include[[:space:]]+"Cesium' \
            "${FILES[@]}" 2>/dev/null || true
    )

    # Pattern B: UE5 UCLASS/ACLASS-style Cesium symbol reference
    while IFS= read -r hit; do
        [ -z "$hit" ] && continue
        file="${hit%%:*}"
        rest="${hit#*:}"
        line="${rest%%:*}"
        match="${rest#*:}"
        emit_error "$file" "$line" "$match"
        HITS=$(( HITS + 1 ))
    done < <(
        grep -rn --include="*.cpp" --include="*.h" \
            -E '\b[UA]Cesium[A-Z]' \
            "${FILES[@]}" 2>/dev/null || true
    )
fi

if [ "$HITS" -eq 0 ]; then
    echo "lint-cesium-isolation: OK (${FILE_COUNT} files scanned, 0 hits)"
    exit 0
else
    echo "lint-cesium-isolation: FAIL (${HITS} violation(s) found in ${FILE_COUNT} files scanned)"
    exit 1
fi
