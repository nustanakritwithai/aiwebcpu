#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SYNC="$SCRIPT_DIR/sync-to-obsidian.sh"
BIN="${PREFIX:-/data/data/com.termux/files/usr}/bin/pb-sync"

[[ -x "$SYNC" ]] || chmod +x "$SYNC"

printf '#!/data/data/com.termux/files/usr/bin/bash\nexec %q "$@"\n' "$SYNC" > "$BIN"
chmod +x "$BIN"

echo "✓ Installed: $BIN"
echo "Run anywhere with: pb-sync"

if [[ "${1:-}" != "--install-only" ]]; then
  "$BIN"
fi
