#!/usr/bin/env node
/*
 * 인투유학 3단 리플렛 빌드 — 한국어판·영어판
 *   source/leaflet/leaflet.html     (한국어)  ┐ 공통 디자인: source/leaflet/leaflet.css
 *   source/leaflet/leaflet-en.html  (영어)    ┘
 *   → leaflet/ 폴더에 판마다
 *     - 인쇄용 CMYK PDF   303×216mm (재단 여유 3mm 포함, TrimBox 297×210) · 인쇄소 전달용
 *     - 인쇄용 RGB PDF    같은 판형의 RGB 원본 (RGB 파일을 받는 인쇄소·디지털 인쇄용)
 *     - 사무용 A4 PDF     297×210mm (A4 가로) · 사무실 프린터 양면 인쇄용
 *     - 바깥면 / 안쪽면 PNG   화면 미리보기 (재단선 기준)
 *     - 접지선 확인 PNG   재단선(점선)·접는 선 표시본 (검수용)
 *
 * 실행:  node tools/build_leaflet.js
 * 필요:  Node 18+, playwright(Chromium) · 선택: Ghostscript(gs, CMYK 변환) · Python3 + pypdf(재단 상자 지정)
 *        gs가 없으면 CMYK 파일은 건너뛰고, pypdf가 없으면 재단 상자 지정을 건너뜁니다.
 * 판을 다시 고칠 때는 아래 EDITIONS의 name을 바꿉니다 (09 자료 정리 매뉴얼의 파일명 규칙 — 예: _최종 → _v6).
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'leaflet');
const EDITIONS = [
  { src: 'leaflet.html', name: '인투유학_3단리플렛_2026_최종_한국어', title: '인투유학 3단 리플렛',
    label: { cmyk: '인쇄용_CMYK', rgb: '인쇄용_RGB', office: '사무용_A4', outside: '바깥면', inside: '안쪽면', guide: '접지선확인' } },
  { src: 'leaflet-en.html', name: 'IntoEdu_Leaflet_2026_Final_EN', title: 'INTO Global Education Leaflet',
    label: { cmyk: 'Print_CMYK', rgb: 'Print_RGB', office: 'Office_A4', outside: 'Outside', inside: 'Inside', guide: 'FoldGuide' } },
];
const MM = 96 / 25.4;            // CSS px / mm
const PT = 72 / 25.4;            // pt / mm
const BLEED = 3;

// Chromium은 PDF 쪽 크기를 조금 크게 반올림한다 → 위·왼쪽 기준으로 정확한 크기로 자르고 TrimBox/BleedBox를 넣는다.
const PY_BOXES = `
import sys
from pypdf import PdfReader, PdfWriter
from pypdf.generic import RectangleObject
src, dst, w, h, bleed, title = sys.argv[1], sys.argv[2], float(sys.argv[3]), float(sys.argv[4]), float(sys.argv[5]), sys.argv[6]
r = PdfReader(src); wr = PdfWriter()
for pg in r.pages:
    top = float(pg.mediabox.top)
    box = RectangleObject([0, top - h, w, top])
    pg.mediabox = box; pg.cropbox = box; pg.bleedbox = box
    pg.trimbox = RectangleObject([bleed, top - h + bleed, w - bleed, top - bleed])
    wr.add_page(pg)
wr.add_metadata({'/Title': title, '/Author': '인투유학 INTO Global Education'})
with open(dst, 'wb') as fh: wr.write(fh)
`;

function has(cmd, args) {
  try { execFileSync(cmd, args, { stdio: 'ignore' }); return true; } catch { return false; }
}

async function build(browser, ed, tools) {
  const SRC = path.join(ROOT, 'source', 'leaflet', ed.src);
  const f = s => path.join(OUT, `${ed.name}_${s}`);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'leaflet-'));

  async function open(bleed, cls = '') {
    const w = 297 + 2 * bleed, h = 210 + 2 * bleed;
    const page = await browser.newPage({ viewport: { width: Math.ceil(w * MM), height: Math.ceil(h * MM) }, deviceScaleFactor: 2 });
    await page.goto('file://' + SRC, { waitUntil: 'load' });
    await page.evaluate(([b, c]) => {
      document.documentElement.style.setProperty('--b', b + 'mm');
      if (c) document.body.classList.add(c);
    }, [bleed, cls]);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(200);
    return { page, w, h };
  }
  const pdf = (page, w, h, out) => page.pdf({ path: out, width: w + 'mm', height: h + 'mm', printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 } });

  // 1) 인쇄용 (재단 여유 3mm)
  { const { page, w, h } = await open(BLEED); await pdf(page, w, h, path.join(tmp, 'print.pdf')); await page.close(); }
  // 2) 사무용 A4 + 미리보기 PNG
  {
    const { page, w, h } = await open(0);
    await pdf(page, w, h, path.join(tmp, 'office.pdf'));
    for (const [i, key] of [[0, 'outside'], [1, 'inside']]) {
      await page.evaluate(n => document.querySelectorAll('.sheet').forEach((s, k) => { s.style.display = k === n ? '' : 'none'; }), i);
      await (await page.$$('.sheet'))[i].screenshot({ path: f(ed.label[key] + '.png') });
    }
    await page.close();
  }
  // 3) 접지선 확인본
  {
    const { page } = await open(BLEED, 'guides');
    await page.setViewportSize({ width: Math.ceil(303 * MM), height: Math.ceil(216 * MM) * 2 });
    await page.screenshot({ path: f(ed.label.guide + '.png'), fullPage: true });
    await page.close();
  }
  // 4) CMYK 변환 (Ghostscript)
  if (tools.gs) execFileSync('gs', ['-q', '-dNOPAUSE', '-dBATCH', '-dSAFER', '-sDEVICE=pdfwrite', '-dCompatibilityLevel=1.6',
    '-dPDFSETTINGS=/prepress', '-sColorConversionStrategy=CMYK', '-sProcessColorModel=DeviceCMYK',
    '-dAutoRotatePages=/None', '-o', path.join(tmp, 'print_cmyk.pdf'), path.join(tmp, 'print.pdf')]);
  // 5) 정확한 판형 + TrimBox/BleedBox
  const jobs = [['print.pdf', f(ed.label.rgb + '.pdf'), 303, 216, BLEED], ['office.pdf', f(ed.label.office + '.pdf'), 297, 210, 0]];
  if (tools.gs) jobs.push(['print_cmyk.pdf', f(ed.label.cmyk + '.pdf'), 303, 216, BLEED]);
  for (const [src, dst, w, h, b] of jobs) {
    if (tools.py) execFileSync('python3', ['-c', PY_BOXES, path.join(tmp, src), dst, String(w * PT), String(h * PT), String(b * PT), ed.title]);
    else fs.copyFileSync(path.join(tmp, src), dst);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const tools = { gs: has('gs', ['--version']), py: has('python3', ['-c', 'import pypdf']) };
  if (!tools.gs) console.warn('  ! gs(Ghostscript)가 없어 CMYK 파일을 건너뜁니다.');
  if (!tools.py) console.warn('  ! pypdf가 없어 재단 상자(TrimBox) 지정을 건너뜁니다. (pip install pypdf)');
  const browser = await chromium.launch();
  for (const ed of EDITIONS) await build(browser, ed, tools);
  await browser.close();
  for (const ed of EDITIONS)
    for (const n of fs.readdirSync(OUT).filter(n => n.startsWith(ed.name)).sort())
      console.log('  leaflet/' + n + '  ' + (fs.statSync(path.join(OUT, n)).size / 1024).toFixed(0) + ' KB');
})().catch(e => { console.error(e); process.exit(1); });
