// Under the hood: the animated illustrations. No dependencies.
// - [data-play]: gets the class "play" while it is on screen (CSS animations
//   run only then); a [data-replay] button inside restarts them.
// - svg[data-smil]: SMIL animations run only while the SVG is on screen.
// - #crdt-demo: a step-by-step walk through a concurrent edit.
// - #slots: the bounded connection slots, simulated.
// - #converge: four replicas that end with the same text.
// With "reduce motion" nothing moves by itself: the steppers still step.
(function () {
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  var onScreen = function (el, cb) {
    if (!('IntersectionObserver' in window)) return cb(true)
    new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { cb(e.isIntersecting) })
    }, { threshold: 0.35 }).observe(el)
  }

  // ---------------------------------------------------------------- CSS timelines
  document.querySelectorAll('[data-play]').forEach(function (el) {
    if (reduce) { el.classList.add('play', 'still'); return }
    var seen = false
    onScreen(el, function (v) {
      if (v && !seen) { seen = true; el.classList.add('play') }
      el.classList.toggle('paused', !v)
    })
    var btn = el.querySelector('[data-replay]')
    if (btn) btn.addEventListener('click', function () {
      el.classList.remove('play'); void el.offsetWidth; el.classList.add('play')
    })
  })

  // ---------------------------------------------------------------- SMIL
  document.querySelectorAll('svg[data-smil]').forEach(function (svg) {
    if (!svg.pauseAnimations) return
    svg.pauseAnimations()
    if (reduce) { svg.classList.add('still'); return }
    onScreen(svg, function (v) { v ? svg.unpauseAnimations() : svg.pauseAnimations() })
  })

  // ---------------------------------------------------------------- CRDT stepper
  var crdt = document.getElementById('crdt-demo')
  if (crdt) {
    // Items: [text, id, who, state]; who: L (laptop) or P (phone); state: '', 'new', 'dead', 'win'.
    var base = [['Buy·', '1–4 L', 'L', ''], ['milk', '5–8 L', 'L', '']]
    var oat = ['oat·', '9–12 L', 'L', ''], fresh = ['fresh·', '9–14 P', 'P', '']
    var mark = function (item, state) { return [item[0], item[1], item[2], state] }
    var steps = [
      { cap: 'Both devices have the same note. Every character has an id: a counter and the device that typed it. “Buy milk” came from the laptop: ids 1 to 8.',
        L: base, P: base, ops: '' },
      { cap: 'In a plane, the laptop types “oat ” after the space (id 4 L). At the same time, the phone types “fresh ” at the same place. Both take the next free counter: 9.',
        L: [base[0], mark(oat, 'new'), base[1]], P: [base[0], mark(fresh, 'new'), base[1]], ops: 'out' },
      { cap: 'The plane lands. Each device sends its operation to the hub and gets the other one. An operation names only its left neighbour: “insert after 4 L”.',
        L: [base[0], oat, base[1]], P: [base[0], fresh, base[1]], ops: 'cross' },
      { cap: 'Two inserts after the same character: the larger id goes first. The counters are equal (9), so the device id decides. Here the phone’s id is larger. Both devices get “Buy fresh oat milk”.',
        L: [base[0], mark(fresh, 'win'), mark(oat, 'new'), base[1]], P: [base[0], mark(fresh, 'win'), mark(oat, 'new'), base[1]], ops: '' },
      { cap: 'The phone deletes “oat ”. The characters stay in the sequence as a tombstone, so an insert that names them as its neighbour still finds its place.',
        L: [base[0], fresh, mark(oat, 'dead'), base[1]], P: [base[0], fresh, mark(oat, 'dead'), base[1]], ops: '' },
      { cap: 'The result is the same on every device, in whatever order the operations arrive. No conflict copies, no “which version do you want to keep?”.',
        L: [base[0], fresh, mark(oat, 'dead'), base[1]], P: [base[0], fresh, mark(oat, 'dead'), base[1]], ops: 'done' }
    ]
    var lanes = { L: crdt.querySelector('[data-lane="L"]'), P: crdt.querySelector('[data-lane="P"]') }
    var cap = crdt.querySelector('.cap'), dots = crdt.querySelector('.dots')
    var playBtn = crdt.querySelector('[data-act="play"]')
    var i = 0, timer = null
    steps.forEach(function (_, k) {
      var d = document.createElement('button')
      d.type = 'button'; d.setAttribute('aria-label', 'Step ' + (k + 1))
      d.addEventListener('click', function () { stop(); show(k) })
      dots.appendChild(d)
    })
    function render(lane, items) {
      lane.innerHTML = items.map(function (it) {
        return '<span class="tile ' + it[2] + ' ' + it[3] + '"><b>' + it[0] + '</b><i>' + it[1] + '</i></span>'
      }).join('')
    }
    function show(k) {
      i = (k + steps.length) % steps.length
      var s = steps[i]
      render(lanes.L, s.L); render(lanes.P, s.P)
      cap.textContent = (i + 1) + ' / ' + steps.length + ' · ' + s.cap
      crdt.dataset.ops = s.ops
      dots.querySelectorAll('button').forEach(function (d, j) { d.classList.toggle('on', j === i) })
    }
    function stop() { clearInterval(timer); timer = null; playBtn.textContent = '▶ Play' }
    function play() {
      if (timer) return stop()
      playBtn.textContent = '❚❚ Pause'
      timer = setInterval(function () { show(i + 1) }, 4200)
    }
    crdt.querySelector('[data-act="prev"]').addEventListener('click', function () { stop(); show(i - 1) })
    crdt.querySelector('[data-act="next"]').addEventListener('click', function () { stop(); show(i + 1) })
    playBtn.addEventListener('click', play)
    show(0)
    if (!reduce) {
      var started = false
      onScreen(crdt, function (v) {
        if (v && !started) { started = true; play() }
        if (!v && timer) stop()
      })
    }
  }

  // ---------------------------------------------------------------- bounded slots
  var slots = document.getElementById('slots')
  if (slots) {
    var n = +slots.dataset.connections || 24
    var grid = slots.querySelector('.grid-slots'), queue = slots.querySelector('.queue')
    var busyOut = slots.querySelector('[data-busy]'), waitOut = slots.querySelector('[data-wait]')
    var cells = []
    for (var c = 0; c < n; c++) {
      var cell = document.createElement('span')
      cell.innerHTML = '<i></i><i></i>'
      grid.appendChild(cell); cells.push({ el: cell, left: 0 })
    }
    var waiting = 0, tick = 0, simTimer = null
    function step() {
      tick++
      // Load comes in waves: calm, then a burst that fills every slot.
      var burst = (tick % 60) > 38 && (tick % 60) < 50
      var arrivals = burst ? 4 : (Math.random() < 0.55 ? 1 : 0)
      waiting = Math.min(waiting + arrivals, 12)
      cells.forEach(function (s) {
        if (s.left > 0 && --s.left === 0) s.el.classList.remove('busy')
      })
      var free = cells.filter(function (s) { return s.left === 0 })
      while (waiting > 0 && free.length) {
        var s = free.splice(Math.floor(Math.random() * free.length), 1)[0]
        waiting--; s.left = 3 + Math.floor(Math.random() * 8); s.el.classList.add('busy')
      }
      var busy = cells.filter(function (s) { return s.left > 0 }).length
      busyOut.textContent = busy
      waitOut.textContent = waiting
      queue.style.setProperty('--wait', waiting)
      slots.classList.toggle('full', busy === n)
    }
    if (reduce) {
      for (var r = 0; r < 44; r++) step()
    } else {
      onScreen(slots, function (v) {
        if (v && !simTimer) simTimer = setInterval(step, 260)
        if (!v && simTimer) { clearInterval(simTimer); simTimer = null }
      })
    }
  }

  // ---------------------------------------------------------------- convergence
  var conv = document.getElementById('converge')
  if (conv) {
    var rows = conv.querySelectorAll('.rep')
    var width = 18, palette = ['a', 'b', 'c', 'd', 'e']
    var target = []
    // A fixed, irregular "text": the same on every replica at the end.
    var seed = 7
    for (var t = 0; t < width; t++) { seed = (seed * 1103515245 + 12345) % 2147483648; target.push(palette[seed % palette.length]) }
    rows.forEach(function (row) {
      for (var k = 0; k < width; k++) row.appendChild(document.createElement('span'))
    })
    var runTimer = null
    function paint(row, fn) {
      row.querySelectorAll('span').forEach(function (s, k) { s.className = fn(k) })
    }
    function run() {
      conv.classList.remove('same')
      var ticks = 0
      clearInterval(runTimer)
      runTimer = setInterval(function () {
        ticks++
        rows.forEach(function (row, r) {
          // Each replica applies the same operations in its own order: the
          // prefix it has is correct, the rest is still in flight.
          var have = Math.min(width, Math.floor(ticks * (0.6 + r * 0.25)))
          paint(row, function (k) {
            if (k < have) return target[k]
            return Math.random() < 0.5 ? 'x' : palette[(k + r + ticks) % palette.length] + ' fly'
          })
        })
        if (ticks > 36) {
          clearInterval(runTimer)
          rows.forEach(function (row) { paint(row, function (k) { return target[k] }) })
          conv.classList.add('same')
        }
      }, 110)
    }
    if (reduce) {
      rows.forEach(function (row) { paint(row, function (k) { return target[k] }) })
      conv.classList.add('same')
    } else {
      var ran = false
      onScreen(conv, function (v) { if (v && !ran) { ran = true; run() } })
    }
    conv.querySelector('[data-rerun]').addEventListener('click', run)
  }
})()
