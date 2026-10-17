# MOA — 개인용 AI 정보 라이브러리

Next.js + Supabase + 선택적 OpenAI API로 만든 모바일/PC용 PWA.

## 설치

1. Node.js 20.9 이상 설치.
2. Supabase 프로젝트 생성 → SQL Editor에서 `supabase/schema.sql` 전체 실행.
3. Supabase Authentication → Providers → Email 활성화. 이메일 확인을 사용할 경우 URL Configuration에 배포 도메인과 `https://YOUR_DOMAIN/auth/callback` 등록. 개발 중에는 `http://localhost:3000` 및 `http://localhost:3000/auth/callback`도 등록.
4. `.env.example`을 `.env.local`로 복사하고 Supabase Project URL과 publishable/anon key 입력. AI 기능은 `OPENAI_API_KEY` 설정 시 활성화(없어도 링크 저장·검색은 작동). **service_role 키는 브라우저 환경변수에 절대 넣지 말 것.**
5. `npm install` → `npm run dev` → `http://localhost:3000` 접속.
6. `npm run build`로 빌드 검사 후 Vercel에 배포. Vercel 환경변수도 동일하게 입력.
7. 갤럭시 Chrome에서 HTTPS 배포 URL을 열고 메뉴 → 홈 화면에 추가/앱 설치. PC에서도 같은 주소로 로그인.

## 현재 기능
- 이메일 비밀번호 가입/로그인/로그아웃, Supabase RLS로 사용자별 분리
- 링크 저장/수정/삭제, 중복 URL 방지, 즐겨찾기
- 제목/설명/메모/태그/카테고리/출처 검색, 카테고리 필터
- 서버 측 URL 메타데이터 가져오기(일부 사이트 제한), 선택적 AI 요약 및 자동 분류/태그
- CSV 내보내기, PWA manifest, 모바일 반응형 UI
- 공유 링크는 `/share?url=...` 주소로 전달 가능. Android 공유 시트의 직접 PWA 등록은 기기·브라우저별 검증이 필요한 차기 기능.

## 주의 사항
- 실제 Supabase 프로젝트·API 키·배포 계정이 없어 여기서는 라이브 서비스에 접속하는 E2E 테스트를 수행하지 않았습니다.
- AI는 페이지 전체를 무조건 읽지 않습니다. 제목·설명·직접 입력한 메모·제공된 텍스트만 사용하며, 링크 원본을 열람했다고 주장하지 않습니다.
- Instagram/Daum Cafe/YouTube 등은 공개 범위·로그인·접근 정책에 따라 메타데이터 추출이 실패할 수 있습니다.
- 외부 URL 미리보기 기능은 프로덕션에서 DNS/IP 재검증 및 egress 방화벽을 추가해 SSRF 방어를 강화해야 합니다. 외부 공개 운영 전 보안 검토 권장.
- 대규모 사용자 대상 서비스로 운영하려면 요청 속도 제한, 비용 상한, 이메일 악용 방지, 백업 정책, 이미지 업로드 정책 등을 추가하세요.
- PWA의 오프라인 동작 및 Android 공유 메뉴 직접 저장은 이번 버전에 포함되지 않았습니다.
