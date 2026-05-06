/* ─── STATE ─── */
const state = {
  name: '',
  order: [],
  index: 0,
  answers: {}
};

const $ = id => document.getElementById(id);

/* ─── SEEDED RANDOM ─── */
function normalizeName(name) {
  return name.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
}

function seedFromName(name) {
  const clean = normalizeName(name) || 'eleve';
  let seed = 2166136261;
  for (let i = 0; i < clean.length; i++) {
    seed ^= clean.charCodeAt(i) * (i + 1);
    seed = Math.imul(seed, 16777619);
  }
  return seed >>> 0;
}

function mulberry32(seed) {
  return function () {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function shuffledOrder(seed) {
  const arr = QUESTIONS.map((_, i) => i);
  const rand = mulberry32(seed);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* ─── PERSISTENCE ─── */
function storageKey() {
  return 'quiz_cc_' + normalizeName(state.name);
}

function saveState() {
  if (!state.name) return;
  localStorage.setItem(storageKey(), JSON.stringify({
    name: state.name,
    order: state.order,
    index: state.index,
    answers: state.answers
  }));
}

/* ─── HELPERS ─── */
function parseNumber(value) {
  if (value === undefined || value === null) return NaN;
  const cleaned = String(value).trim().replace(/\s/g, '').replace(/€/g, '').replace(/%/g, '').replace(/,/g, '.');
  if (cleaned === '') return NaN;
  return Number(cleaned);
}

function nearlyEqual(user, expected) {
  if (Number.isNaN(user)) return false;
  return Math.abs(user - expected) <= 0.011;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

function currentQuestion() {
  return QUESTIONS[state.order[state.index]];
}

function answeredCount() {
  return Object.values(state.answers).filter(arr => (arr || []).some(v => String(v || '').trim() !== '')).length;
}

/* ─── RENDER ─── */
function renderQuestion() {
  const q = currentQuestion();

  $('pillStudent').textContent = state.name;
  $('pillQuestion').textContent = (state.index + 1) + ' / ' + QUESTIONS.length;
  $('pillAnswered').textContent = answeredCount() + ' répondue(s)';
  $('pillCat').textContent = q.cat;
  $('progressFill').style.width = ((state.index + 1) / QUESTIONS.length * 100) + '%';
  $('questionText').textContent = q.text;

  // Next button logic — only enabled if current question is answered
  updateNextBtn();

  const saved = state.answers[state.index] || [];
  const zone = $('answerFields');
  zone.innerHTML = '';

  q.answers.forEach((ans, i) => {
    const div = document.createElement('div');
    div.className = 'answer-field';
    const uid = 'ans_' + i;
    div.innerHTML = `
      <label for="${uid}">${ans.label}</label>
      <input id="${uid}" data-idx="${i}" type="text" inputmode="decimal" autocomplete="off"
             placeholder="Ta réponse" value="${saved[i] ? escapeHtml(saved[i]) : ''}" />
      <div class="hint">Précision : ${q.decimals} décimale(s)${ans.suffix ? ' · Unité : ' + ans.suffix : ''}</div>
    `;
    zone.appendChild(div);
  });

  zone.querySelectorAll('input').forEach(input => {
    input.addEventListener('input', () => {
      storeCurrentInputs();
      saveState();
      renderGrid();
      $('pillAnswered').textContent = answeredCount() + ' répondue(s)';
      updateNextBtn();
      updateFinishBtn();
    });
  });

  renderGrid();
  updateFinishBtn();
}

function currentIsAnswered() {
  const arr = state.answers[state.index] || [];
  return arr.length > 0 && arr.every(v => String(v || '').trim() !== '');
}

function updateNextBtn() {
  const isLast = state.index === QUESTIONS.length - 1;
  $('nextBtn').disabled = isLast || !currentIsAnswered();
}

function updateFinishBtn() {
  const allDone = answeredCount() === QUESTIONS.length;
  $('finishBtn').disabled = !allDone;
  $('finishBtn').title = allDone ? 'Terminer et voir la note' : 'Réponds à toutes les questions pour terminer';
}

function renderGrid() {
  const wrap = $('questionGrid');
  wrap.innerHTML = '';
  state.order.forEach((qid, pos) => {
    const dot = document.createElement('div');
    dot.className = 'qdot';
    if (pos === state.index) dot.classList.add('active');
    if ((state.answers[pos] || []).some(v => String(v || '').trim() !== '')) dot.classList.add('done');
    dot.textContent = pos + 1;
    wrap.appendChild(dot);
  });
}

function storeCurrentInputs() {
  const inputs = Array.from(document.querySelectorAll('#answerFields input'));
  if (!inputs.length) return;
  state.answers[state.index] = inputs.map(i => i.value);
}

/* ─── NAVIGATION ─── */
function goNext() {
  storeCurrentInputs();
  if (state.index < QUESTIONS.length - 1) {
    state.index++;
    saveState();
    renderQuestion();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

/* ─── START ─── */
function startQuiz() {
  const name = $('studentName').value.trim();
  if (!name) {
    $('studentName').focus();
    return;
  }
  state.name = name;

  const existing = localStorage.getItem(storageKey());
  if (existing) {
    try {
      const data = JSON.parse(existing);
      state.order = data.order && data.order.length === QUESTIONS.length ? data.order : shuffledOrder(seedFromName(name));
      state.index = data.index || 0;
      state.answers = data.answers || {};
    } catch {
      state.order = shuffledOrder(seedFromName(name));
      state.index = 0;
      state.answers = {};
    }
  } else {
    state.order = shuffledOrder(seedFromName(name));
    state.index = 0;
    state.answers = {};
  }

  $('app').classList.remove('intro-mode');
  $('app').classList.add('quiz-mode');
  $('introCard').classList.add('hidden');
  $('quizCard').classList.remove('hidden');
  $('calcCard').classList.remove('hidden');
  renderQuestion();
  saveState();
}

/* ─── FINISH ─── */
function finishQuiz() {
  storeCurrentInputs();

  const totalAnswers = QUESTIONS.reduce((sum, q) => sum + q.answers.length, 0);
  let correct = 0;

  state.order.forEach((qid, pos) => {
    const q = QUESTIONS[qid];
    const userArr = state.answers[pos] || [];
    q.answers.forEach((ans, i) => {
      const userNum = parseNumber(userArr[i]);
      if (nearlyEqual(userNum, ans.value)) correct++;
    });
  });

  const score20 = (correct / totalAnswers) * 20;

  $('app').classList.remove('quiz-mode');
  $('app').classList.add('result-mode');
  $('quizCard').classList.add('hidden');
  $('calcCard').classList.add('hidden');
  $('resultCard').classList.remove('hidden');

  const now = new Date();
  $('resultName').textContent = state.name + ' — ' + now.toLocaleDateString('fr-FR') + ' à ' + now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  $('scoreDisplay').textContent = score20.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' / 20';
  $('scoreDetail').textContent = correct + ' bonne(s) réponse(s) sur ' + totalAnswers + ' · Tolérance ±0,01';

  saveState();
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Auto-capture after render
  setTimeout(captureResult, 400);
}

/* ─── SCREENSHOT ─── */
function captureResult() {
  const panel = $('resultCard');

  const clone = panel.cloneNode(true);
  clone.classList.remove('hidden');
  const actions = clone.querySelector('.result-actions');
  if (actions) actions.remove();

  clone.style.width = Math.min(panel.offsetWidth || 700, 900) + 'px';
  clone.style.margin = '0';
  clone.style.boxSizing = 'border-box';
  inlineStyles(panel, clone);

  const w = Math.ceil(panel.offsetWidth || 700);
  const h = Math.ceil(panel.offsetHeight || 400);
  const pad = 40;

  const wrapper = document.createElement('div');
  wrapper.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
  wrapper.style.background = '#f5f5f7';
  wrapper.style.padding = pad + 'px';
  wrapper.appendChild(clone);

  const serialized = new XMLSerializer().serializeToString(wrapper);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w + pad * 2}" height="${h + pad * 2}">
    <foreignObject width="100%" height="100%">${serialized}</foreignObject>
  </svg>`;

  const img = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));

  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = w + pad * 2;
    canvas.height = h + pad * 2;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f5f5f7';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);

    const link = document.createElement('a');
    link.download = 'resultat_' + normalizeName(state.name) + '_calculs_commerciaux.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  img.onerror = () => {
    URL.revokeObjectURL(url);
    alert('La capture automatique a échoué. Utilise le bouton « Imprimer » et choisis « Enregistrer en PDF ».');
  };

  img.src = url;
}

function inlineStyles(source, target) {
  const computed = window.getComputedStyle(source);
  for (const prop of computed) {
    target.style.setProperty(prop, computed.getPropertyValue(prop), computed.getPropertyPriority(prop));
  }
  const sc = Array.from(source.children);
  const tc = Array.from(target.children);
  sc.forEach((child, i) => { if (tc[i]) inlineStyles(child, tc[i]); });
}

/* ─── CALCULATOR ─── */
function calcAppend(value) {
  const screen = $('calcScreen');
  if (value === 'clear') { screen.value = ''; return; }
  if (value === 'back') { screen.value = screen.value.slice(0, -1); return; }
  if (value === 'percent') { screen.value += '/100'; return; }
  if (value === 'equal') { calcEval(); return; }
  screen.value += value === ',' ? ',' : value;
}

function calcEval() {
  const screen = $('calcScreen');
  let expr = screen.value.replace(/,/g, '.').replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
  if (!/^[0-9+\-*/().\s]+$/.test(expr)) { screen.value = 'Erreur'; return; }
  try {
    const result = Function('"use strict"; return (' + expr + ')')();
    if (!Number.isFinite(result)) throw new Error('bad');
    screen.value = String(Math.round(result * 1000000) / 1000000).replace('.', ',');
  } catch {
    screen.value = 'Erreur';
  }
}

/* ─── RESTART ─── */
function restart() {
  if (!confirm('Recommencer effacera toutes les réponses enregistrées pour « ' + state.name + ' ». Continuer ?')) return;
  localStorage.removeItem(storageKey());
  location.reload();
}

/* ─── BINDINGS ─── */
document.addEventListener('DOMContentLoaded', () => {
  $('startBtn').addEventListener('click', startQuiz);
  $('studentName').addEventListener('keydown', e => { if (e.key === 'Enter') startQuiz(); });
  $('nextBtn').addEventListener('click', goNext);
  $('clearBtn').addEventListener('click', () => {
    state.answers[state.index] = [];
    saveState();
    renderQuestion();
  });
  $('finishBtn').addEventListener('click', finishQuiz);

  document.querySelectorAll('[data-calc]').forEach(btn => {
    btn.addEventListener('click', () => calcAppend(btn.dataset.calc));
  });

  $('calcScreen').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); calcEval(); }
  });
});
