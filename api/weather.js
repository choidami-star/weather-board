// Vercel Node.js Function. 인증키와 원본 API 오류는 클라이언트에 반환하지 않는다.
const { REGIONS, getKoreaDate, buildWeatherUrl, parseWeatherResponse } = require('../logic.js');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'GET 요청만 지원합니다.' });
  }
  const region = req.query?.region;
  if (typeof region !== 'string' || !Object.hasOwn(REGIONS, region)) {
    return res.status(400).json({ error: '지원하지 않는 지역입니다.' });
  }
  const serviceKey = process.env.KMA_SERVICE_KEY?.trim();
  if (!serviceKey) return res.status(503).json({ error: '서버의 기상청 인증키 설정이 필요합니다.' });
  const now = new Date();
  const date = getKoreaDate(now);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(buildWeatherUrl(region, serviceKey, now), { signal: controller.signal });
    if (!response.ok) throw new Error('upstream');
    const weather = parseWeatherResponse(await response.json(), date);
    if (!weather) throw new Error('invalid');
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=600');
    return res.status(200).json({ region, date, weather });
  } catch {
    return res.status(502).json({ error: '기상청 예보를 받지 못했습니다. 잠시 후 다시 시도하세요.' });
  } finally {
    clearTimeout(timeout);
  }
};
