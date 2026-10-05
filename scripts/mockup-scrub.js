(function () {
  var canvas = document.getElementById('mockup-scrub');
  if (!canvas) return;

  var count = Number(canvas.getAttribute('data-count')) || 0;
  if (count < 2) return;

  var ctx = canvas.getContext('2d', { alpha: false });
  var frames = new Array(count);
  var ready = new Array(count);
  var current = -1;
  var wanted = 0;

  function src(i) {
    return '/mockup/f' + String(i).padStart(3, '0') + '.jpg';
  }

  function draw(i) {
    var img = frames[i];
    if (!img || !ready[i] || current === i) return;
    if (canvas.width !== img.naturalWidth || canvas.height !== img.naturalHeight) {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
    }
    current = i;
    ctx.drawImage(img, 0, 0);
  }

  function nearest(i) {
    if (ready[i]) return i;
    for (var d = 1; d < count; d++) {
      if (i - d >= 0 && ready[i - d]) return i - d;
      if (i + d < count && ready[i + d]) return i + d;
    }
    return -1;
  }

  function load(i) {
    if (frames[i]) return;
    var img = new Image();
    frames[i] = img;
    img.decoding = 'async';
    img.onload = function () {
      ready[i] = true;
      var n = nearest(wanted);
      if (n >= 0) draw(n);
    };
    img.src = src(i);
  }

  function progress() {
    var rect = canvas.getBoundingClientRect();
    if (rect.height <= 0) return 0;
    var entered = (window.innerHeight - rect.top) / rect.height;
    var p = (entered - 0.9) / 0.6;
    if (p < 0) return 0;
    if (p > 1) return 1;
    return p;
  }

  function onScroll() {
    wanted = Math.round(progress() * (count - 1));
    var n = nearest(wanted);
    if (n >= 0) draw(n);
  }

  load(0);
  var next = 1;
  function pump() {
    var budget = 4;
    while (budget > 0 && next < count) {
      load(next);
      next += 1;
      budget -= 1;
    }
    if (next < count) requestAnimationFrame(pump);
  }
  requestAnimationFrame(pump);

  var ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      onScroll();
    });
  }, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();
})();
