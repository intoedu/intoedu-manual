/* 인투유학 매뉴얼 — 비밀번호 잠금 (Vercel Routing Middleware)
 *
 * 모든 요청을 서버에서 먼저 막고, 비밀번호가 맞으면 쿠키를 발급해 들여보냅니다.
 * 비밀번호는 코드에 적지 않고 Vercel 환경변수로만 둡니다.
 *   SITE_PASSWORD : 입장 비밀번호 (숫자 4자리)
 *   AUTH_SECRET   : 쿠키 서명용 임의 문자열 (바꾸면 모든 기기가 다시 로그인)
 * 비밀번호를 바꾸면 기존 로그인도 모두 풀립니다.
 */

export const config = { matcher: '/:path*' };

const COOKIE = 'im_auth';
const MAX_AGE = 60 * 60 * 24 * 30;            // 30일
const PUBLIC = new Set([                        // 잠금 화면에 필요한 파일만 공개
  '/assets/img/logo-lockup.png',
  '/assets/img/logo-mark.png',
  '/assets/img/favicon-32.png',
  '/assets/img/apple-touch-icon.png',
  '/assets/img/icon-512.png',
  '/site.webmanifest',
]);

const enc = new TextEncoder();

async function sign(secret, text) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(text));
  return Array.from(new Uint8Array(mac), (b) => b.toString(16).padStart(2, '0')).join('');
}

function same(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

function readCookie(req, name) {
  const raw = req.headers.get('cookie') || '';
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return '';
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const NO_STORE = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'private, no-store',
  'x-robots-tag': 'noindex, nofollow',
  'x-frame-options': 'DENY',
  'referrer-policy': 'same-origin',
};

export default async function middleware(req) {
  const url = new URL(req.url);
  const path = url.pathname;
  const pw = process.env.SITE_PASSWORD || '';
  const secret = process.env.AUTH_SECRET || '';

  if (PUBLIC.has(path)) return;                 // 그대로 통과

  if (!pw || !secret) {                         // 설정이 빠지면 닫아 둔다
    return new Response(gate('사이트 설정이 끝나지 않았습니다. 관리자에게 알려 주세요.', true), { status: 503, headers: NO_STORE });
  }

  const token = await sign(secret, 'intoedu-manual:' + pw);

  if (path === '/__logout') {
    return new Response(null, {
      status: 303,
      headers: { location: '/', 'cache-control': 'no-store', 'set-cookie': `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax` },
    });
  }

  if (path === '/__login' && req.method === 'POST') {
    let pin = '';
    try { pin = String((await req.formData()).get('pin') || '').trim(); } catch (e) { /* 빈 값 처리 */ }
    const tryToken = await sign(secret, 'intoedu-manual:' + pin);
    if (pin && same(tryToken, token)) {
      return new Response(null, {
        status: 303,
        headers: {
          location: '/', 'cache-control': 'no-store',
          'set-cookie': `${COOKIE}=${token}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Lax`,
        },
      });
    }
    await sleep(900);                            // 연속 대입을 늦춘다
    return new Response(gate('비밀번호가 맞지 않습니다. 다시 입력해 주세요.'), { status: 401, headers: NO_STORE });
  }

  if (same(readCookie(req, COOKIE), token)) return;   // 로그인됨 → 원래 파일로

  return new Response(gate(''), { status: 401, headers: NO_STORE });
}

function gate(msg, locked) {
  return `<!doctype html>
<html lang="ko"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<meta name="theme-color" content="#05205B">
<title>인투유학 매뉴얼</title>
<link rel="icon" type="image/png" sizes="32x32" href="/assets/img/favicon-32.png">
<link rel="apple-touch-icon" href="/assets/img/apple-touch-icon.png">
<style>
*{box-sizing:border-box}
html,body{height:100%}
body{margin:0;display:grid;place-items:center;padding:24px 16px;color:#fff;
  font-family:"Pretendard Variable","Pretendard","Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif;
  background:radial-gradient(700px 380px at 85% 0%,rgba(23,184,246,.22),transparent 70%),
    radial-gradient(600px 340px at 0% 100%,rgba(23,184,246,.10),transparent 70%),
    linear-gradient(160deg,#0A2C74,#05205B 60%);background-color:#05205B}
.box{width:100%;max-width:420px;text-align:center}
.logo{width:min(340px,100%);height:auto;display:block;margin:0 auto 34px}
h1{font-size:17px;font-weight:700;margin:0 0 6px;letter-spacing:-.02em}
.sub{font-size:13.5px;color:rgba(255,255,255,.6);margin:0 0 24px}
.pins{position:relative;display:flex;gap:12px;justify-content:center;margin:0 auto 18px;width:max-content}
.pins span{width:58px;height:66px;border-radius:14px;border:1.5px solid rgba(255,255,255,.22);
  background:rgba(255,255,255,.07);display:grid;place-items:center;font-size:28px;transition:border-color .15s,background .15s}
.pins span.f{border-color:#17B8F6;background:rgba(23,184,246,.12)}
.pins span.f::after{content:"";width:13px;height:13px;border-radius:50%;background:#fff}
.pins span.cur{border-color:rgba(255,255,255,.6)}
#pin{position:absolute;inset:0;width:100%;height:100%;opacity:0;font-size:16px;border:0;cursor:pointer;
  color:transparent;caret-color:transparent;background:transparent}
.msg{min-height:22px;font-size:13.5px;color:#ffb4a9;margin:0 0 14px;font-weight:600}
button{width:100%;max-width:268px;padding:13px;border:0;border-radius:12px;background:#17B8F6;color:#05205B;
  font:inherit;font-size:15px;font-weight:800;cursor:pointer}
button:disabled{opacity:.4;cursor:default}
.foot{margin-top:38px;font-size:11.5px;color:rgba(255,255,255,.4);letter-spacing:.06em}
@keyframes shake{20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}}
.err .pins{animation:shake .35s}
</style></head>
<body class="${msg && !locked ? 'err' : ''}">
<main class="box">
  <img class="logo" src="/assets/img/logo-lockup.png" alt="인투유학 매뉴얼">
  <h1>내부 직원 전용</h1>
  <p class="sub">비밀번호 4자리를 입력해 주세요</p>
  <form method="post" action="/__login" autocomplete="off">
    <div class="pins"><span aria-hidden="true"></span><span aria-hidden="true"></span><span aria-hidden="true"></span><span aria-hidden="true"></span>
      <input id="pin" name="pin" type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4"
        aria-label="비밀번호 4자리" autocomplete="off" ${locked ? 'disabled' : 'autofocus'} required>
    </div>
    <p class="msg" role="alert">${msg}</p>
    <button type="submit" id="go" ${locked ? 'disabled' : ''}>들어가기</button>
  </form>
  <div class="foot">INTO GLOBAL EDUCATION</div>
</main>
<script>
(function(){
  var i=document.getElementById('pin'),s=document.querySelectorAll('.pins span'),f=i.form,sent=false;
  function draw(){var v=i.value;s.forEach(function(e,k){e.className=k<v.length?'f':(k===v.length&&document.activeElement===i?'cur':'');});}
  i.addEventListener('input',function(){i.value=i.value.replace(/\\D/g,'').slice(0,4);draw();
    if(i.value.length===4&&!sent){sent=true;f.submit();}});
  i.addEventListener('focus',draw);i.addEventListener('blur',draw);
  f.addEventListener('submit',function(){sent=true;});
  draw();
})();
</script>
</body></html>`;
}
