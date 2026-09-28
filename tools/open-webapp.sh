#!/bin/bash
# Open the omajot web app in an Omarchy web app window, popped out like
# Super+O (tools/omarchy-pop.sh). A window that is open already gets the focus
# instead. The plugin runs this for its web app button.
#
#   tools/open-webapp.sh <hub url>
#
# The window comes from omarchy-launch-webapp (the default browser in app
# mode). Chromium-based browsers name an app window's class after the URL:
# https://host:8443/ -> chrome-host__-Default (brave-…, msedge-… for others).
set -u

url=${1:-}
[[ $url == http://* || $url == https://* ]] || { echo "usage: tools/open-webapp.sh <hub url>" >&2; exit 64; }
command -v omarchy-launch-webapp >/dev/null || exec xdg-open "$url"

host=${url#*://}
host=${host%%/*}
host=${host%%:*}
# The class for the root path: "<browser>-<host>__-<profile>".
exec "$(dirname "$0")/omarchy-pop.sh" "-${host//./\\.}__-" omarchy-launch-webapp "$url"
