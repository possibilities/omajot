#!/bin/sh
# Open a local file or folder from a note link with the desktop's opener
# (xdg-open, macOS open), only when it exists and is no program: no execute
# bit on a file, no .desktop file. Notes also come from other devices, agents
# and pasted pages. The plugin asks for a confirmation first.
#
#   tools/open-file.sh --check <path>   prints ok | missing | program, opens nothing
#   tools/open-file.sh <path>           checks again, then opens
check=""
[ "${1:-}" = "--check" ] && { check=1; shift; }
path=${1:-}
[ -n "$path" ] || { echo "usage: tools/open-file.sh [--check] <path>" >&2; exit 64; }

if [ ! -e "$path" ]; then
  verdict=missing
elif [ -d "$path" ]; then
  verdict=ok
elif [ ! -f "$path" ] || [ -x "$path" ]; then
  verdict=program
else
  case "$path" in *.desktop) verdict=program ;; *) verdict=ok ;; esac
fi

if [ -n "$check" ]; then
  echo "$verdict"
  exit 0
fi
[ "$verdict" = ok ] || { echo "open-file.sh: not opened ($verdict): $path" >&2; exit 1; }
if [ "$(uname -s)" = Darwin ]; then exec open "$path"; fi
exec xdg-open "$path"
