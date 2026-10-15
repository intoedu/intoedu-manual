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
    sr.classList.add('on');
    if (!hits.length) {
      srIn.innerHTML = '<div class="empty"><p><b>' + esc(q) + '</b>에 맞는 내용을 찾지 못했습니다.</p>'
        + '<p class="muted">다른 낱말로 찾아보시거나, 질문 수집 시트에 적어 주세요.</p></div>';
      return;
    }

    /* 매뉴얼별로 묶기 — 어느 매뉴얼에 있는지 먼저, 그 안의 내용은 아래에 */
    var groups = {};
    hits.forEach(function (it) { (groups[it.m] = groups[it.m] || []).push(it); });
    var order = MANUALS.filter(function (m) { return groups[m.id]; });
    var html = '<div class="sum"><div class="sum-h"><mark>' + esc(q) + '</mark> — 매뉴얼 <b>' + order.length
      + '곳</b>에서 <b>' + hits.length + '건</b>을 찾았습니다</div><div class="chips">'
      + '<button type="button" class="chip on" data-f="">전체 <em>' + hits.length + '</em></button>';
    order.forEach(function (m) {
      html += '<button type="button" class="chip" data-f="' + m.id + '" style="--c:' + m.c + '">'
        + '<span class="cn">' + esc(m.n) + '</span>' + esc(m.name) + ' <em>' + groups[m.id].length + '</em></button>';
    });
    html += '</div></div>';
    order.forEach(function (m) {
      var list = groups[m.id];
      html += '<section class="grp" data-m="' + m.id + '" style="--c:' + m.c + '">'
        + '<a class="gh" data-go="' + m.id + '"><span class="gn">' + esc(m.n) + '</span><span class="gt">' + esc(m.name)
        + '</span><span class="gc">' + list.length + '건</span></a><div class="gl">';
      list.forEach(function (it, i) {
        var sec = section(it, m);
        html += '<a class="gi' + (i >= SHOW ? ' more' : '') + '" data-go="' + it.m + '" data-anchor="' + it.a + '">'
          + '<div class="gs">' + (it.code ? '<span class="gcode">' + esc(it.code) + '</span>' : '') + esc(sec) + '</div>'
          + '<div class="ht">' + mark(it.t, terms) + '</div>'
          + (it.b ? '<div class="hs">' + mark(snippet(it.b, low), terms) + '</div>' : '')
          + '</a>';
      });
      html += '</div>' + (list.length > SHOW ? '<button type="button" class="gmore" data-more>나머지 '
        + (list.length - SHOW) + '건 더 보기</button>' : '') + '</section>';
    });
    srIn.innerHTML = html;
    sr.scrollTop = 0;
  }
  var SHOW = 4;
  var MANUALS = $$('.side .nav-i[data-go]').filter(function (a) { return a.dataset.go !== 'home'; }).map(function (a) {
    return { id: a.dataset.go, n: $('.n', a).textContent, name: a.lastElementChild.textContent,
      c: a.style.getPropertyValue('--c') };
  });
  function section(it, m) {
    var pre = (m.n === '부록' ? '부록 · ' : m.n + ' ') + m.name;
    var rest = it.ml.indexOf(pre) === 0 ? it.ml.slice(pre.length).replace(/^\s*·\s*/, '') : it.ml;
    return rest || (it.code ? '상황 카드' : '본문');
  }
  srIn.addEventListener('click', function (e) {
    var chip = e.target.closest('.chip');
    if (chip) {
      var f = chip.dataset.f;
      $$('.chip', srIn).forEach(function (c) { c.classList.toggle('on', c === chip); });
      $$('.grp', srIn).forEach(function (g) {
        g.hidden = !!f && g.dataset.m !== f;
        g.classList.toggle('open', !!f);
      });
      sr.scrollTop = 0;
      return;
    }
    var more = e.target.closest('[data-more]');
    if (more) { more.closest('.grp').classList.add('open'); }
  });
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
