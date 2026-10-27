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

// 실제 API 연결 시 이 함수에서 같은 형식의 지역별 데이터를 반환한다.
// { 지역: { tempMax: 섭씨, windMax: m/s, rainProb: 0~100 } | null }
async function getWeatherByRegion() {
  return {
    '세종': { tempMax: 23, windMax: 3, rainProb: 20 },
    '태안': { tempMax: 21, windMax: 12, rainProb: 30 },
    '보령': { tempMax: 20, windMax: 5, rainProb: 80 },
    '대전': null,
  };
}

async function loadWeather() {
  const box = document.getElementById('weatherBox');
  try {
    weatherByRegion = await getWeatherByRegion();
    box.textContent = Object.entries(weatherByRegion)
      .map(([region, w]) => region + ' ' + (w ? weatherText(w) : '확인 전')).join(' / ');
  } catch (error) {
    weatherByRegion = {};
    box.textContent = '날씨를 불러오지 못했습니다. 날씨 확인 전으로 표시합니다.';
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
loadTasks();
renderTasks();
loadWeather();
