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
  var simEl = document.getElementById('brain-sim');
  var onScreen = true;
  var stepIndex = 0;
  var simKey = '';

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

  function showStep(step) {
    var key = step.kind + '|' + (step.card ? step.card.id : '') + '|' + step.revealed + '|' + step.phase + '|' + step.target + '|' + step.press + '|' + step.typed;
    if (key !== simKey) {
      simKey = key;
      simEl.innerHTML = simHtml(step);
    }
  }

  var still = STEPS.filter(function (s) {
    return s.kind === 'write' && s.card && s.card.id === 'wm' && s.typed === OWN.wm;
  })[0] || STEPS[STEPS.length - 1];
  showStep(reduce ? still : STEPS[0]);

  if (!reduce && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      onScreen = entries[0].isIntersecting;
    }, { threshold: 0.08 });
    io.observe(root);
  }

  if (!reduce) {
    (function loop() {
      var step = STEPS[stepIndex];
      showStep(step);
      setTimeout(function () {
        if (onScreen) stepIndex = (stepIndex + 1) % STEPS.length;
        loop();
      }, onScreen ? step.ms : 400);
    })();
  }
})();
