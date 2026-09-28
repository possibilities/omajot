#!/bin/bash
# Show a window popped out like Super+O (floating, 1300x900, centred,
# pinned): focus it when a window whose class matches is open already, else
# run the launch command, wait for its window and pop it out. The plugin's web
# app and terminal UI buttons use this (tools/open-webapp.sh, tools/open-tui.sh).
#
#   tools/omarchy-pop.sh <class regex> <command> [args...]
set -u

pattern=${1:-}
shift || true
[[ -n $pattern && $# -gt 0 ]] || { echo "usage: tools/omarchy-pop.sh <class regex> <command> [args...]" >&2; exit 64; }

find_window() {
  hyprctl clients -j | jq -r --arg re "$pattern" '[.[] | select(.class | test($re))][0].address // empty'
}

dispatch() { hyprctl dispatch "$1" >/dev/null; }

addr=$(find_window)
if [[ -n $addr ]]; then
  dispatch "hl.dsp.focus({ window = \"address:$addr\" })"
  exit 0
fi

"$@" >/dev/null 2>&1 &
disown

# Wait for the window (a cold start can take a few seconds).
for _ in $(seq 1 100); do
  addr=$(find_window)
  [[ -n $addr ]] && break
  sleep 0.1
done
[[ -n $addr ]] || exit 0

# The same steps as omarchy-hyprland-window-pop, on this window by address.
# float and pin toggle, so they run only when the window is not so already.
window="address:$addr"
state=$(hyprctl clients -j | jq -r --arg a "$addr" '.[] | select(.address == $a) | "\(.floating) \(.pinned)"')
[[ ${state% *} == true ]] || dispatch "hl.dsp.window.float({ window = \"$window\", action = \"toggle\" })"
dispatch "hl.dsp.window.resize({ window = \"$window\", x = 1300, y = 900 })"
dispatch "hl.dsp.window.center({ window = \"$window\" })"
[[ ${state#* } == true ]] || dispatch "hl.dsp.window.pin({ window = \"$window\" })"
dispatch "hl.dsp.window.alter_zorder({ window = \"$window\", mode = \"top\" })"
dispatch "hl.dsp.window.tag({ window = \"$window\", tag = \"+pop\" })"
