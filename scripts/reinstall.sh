#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

FRESH=false
for arg in "$@"; do
  case "$arg" in
    -f|--fresh)
      FRESH=true
      ;;
    -h|--help)
      echo "Usage: ./scripts/reinstall.sh [--fresh]"
      echo "  -f, --fresh   Hapus juga bun.lock dan bersihkan cache Bun"
      exit 0
      ;;
  esac
done

echo "Menghapus semua node_modules di $ROOT_DIR..."
find "$ROOT_DIR" -name "node_modules" -type d -prune -exec rm -rf '{}' +

if [ "$FRESH" = true ]; then
  echo "Menghapus bun.lock dan membersihkan cache Bun..."
  rm -f "$ROOT_DIR/bun.lock"
  bun pm cache rm
fi

echo "Menjalankan bun install..."
bun install

echo "Selesai! Semua dependency berhasil di-reinstall."
