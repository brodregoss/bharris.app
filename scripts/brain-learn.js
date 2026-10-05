(function () {
  var root = document.getElementById('brain');
  if (!root) return;

  var KNOWN = [
    { id: 'synapse', term: 'Synapse', def: 'The gap where one neuron signals the next.' },
    { id: 'axon', term: 'Axon', def: 'The fiber that carries a signal away from the cell.' },
  ];
  var STUCK = [
    { id: 'wm', term: 'Working memory', def: 'The small workspace that holds what you are using right now.' },
    { id: 'cl', term: 'Cognitive load', def: 'How much of that workspace a task is using.' },
  ];
  var OWN = {
    wm: 'The short desk in your head that holds what you are using.',
    cl: 'How full that desk gets while you do the task.',
  };
  var NODES = [
    { x: 58, y: 62 }, { x: 80, y: 48 }, { x: 104, y: 44 }, { x: 128, y: 52 },
    { x: 148, y: 70 }, { x: 146, y: 92 }, { x: 126, y: 82 }, { x: 102, y: 76 },
    { x: 78, y: 88 }, { x: 62, y: 104 }, { x: 114, y: 100 }, { x: 136, y: 118 },
  ];
  var EDGES = [
    [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 0],
    [2, 7], [7, 10], [10, 6], [8, 10], [5, 11], [10, 11],
  ];
  var FIRING = [
    [0], [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 11], [11, 10], [10, 7], [7, 2],
    [2, 7, 10], [10, 6, 4], [6, 5, 3], [1, 8, 9], [0, 7, 4], [2, 3, 10, 11], [8, 10, 5], [],
  ];
  var SLICES = [
    { kind: 'cap', rx: 18, ry: 10 },
    { kind: 'high', rx: 30, ry: 17 },
    { kind: 'high', rx: 40, ry: 24 },
    { kind: 'fissure', rx: 48, ry: 30 },
    { kind: 'vent', rx: 52, ry: 33, split: false },
    { kind: 'vent', rx: 54, ry: 34, split: true },
    { kind: 'deep', rx: 52, ry: 34 },
    { kind: 'deep', rx: 48, ry: 33 },
    { kind: 'orbit', rx: 44, ry: 31 },
    { kind: 'orbit', rx: 38, ry: 28 },
    { kind: 'fossa', rx: 32, ry: 24 },
    { kind: 'cap', rx: 16, ry: 9 },
  ];

  function push(steps, step) {
    steps.push(Object.assign({
      card: null, revealed: false, target: null, press: false, phase: null, typed: '', n: '',
    }, step));
  }

  function buildSteps() {
    var steps = [];
    var left = 4;
    KNOWN.forEach(function (card) {
      push(steps, { kind: 'card', card: card, revealed: false, target: 'show', effort: 22, left: left, ms: 380 });
      push(steps, { kind: 'card', card: card, revealed: false, target: 'show', press: true, effort: 16, left: left, ms: 140 });
      push(steps, { kind: 'card', card: card, revealed: true, target: 'got', effort: 12, left: left, ms: 420 });
      left -= 1;
      push(steps, { kind: 'card', card: card, revealed: true, target: 'got', press: true, effort: 10, left: left, ms: 220 });
    });
    for (var pass = 0; pass < 2; pass += 1) {
      STUCK.forEach(function (card, i) {
        var effort = 40 + pass * 22 + i * 8;
        push(steps, { kind: 'card', card: card, revealed: false, target: 'show', effort: effort, left: 2, ms: 360 });
        push(steps, { kind: 'card', card: card, revealed: false, target: 'show', press: true, effort: effort + 3, left: 2, ms: 130 });
        push(steps, { kind: 'card', card: card, revealed: true, target: 'miss', effort: Math.min(82, effort + 8), left: 2, ms: 300 });
        push(steps, { kind: 'card', card: card, revealed: true, target: 'miss', press: true, effort: Math.min(88, effort + 14), left: 2, ms: 180 });
      });
    }
    push(steps, { kind: 'prompt', effort: 92, left: 2, ms: 880 });
    push(steps, { kind: 'prompt', target: 'next', effort: 93, left: 2, ms: 360 });
    push(steps, { kind: 'prompt', target: 'next', press: true, effort: 94, left: 2, ms: 160 });
    STUCK.forEach(function (card, i) {
      var text = OWN[card.id];
      var n = (i + 1) + '/2';
      var chunk = i === 0 ? 4 : 6;
      push(steps, { kind: 'write', card: card, phase: 'look', target: 'start', effort: 95, left: 2, ms: i === 0 ? 520 : 340, n: n });
      push(steps, { kind: 'write', card: card, phase: 'look', target: 'start', press: true, effort: 96, left: 2, ms: 140, n: n });
      for (var c = chunk; c < text.length; c += chunk) {
        push(steps, { kind: 'write', card: card, phase: 'type', typed: text.slice(0, c), effort: 96, left: 2, ms: i === 0 ? 48 : 36, n: n });
      }
      push(steps, { kind: 'write', card: card, phase: 'type', typed: text, target: 'next', effort: 97, left: 2, ms: i === 0 ? 900 : 520, n: n });
      push(steps, { kind: 'write', card: card, phase: 'type', typed: text, target: 'next', press: true, effort: 97, left: 2, ms: 160, n: n });
    });
    return steps;
  }

  var STEPS = buildSteps();
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fireEl = document.getElementById('brain-fire');
  var sliceEl = document.getElementById('brain-slice');
  var gaugeEl = document.getElementById('brain-gauge');
  var simEl = document.getElementById('brain-sim');
  var onScreen = true;
  var stepIndex = 0;
  var fireFrame = 14;
  var sliceFrame = 5;
  var angle = -90;
  var simKey = '';

  function zone(value) {
    if (value < 38) return { color: '#3dbe78', label: 'Low effort' };
    if (value < 72) return { color: '#e2b340', label: 'Rising' };
    return { color: '#e15b5b', label: 'High effort' };
  }

  function arc(cx, cy, r, a0, a1) {
    function pt(a) {
      var rad = (a * Math.PI) / 180;
      return [cx + r * Math.cos(rad), cy - r * Math.sin(rad)];
    }
    var p0 = pt(a0);
    var p1 = pt(a1);
    var large = Math.abs(a1 - a0) > 180 ? 1 : 0;
    return 'M ' + p0[0].toFixed(2) + ' ' + p0[1].toFixed(2) + ' A ' + r + ' ' + r + ' 0 ' + large + ' 0 ' + p1[0].toFixed(2) + ' ' + p1[1].toFixed(2);
  }

  function needle(cx, cy, angleDeg, length, half) {
    var rad = ((angleDeg - 90) * Math.PI) / 180;
    var tx = cx + length * Math.cos(rad);
    var ty = cy + length * Math.sin(rad);
    var px = Math.cos(rad + Math.PI / 2);
    var py = Math.sin(rad + Math.PI / 2);
    return tx.toFixed(1) + ',' + ty.toFixed(1) + ' ' + (cx + half * px).toFixed(1) + ',' + (cy + half * py).toFixed(1) + ' ' + (cx - half * px).toFixed(1) + ',' + (cy - half * py).toFixed(1);
  }

  function firingSvg(frame) {
    var hot = FIRING[frame] || [];
    var hotSet = {};
    hot.forEach(function (i) { hotSet[i] = true; });
    var scanY = 18 + (frame % 8) * 16;
    var edges = EDGES.map(function (e) {
      var on = hotSet[e[0]] && hotSet[e[1]];
      return '<line x1="' + NODES[e[0]].x + '" y1="' + NODES[e[0]].y + '" x2="' + NODES[e[1]].x + '" y2="' + NODES[e[1]].y + '" stroke="' + (on ? '#ffd27a' : '#2a4a46') + '" stroke-width="' + (on ? 1.5 : 0.7) + '" stroke-linecap="round"></line>';
    }).join('');
    var dots = NODES.map(function (n, i) {
      var on = hotSet[i];
      return '<g' + (on ? ' filter="url(#bf-glow)"' : '') + '>' +
        (on ? '<circle cx="' + n.x + '" cy="' + n.y + '" r="11" fill="url(#bf-hot)"></circle>' : '') +
        '<circle cx="' + n.x + '" cy="' + n.y + '" r="' + (on ? 2.5 : 1.7) + '" fill="' + (on ? '#fff6df' : '#2c3330') + '"></circle></g>';
    }).join('');
    return '<svg viewBox="0 0 200 168" aria-hidden="true"><defs>' +
      '<radialGradient id="bf-hot" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#fff6d8"/><stop offset="38%" stop-color="#ff9a1f"/><stop offset="72%" stop-color="#ff3b1f" stop-opacity="0.8"/><stop offset="100%" stop-color="#ff3b1f" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="bf-scan" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#7ef0df" stop-opacity="0"/><stop offset="50%" stop-color="#9ff7ea" stop-opacity="0.5"/><stop offset="100%" stop-color="#7ef0df" stop-opacity="0"/></linearGradient>' +
      '<filter id="bf-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
      '<pattern id="bf-grid" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M 12 0 L 0 0 0 12" fill="none" stroke="#12343a" stroke-width="0.4"/></pattern>' +
      '</defs><rect width="200" height="168" fill="#061016"/><rect width="200" height="168" fill="url(#bf-grid)"/>' +
      '<ellipse cx="108" cy="86" rx="78" ry="62" fill="#0c2428" stroke="#1a4a4e" stroke-width="0.8"/>' +
      '<path d="M52 96 C38 78 42 50 66 38 C86 28 112 26 132 36 C154 46 172 62 170 80 C168 94 156 100 148 102 C162 110 160 130 140 138 C124 144 110 132 108 118 C104 130 88 136 72 128 C58 120 54 108 58 98 C40 102 36 100 52 96 Z" fill="#8f8c86" stroke="#d7d3cb" stroke-width="1.6"/>' +
      '<path d="M70 46 C78 62 72 78 64 96 M96 40 C100 58 92 74 98 92 M122 44 C130 60 118 76 128 92" fill="none" stroke="#3a3a36" stroke-width="1.2" stroke-linecap="round"/>' +
      '<path d="M112 108 C128 104 150 112 146 128 C138 142 118 140 112 126 C108 118 108 112 112 108 Z" fill="#7c7a74" stroke="#d7d3cb" stroke-width="1.15"/>' +
      edges + dots +
      '<rect x="0" y="' + scanY + '" width="200" height="12" fill="url(#bf-scan)"/>' +
      '<text x="8" y="14" fill="#7ef0df" font-size="8" font-family="ui-monospace, monospace">fMRI · BOLD</text>' +
      '<text x="8" y="160" fill="#5eead4" font-size="8" font-family="ui-monospace, monospace">NEURONS</text></svg>';
  }

  function sliceSvg(index) {
    var slice = SLICES[index];
    var cx = 78;
    var cy = 68;
    var bone = slice.rx + 7;
    var boneY = slice.ry + 6;
    var inner = '';
    if (slice.kind === 'fossa') {
      inner = '<ellipse cx="' + (cx - slice.rx * 0.32) + '" cy="' + (cy + 4) + '" rx="' + (slice.rx * 0.42) + '" ry="' + (slice.ry * 0.62) + '" fill="#c8c6be"/>' +
        '<ellipse cx="' + (cx + slice.rx * 0.32) + '" cy="' + (cy + 4) + '" rx="' + (slice.rx * 0.42) + '" ry="' + (slice.ry * 0.62) + '" fill="#d2d0c6"/>';
    } else {
      inner = '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + slice.rx + '" ry="' + slice.ry + '" fill="#c5c3bb"/>';
    }
    var marks = '';
    if (slice.kind === 'vent' && slice.split) {
      marks = '<ellipse cx="' + (cx - 12) + '" cy="' + (cy + 1) + '" rx="8" ry="11" fill="#121212"/><ellipse cx="' + (cx + 12) + '" cy="' + (cy + 1) + '" rx="8" ry="11" fill="#121212"/>';
    } else if (slice.kind === 'vent') {
      marks = '<ellipse cx="' + cx + '" cy="' + (cy + 1) + '" rx="5" ry="12" fill="#141414"/>';
    } else if (slice.kind === 'deep') {
      marks = '<ellipse cx="' + (cx - 14) + '" cy="' + (cy + 2) + '" rx="8" ry="11" fill="#141414"/><ellipse cx="' + (cx + 14) + '" cy="' + (cy + 2) + '" rx="8" ry="11" fill="#141414"/><rect x="' + (cx - 1.2) + '" y="' + (cy - 8) + '" width="2.4" height="16" fill="#161616"/>';
    } else if (slice.kind === 'orbit') {
      marks = '<circle cx="' + (cx - 16) + '" cy="' + (cy - slice.ry * 0.22) + '" r="8" fill="#0c0c0c"/><circle cx="' + (cx + 16) + '" cy="' + (cy - slice.ry * 0.22) + '" r="8" fill="#0c0c0c"/>' +
        '<circle cx="' + (cx - 16) + '" cy="' + (cy - slice.ry * 0.22) + '" r="3" fill="#3a3a3a"/><circle cx="' + (cx + 16) + '" cy="' + (cy - slice.ry * 0.22) + '" r="3" fill="#3a3a3a"/>';
    }
    var ticks = SLICES.map(function (_, i) {
      return '<rect x="150" y="' + (14 + i * 9) + '" width="4" height="5" fill="' + (i === index ? '#35e08a' : '#16382f') + '"></rect>';
    }).join('');
    var n = String(index + 1);
    if (n.length < 2) n = '0' + n;
    return '<svg viewBox="0 0 160 140" aria-hidden="true"><rect width="160" height="140" fill="#050505"/>' +
      '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + (bone + 3) + '" ry="' + (boneY + 2.5) + '" fill="#6a6a66"/>' +
      '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + bone + '" ry="' + boneY + '" fill="#f3f1ea"/>' +
      '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + (bone - 3.2) + '" ry="' + (boneY - 2.8) + '" fill="#101010"/>' +
      inner + marks + ticks +
      '<text x="6" y="12" fill="#35e08a" font-size="8" font-family="ui-monospace, monospace">CT  AX ' + n + '</text>' +
      '<text x="6" y="132" fill="#35e08a" font-size="7" font-family="ui-monospace, monospace">' + (index + 1) + ' / ' + SLICES.length + '</text></svg>';
  }

  function drawGauge(value) {
    var z = zone(value);
    var cx = 80;
    var cy = 86;
    var r = 58;
    var ticks = '';
    for (var i = 0; i < 9; i += 1) {
      var a = 180 - i * (180 / 8);
      var rad = (a * Math.PI) / 180;
      ticks += '<line x1="' + (cx + (r - 18) * Math.cos(rad)) + '" y1="' + (cy - (r - 18) * Math.sin(rad)) + '" x2="' + (cx + (r - 11) * Math.cos(rad)) + '" y2="' + (cy - (r - 11) * Math.sin(rad)) + '" stroke="#d6d3d1" stroke-width="' + (i % 2 === 0 ? 1.6 : 1) + '"></line>';
    }
    gaugeEl.innerHTML = '<svg viewBox="0 0 160 108" aria-hidden="true">' +
      '<path d="' + arc(cx, cy, r, 180, 112) + '" stroke="#3cba6f" stroke-width="11" fill="none"/>' +
      '<path d="' + arc(cx, cy, r, 112, 52) + '" stroke="#e0b03a" stroke-width="11" fill="none"/>' +
      '<path d="' + arc(cx, cy, r, 52, 0) + '" stroke="#e15d5d" stroke-width="11" fill="none"/>' +
      ticks +
      '<text x="14" y="102" fill="#a8a29e" font-size="8" font-family="ui-monospace, monospace">LOW</text>' +
      '<text x="122" y="102" fill="#a8a29e" font-size="8" font-family="ui-monospace, monospace">HIGH</text>' +
      '<polygon id="brain-needle" points="' + needle(cx, cy, angle, 48, 3.2) + '" fill="#f5f5f4"/>' +
      '<polygon id="brain-needle-tip" points="' + needle(cx, cy, angle, 16, 2) + '" fill="' + z.color + '"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="6" fill="#e7e5e4"/><circle cx="' + cx + '" cy="' + cy + '" r="2.2" fill="#111113"/>' +
      '</svg><p class="bg-num" style="color:' + z.color + '">' + Math.round(value) + '</p><p class="bg-label" style="color:' + z.color + '">' + z.label + '</p>';
  }

  function moveNeedle(value) {
    var target = -90 + (value / 100) * 180;
    var from = angle;
    var start = performance.now();
    function tick(now) {
      var t = Math.min(1, (now - start) / 280);
      angle = from + (target - from) * (1 - Math.pow(1 - t, 3));
      var z = zone(value);
      var shaft = gaugeEl.querySelector('#brain-needle');
      var tip = gaugeEl.querySelector('#brain-needle-tip');
      if (shaft) shaft.setAttribute('points', needle(80, 86, angle, 48, 3.2));
      if (tip) {
        tip.setAttribute('points', needle(80, 86, angle, 16, 2));
        tip.setAttribute('fill', z.color);
      }
      var num = gaugeEl.querySelector('.bg-num');
      var label = gaugeEl.querySelector('.bg-label');
      if (num) {
        num.textContent = String(Math.round(value));
        num.style.color = z.color;
      }
      if (label) {
        label.textContent = z.label;
        label.style.color = z.color;
      }
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function finger(on) {
    return on ? '<span class="bs-finger"></span>' : '';
  }

  function btn(className, label, on, press) {
    return '<div class="bs-btn ' + className + (press && on ? ' press' : '') + '">' + label + finger(on) + '</div>';
  }

  function simHtml(step) {
    var top = step.kind === 'card' ? 'Recall' : step.kind === 'prompt' ? 'Stuck cards' : 'Write your own def';
    var meta = step.kind === 'write' ? '<span>' + step.n + '</span>' : '';
    var body = '';
    if (step.kind === 'prompt') {
      body = '<p class="bs-title">Feeling stuck?</p><p class="bs-sub">Try writing your own definition to lock it in.</p>' +
        STUCK.map(function (c) { return '<div class="bs-term-row">' + c.term + '</div>'; }).join('') +
        btn('solid', 'Next <span aria-hidden="true">→</span>', step.target === 'next', step.press) +
        '<p class="bs-skip">Keep going</p>';
    } else if (step.kind === 'write') {
      var def = step.phase === 'type'
        ? '<p class="bs-peek">Hold to peek</p>'
        : '<p class="bs-def">' + step.card.def + '</p>';
      var field = step.phase === 'type'
        ? '<div class="bs-type">' + step.typed + '<span class="bs-caret"></span></div>' + btn('solid', 'Next <span aria-hidden="true">→</span>', step.target === 'next', step.press)
        : btn('solid', 'Start typing', step.target === 'start', step.press);
      body = '<p class="bs-kicker">Term</p><p class="bs-term">' + step.card.term + '</p><p class="bs-sub">Don’t just rewrite — paraphrase it.</p>' +
        '<div class="bs-defbox"><p class="bs-kicker">Definition</p>' + def + '</div>' + field;
    } else {
      var retired = 4 - step.left;
      var mid = step.revealed
        ? '<p class="bs-def">' + step.card.def + '</p>'
        : '<p class="bs-sub">Reveal the definition, then grade yourself.</p>';
      var actions = step.revealed
        ? '<div class="bs-row">' + btn('miss', 'Missed', step.target === 'miss', step.press) + btn('got', 'Got it', step.target === 'got', step.press) + '</div>'
        : btn('solid', 'Show answer', step.target === 'show', step.press);
      body = '<div class="bs-card"><p class="bs-kicker">Term</p><p class="bs-term">' + step.card.term + '</p>' + mid + '</div>' +
        actions + '<p class="bs-foot">' + retired + ' retired · ' + step.left + ' in rotation</p>';
    }
    return '<div class="bs-top"><span>' + top + '</span>' + meta + '</div><div class="bs-body">' + body + '</div>';
  }

  function showStep(step, animateNeedle) {
    var key = step.kind + '|' + (step.card ? step.card.id : '') + '|' + step.revealed + '|' + step.phase + '|' + step.target + '|' + step.press + '|' + step.typed;
    if (key !== simKey) {
      simKey = key;
      simEl.innerHTML = simHtml(step);
    }
    if (!gaugeEl.querySelector('svg')) drawGauge(step.effort);
    if (animateNeedle) moveNeedle(step.effort);
    else {
      angle = -90 + (step.effort / 100) * 180;
      drawGauge(step.effort);
    }
  }

  function paintScans() {
    fireEl.innerHTML = firingSvg(fireFrame);
    sliceEl.innerHTML = sliceSvg(sliceFrame);
  }

  var running = onScreen && !reduce;
  paintScans();
  var still = STEPS.filter(function (s) {
    return s.kind === 'write' && s.card && s.card.id === 'wm' && s.typed === OWN.wm;
  })[0] || STEPS[STEPS.length - 1];
  showStep(reduce ? still : STEPS[0], false);

  if (!reduce && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      onScreen = entries[0].isIntersecting;
    }, { threshold: 0.08 });
    io.observe(root);
  }

  if (!reduce) {
    setInterval(function () {
      if (!onScreen) return;
      fireFrame = (fireFrame + 1) % FIRING.length;
      fireEl.innerHTML = firingSvg(fireFrame);
    }, 150);
    setInterval(function () {
      if (!onScreen) return;
      sliceFrame = (sliceFrame + 1) % SLICES.length;
      sliceEl.innerHTML = sliceSvg(sliceFrame);
    }, 260);
    (function loop() {
      var step = STEPS[stepIndex];
      showStep(step, true);
      setTimeout(function () {
        if (onScreen) stepIndex = (stepIndex + 1) % STEPS.length;
        loop();
      }, onScreen ? step.ms : 400);
    })();
  }
})();
