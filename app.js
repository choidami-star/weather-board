// app.js – 화면 동작 (목록 그리기, 일정 추가)

let baseTasks = [];
let addedTasks = [];
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
      const response = await fetch('/api/weather?' + new URLSearchParams({ region }), { signal: controller.signal });
      if (!response.ok) throw new Error('날씨 API HTTP ' + response.status);
      const data = await response.json();
      const w = data.weather;
      if (data.date !== today || data.region !== region || !w ||
          ![w.tempMax, w.windMax, w.rainProb].every(Number.isFinite) ||
          w.windMax < 0 || w.rainProb < 0 || w.rainProb > 100) return null;
      return { ...w, windMax: testWind ? 12 : w.windMax };
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
  if (window.location.protocol === 'file:') {
    box.textContent = '기상청 날씨는 배포 주소 또는 vercel dev로 실행해 주세요.';
    return;
  }
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

function isTask(task) {
  return task && ['title', 'region', 'kind', 'owner'].every(key =>
    typeof task[key] === 'string' && task[key].trim().length > 0);
}

async function loadTasks() {
  const status = document.getElementById('taskStatus');
  const button = document.querySelector('#taskForm button');
  button.disabled = true;
  status.textContent = '일정을 불러오는 중입니다.';
  baseTasks = [];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch('data/tasks.json', { signal: controller.signal });
    if (!response.ok) throw new Error('일정 파일 읽기 실패');
    const data = await response.json();
    if (!Array.isArray(data) || !data.every(isTask)) throw new Error('일정 형식 오류');
    baseTasks = data;
    status.textContent = '';
  } catch {
    status.textContent = window.location.protocol === 'file:'
      ? '배포 주소로 열어 주세요'
      : '기본 일정 파일을 읽지 못했습니다. 잠시 후 새로고침해 주세요.';
  } finally {
    clearTimeout(timeout);
  }
  // 기본 JSON을 먼저 읽고, 화면에서 추가한 일정만 뒤에 합친다.
  try {
    const saved = JSON.parse(localStorage.getItem('wx_added') || '[]');
    if (!Array.isArray(saved) || !saved.every(isTask)) throw new Error('저장 형식 오류');
    addedTasks = saved;
  } catch {
    addedTasks = [];
    document.getElementById('msgBox').textContent = '브라우저에 저장된 추가 일정을 읽지 못했습니다.';
  }
  tasks = baseTasks.concat(addedTasks);
  renderTasks();
  button.disabled = false;
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
  const nextAdded = addedTasks.concat(t);
  try {
    localStorage.setItem('wx_added', JSON.stringify(nextAdded));
  } catch {
    document.getElementById('msgBox').textContent = '브라우저에 저장하지 못했습니다. 저장 공간과 권한을 확인해 주세요.';
    return;
  }
  addedTasks = nextAdded;
  tasks = baseTasks.concat(addedTasks);
  document.getElementById('msgBox').textContent = '';
  e.target.reset();
  renderTasks();
}

document.getElementById('taskForm').addEventListener('submit', addTask);
if (testWind) {
  document.getElementById('testNotice').hidden = false;
}
loadTasks();
loadWeather();
