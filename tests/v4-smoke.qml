// Loads Model.mjs in Qt's own JS engine (V4), which lacks some syntax node
// accepts (\p{…} escapes, for one). Run: tools/v4-smoke.sh
import QtQuick
import "../Model.mjs" as Model

QtObject {
  Component.onCompleted: {
    var failures = []
    function check(name, got, want) {
      if (JSON.stringify(got) !== JSON.stringify(want)) failures.push(name + ": " + JSON.stringify(got))
    }
    check("tags", Model.extractTags("#Work #grüße `#no` #end-"), ["end", "grüße", "work"])
    check("prefix", Model.tagPrefixAt("see #pro", 8), "pro")
    check("diff", Model.diffText("aa", "aaa", 1), { pos: 0, del: 0, ins: "a" })
    var doc = Model.newDoc("n", "ab", 0, 0)
    Model.docApplyLocal(doc, { pos: 1, del: 0, ins: "L" }, 0)
    check("patch", Model.docApplyPatch(doc, { base: 0, pseq: 1, pos: 1, del: 0, ins: "P" }).pieces, [{ pos: 1, del: 0, ins: "P" }])
    check("tie", doc.text, "aPLb")
    check("split", Model.xformPrim(Model.insPrim(3, "X", 0), Model.delPrim(1, 4, 7), false).b.length, 2)
    check("preview", Model.splitPreview("- [ ] a", "/d")[0], { kind: "text", text: "- [ ] a", line: 0 })
    // The web renderer in V4: tags (no \\p{L} there), table cells (no lookbehind), tasks.
    var html = Model.previewHtml("T\n\n#grüße x\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n- [ ] t", { title: true })
    check("preview tag", html.indexOf(">#grüße</span>") > 0, true)
    check("preview table", html.indexOf(">a</th><th") > 0, true)
    check("preview task", html.indexOf('href="task:8"') > 0, true)
    check("format", Model.formatUpdated(Date.now() - 120000, Date.now()), "2m ago")
    check("glyph", Model.GLYPH.pin.charCodeAt(0), 0xf08d)
    console.log(failures.length === 0 ? "V4 SMOKE PASS" : "V4 SMOKE FAIL " + failures.join(" | "))
    Qt.exit(failures.length === 0 ? 0 : 1)
  }
}
