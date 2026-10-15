# 인투유학 매뉴얼 — 작업 규칙

- 사용자(저장소 주인)는 이 매뉴얼 사이트에 대한 **수정 요청을 확인 질문 없이 바로 반영하고 배포**하기를 원한다.
  수정 → `python3 tools/build_site.py`로 다시 빌드(원본·로고·빌드 스크립트·brand.css를 고쳤을 때) → 화면 확인 → 커밋 → 푸시하면 끝.
- 배포: Vercel 프로젝트 `intoedu-manual`이 이 GitHub 저장소의 기본 브랜치에 연결되어 있어 **푸시하면 자동으로 운영 배포**된다.
  푸시 후 배포 상태(READY)를 확인하고 결과 주소를 알려 준다.
- 매뉴얼 본문(그림 포함)은 `source/manual.html`을 고친 뒤 빌드한다. `index.html`, `assets/css/style.css`, `assets/js/search-index.js`, `assets/img/*`는 빌드 결과물이라 직접 고치지 않는다.
  브랜드 디자인은 `assets/css/brand.css`, 화면 동작·검색 화면(매뉴얼별 묶음 결과)은 `assets/js/app.js`, 잠금 화면은 `middleware.js`에서 직접 고친다.
- 비밀번호 잠금: `middleware.js`가 서버에서 모든 요청을 막는다. 비밀번호(`SITE_PASSWORD`)와 쿠키 서명키(`AUTH_SECRET`)는
  Vercel 환경변수에만 둔다. **비밀번호를 저장소에 적지 않는다.**
- 사업(비즈니스) 트랙 자료이므로 종교적 표현을 넣지 않는다.
