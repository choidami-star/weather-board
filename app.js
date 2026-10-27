// app.js – 화면 동작 (목록 그리기, 일정 추가)

// 01 단원 : 일정 목록을 코드 안에 둠 (가상 데이터) → 04 단원에서 data/tasks.json 으로 분리
const SAMPLE_TASKS = [
  { title: '다중이용시설 안전점검', region: '세종', kind: '야외', owner: '김안전' },
  { title: '시민 안전체험 행사 운영', region: '보령', kind: '야외', owner: '이행사' },
  { title: '옥상 태양광 설비 점검', region: '태안', kind: '고소', owner: '박설비' },
  { title: '하천 수위계 확인', region: '대전', kind: '야외', owner: '최현장' },
  { title: '청사 외벽 간판 보수', region: '세종', kind: '고소', owner: '정시설' },
  { title: '비상연락 훈련', region: '대전', kind: '실내', owner: '한상황' },
];

let tasks = [];
let weatherByRegion = {};

const testWind = new URLSearchParams(window.location.search).get('test') === 'wind';

// 한 지역의 실패가 다른 지역에 영향을 주지 않도록 개별 결과를 받는다.
async function getWeatherByRegion() {
  const today = getKoreaDate();
  const regions = Object.keys(REGIONS);
  const results = await Promise.allSettled(regions.map(async region => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(buildWeatherUrl(region), { signal: controller.signal });
      if (!response.ok) throw new Error('날씨 API HTTP ' + response.status);
      return parseWeatherResponse(await response.json(), today, testWind);
    } finally {
      clearTimeout(timeout);
    }
  }));
  return Object.fromEntries(regions.map((region, index) => [
    region, results[index].status === 'fulfilled' ? results[index].value : null,
  ]));
}

async function loadWeather() {
  const box = document.getElementById('weatherBox');
  try {
    weatherByRegion = await getWeatherByRegion();
    box.textContent = Object.entries(weatherByRegion)
      .map(([region, w]) => region + ' ' + (w ? weatherText(w) : '확인 전')).join(' / ');
    if (Object.values(weatherByRegion).some(w => !w)) {
      box.textContent += ' · 일부 날씨를 받지 못했습니다. 미확인 지역은 날씨 확인 전으로 표시합니다(실내 제외).';
    }
  } catch (error) {
    weatherByRegion = {};
    box.textContent = '날씨를 불러오지 못했습니다. 날씨 확인 전으로 표시합니다(실내 제외).';
  }
  renderTasks();
}

function loadTasks() {
  const saved = JSON.parse(localStorage.getItem('wx_added') || '[]');
  tasks = SAMPLE_TASKS.concat(saved);
}

function weatherText(w) {
  return w ? w.tempMax + '℃ · ' + w.windMax + 'm/s · ' + w.rainProb + '%' : '-';
}

function renderTasks() {
  const body = document.getElementById('taskList');
  body.innerHTML = '';
  for (const t of tasks) {
    const w = weatherByRegion[t.region];
    const r = judge(t.kind, w);
    const tr = document.createElement('tr');
    const labels = ['일정', '지역', '구분', '담당', '날씨'];
    for (const [i, v] of [t.title, t.region, t.kind, t.owner, weatherText(w)].entries()) {
      const td = document.createElement('td');
      td.dataset.label = labels[i];
      td.textContent = v;
      tr.appendChild(td);
    }
    const td = document.createElement('td');
    td.dataset.label = '판단';
    const badge = document.createElement('span');
    badge.textContent = r.text;
    badge.className = 'badge badge-' + r.level;
    td.appendChild(badge);
    tr.appendChild(td);
    body.appendChild(tr);
  }
}

function addTask(e) {
  e.preventDefault();
  const t = {
    title: document.getElementById('titleInput').value.trim(),
    region: document.getElementById('regionInput').value,
    kind: document.getElementById('kindInput').value,
    owner: document.getElementById('ownerInput').value.trim(),
  };
  if (!t.title || !t.owner) return;
  const saved = JSON.parse(localStorage.getItem('wx_added') || '[]');
  saved.push(t);
  localStorage.setItem('wx_added', JSON.stringify(saved));
  e.target.reset();
  loadTasks();
  renderTasks();
}

document.getElementById('taskForm').addEventListener('submit', addTask);
if (testWind) {
  document.getElementById('testNotice').hidden = false;
}
loadTasks();
renderTasks();
loadWeather();
