// app.js – 화면 동작 (목록 그리기, 일정 추가)

let tasks = [];
let tasksDb = null;
let savingTask = false;
let weatherByRegion = {};
let selectedFilter = 'all';
let tasksLoading = true;
let displayedRows = [];

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
    typeof task[key] === 'string' && task[key].trim().length > 0) &&
    Object.hasOwn(REGIONS, task.region) && ['야외', '고소', '실내'].includes(task.kind);
}

function getTasksDb() {
  if (tasksDb) return tasksDb;
  if (typeof SUPABASE_URL !== 'string' || !SUPABASE_URL.trim() ||
      typeof SUPABASE_PUBLIC_KEY !== 'string' || !SUPABASE_PUBLIC_KEY.trim()) {
    throw new Error('config.js에 Supabase 주소와 공개용 키를 입력해 주세요.');
  }
  if (!window.supabase?.createClient) throw new Error('Supabase 스크립트를 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.');
  const key = SUPABASE_PUBLIC_KEY.trim();
  let publicKey = key.startsWith('sb_publishable_');
  if (!publicKey) {
    try {
      const payload = key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      publicKey = JSON.parse(atob(payload)).role === 'anon';
    } catch { publicKey = false; }
  }
  if (!publicKey) throw new Error('공개용 publishable 또는 anon 키만 사용해 주세요. 비밀 키는 금지합니다.');
  let url;
  try { url = new URL(SUPABASE_URL); } catch { throw new Error('Supabase 주소 형식을 확인해 주세요.'); }
  if (url.protocol !== 'https:') throw new Error('Supabase HTTPS 주소를 입력해 주세요.');
  tasksDb = window.supabase.createClient(url.origin, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return tasksDb;
}

async function loadTasks() {
  tasksLoading = true;
  document.getElementById('saveMarkdown').disabled = true;
  const status = document.getElementById('taskStatus');
  const button = document.querySelector('#taskForm button');
  button.disabled = true;
  status.textContent = '일정을 불러오는 중입니다.';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const db = getTasksDb();
    const loaded = [];
    // Supabase의 기본 반환 한도(1000건)를 넘는 목록도 끝까지 읽는다.
    for (let start = 0; ; start += 1000) {
      const { data, error } = await db.from('wx_tasks')
        .select('id,created_at,title,region,kind,owner')
        .order('created_at', { ascending: true }).order('id', { ascending: true })
        .range(start, start + 999).abortSignal(controller.signal);
      if (error || !Array.isArray(data) || !data.every(isTask)) throw new Error('조회 실패');
      loaded.push(...data);
      if (data.length < 1000) break;
    }
    tasks = loaded;
    status.textContent = tasks.length ? '' : '등록된 일정이 없습니다. 가상 일정을 추가해 주세요.';
  } catch (error) {
    status.textContent = tasksDb
      ? '일정을 불러오지 못했습니다. 연결·setup.sql 실행·조회 권한을 확인한 뒤 새로고침해 주세요.'
      : error.message;
  } finally {
    clearTimeout(timeout);
  }
  tasksLoading = false;
  renderTasks();
  button.disabled = !tasksDb;
}

function weatherText(w) {
  return w ? w.tempMax + '℃ · ' + w.windMax + 'm/s · ' + w.rainProb + '%' : '-';
}

function renderTasks() {
  const body = document.getElementById('taskList');
  body.innerHTML = '';
  displayedRows = [];
  let visibleCount = 0;
  for (const t of tasks) {
    const w = weatherByRegion[t.region];
    const r = judge(t.kind, w);
    if (selectedFilter === 'attention' && r.level !== 'wind' && r.level !== 'rain') continue;
    visibleCount += 1;
    displayedRows.push([t.title, t.region, t.kind, t.owner, weatherText(w), r.text]);
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
  document.getElementById('filterEmpty').hidden = tasksLoading || selectedFilter !== 'attention' || visibleCount > 0;
  document.getElementById('saveMarkdown').disabled = tasksLoading;
}

function saveJudgmentMarkdown() {
  if (tasksLoading) return;
  const date = getKoreaDate();
  const markdown = createJudgmentMarkdown(displayedRows, date, { filter: selectedFilter, testWind });
  const url = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = '현장일정_판단_' + date + '.md';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function setFilter(filter) {
  selectedFilter = filter;
  document.getElementById('filterAll').setAttribute('aria-pressed', String(filter === 'all'));
  document.getElementById('filterAttention').setAttribute('aria-pressed', String(filter === 'attention'));
  renderTasks();
}

async function addTask(e) {
  e.preventDefault();
  if (tasksLoading || savingTask || !tasksDb) return;
  const t = {
    title: document.getElementById('titleInput').value.trim(),
    region: document.getElementById('regionInput').value,
    kind: document.getElementById('kindInput').value,
    owner: document.getElementById('ownerInput').value.trim(),
  };
  const msg = document.getElementById('msgBox');
  if (!isTask(t)) {
    msg.textContent = '일정 이름·담당을 입력하고 허용된 지역·구분을 선택해 주세요.';
    return;
  }
  savingTask = true;
  const button = document.querySelector('#taskForm button');
  button.disabled = true;
  msg.textContent = '저장 중입니다.';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const { data, error } = await tasksDb.from('wx_tasks').insert(t)
      .select('id,created_at,title,region,kind,owner').single().abortSignal(controller.signal);
    if (error || !isTask(data)) throw new Error('저장 실패');
    tasks.push(data);
    document.getElementById('taskStatus').textContent = '';
    msg.textContent = 'Supabase에 저장했습니다.';
    e.target.reset();
    renderTasks();
  } catch {
    msg.textContent = '저장을 확인하지 못했습니다. 새로고침으로 등록 여부를 확인한 뒤 다시 시도해 주세요.';
  } finally {
    clearTimeout(timeout);
    savingTask = false;
    button.disabled = false;
  }
}

document.getElementById('taskForm').addEventListener('submit', addTask);
document.getElementById('filterAll').addEventListener('click', () => setFilter('all'));
document.getElementById('filterAttention').addEventListener('click', () => setFilter('attention'));
document.getElementById('saveMarkdown').addEventListener('click', saveJudgmentMarkdown);
if (testWind) {
  document.getElementById('testNotice').hidden = false;
}
loadTasks();
loadWeather();
