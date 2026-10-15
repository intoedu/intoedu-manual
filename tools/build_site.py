#!/usr/bin/env python3
"""인투유학 매뉴얼 홈페이지 빌드 스크립트.

source/manual.html (매뉴얼 원본 한 장짜리 HTML)과 source/logo-banner.webp(로고)를 읽어
index.html + assets/ 로 나눠 만든다. 새 판 매뉴얼을 받으면 source/manual.html 만 바꾸고
    python3 tools/build_site.py
를 다시 실행하면 된다. (필요: Python 3, Pillow)
"""
import base64
import hashlib
import os
import re
import sys

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_HTML = os.path.join(ROOT, 'source', 'manual.html')
SRC_LOGO = os.path.join(ROOT, 'source', 'logo-banner.webp')
ASSETS = os.path.join(ROOT, 'assets')

LOCK_SIZE = [0, 0]
NAVY = (5, 32, 91)          # 로고 배경색 #05205B
CYAN = (23, 184, 246)       # 로고 강조색 #17B8F6
WHITE = (255, 255, 255)


def p(*parts):
    return os.path.join(ROOT, *parts)


def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(text)


def between(s, start, end, frm=0):
    i = s.index(start, frm) + len(start)
    j = s.index(end, i)
    return s[i:j], j + len(end)


# ── 로고: 남색 배경을 걷어내고 투명 PNG로 ─────────────────────
def unmix(img):
    """배경(남색)과 섞인 픽셀을 흰색/하늘색 전경 + 알파로 되돌린다."""
    img = img.convert('RGB')
    out = Image.new('RGBA', img.size)
    src, dst = img.load(), out.load()
    for y in range(img.height):
        for x in range(img.width):
            c = src[x, y]
            best = None
            for fg in (WHITE, CYAN):
                den = sum((f - b) ** 2 for f, b in zip(fg, NAVY))
                a = sum((ci - b) * (f - b) for ci, f, b in zip(c, fg, NAVY)) / den
                a = max(0.0, min(1.0, a))
                err = sum((ci - (b + a * (f - b))) ** 2 for ci, f, b in zip(c, fg, NAVY))
                if best is None or err < best[0]:
                    best = (err, a, fg)
            _, a, fg = best
            a = 0.0 if a < 0.12 else (1.0 if a > 0.9 else (a - 0.12) / 0.78)
            dst[x, y] = fg + (int(round(a * 255)),)
    return out


def bbox_of_logo(img):
    px = img.convert('RGB').load()
    xs, ys = [], []
    for y in range(0, img.height, 2):
        for x in range(0, img.width, 2):
            if sum(abs(a - b) for a, b in zip(px[x, y], NAVY)) > 90:
                xs.append(x)
                ys.append(y)
    cols = sorted(set(xs))
    gap = next(a for a, b in zip(cols, cols[1:]) if b - a > 20)   # 아이콘과 글자 사이 틈
    return min(xs), min(ys), max(xs), max(ys), gap


