#!/usr/bin/env bash
# Rebuilds the self-hosted font subsets in src/assets/fonts/ from the upstream
# release files (FELA-32). Run locally; fonttools is a one-off tool, not a
# project dependency (nothing here touches package.json).
#
# Usage:
#   python3 -m venv /tmp/fontsubset-venv && source /tmp/fontsubset-venv/bin/activate
#   pip install fonttools==4.67.0 brotli==1.2.0
#   ./scripts/subset-fonts.sh <path-to-InterVariable.ttf> <path-to-JetBrainsMono-Regular.ttf>
#
# brotli==1.2.0 is pinned because it supplies the woff2 compressor fontTools
# calls into — a different brotli build changes the output bytes even with
# the same fonttools version and inputs. Verified reproducible with this
# exact pin (FELA-37).
#
# Source files (same versions committed in src/assets/fonts/). Pinned sha256,
# verified byte-for-byte reproducible with fonttools==4.67.0 (FELA-35/FELA-37):
#   Inter v4.1        https://github.com/rsms/inter/releases/download/v4.1/Inter-4.1.zip
#                      sha256 9883fdd4a49d4fb66bd8177ba6625ef9a64aa45899767dde3d36aa425756b11e
#                      -> InterVariable.ttf
#                      sha256 4989b125924991b90d05b2d16e0e388c48f7d5bb8b30539bbf9c755278d0ccaf
#   JetBrains Mono v2.304
#                      https://github.com/JetBrains/JetBrainsMono/releases/download/v2.304/JetBrainsMono-2.304.zip
#                      sha256 6f6376c6ed2960ea8a963cd7387ec9d76e3f629125bc33d1fdcd7eb7012f7bbf
#                      -> fonts/ttf/JetBrainsMono-Regular.ttf
#                      sha256 a0bf60ef0f83c5ed4d7a75d45838548b1f6873372dfac88f71804491898d138f
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
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="$REPO_ROOT/src/assets/fonts"
MANIFEST="$OUT_DIR/SOURCES.sha256"

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

# Expected hashes live only in src/assets/fonts/SOURCES.sha256 (same file CI
# checks) so the pin can't silently drift between the script and the
# manifest. A mismatch here means the reproduction diverged from what was
# committed — wrong source TTF, wrong fonttools/brotli version, or a changed
# subset arg.
cd "$REPO_ROOT"
grep -E 'src/assets/fonts/.*\.woff2$' "$MANIFEST" | sha256sum -c -
