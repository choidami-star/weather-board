// logic.js – 판단 규칙만 (화면을 다루는 코드 금지)

// 교육용 가상 기준 (실제 작업 중지 · 행사 취소 기준은 각 기관 규정을 따름)
const RULES = { wind: 10, rain: 60 };

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

if (typeof module !== 'undefined') module.exports = { RULES, judge };
