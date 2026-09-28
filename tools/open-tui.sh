#!/bin/bash
# Open `omajot tui` in the default terminal, popped out like Super+O
# (tools/omarchy-pop.sh). A TUI window that is open already gets the focus.
# The plugin runs this for its terminal button, with its own binary and data
# folder, so the TUI talks to the plugin's daemon.
#
#   tools/open-tui.sh <omajot binary> <data dir>
set -u

bin=${1:-}
data=${2:-}
[[ -x $bin && -n $data ]] || { echo "usage: tools/open-tui.sh <omajot binary> <data dir>" >&2; exit 64; }

app_id=io.github.renerocksai.omajot.tui
here=$(dirname "$0")

if command -v omarchy-launch-tui >/dev/null; then
  launch=(omarchy-launch-tui --app-id="$app_id" "$bin" tui --data "$data")
else
  launch=(setsid xdg-terminal-exec --app-id="$app_id" -e "$bin" tui --data "$data")
fi
exec "$here/omarchy-pop.sh" "^${app_id//./\\.}\$" "${launch[@]}"
