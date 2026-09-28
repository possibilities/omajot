import QtQuick
import Quickshell
import qs.Commons
import "../Model.mjs" as Model

// Rendered markdown for one note, with the web app's renderer (Model.previewHtml):
// text in a proportional font, code in the bar's monospace font. Images are
// lifted into their own segments and drawn by Image items (Qt's rich text
// paints nothing for file:// images in the shell); task boxes are
// `task:<line>` links that ask the owner to toggle the checkbox in the source.
Flickable {
  id: root

  property string text: ""
  property string dataDir: ""
  // Changes when an attachment finishes downloading; a new URL makes Qt load
  // an image again instead of keeping a failed load.
  property int reloadStamp: 0
  property color foreground: Color.foreground
  property color accent: Color.accent
  property color background: Color.background
  property color muted: Color.muted
  // Code and the checkbox glyphs; the text uses the proportional font.
  property string fontFamily: Style.font.family
  property string proseFamily: "sans-serif"
  property real fontSize: Style.font.bodySmall

  signal taskToggled(int line)

  function hexOf(colour) {
    function channel(value) { return ("0" + Math.round(value * 255).toString(16)).slice(-2) }
    return "#" + channel(colour.r) + channel(colour.g) + channel(colour.b)
  }

  readonly property var segments: Model.splitPreview(root.text, root.dataDir)
  readonly property var styling: ({
    linkColor: hexOf(root.accent),
    textColor: hexOf(root.foreground),
    mutedColor: hexOf(root.muted),
    background: hexOf(root.background),
    codeBackground: hexOf(Qt.tint(root.background, Qt.rgba(root.foreground.r, root.foreground.g, root.foreground.b, 0.08))),
    borderColor: hexOf(Qt.tint(root.background, Qt.rgba(root.foreground.r, root.foreground.g, root.foreground.b, 0.22))),
    fontSizePx: Math.round(root.fontSize * 1.1),
    monoFamily: root.fontFamily
  })

  function segmentHtml(segment, index) {
    var options = Object.assign({}, root.styling)
    options.startLine = segment.line
    options.title = index === 0 && segment.line === 0
    return Model.previewHtml(segment.text, options)
  }

  contentWidth: width
  contentHeight: column.implicitHeight
  clip: true
  boundsBehavior: Flickable.StopAtBounds
  interactive: contentHeight > height

  function scrollBy(panes) {
    var limit = Math.max(0, contentHeight - height)
    contentY = Math.max(0, Math.min(limit, contentY + height * panes))
  }

  Column {
    id: column
    width: root.width
    spacing: Style.space(8)

    Repeater {
      model: root.segments

      delegate: Item {
        id: segment
        required property var modelData
        required property int index
        readonly property bool isImage: segment.modelData.kind === "image"

        width: column.width
        implicitHeight: segment.isImage
          ? Math.max(segmentImage.height, segmentNotice.visible ? segmentNotice.implicitHeight : 0)
          : segmentText.implicitHeight
        height: implicitHeight

        Text {
          id: segmentText
          visible: !segment.isImage
          width: parent.width
          text: segment.isImage ? "" : root.segmentHtml(segment.modelData, segment.index)
          textFormat: Text.RichText
          color: root.foreground
          linkColor: root.accent
          font.family: root.proseFamily
          font.pixelSize: root.fontSize
          wrapMode: Text.Wrap
          onLinkActivated: function(link) {
            var line = Model.taskLine(link)
            if (line >= 0) {
              root.taskToggled(line)
              return
            }
            var url = Model.externalLinkUrl(link)
            if (url !== "") Quickshell.execDetached(["xdg-open", url])
          }
          HoverHandler {
            cursorShape: segmentText.hoveredLink !== "" ? Qt.PointingHandCursor : Qt.ArrowCursor
          }
        }

        Image {
          id: segmentImage
          visible: segment.isImage && status === Image.Ready
          source: segment.isImage ? segment.modelData.url + (root.reloadStamp > 0 ? "?v=" + root.reloadStamp : "") : ""
          asynchronous: true
          fillMode: Image.PreserveAspectFit
          width: implicitWidth > 0 ? Math.min(implicitWidth, parent.width) : 0
          height: implicitWidth > 0 ? Math.round(implicitHeight * (width / implicitWidth)) : 0
          // A decode bound, not a display size (see omajop).
          sourceSize.width: Model.MAX_IMAGE_PIXELS_PER_SIDE
          sourceSize.height: Model.MAX_IMAGE_PIXELS_PER_SIDE
          mipmap: true
          smooth: true
        }

        Text {
          id: segmentNotice
          visible: segment.isImage && segmentImage.status === Image.Error
          width: parent.width
          text: "Missing image" + (segment.isImage && segment.modelData.title ? ": " + segment.modelData.title : "")
          textFormat: Text.PlainText
          color: Qt.darker(root.foreground, 1.5)
          font.family: root.fontFamily
          font.pixelSize: Style.font.caption
          wrapMode: Text.WordWrap
        }
      }
    }
  }
}