def build_images():
    banner = Image.open(SRC_LOGO)
    x0, y0, x1, y1, gap = bbox_of_logo(banner)
    pad = 6
    lock = unmix(banner.crop((x0 - pad, y0 - pad, x1 + pad, y1 + pad)))
    mark = unmix(banner.crop((x0 - pad, y0 - pad, gap + pad, y1 + pad)))
    lock.save(p('assets', 'img', 'logo-lockup.png'), optimize=True)
    LOCK_SIZE[:] = lock.size

    # 정사각형 아이콘 (헤더용 투명)
    side = max(mark.size)
    sq = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    sq.paste(mark, ((side - mark.width) // 2, (side - mark.height) // 2), mark)
    sq.resize((128, 128), Image.LANCZOS).save(p('assets', 'img', 'logo-mark.png'), optimize=True)

    # 파비콘 (남색 둥근 사각형 위 아이콘)
    for size, name in ((32, 'favicon-32.png'), (180, 'apple-touch-icon.png'), (512, 'icon-512.png')):
        big = size * 4
        bg = Image.new('RGBA', (big, big), (0, 0, 0, 0))
        ImageDraw.Draw(bg).rounded_rectangle((0, 0, big - 1, big - 1), radius=int(big * .22), fill=NAVY + (255,))
        inner = int(big * .74)
        icon = sq.resize((inner, inner), Image.LANCZOS)
        bg.paste(icon, ((big - inner) // 2, (big - inner) // 2 + int(big * .01)), icon)
        bg.resize((size, size), Image.LANCZOS).save(p('assets', 'img', name), optimize=True)

    # 공유 미리보기(OG) 이미지: 원본 배너 그대로
    banner.convert('RGB').resize((1200, int(1200 * banner.height / banner.width)), Image.LANCZOS) \
        .save(p('assets', 'img', 'og.jpg'), quality=88, optimize=True)


# ── 원본 HTML 나누기 ───────────────────────────────────────
HEAD_EXTRA = '''<meta name="robots" content="noindex,nofollow">
<meta name="theme-color" content="#05205B">
<meta property="og:type" content="website">
<meta property="og:title" content="인투유학 매뉴얼">
<meta property="og:description" content="{desc}">
<meta property="og:image" content="assets/img/og.jpg">
<link rel="icon" type="image/png" sizes="32x32" href="assets/img/favicon-32.png">
<link rel="apple-touch-icon" href="assets/img/apple-touch-icon.png">
<link rel="manifest" href="site.webmanifest">
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<link rel="stylesheet" href="assets/css/style.css?v={v1}">
<link rel="stylesheet" href="assets/css/brand.css?v={v2}">'''

BRAND_OLD = re.compile(r'<a class="brand" href="#/home" data-go="home">.*?</a>', re.S)
BRAND_NEW = ('<a class="brand" href="#/home" data-go="home">'
             '<img class="bmark" src="assets/img/logo-mark.png" alt="" width="34" height="34">'
             '<span class="btxt">인투유학 <em>매뉴얼</em><small>INTO GLOBAL EDUCATION</small></span></a>')

HERO_OLD = re.compile(r'<div class="hero"><div class="eyebrow">(.*?)</div><h1>(.*?)</h1>', re.S)


def hero_new(m):
    return ('<div class="hero hero-brand"><h1 class="hero-logo">'
            + '<img src="assets/img/logo-lockup.png" alt="인투유학 매뉴얼" width="%d" height="%d">' % tuple(LOCK_SIZE)
            + '<span class="print-only">인투유학 매뉴얼</span></h1>'
            '<div class="eyebrow">' + m.group(1) + ' · 내부 운영 매뉴얼</div>')


def short_hash(s):
    return hashlib.sha1(s.encode('utf-8')).hexdigest()[:8]


def build_html():
    s = open(SRC_HTML, encoding='utf-8').read()

    css, _ = between(s, '<style>', '</style>')
    body, _ = between(s, '<body>', '</body>')
    desc = re.search(r'<meta name="description" content="([^"]*)"', s).group(1)

    # 본문 속 base64 그림을 파일로 꺼내기
    n = [0]

    def save_img(m):
        n[0] += 1
        ext, data = m.group(1), m.group(2)
        name = 'figure-%d.%s' % (n[0], 'jpg' if ext == 'jpeg' else ext)
        with open(p('assets', 'img', name), 'wb') as f:
            f.write(base64.b64decode(data))
        return 'src="assets/img/%s" loading="lazy"' % name
    body = re.sub(r'src="data:image/(png|jpeg|gif|webp);base64,([^"]+)"', save_img, body)

    # 스크립트 분리: 검색 색인(IDX)과 화면 동작
    scripts = re.findall(r'<script>(.*?)</script>', body, re.S)
    body = re.sub(r'\s*<script>.*?</script>', '', body, flags=re.S)
    idx_js = next(x for x in scripts if x.lstrip().startswith('var IDX'))
    app_js = next(x for x in scripts if not x.lstrip().startswith('var IDX'))

    # 브랜드 적용
    body, k1 = BRAND_OLD.subn(BRAND_NEW, body, count=1)
    body, k2 = HERO_OLD.subn(hero_new, body, count=1)
    body = body.replace('style="--c:#16202b"', 'style="--c:#05205B"')
    body = body.replace('id="home" style="--c:#16202b;', 'id="home" style="--c:#05205B;')
    if not (k1 and k2):
        sys.exit('원본 구조가 바뀌었습니다: 로고(%d)/첫 화면(%d) 자리를 찾지 못함' % (k1, k2))

    footer = ('<footer class="foot"><img src="assets/img/logo-mark.png" alt="" width="22" height="22">'
              '<span>인투유학 매뉴얼 · INTO GLOBAL EDUCATION</span><span class="sep">|</span>'
              '<span>내부용 — 외부 공유 금지</span><span class="sep">|</span>'
              '<a href="/__logout">잠그기</a></footer>')
    body = body.replace('</article><article class="pane" id="m00"', footer + '</article><article class="pane" id="m00"', 1)

    write(p('assets', 'css', 'style.css'), css.strip() + '\n')
    write(p('assets', 'js', 'search-index.js'), idx_js.strip() + '\n')
    # app.js(화면 동작·검색 화면)는 저장소에서 직접 고쳐 쓰는 파일이라 원본으로 덮어쓰지 않는다
    app_js = open(p('assets', 'js', 'app.js'), encoding='utf-8').read()
    brand_css = open(p('assets', 'css', 'brand.css'), encoding='utf-8').read()

    head = HEAD_EXTRA.format(desc=desc, v1=short_hash(css), v2=short_hash(brand_css))
    html = ('<!doctype html>\n<html lang="ko">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width,initial-scale=1">\n'
            '<title>인투유학 매뉴얼</title>\n'
            '<meta name="description" content="%s">\n%s\n</head>\n<body>\n%s\n'
            '<script src="assets/js/search-index.js?v=%s"></script>\n'
            '<script src="assets/js/app.js?v=%s"></script>\n</body>\n</html>\n'
            % (desc, head, body.strip(), short_hash(idx_js), short_hash(app_js)))
    write(p('index.html'), html)
    print('index.html 생성 — 그림 %d개 분리' % n[0])


if __name__ == '__main__':
    os.makedirs(p('assets', 'img'), exist_ok=True)
    build_images()
    build_html()
