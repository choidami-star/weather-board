const { SUPABASE_URL, SUPABASE_PUBLIC_KEY } = require('../config.js');
const { REGIONS, getKoreaDate, buildWeatherUrl, parseWeatherResponse, judge } = require('../logic.js');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'GET 요청만 지원합니다.' });
  }
  const region = req.query?.region;
  if (typeof region !== 'string' || !Object.hasOwn(REGIONS, region)) {
    return res.status(400).json({ error: '세종·대전·태안·보령 중 지역을 지정해 주세요.' });
  }
  if (!SUPABASE_URL || !SUPABASE_PUBLIC_KEY) {
    return res.status(503).json({ error: 'Supabase 연결 설정이 필요합니다.' });
  }
  const now = new Date();
  const date = getKoreaDate(now);
  // 서로 독립적으로 호출하여 날씨 실패가 일정 조회를 막지 않게 한다.
  const results = await Promise.allSettled([
    readTasks(region),
    readWeather(region, date, now),
  ]);
  if (results[0].status !== 'fulfilled') {
    return res.status(502).json({ error: 'DB 일정을 조회하지 못했습니다. 테이블·조회 권한·연결을 확인해 주세요.' });
  }
  const weather = results[1].status === 'fulfilled' ? results[1].value : null;
  return res.status(200).json({
    region, date, weather,
    tasks: results[0].value.map(task => ({ ...task, judgment: judge(task.kind, weather) })),
    ...(weather ? {} : { warning: '날씨를 받지 못했습니다. 실내 외 일정은 날씨 확인 전입니다.' }),
  });
};

async function readTasks(region) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const tasks = [];
    for (let offset = 0; ; offset += 1000) {
      const url = new URL('/rest/v1/wx_tasks', SUPABASE_URL);
      url.search = new URLSearchParams({
        select: 'id,created_at,title,region,kind,owner', region: 'eq.' + region,
        order: 'created_at.asc,id.asc', offset: String(offset), limit: '1000',
      });
      const response = await fetch(url, {
        headers: { apikey: SUPABASE_PUBLIC_KEY }, signal: controller.signal,
      });
      if (!response.ok) throw new Error('db');
      const rows = await response.json();
      if (!Array.isArray(rows) || !rows.every(row => row && row.region === region &&
          ['title', 'owner'].every(key => typeof row[key] === 'string' && row[key].trim()) &&
          ['야외', '고소', '실내'].includes(row.kind))) throw new Error('invalid db response');
      tasks.push(...rows);
      if (rows.length < 1000) return tasks;
    }
  } finally {
    clearTimeout(timeout);
  }
}

async function readWeather(region, date, now) {
  const key = process.env.KMA_KEY?.trim() || process.env.KMA_SERVICE_KEY?.trim();
  if (!key) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(buildWeatherUrl(region, key, now), { signal: controller.signal });
    if (!response.ok) return null;
    return parseWeatherResponse(await response.json(), date);
  } finally {
    clearTimeout(timeout);
  }
}
