#!/usr/bin/env bash
# Rebuilds the self-hosted font subsets in src/assets/fonts/ from the upstream
# release files (FELA-32). Run locally; fonttools is a one-off tool, not a
# project dependency (nothing here touches package.json).
#
# Usage:
#   python3 -m venv /tmp/fontsubset-venv && source /tmp/fontsubset-venv/bin/activate
#   pip install fonttools brotli
#   ./scripts/subset-fonts.sh <path-to-InterVariable.ttf> <path-to-JetBrainsMono-Regular.ttf>
#
# Source files (same versions committed in src/assets/fonts/):
#   Inter v4.1        https://github.com/rsms/inter/releases/download/v4.1/Inter-4.1.zip
#                      -> InterVariable.ttf
#   JetBrains Mono v2.304
#                      https://github.com/JetBrains/JetBrainsMono/releases/download/v2.304/JetBrainsMono-2.304.zip
#                      -> fonts/ttf/JetBrainsMono-Regular.ttf
#
# Subset coverage:
#   Inter: ASCII, NBSP, Cyrillic (ru UI copy), Russian typographic punctuation
#          (« » – — ‘ ’ “ ” …), middle dot, arrows (U+2190-2193, used literally
#          as glyphs in the shortcuts sheet and SegmentedControl copy — see
#          design-spec.md sections on keyboard navigation), and the
#          PriorityChip glyphs ▲ ■ ▼ (design-spec 3.9/3.12).
#   JetBrains Mono: ASCII, middle dot, arrows (U+2190-2193). Mono is used for
#          counters and <kbd> only (design-spec 3.9) — no Cyrillic prose is
#          ever set in it, but the shortcuts sheet renders `Ctrl/Cmd+↑` `↓` as
#          <kbd> labels, so the arrows are required here too.
set -euo pipefail

INTER_SRC="${1:?usage: subset-fonts.sh <InterVariable.ttf> <JetBrainsMono-Regular.ttf>}"
MONO_SRC="${2:?usage: subset-fonts.sh <InterVariable.ttf> <JetBrainsMono-Regular.ttf>}"
OUT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/src/assets/fonts"

INTER_UNICODES="U+0020-007E,U+00A0,U+00AB,U+00B7,U+00BB,U+0400-0479,U+0480-049D,U+04A0-04FF,U+2010-2015,U+2018-201E,U+2026,U+2190-2193,U+25A0,U+25B2,U+25BC"
MONO_UNICODES="U+0020-007E,U+00B7,U+2190-2193"

python3 -m fontTools.subset "$INTER_SRC" \
  --output-file="$OUT_DIR/InterVariable.woff2" \
  --flavor=woff2 \
  --unicodes="$INTER_UNICODES" \
  --layout-features='*'

python3 -m fontTools.subset "$MONO_SRC" \
  --output-file="$OUT_DIR/JetBrainsMono-Regular.woff2" \
  --flavor=woff2 \
  --unicodes="$MONO_UNICODES" \
  --layout-features='*'
