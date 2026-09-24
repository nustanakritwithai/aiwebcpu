#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

REPO="${PROJECT_BRAIN_REPO:-$HOME/aiwebcpu}"
DEST="${PROJECT_BRAIN_VAULT:-$HOME/storage/shared/ProjectBrain}"
REMOTE="${PROJECT_BRAIN_REMOTE:-origin}"
REF="${PROJECT_BRAIN_REF:-main}"
DO_FETCH=1

usage(){
  cat <<'EOF'
Usage: pb-sync [--no-fetch] [--repo PATH] [--vault PATH] [--ref REF]

Safely sync Project Brain from Git remote ref into the Obsidian vault.
The .obsidian directory is never removed or overwritten.

Environment overrides:
  PROJECT_BRAIN_REPO
  PROJECT_BRAIN_VAULT
  PROJECT_BRAIN_REMOTE
  PROJECT_BRAIN_REF
EOF
}

while (($#)); do
  case "$1" in
    --no-fetch) DO_FETCH=0; shift ;;
    --repo) REPO="$2"; shift 2 ;;
    --vault) DEST="$2"; shift 2 ;;
    --ref) REF="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
done

command -v git >/dev/null 2>&1 || { echo "git is required" >&2; exit 1; }
command -v tar >/dev/null 2>&1 || { echo "tar is required" >&2; exit 1; }
[[ -d "$REPO/.git" ]] || { echo "Git repo not found: $REPO" >&2; exit 1; }

if ((DO_FETCH)); then
  echo "→ Fetching $REMOTE/$REF..."
  git -C "$REPO" fetch --quiet "$REMOTE" "$REF"
fi

SOURCE_REF="$REMOTE/$REF"
git -C "$REPO" rev-parse --verify "$SOURCE_REF^{commit}" >/dev/null 2>&1 || {
  echo "Cannot resolve $SOURCE_REF" >&2
  exit 1
}

mkdir -p "$DEST"
[[ -d "$DEST" ]] || { echo "Cannot create vault: $DEST" >&2; exit 1; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "→ Exporting project-brain from $SOURCE_REF..."
git -C "$REPO" archive --format=tar "$SOURCE_REF" project-brain | tar -xf - -C "$TMP"
SRC="$TMP/project-brain"
[[ -f "$SRC/00-Home.md" ]] || { echo "Project Brain export is incomplete" >&2; exit 1; }

MANIFEST="$DEST/.pb-sync-manifest"

# Remove only paths previously managed by pb-sync. Never touch .obsidian.
if [[ -f "$MANIFEST" ]]; then
  while IFS= read -r name; do
    [[ -z "$name" || "$name" == ".obsidian" || "$name" == ".pb-sync-manifest" ]] && continue
    rm -rf -- "$DEST/$name"
  done < "$MANIFEST"
fi

NEW_MANIFEST="$TMP/manifest"
: > "$NEW_MANIFEST"

while IFS= read -r -d '' item; do
  name="$(basename "$item")"
  [[ "$name" == ".obsidian" || "$name" == ".pb-sync-manifest" ]] && continue
  cp -a -- "$item" "$DEST/$name"
  printf '%s\n' "$name" >> "$NEW_MANIFEST"
done < <(find "$SRC" -mindepth 1 -maxdepth 1 -print0)

cp "$NEW_MANIFEST" "$MANIFEST"

SHA="$(git -C "$REPO" rev-parse --short "$SOURCE_REF")"
printf '%s\n' "$SHA" > "$DEST/.pb-sync-source"

echo "✓ Project Brain synced"
echo "  Source: $SOURCE_REF @ $SHA"
echo "  Vault:  $DEST"
echo "  Preserved: $DEST/.obsidian"
