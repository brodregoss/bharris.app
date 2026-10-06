(function () {
  var video = document.getElementById('mockup-scrub');
  if (!video) return;

  var mock = video.parentElement;
  var black = document.querySelector('.paper-black');
  var sheet = document.querySelector('.paper-sheet');
  var title = document.querySelector('.paper-procrastination');
  var noLine = document.querySelector('.paper-no p:nth-child(2)');
  var back = document.querySelector('.paper-back');

  function clearPlacement() {
    mock.style.left = '';
    mock.style.top = '';
    mock.style.width = '';
    mock.style.height = '';
    mock.style.transform = '';
    video.style.left = '';
    video.style.top = '';
    video.style.width = '';
    video.style.height = '';
    video.style.right = '';
    video.style.bottom = '';
  }

  // The upright phone sits inside the 9:16 frame, with empty margin around it.
  var phoneX = 184 / 1080;
  var phoneY = 284 / 1920;
  var phoneW = 724 / 1080;
  var phoneH = 1480 / 1920;

  function layout() {
    if (!black || !sheet || !title || !noLine || !back) return;
    if (window.matchMedia('(max-width: 760px)').matches) {
      clearPlacement();
      return;
    }

    var sr = sheet.getBoundingClientRect();
    var tr = title.getBoundingClientRect();
    var nr = noLine.getBoundingClientRect();
    var kr = back.getBoundingClientRect();
    var boxLeft = nr.right + 48;
    var boxRight = kr.left - 40;
    var boxTop = sr.top;
    var boxBottom = tr.top - 18;
    var boxW = boxRight - boxLeft;
    var boxH = boxBottom - boxTop;
    if (boxW < 160 || boxH < 220) {
      clearPlacement();
      return;
    }

    var videoW = Math.min(boxW / phoneW, boxH / ((16 / 9) * phoneH));
    var videoH = videoW * (16 / 9);
    var shownW = videoW * phoneW;
    var shownH = videoH * phoneH;
    video.style.left = ((boxW - shownW) / 2 - videoW * phoneX) + 'px';
    video.style.top = ((boxH - shownH) / 2 - videoH * phoneY) + 'px';
    video.style.right = 'auto';
    video.style.bottom = 'auto';
    video.style.width = videoW + 'px';
    video.style.height = videoH + 'px';

    mock.style.left = (boxLeft - sr.left) + 'px';
    mock.style.top = (boxTop - sr.top) + 'px';
    mock.style.width = boxW + 'px';
    mock.style.height = boxH + 'px';
    mock.style.transform = 'none';
  }

  layout();
  window.addEventListener('resize', layout);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);

  var fade = 0.85;
  var playing = false;

  function applyFade() {
    var d = video.duration;
    var t = video.currentTime || 0;
    if (!d || !isFinite(d)) {
      video.style.opacity = '0';
      return;
    }
    var amount = 1;
    if (t < fade) amount = t / fade;
    var left = d - t;
    if (left < fade) amount = Math.min(amount, Math.max(left, 0) / fade);
    video.style.opacity = String(amount);
  }

  var looping = false;

  function restart() {
    if (looping) return;
    looping = true;
    video.currentTime = 0;
    if (playing) video.play().catch(function () {});
  }

  video.addEventListener('ended', restart);
  video.addEventListener('loadeddata', applyFade);

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    video.style.opacity = '1';
    return;
  }

  var observer = new IntersectionObserver(function (entries) {
    playing = entries.some(function (entry) { return entry.isIntersecting; });
    if (playing) video.play().catch(function () {});
    else video.pause();
  }, { threshold: 0.45 });
  observer.observe(video);

  function tick() {
    applyFade();
    if (video.currentTime < 0.12) looping = false;
    if (playing && video.duration && video.currentTime >= video.duration - 0.03) restart();
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
