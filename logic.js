// logic.js – 판단 규칙만 (화면을 다루는 코드 금지)

// 교육용 가상 기준 (실제 작업 중지 · 행사 취소 기준은 각 기관 규정을 따름)
const RULES = { wind: 10, rain: 60 };

// 지역 중심의 대표 좌표. 네트워크 호출과 화면 접근은 app.js에서만 한다.
const REGIONS = {
  '세종': { latitude: 36.4800, longitude: 127.2890 },
  '대전': { latitude: 36.3504, longitude: 127.3845 },
  '태안': { latitude: 36.7456, longitude: 126.2983 },
  '보령': { latitude: 36.3334, longitude: 126.6129 },
};

function getKoreaDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
}

function buildWeatherUrl(region) {
  const coordinates = REGIONS[region];
  if (!coordinates) throw new Error('지원하지 않는 지역');
  const params = new URLSearchParams({
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    daily: 'temperature_2m_max,wind_speed_10m_max,precipitation_probability_max',
    temperature_unit: 'celsius',
    wind_speed_unit: 'ms',
    timezone: 'Asia/Seoul',
    forecast_days: '1',
  });
  return 'https://api.open-meteo.com/v1/forecast?' + params;
}

function parseWeatherResponse(data, today, testWind = false) {
  if (data?.error) return null;
  const daily = data?.daily;
  const index = Array.isArray(daily?.time) ? daily.time.indexOf(today) : -1;
  if (index < 0) return null;
  const tempMax = daily.temperature_2m_max?.[index];
  const windMax = daily.wind_speed_10m_max?.[index];
  const rainProb = daily.precipitation_probability_max?.[index];
  if (![tempMax, windMax, rainProb].every(Number.isFinite) ||
      windMax < 0 || rainProb < 0 || rainProb > 100 ||
      data.daily_units?.temperature_2m_max !== '°C' ||
      data.daily_units?.wind_speed_10m_max !== 'm/s' ||
      data.daily_units?.precipitation_probability_max !== '%') return null;
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

if (typeof module !== 'undefined') {
  module.exports = { RULES, REGIONS, getKoreaDate, buildWeatherUrl, parseWeatherResponse, judge };
}
