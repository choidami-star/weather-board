# 현장 일정 날씨판

가상 일정은 Supabase public.wx_tasks에서 읽고 추가도 같은 표에 저장합니다. 판단 규칙·필터·마크다운 저장 기능은 유지합니다.

## Supabase 설정
1. Supabase 프로젝트의 SQL Editor에서 저장소 루트의 `setup.sql`을 직접 한 번 실행합니다. 기존 wx_tasks가 있으면 덮어쓰지 않고 실패하므로 먼저 스키마를 확인하세요.
2. `config.js`의 두 빈 값에 프로젝트 HTTPS 주소와 공개용 publishable 키(`sb_publishable_...`) 또는 legacy anon 키를 입력합니다. secret/service_role 키는 사용하지 마세요.
3. Supabase Data API에서 public 스키마가 노출되어 있는지 확인하고 페이지를 엽니다. 외부 스크립트는 CDN의 supabase-js v2 하나만 사용합니다.

설정 전에는 연결 정보 안내가 표시되며 일정 추가 버튼이 비활성화됩니다. 초기 일정은 자동으로 넣지 않습니다. 기존 `data/tasks.json`은 참고 자료로 남고 localStorage의 wx_added도 삭제하지 않지만, 앱은 둘 다 읽거나 쓰지 않습니다. 기존 일정은 필요한 것만 직접 등록하세요.

이 로그인 없는 교육용 프로토타입은 공개 방문자 모두 일정 조회·추가가 가능합니다. RLS와 테이블 권한으로 수정·삭제는 허용하지 않습니다. 지역(세종·대전·태안·보령), 구분(야외·고소·실내), 빈 제목·담당 금지는 DB CHECK/NOT NULL 제약으로도 적용합니다. 실제 개인정보는 넣지 마세요.

SQL에 정의된 열: id(UUID 자동), created_at(서버 시각), title, region, kind, owner. 조회는 생성 시각과 id 순서이며 페이지 단위로 읽습니다. 저장 성공한 행만 화면에 추가합니다. 오류·시간 초과는 안내하고 입력을 보존합니다. 시간 초과 후 재시도 전에는 새로고침으로 실제 등록 여부를 확인하세요. 다른 사람의 추가 일정은 새로고침 시 반영됩니다.

## Vercel과 날씨 설정
- GitHub 저장소를 Vercel에 연결하고 Framework Preset을 Other로 설정합니다. 빌드 명령과 별도 출력 폴더는 필요 없습니다.
- Vercel 환경 변수 `KMA_KEY`에 기상청 일반 인증키(Decoding)를 설정하고 Redeploy합니다. 기존 `KMA_SERVICE_KEY`도 호환하며 KMA_KEY가 우선입니다. 이 키는 config.js나 GitHub에 넣지 않습니다.
- 로컬 날씨 호출은 `vercel link`, `vercel env pull .env.local`, `vercel dev`로 실행합니다. `.env.local`은 Git에서 제외됩니다.
- HTML 더블클릭 시에도 인터넷과 Supabase 설정이 있으면 DB 접근을 시도합니다. 기상청 날씨는 Vercel 또는 vercel dev가 필요합니다. 배포 주소에서 확인하는 것을 권장합니다.

기상청은 전날 23시 발표에서 오늘의 TMX와 24시간 WSD·POP 최댓값을 사용합니다. 날씨 서버 요청 8초, 브라우저 날씨·DB 요청 10초 제한입니다. 출처: https://www.data.go.kr/data/15084084/openapi.do

## 파일
- `setup.sql`: 직접 실행할 테이블·제약·RLS·권한 SQL
- `config.js`: Supabase 주소와 공개용 키 두 줄
- `app.js`: Supabase 조회·추가, 날씨 서버 호출과 화면 동작
- `logic.js`: 판단, 기상청 URL/응답 처리, 마크다운 생성
- `index.html`, `style.css`: 화면·모바일 디자인
- `api/weather.js`: 인증키를 서버에서만 사용하는 기상청 호출
- `data/tasks.json`: 과거 JSON 예시(현재 앱에서는 사용 안 함)

## 확인 방법
- T-01·T-10: 빈 config에서 안내·추가 비활성화 확인. 설정 후 빈 DB 안내와 등록한 목록 확인.
- T-02·T-09: 가상 일정을 추가하고 새로고침·다른 브라우저에서도 같은 목록 확인. 저장 중 중복 클릭은 차단됩니다.
- T-03·T-04: 실제 날씨와 `?test=wind` 풍속 12m/s 확인. 강수확률 60% 이상 우천 우선, 실내 정상 규칙 유지.
- T-05·T-06: 제목 아래 날짜와 모바일 카드 배치 확인.
- T-07·T-08: 날씨 실패 시 목록 유지, DB 실패 안내와 입력 보존, 서버 인증키 비노출 확인.
- T-11~T-14: 전체/주의 필터, 빈 결과 안내, 추가·날씨 갱신 시 선택 유지, PC·모바일 배치 확인.
- T-15: 오늘 판단 md로 저장을 눌러 현재 표와 마지막 판단 기준 확인.
- T-16: SQL에서 지역 또는 구분을 허용 목록 밖의 값으로 INSERT하면 CHECK 오류인지 확인. 공개 키를 사용하는 Data API에서 UPDATE/DELETE는 거부되어야 합니다(SQL Editor 관리자 권한과 구분).

Supabase 공식 문서: https://supabase.com/docs/reference/javascript/installing 및 https://supabase.com/docs/guides/database/secure-data

## 지역 일정·날씨·판단 통합 조회
`GET /api/kma?region=대전` (세종·대전·태안·보령 지원)을 배포 주소에서 호출합니다. `region`, 한국 날짜 `date`, `weather: {tempMax,windMax,rainProb}`, `tasks` 배열을 반환합니다. 각 일정에는 DB 필드와 `judgment: {level,text}`가 포함됩니다. 등록 일정이 없으면 tasks는 빈 배열입니다. 날씨와 판단은 DB에 저장하지 않고 요청 시 계산합니다.

날씨 실패 또는 KMA_KEY 미설정은 weather:null과 warning으로 알리며 DB 일정은 반환합니다. 기존 규칙에 따라 실내는 정상, 나머지는 미확인입니다. DB 실패는 502, 연결 설정 없음은 503, 잘못된 지역은 400, GET 외 요청은 405입니다. 인증키와 원본 오류는 반환하지 않습니다. config.js의 두 설정 줄에 브라우저·서버 공용 내보내기만 덧붙였으며 값은 유지합니다. 별도 외부 스크립트는 추가하지 않습니다.

T-17·T-18: 대전 통합 조회의 일정·날씨·판단, 빈 목록, 날씨 실패 시 목록 유지, 잘못된 지역의 오류를 확인합니다. DB 쓰기는 기존 화면 추가 기능에서만 합니다.
