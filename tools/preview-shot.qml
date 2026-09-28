// Renders a note through Model.previewHtml the way NotePreview does, offscreen,
// into a PNG: a quick look at the plugin preview without a shell.
//   QT_QPA_PLATFORM=offscreen /usr/lib/qt6/bin/qml tools/preview-shot.qml -- <note.md> <out.png> [width]
import QtQuick
import "../Model.mjs" as Model

Rectangle {
  id: root
  readonly property var args: Qt.application.arguments.slice(Qt.application.arguments.indexOf("--") + 1)
  width: Number(args[2] || 640)
  height: text.implicitHeight + 40
  color: "#1a1b26"

  function read(path) {
    var x = new XMLHttpRequest()
    x.open("GET", "file://" + path, false)
    x.send()
    return x.responseText
  }

  Text {
    id: text
    x: 20; y: 20
    width: root.width - 40
    textFormat: Text.RichText
    wrapMode: Text.Wrap
    color: "#a9b1d6"
    linkColor: "#7aa2f7"
    font.family: "sans-serif"
    font.pixelSize: 15
    text: Model.previewHtml(root.read(root.args[0]), {
      title: true, textColor: "#a9b1d6", mutedColor: "#565f89", linkColor: "#7aa2f7",
      background: "#1a1b26", codeBackground: "#262835", borderColor: "#3b3e52", fontSizePx: 15, monoFamily: "JetBrainsMono Nerd Font"
    })
  }

  Timer {
    interval: 300; running: true
    onTriggered: root.grabToImage(function (r) { r.saveToFile(root.args[1]); Qt.quit() })
  }
}
