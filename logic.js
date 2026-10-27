// logic.js – 판단 규칙만 (화면을 다루는 코드 금지)

// 교육용 가상 기준 (실제 작업 중지 · 행사 취소 기준은 각 기관 규정을 따름)
const RULES = { wind: 10, rain: 60 };

// 지역 중심의 대표 좌표. 네트워크 호출과 화면 접근은 app.js에서만 한다.
const REGIONS = {
  '세종': { nx: 66, ny: 103 },
  '대전': { nx: 67, ny: 100 },
  '태안': { nx: 48, ny: 109 },
  '보령': { nx: 54, ny: 100 },
};

function getKoreaDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
}

function buildWeatherUrl(region, serviceKey, now = new Date()) {
  if (typeof region !== 'string' || !Object.hasOwn(REGIONS, region)) {
    throw new Error('지원하지 않는 지역');
  }
  const coordinates = REGIONS[region];
  if (!coordinates) throw new Error('지원하지 않는 지역');
  if (!serviceKey) throw new Error('인증키 필요');
  // 오늘 전체 시간대를 포함하기 위해 전날 23시 발표 예보를 사용한다.
  const yesterday = getKoreaDate(new Date(now.getTime() - 86400000)).replaceAll('-', '');
  const params = new URLSearchParams({
    serviceKey, pageNo: '1', numOfRows: '1000', dataType: 'JSON',
    base_date: yesterday, base_time: '2300', nx: coordinates.nx, ny: coordinates.ny,
  });
  return 'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst?' + params;
}

function parseWeatherResponse(data, today, testWind = false) {
  if (typeof today !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(today)) return null;
  if (data?.response?.header?.resultCode !== '00') return null;
  const items = data.response.body?.items?.item;
  if (!Array.isArray(items)) return null;
  const values = { TMX: new Map(), WSD: new Map(), POP: new Map() };
  const targetDate = today.replaceAll('-', '');
  for (const item of items) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    if (item.fcstDate !== targetDate) continue;
    // SKY 등 다른 정상 예보 항목은 무시하며 상속 속성은 허용하지 않는다.
    if (typeof item.category !== 'string' || !Object.hasOwn(values, item.category)) continue;
    if (typeof item.fcstTime !== 'string' || !/^(?:[01]\d|2[0-3])00$/.test(item.fcstTime)) return null;
    if (typeof item.fcstValue !== 'string' && typeof item.fcstValue !== 'number') return null;
    if (String(item.fcstValue).trim() === '') return null;
    const value = Number(item.fcstValue);
    if (!Number.isFinite(value) || value <= -900 ||
        (item.category === 'WSD' && value < 0) ||
        (item.category === 'POP' && (value < 0 || value > 100))) return null;
    values[item.category].set(item.fcstTime, value);
  }
  // 일부 시간만으로 하루 최댓값을 오인하지 않는다.
  const hours = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0') + '00');
  if (!values.TMX.size || hours.some(h => !values.WSD.has(h) || !values.POP.has(h))) return null;
  const tempMax = Math.max(...values.TMX.values());
  const windMax = Math.max(...values.WSD.values());
  const rainProb = Math.max(...values.POP.values());
  return { tempMax, windMax: testWind ? 12 : windMax, rainProb };
}

// 일정 구분과 날씨로 판단 (w가 없으면 '날씨 확인 전')
function judge(kind, w) {
  if (kind === '실내') return { level: 'ok', text: '정상 진행' };
  if (!w || ![w.tempMax, w.windMax, w.rainProb].every(Number.isFinite)) {
    return { level: 'none', text: '날씨 확인 전' };
  }
  if (w.rainProb >= RULES.rain) return { level: 'rain', text: '우천 대비 필요' };
  if (w.windMax >= RULES.wind) return { level: 'wind', text: '강풍 주의' };
  return { level: 'ok', text: '정상 진행' };
}

// 화면과 같은 값으로 구성한 행을 받아 문서만 만든다. DOM 접근 없음.
function createJudgmentMarkdown(rows, date, { filter = 'all', testWind = false } = {}) {
  const escapeCell = value => String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\\/g, '&#92;').replace(/\|/g, '&#124;')
    .replace(/`/g, '&#96;').replace(/\*/g, '&#42;').replace(/_/g, '&#95;')
    .replace(/\[/g, '&#91;').replace(/\]/g, '&#93;')
    .replace(/\r\n|\r|\n/g, '<br>');
  const lines = [
    '# 현장 일정 날씨판 — ' + date,
    '',
    '표시 범위: ' + (filter === 'attention' ? '주의 일정만' : '전체 일정'),
    '일정·담당자는 가상 데이터이며 판단은 교육용 가상 기준입니다.',
  ];
  if (testWind) lines.push('풍속 시험 모드: 정상 수신한 풍속을 12m/s로 바꾼 결과입니다.');
  lines.push('', '| 일정 | 지역 | 구분 | 담당 | 날씨 | 판단 |', '| --- | --- | --- | --- | --- | --- |');
  for (const row of rows) lines.push('| ' + row.map(escapeCell).join(' | ') + ' |');
  if (!rows.length) lines.push('', filter === 'attention' ? '현재 주의가 필요한 일정이 없습니다.' : '표시할 일정이 없습니다.');
  lines.push('', `판단 기준: 풍속 ${RULES.wind}m/s 이상 강풍 주의 · 강수확률 ${RULES.rain}% 이상 우천 대비 필요(우선) · 기온은 표시만 하며 판단에 사용하지 않음 · 실내는 정상 진행`, '');
  return lines.join('\n');
}

if (typeof module !== 'undefined') {
  module.exports = { RULES, REGIONS, getKoreaDate, buildWeatherUrl, parseWeatherResponse, judge, createJudgmentMarkdown };
}
