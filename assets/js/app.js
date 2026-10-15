(function () {
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ── 화면 전환 ───────────────────── */
  function show(id, anchor) {
    var pane = document.getElementById(id);
    if (!pane) { id = 'home'; pane = document.getElementById('home'); }
    $$('.pane').forEach(function (p) { p.classList.toggle('on', p === pane); });
    $$('.nav-i').forEach(function (a) { a.classList.toggle('on', a.dataset.go === id); });
    $$('.subnav').forEach(function (s) { s.classList.toggle('open', s.dataset.of === id); });
    closeSearch();
    closeNav();
    if (anchor) {
      var el = document.getElementById(anchor);
      if (el) { el.scrollIntoView({ block: 'start' }); window.scrollBy(0, -8); return; }
    }
    window.scrollTo(0, 0);
  }

  function route() {
    var h = (location.hash || '#/home').slice(1);
    try { h = decodeURIComponent(h); } catch (e) { }
    if (h.charAt(0) === '/') h = h.slice(1);
    if (!h) h = 'home';
    if (h.indexOf('card-') === 0) {
      var el = document.getElementById(h);
      if (el) { show(el.closest('.pane').id, h); return; }
    }
    var parts = h.split('--');
    show(parts[0], parts[1]);
  }
  window.addEventListener('hashchange', route);

  document.addEventListener('click', function (e) {
    var go = e.target.closest('[data-go]');
    if (go) {
      e.preventDefault();
      location.hash = '/' + go.dataset.go + (go.dataset.anchor ? '--' + go.dataset.anchor : '');
      return;
    }
    var tog = e.target.closest('[data-toggle]');
    if (tog) {
      var sn = $('.subnav[data-of="' + tog.dataset.toggle + '"]');
      if (sn) sn.classList.toggle('open');
    }
  });

  /* ── 사이드 메뉴 (모바일) ───────────── */
  function closeNav() { $('.side').classList.remove('open'); $('.scrim').classList.remove('on'); }
  $('.menu-btn').addEventListener('click', function () {
    $('.side').classList.toggle('open');
    $('.scrim').classList.toggle('on');
  });
  $('.scrim').addEventListener('click', closeNav);

  /* ── 메시지 복사 ─────────────────── */
  document.addEventListener('click', function (e) {
    var b = e.target.closest('.copy');
    if (!b) return;
    var box = b.closest('.msg');
    var lines = $$('.mb p', box).map(function (p) { return p.textContent; });
    var txt = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    var done = function () {
      var old = b.textContent;
      b.textContent = '복사됨';
      b.classList.add('ok');
      setTimeout(function () { b.textContent = old; b.classList.remove('ok'); }, 1600);
    };
    try {
      navigator.clipboard.writeText(txt).then(done, function () { fallback(txt, done); });
    } catch (err) { fallback(txt, done); }
  });
  function fallback(txt, done) {
    try {
      var ta = document.createElement('textarea');
      ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      done();
    } catch (e) { alert('복사하지 못했습니다. 메시지를 직접 선택해서 복사해 주세요.'); }
  }

  /* ── 검색 ───────────────────────── */
  var box = $('#q'), sr = $('.sr'), srIn = $('.sr .in'), timer = null;
  function esc(s) { return s.replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function mark(text, terms) {
    var out = esc(text);
    terms.forEach(function (t) {
      if (!t) return;
      var re = new RegExp('(' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
      out = out.replace(re, '<mark>$1</mark>');
    });
    return out;
  }
  function closeSearch() { sr.classList.remove('on'); }
  function snippet(body, low) {
    var lb = body.toLowerCase(), at = -1;
    low.forEach(function (t) { var i = lb.indexOf(t); if (i >= 0 && (at < 0 || i < at)) at = i; });
    if (at < 60) return body.slice(0, 180);
    var from = Math.max(0, at - 45);
    return '… ' + body.slice(from, from + 180);
  }
  function run() {
    var q = box.value.trim();
    if (q.length < 1) { closeSearch(); return; }
    var terms = q.split(/\s+/).filter(Boolean);
    var low = terms.map(function (t) { return t.toLowerCase(); });
    var hits = IDX.filter(function (it) {
      return low.every(function (t) { return it.s.indexOf(t) >= 0; });
    });
    hits.forEach(function (it) {
      var t = it.t.toLowerCase(), c = (it.code || '').toLowerCase();
      var s = (it.w === undefined ? 4 : it.w) * 10;
      if (low.every(function (x) { return t.indexOf(x) >= 0; })) s -= 25;
      if (c && low.some(function (x) { return c.indexOf(x) >= 0; })) s -= 40;
      it._s = s;
    });
    hits.sort(function (a, b) { return a._s - b._s; });
    hits = hits.slice(0, 80);
    sr.classList.add('on');
    if (!hits.length) {
      srIn.innerHTML = '<div class="empty"><p><b>' + esc(q) + '</b>에 맞는 내용을 찾지 못했습니다.</p>'
        + '<p class="muted">다른 낱말로 찾아보시거나, 질문 수집 시트에 적어 주세요.</p></div>';
      return;
    }
    var html = '<div class="cnt">' + hits.length + '건' + (hits.length === 80 ? ' 이상' : '') + ' 찾았습니다</div>';
    hits.forEach(function (it) {
      html += '<a class="hit" style="--c:' + it.c + '" data-go="' + it.m + '" data-anchor="' + it.a + '">'
        + '<div class="hm">' + esc(it.ml) + (it.code ? ' · ' + esc(it.code) : '') + '</div>'
        + '<div class="ht">' + mark(it.t, terms) + '</div>'
        + (it.b ? '<div class="hs">' + mark(snippet(it.b, low), terms) + '</div>' : '')
        + '</a>';
    });
    srIn.innerHTML = html;
  }
  box.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(run, 110); });
  box.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { box.value = ''; closeSearch(); box.blur(); }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === '/' && document.activeElement !== box) { e.preventDefault(); box.focus(); box.select(); }
    if (e.key === 'Escape') { closeSearch(); closeNav(); }
  });

  /* ── 맨 위로 ─────────────────────── */
  var up = $('.up');
  window.addEventListener('scroll', function () { up.classList.toggle('on', window.scrollY > 500); });
  up.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });

  /* ── 인쇄 ───────────────────────── */
  $('#print').addEventListener('click', function () {
    closeSearch();
    var all = $('#home').classList.contains('on');   /* 처음 화면에서 누르면 전체 인쇄 */
    if (all) document.body.classList.add('printall');
    window.print();
    setTimeout(function () { document.body.classList.remove('printall'); }, 800);
  });

  route();
})();
