#!/bin/bash
# Open the omajot web app in an Omarchy web app window, popped out like
# Super+O (floating, 1300x900, centred, pinned). A window that is open
# already gets the focus instead. The plugin runs this for its web app button.
#
#   tools/open-webapp.sh <hub url>
#
# The window comes from omarchy-launch-webapp (the default browser in app
# mode). Chromium-based browsers name an app window's class after the URL:
# https://host:8443/ -> chrome-host__-Default (brave-…, msedge-… for others).
set -u

url=${1:-}
[[ $url == http://* || $url == https://* ]] || { echo "usage: tools/open-webapp.sh <hub url>" >&2; exit 64; }

host=${url#*://}
host=${host%%/*}
host=${host%%:*}
# The class for the root path: "<browser>-<host>__-<profile>".
pattern="-${host//./\\.}__-"

find_window() {
  hyprctl clients -j | jq -r --arg re "$pattern" '[.[] | select(.class | test($re))][0].address // empty'
}

dispatch() { hyprctl dispatch "$1" >/dev/null; }

addr=$(find_window)
if [[ -n $addr ]]; then
  dispatch "hl.dsp.focus({ window = \"address:$addr\" })"
  exit 0
fi

if command -v omarchy-launch-webapp >/dev/null; then
  omarchy-launch-webapp "$url" >/dev/null 2>&1 &
else
  exec xdg-open "$url"
fi

# Wait for the window (a cold browser start can take a few seconds).
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
