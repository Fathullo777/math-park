(() => {
  const state = {
    about: null,
    facts: [],
    games: [],
    attractions: [],
    progress: null,
    soundOn: true,
    audio: null,
    streak: 0,
    bestStreak: 0,
    journey: { factsDone: false, gamesDone: false },
    quizSession: false,
  };

  const JOURNEY_KEY = 'math_park_journey_v1';
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const icons = {
    carousel: '🎠',
    coaster: '🎢',
    target: '🎯',
    maze: '🧭',
    gift: '🎁',
  };

  const praise = ['Молодец!', 'Супер!', 'Умница!', 'Отлично!', 'Так держать!', 'Ты звезда!'];

  function loadJourney() {
    try {
      return { factsDone: false, gamesDone: false, ...JSON.parse(localStorage.getItem(JOURNEY_KEY) || '{}') };
    } catch {
      return { factsDone: false, gamesDone: false };
    }
  }

  function saveJourney() {
    localStorage.setItem(JOURNEY_KEY, JSON.stringify(state.journey));
  }

  /* ---------- Sound ---------- */
  function ensureAudio() {
    if (!state.audio) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      state.audio = new Ctx();
    }
    if (state.audio.state === 'suspended') state.audio.resume();
    return state.audio;
  }

  function beep(freq, dur = 0.12, type = 'sine', gain = 0.04) {
    if (!state.soundOn) return;
    const ctx = ensureAudio();
    if (!ctx) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = gain;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.stop(ctx.currentTime + dur);
  }

  function sfx(kind) {
    if (kind === 'click') beep(520, 0.06, 'triangle', 0.03);
    if (kind === 'ok') {
      beep(523, 0.09, 'sine', 0.05);
      setTimeout(() => beep(659, 0.1, 'sine', 0.05), 80);
      setTimeout(() => beep(784, 0.14, 'sine', 0.05), 160);
    }
    if (kind === 'bad') beep(180, 0.18, 'sawtooth', 0.03);
    if (kind === 'win') {
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, 0.16, 'sine', 0.05), i * 90));
    }
  }

  function confetti(count = 48) {
    const layer = $('#fx-layer');
    const colors = ['#ff6b6b', '#ffd43b', '#69db7c', '#74c0fc', '#b197fc', '#ff922b'];
    for (let i = 0; i < count; i += 1) {
      const el = document.createElement('i');
      el.className = 'confetti';
      el.style.left = `${Math.random() * 100}%`;
      el.style.background = colors[i % colors.length];
      el.style.animationDuration = `${1.6 + Math.random() * 1.6}s`;
      layer.appendChild(el);
      setTimeout(() => el.remove(), 3200);
    }
  }

  function say(msg) {
    const bubble = $('#mascot-bubble');
    if (!bubble) return;
    bubble.textContent = msg;
    bubble.style.animation = 'none';
    bubble.offsetHeight;
    bubble.style.animation = 'popStar .45s ease';
  }

  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.add('hidden'), 2400);
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function bumpStreak(ok) {
    state.streak = ok ? state.streak + 1 : 0;
    if (ok) state.bestStreak = Math.max(state.bestStreak, state.streak);
    if (ok && state.streak >= 3) say(`Серия ×${state.streak}!`);
    const el = $('#streak-value');
    if (el) {
      el.textContent = `🔥 ${state.streak}`;
      el.parentElement.classList.toggle('hot', state.streak >= 3);
    }
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function escapeAttr(s) {
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  async function api(path, options = {}) {
    return window.ParkLocalAPI.handle(path, options);
  }

  function starString(n) {
    return '★'.repeat(n) + '☆'.repeat(Math.max(0, 5 - n));
  }

  function animateNumber(el, from, to) {
    if (from === to) {
      el.textContent = to;
      return;
    }
    const start = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - start) / 450);
      el.textContent = Math.round(from + (to - from) * p);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* ---------- Journey unlock logic ---------- */
  function attractionDone(id) {
    return Boolean(state.progress?.attractions?.[id]?.completed);
  }

  function currentStepIndex() {
    const attrs = state.attractions;
    for (let i = 0; i < attrs.length; i += 1) {
      if (!attractionDone(attrs[i].id)) return i; // 0..4
    }
    if (!state.journey.factsDone) return 5;
    if (!state.journey.gamesDone) return 6;
    if (!state.progress?.certificate && !state.progress?.quiz?.passed) return 7;
    return 8; // finished
  }

  function isStepUnlocked(index) {
    return index <= currentStepIndex();
  }

  function isStepDone(index) {
    if (index < 5) return attractionDone(state.attractions[index]?.id);
    if (index === 5) return state.journey.factsDone;
    if (index === 6) return state.journey.gamesDone;
    if (index === 7) return Boolean(state.progress?.quiz?.passed || state.progress?.certificate);
    return Boolean(state.progress?.certificate);
  }

  function setProgress(progress) {
    state.progress = progress;
    const scoreEl = $('#score-value');
    animateNumber(scoreEl, Number(scoreEl.textContent) || 0, progress.score || 0);
    $('#stars-value').textContent = starString(progress.completedCount || 0);
    const nameInput = $('#player-name');
    if (document.activeElement !== nameInput) nameInput.value = progress.name || '';
    const step = Math.min(8, currentStepIndex() + 1);
    $('#step-progress').textContent = `${step}/8`;
    renderCertificate();
    renderJourney();
  }

  function renderCertificate() {
    const box = $('#certificate-view');
    const cert = state.progress?.certificate;
    if (!cert) {
      box.innerHTML = `<p class="cert-empty">Диплом появится после финальной викторины.</p>`;
      return;
    }
    const date = new Date(cert.issuedAt).toLocaleDateString('ru-RU');
    box.innerHTML = `
      <h3>Диплом чемпиона</h3>
      <p><strong>${cert.name}</strong></p>
      <p>Лучший гость парка!</p>
      <p>Очки: <strong>${cert.score}</strong></p>
      <p>${date}</p>
      <div class="seal">🏅</div>
    `;
  }

  function renderJourney() {
    const root = $('#journey');
    if (!root || !state.attractions.length) return;
    const cur = currentStepIndex();
    const quizUnlocked = isStepUnlocked(7);
    const quizDone = isStepDone(7);
    const preserveQuiz = state.quizSession && quizUnlocked && !quizDone;
    const savedQuiz = preserveQuiz ? $('#quiz-panel')?.innerHTML : null;

    const attrSteps = state.attractions
      .map((a, i) => {
        const done = isStepDone(i);
        const unlocked = isStepUnlocked(i);
        const locked = !unlocked;
        const current = cur === i;
        return `
        <article class="journey-step theme-${a.theme} ${done ? 'done' : ''} ${locked ? 'locked' : ''} ${current ? 'current' : ''}" data-step="${i}">
          <div class="journey-num">${done ? '★' : i + 1}</div>
          <div class="journey-body">
            <div class="journey-emoji">${icons[a.icon] || '⭐'}</div>
            <h3>Шаг ${i + 1}. ${a.title}</h3>
            <p>${a.description}</p>
            ${
              locked
                ? `<p class="lock-note">🔒 Сначала пройди шаг ${i}</p>`
                : `<button type="button" class="btn btn-primary" data-open-attraction="${a.id}">
                    ${done ? 'Пройти ещё раз ▶' : 'Начать ▶'}
                  </button>`
            }
          </div>
        </article>`;
      })
      .join('');

    const factsUnlocked = isStepUnlocked(5);
    const factsDone = isStepDone(5);
    const factsStep = `
      <article class="journey-step theme-blue ${factsDone ? 'done' : ''} ${!factsUnlocked ? 'locked' : ''} ${cur === 5 ? 'current' : ''}" data-step="5">
        <div class="journey-num">${factsDone ? '★' : 6}</div>
        <div class="journey-body">
          <div class="journey-emoji">💡</div>
          <h3>Шаг 6. Интересные факты</h3>
          <p>Прочитай факты про числа — и нажми «Дальше».</p>
          ${
            !factsUnlocked
              ? `<p class="lock-note">🔒 Сначала пройди все 5 аттракционов</p>`
              : `<div class="facts-grid compact">${state.facts
                  .map(
                    (f) => `
                <article class="fact-card">
                  <div class="fact-emoji">${f.emoji || '💡'}</div>
                  <h3>${f.title}</h3>
                  <p>${f.text}</p>
                </article>`
                  )
                  .join('')}</div>
                ${
                  factsDone
                    ? `<p class="ok-msg">✅ Факты прочитаны</p>`
                    : `<button type="button" class="btn btn-gold" id="facts-next-btn">Прочитал — дальше ▶</button>`
                }`
          }
        </div>
      </article>`;

    const gamesUnlocked = isStepUnlocked(6);
    const gamesDone = isStepDone(6);
    const gamesStep = `
      <article class="journey-step theme-orange ${gamesDone ? 'done' : ''} ${!gamesUnlocked ? 'locked' : ''} ${cur === 6 ? 'current' : ''}" data-step="6">
        <div class="journey-num">${gamesDone ? '★' : 7}</div>
        <div class="journey-body">
          <div class="journey-emoji">🎮</div>
          <h3>Шаг 7. Игра</h3>
          <p>Сыграй хотя бы в одну игру — потом откроется викторина.</p>
          ${
            !gamesUnlocked
              ? `<p class="lock-note">🔒 Сначала шаг 6</p>`
              : `<div class="games-grid compact">${state.games
                  .map((g) => {
                    const best = state.progress?.games?.[g.id]?.best;
                    return `
                    <article class="game-card">
                      <h3>${g.title}</h3>
                      <p>${g.description}</p>
                      <p style="font-weight:900;color:#2b8a3e">${best != null ? `Рекорд: ${best}` : 'Ещё не играли'}</p>
                      <button type="button" class="btn btn-primary" data-open-game="${g.id}">Играть</button>
                    </article>`;
                  })
                  .join('')}</div>
                ${
                  gamesDone
                    ? `<p class="ok-msg">✅ Игра пройдена — можно к викторине!</p>`
                    : `<p class="hint">После любой игры этот шаг закроется галочкой.</p>`
                }`
          }
        </div>
      </article>`;

    const quizStep = `
      <article class="journey-step theme-purple ${quizDone ? 'done' : ''} ${!quizUnlocked ? 'locked' : ''} ${cur === 7 ? 'current' : ''}" data-step="7" id="quiz-step">
        <div class="journey-num">${quizDone ? '★' : 8}</div>
        <div class="journey-body">
          <div class="journey-emoji">🏆</div>
          <h3>Шаг 8. Финальная викторина</h3>
          <p>5 вопросов — и диплом чемпиона!</p>
          ${
            !quizUnlocked
              ? `<p class="lock-note">🔒 Сначала пройди шаги 1–7</p>`
              : `<div id="quiz-panel">
                  <div id="quiz-play"></div>
                  <div id="quiz-result" class="hidden"></div>
                </div>`
          }
        </div>
      </article>`;

    root.innerHTML = attrSteps + factsStep + gamesStep + quizStep;

    const factsBtn = $('#facts-next-btn');
    if (factsBtn) {
      factsBtn.onclick = () => {
        state.journey.factsDone = true;
        saveJourney();
        sfx('ok');
        confetti(20);
        say('Дальше — игра!');
        toast('Шаг 6 пройден!');
        renderJourney();
        scrollToStep(6);
      };
    }

    if (preserveQuiz && savedQuiz) {
      const panel = $('#quiz-panel');
      if (panel) panel.innerHTML = savedQuiz;
    } else if (quizUnlocked && !quizDone) {
      state.quizSession = true;
      startQuizPlay();
    }

    const currentEl = root.querySelector('.journey-step.current');
    if (currentEl && !renderJourney._scrolled) {
      renderJourney._scrolled = true;
      setTimeout(() => currentEl.scrollIntoView({ behavior: 'smooth', block: 'center' }), 200);
    }
  }

  function scrollToStep(index) {
    renderJourney._scrolled = false;
    const el = document.querySelector(`.journey-step[data-step="${index}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function showView(id) {
    sfx('click');
    $$('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${id}`));
    $$('.nav-chip').forEach((n) => n.classList.toggle('active', n.dataset.view === id));
    if (id === 'answers') say('Только для взрослых!');
    else say('Поехали!');
  }

  /* ---------- Modal ---------- */
  function openModal(title, emoji = '✨') {
    $('#modal-title').textContent = title;
    $('#modal-emoji').textContent = emoji;
    $('#modal').classList.remove('hidden');
  }

  function closeModal() {
    $('#modal').classList.add('hidden');
    $('#modal-body').innerHTML = '';
    $('#step-dots').innerHTML = '';
  }

  function setDots(total, index, answers) {
    $('#step-dots').innerHTML = Array.from({ length: total }, (_, i) => {
      let cls = '';
      if (answers[i] != null) cls = answers[i] ? 'ok' : '';
      if (i === index) cls += ' on';
      return `<span class="${cls.trim()}"></span>`;
    }).join('');
  }

  /* ---------- Attractions ---------- */
  function startAttraction(id) {
    const idx = state.attractions.findIndex((x) => x.id === id);
    if (idx < 0) return;
    if (!isStepUnlocked(idx)) {
      toast(`Сначала пройди шаг ${idx}`);
      return;
    }
    const a = state.attractions[idx];
    sfx('click');
    say('Удачи!');
    openModal(a.title, icons[a.icon] || '✨');

    const answers = {};
    const correctness = [];
    let step = 0;
    let tries = 0;

    const renderStep = () => {
      const p = a.problems[step];
      tries = 0;
      setDots(a.problems.length, step, correctness);
      let factBlock = '';
      if (a.facts?.length) {
        factBlock = `<div class="facts-mini">🎁 ${a.facts[Math.min(step, a.facts.length - 1)]}</div>`;
      }
      const choices = shuffle(p.options || [])
        .map((o) => `<button type="button" class="choice-btn" data-val="${escapeAttr(o)}">${o}</button>`)
        .join('');
      $('#modal-body').innerHTML = `
        <div class="play-screen">
          ${factBlock}
          <div class="combo-bar"><span>Серия: 🔥 ${state.streak}</span><span>Попытка <b id="try-n">1</b></span></div>
          <p class="play-hint">Вопрос ${step + 1} из ${a.problems.length}</p>
          <div class="play-prompt bounce-in">${p.prompt}</div>
          <div class="choice-grid">${choices}</div>
          <div class="feedback" id="step-feedback"></div>
        </div>`;
      $$('.choice-btn', $('#modal-body')).forEach((btn) => {
        btn.onclick = () => onChoose(btn, p);
      });
    };

    const onChoose = async (btn, problem) => {
      $$('.choice-btn', $('#modal-body')).forEach((b) => {
        b.disabled = true;
      });
      const val = btn.dataset.val;
      tries += 1;
      const tryN = $('#try-n');
      if (tryN) tryN.textContent = String(tries);

      let ok = false;
      try {
        const check = await api(`/api/attractions/${a.id}/check`, {
          method: 'POST',
          body: JSON.stringify({ problemId: problem.id, answer: val }),
        });
        ok = Boolean(check.correct);
      } catch (err) {
        toast(err.message);
        $$('.choice-btn', $('#modal-body')).forEach((b) => {
          b.disabled = false;
        });
        return;
      }

      if (ok) {
        answers[problem.id] = val;
        correctness[step] = true;
        btn.classList.add('correct');
        bumpStreak(true);
        sfx('ok');
        $('#step-feedback').innerHTML = `<span class="ok-msg">${pick(praise)}</span>`;
        say(pick(praise));
        confetti(state.streak >= 3 ? 22 : 10);
        setTimeout(async () => {
          step += 1;
          if (step < a.problems.length) renderStep();
          else await finishAttraction(a, answers, idx);
        }, 700);
        return;
      }

      bumpStreak(false);
      btn.classList.add('wrong');
      sfx('bad');
      say('Ещё раз!');
      if (tries < 2) {
        $('#step-feedback').textContent = 'Неверно — выбери другой ответ!';
        setTimeout(() => {
          btn.classList.remove('wrong');
          $$('.choice-btn', $('#modal-body')).forEach((b) => {
            b.disabled = false;
          });
          $('#step-feedback').textContent = '';
        }, 700);
        return;
      }
      answers[problem.id] = val;
      correctness[step] = false;
      $('#step-feedback').textContent = 'Этот вопрос пропустим. Ответ — в разделе «Ответы».';
      setTimeout(async () => {
        step += 1;
        if (step < a.problems.length) renderStep();
        else await finishAttraction(a, answers, idx);
      }, 1100);
    };

    renderStep();
  }

  async function finishAttraction(a, answers, idx) {
    try {
      const data = await api(`/api/attractions/${a.id}/submit`, {
        method: 'POST',
        body: JSON.stringify({ answers }),
      });
      setProgress(data.progress);
      $('#step-dots').innerHTML = data.results.map((r) => `<span class="${r.correct ? 'ok' : ''}"></span>`).join('');
      const lines = data.results
        .map((r, i) =>
          r.correct
            ? `<div class="result-line ok">✅ Вопрос ${i + 1}</div>`
            : `<div class="result-line bad">❌ Вопрос ${i + 1}</div>`
        )
        .join('');
      $('#modal-body').innerHTML = `
        <div class="win-screen">
          <div class="big">${data.completed ? '🌟' : '💪'}</div>
          <h3 style="font-family:var(--font-display);color:#5b35d1;margin:.2rem 0">
            ${data.completed ? a.encouragement || 'Шаг пройден!' : 'Почти! Попробуй ещё раз'}
          </h3>
          <p style="font-weight:900">Верно: ${data.correct}/${data.total} · +${data.scoreGain} очков</p>
          <div class="result-list">${lines}</div>
          <div class="end-actions">
            ${data.completed ? '' : `<button type="button" class="btn btn-primary" id="retry-ride">Ещё раз</button>`}
            <button type="button" class="btn btn-gold" id="close-ride">Дальше</button>
          </div>
        </div>`;
      if (data.completed) {
        sfx('win');
        confetti(50);
        say('Следующий шаг!');
        toast(`Шаг ${idx + 1} пройден!`);
      } else {
        sfx('bad');
        const retry = $('#retry-ride');
        if (retry) retry.onclick = () => startAttraction(a.id);
      }
      $('#close-ride').onclick = () => {
        closeModal();
        if (data.completed) scrollToStep(Math.min(idx + 1, 7));
      };
    } catch (err) {
      toast(err.message);
      closeModal();
    }
  }

  /* ---------- Quiz ---------- */
  async function startQuizPlay() {
    const play = $('#quiz-play');
    if (!play) return;
    try {
      const data = await api('/api/quiz');
      play.dataset.ready = '1';
      play.classList.remove('hidden');
      const result = $('#quiz-result');
      if (result) result.classList.add('hidden');

      const answers = {};
      let step = 0;
      const qs = data.questions;

      const render = () => {
        const q = qs[step];
        const opts = shuffle(q.options || []);
        play.innerHTML = `
          <div class="quiz-step">
            <div class="combo-bar"><span>Серия: 🔥 ${state.streak}</span><span>Вопрос ${step + 1}/${qs.length}</span></div>
            <div class="play-prompt bounce-in">${q.prompt}</div>
            <div class="choice-grid">
              ${opts
                .map((o, i) => `<button type="button" class="choice-btn" data-val="${escapeAttr(o)}">${String.fromCharCode(65 + i)}. ${o}</button>`)
                .join('')}
            </div>
            <div class="feedback" id="quiz-feedback"></div>
          </div>`;
        $$('.choice-btn', play).forEach((btn) => {
          btn.onclick = async () => {
            $$('.choice-btn', play).forEach((b) => {
              b.disabled = true;
            });
            const val = btn.dataset.val;
            let ok = false;
            try {
              const check = await api('/api/quiz/check', {
                method: 'POST',
                body: JSON.stringify({ problemId: q.id, answer: val }),
              });
              ok = Boolean(check.correct);
            } catch (err) {
              toast(err.message);
              $$('.choice-btn', play).forEach((b) => {
                b.disabled = false;
              });
              return;
            }
            answers[q.id] = val;
            bumpStreak(ok);
            if (ok) {
              btn.classList.add('correct');
              sfx('ok');
              confetti(12);
              $('#quiz-feedback').innerHTML = `<span class="ok-msg">${pick(praise)}</span>`;
            } else {
              btn.classList.add('wrong');
              sfx('bad');
              $('#quiz-feedback').textContent = 'Идём дальше!';
            }
            step += 1;
            setTimeout(async () => {
              if (step < qs.length) render();
              else await submitQuiz(answers);
            }, ok ? 550 : 800);
          };
        });
      };
      render();
    } catch (e) {
      play.innerHTML = `<p class="lock-note">${e.message}</p>`;
    }
  }

  async function submitQuiz(answers) {
    const data = await api('/api/quiz/submit', {
      method: 'POST',
      body: JSON.stringify({ answers }),
    });
    setProgress(data.progress);
    const play = $('#quiz-play');
    const box = $('#quiz-result');
    if (play) play.classList.add('hidden');
    if (!box) return;
    box.classList.remove('hidden');
    const lines = data.results
      .map((r, i) =>
        r.correct
          ? `<div class="result-line ok">✅ Вопрос ${i + 1}</div>`
          : `<div class="result-line bad">❌ Вопрос ${i + 1}</div>`
      )
      .join('');
    box.innerHTML = `
      <div class="win-screen">
        <div class="big">${data.passed ? '🏆' : '✨'}</div>
        <p style="font-weight:900;font-size:1.2rem">${data.passed ? 'Победа! Ты чемпион!' : 'Почти получилось!'}</p>
        <p style="font-weight:800">Результат: ${data.correct}/${data.total}</p>
        <div class="result-list">${lines}</div>
        ${
          data.passed
            ? '<p class="ok-msg">Смотри диплом ниже 👇</p>'
            : '<button type="button" class="btn btn-primary" id="retry-quiz">Ещё раз</button>'
        }
      </div>`;
    if (data.passed) {
      sfx('win');
      confetti(80);
      say('Диплом твой!');
      $('#certificate-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      sfx('bad');
      $('#retry-quiz').onclick = () => {
        state.quizSession = true;
        if (play) {
          play.dataset.ready = '';
          play.classList.remove('hidden');
        }
        box.classList.add('hidden');
        startQuizPlay();
      };
    }
  }

  /* ---------- Answer book ---------- */
  function renderAnswerBook(book) {
    const blocks = book.attractions
      .map(
        (a) => `
      <details class="key-block" open>
        <summary>${icons[a.icon] || '⭐'} ${a.number}. ${a.title}</summary>
        <ol>${a.items.map((it) => `<li><span class="q">${it.prompt}</span> → <strong class="a">${it.answer}</strong></li>`).join('')}</ol>
      </details>`
      )
      .join('');
    const quiz = `
      <details class="key-block" open>
        <summary>🏆 ${book.quiz.title}</summary>
        <ol>${book.quiz.items.map((it) => `<li><span class="q">${it.prompt}</span> → <strong class="a">${it.answer}</strong></li>`).join('')}</ol>
      </details>`;
    const gamesBlock = `
      <details class="key-block">
        <summary>🎮 ${book.games.title}</summary>
        <ol>${book.games.items.map((it) => `<li><span class="q">${it.prompt}</span> → <strong class="a">${it.answer}</strong></li>`).join('')}</ol>
      </details>`;
    $('#answers-book').innerHTML = blocks + quiz + gamesBlock;
  }

  async function unlockAnswers() {
    const pin = $('#answers-pin').value.trim();
    const err = $('#answers-error');
    err.classList.add('hidden');
    try {
      const data = await api('/api/answer-book', { method: 'POST', body: JSON.stringify({ pin }) });
      renderAnswerBook(data.book);
      $('#answers-lock').classList.add('hidden');
      $('#answers-book').classList.remove('hidden');
      $('#answers-hide-btn').classList.remove('hidden');
      sfx('ok');
      toast('Книга ответов открыта');
    } catch (e) {
      err.textContent = e.message;
      err.classList.remove('hidden');
      sfx('bad');
    }
  }

  function hideAnswers() {
    $('#answers-book').classList.add('hidden');
    $('#answers-book').innerHTML = '';
    $('#answers-hide-btn').classList.add('hidden');
    $('#answers-lock').classList.remove('hidden');
    $('#answers-pin').value = '';
  }

  /* ---------- Games ---------- */
  function openGame(id) {
    if (!isStepUnlocked(6)) {
      toast('Сначала пройди предыдущие шаги');
      return;
    }
    const game = state.games.find((g) => g.id === id);
    if (!game) return;
    sfx('click');
    if (game.type === 'timed') openTimedGame(game);
    else if (game.type === 'memory') openMemoryGame(game);
    else if (game.type === 'balloon') openBalloonGame(game);
  }

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function makeExpr() {
    const kinds = [
      () => {
        const a = randInt(1, 12);
        const b = randInt(1, 12);
        return { prompt: `${a} + ${b}`, answer: a + b };
      },
      () => {
        const a = randInt(8, 20);
        const b = randInt(1, 8);
        return { prompt: `${a} − ${b}`, answer: a - b };
      },
      () => {
        const a = randInt(2, 5);
        const b = randInt(2, 5);
        return { prompt: `${a} × ${b}`, answer: a * b };
      },
    ];
    return kinds[randInt(0, kinds.length - 1)]();
  }

  function markGameDone() {
    if (!state.journey.gamesDone) {
      state.journey.gamesDone = true;
      saveJourney();
      toast('Шаг 7 пройден!');
      say('Пора на викторину!');
    }
    renderJourney();
    scrollToStep(7);
  }

  function openTimedGame(game) {
    let left = game.durationSec;
    let correct = 0;
    let total = 0;
    let current = makeExpr();
    let buf = '';
    openModal(game.title, '⏱️');
    const paint = () => {
      $('#modal-body').innerHTML = `
        <div class="game-arena">
          <p style="font-weight:900">Верно: <strong id="g-correct">${correct}</strong> · Время: <strong id="timer">${left}</strong></p>
          <div class="timer-bar"><i id="timer-fill" style="transform:scaleX(${left / game.durationSec})"></i></div>
          <div class="big" id="g-prompt">${current.prompt} = ?</div>
          <div class="answer-display" id="g-buf">${buf || '—'}</div>
          <div class="num-pad" id="num-pad">
            ${[1, 2, 3, 4, 5, 6, 7, 8, 9, '⌫', 0, 'OK'].map((n) => `<button type="button" data-n="${n}">${n}</button>`).join('')}
          </div>
        </div>`;
      $('#num-pad').onclick = (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        const n = b.dataset.n;
        if (n === '⌫') buf = buf.slice(0, -1);
        else if (n === 'OK') submitAns();
        else if (buf.length < 3) buf += n;
        $('#g-buf').textContent = buf || '—';
        sfx('click');
      };
    };
    const submitAns = () => {
      total += 1;
      if (Number(buf) === current.answer) {
        correct += 1;
        bumpStreak(true);
        sfx('ok');
        confetti(8);
      } else {
        bumpStreak(false);
        sfx('bad');
      }
      buf = '';
      current = makeExpr();
      if (correct >= game.count) {
        clearInterval(tick);
        finishGame(game.id, correct, total);
        return;
      }
      paint();
    };
    paint();
    const tick = setInterval(() => {
      left -= 1;
      const t = $('#timer');
      const f = $('#timer-fill');
      if (t) t.textContent = left;
      if (f) f.style.transform = `scaleX(${Math.max(0, left / game.durationSec)})`;
      if (left <= 0) {
        clearInterval(tick);
        finishGame(game.id, correct, Math.max(total, 1));
      }
    }, 1000);
    $('#modal-close').addEventListener('click', () => clearInterval(tick), { once: true });
  }

  async function openMemoryGame(game) {
    let pairs = game.pairs;
    if (!pairs) {
      const data = await api(`/api/games/${game.id}/start`);
      pairs = data.pairs;
    }
    const cards = [];
    pairs.forEach((p, i) => {
      cards.push({ pair: i, text: p.q });
      cards.push({ pair: i, text: p.a });
    });
    cards.sort(() => Math.random() - 0.5);
    let open = [];
    let matched = 0;
    let locked = false;
    openModal(game.title, '🧠');
    $('#modal-body').innerHTML = `
      <div class="memory-grid" id="memory-grid">
        ${cards
          .map((c, i) => `<button type="button" class="memory-card" data-i="${i}" data-pair="${c.pair}" data-text="${escapeAttr(c.text)}">?</button>`)
          .join('')}
      </div>`;
    $('#memory-grid').onclick = async (e) => {
      const btn = e.target.closest('.memory-card');
      if (!btn || locked || btn.classList.contains('matched') || btn.classList.contains('open')) return;
      sfx('click');
      btn.classList.add('open');
      btn.textContent = btn.dataset.text;
      open.push(btn);
      if (open.length < 2) return;
      locked = true;
      const [a, b] = open;
      if (a.dataset.pair === b.dataset.pair) {
        a.classList.add('matched');
        b.classList.add('matched');
        matched += 1;
        open = [];
        locked = false;
        bumpStreak(true);
        sfx('ok');
        if (matched >= pairs.length) {
          sfx('win');
          confetti(40);
          await finishGame(game.id, matched, pairs.length);
        }
      } else {
        bumpStreak(false);
        sfx('bad');
        setTimeout(() => {
          a.classList.remove('open');
          b.classList.remove('open');
          a.textContent = '?';
          b.textContent = '?';
          open = [];
          locked = false;
        }, 650);
      }
    };
  }

  function openBalloonGame(game) {
    let round = 0;
    let correct = 0;
    const next = () => {
      round += 1;
      if (round > game.rounds) {
        finishGame(game.id, correct, game.rounds);
        return;
      }
      const expr = makeExpr();
      const opts = new Set([expr.answer]);
      while (opts.size < 3) {
        const n = expr.answer + randInt(-4, 4);
        if (n !== expr.answer && n > 0) opts.add(n);
      }
      const list = [...opts].sort(() => Math.random() - 0.5);
      openModal(game.title, '🎈');
      $('#modal-body').innerHTML = `
        <div class="game-arena">
          <p style="font-weight:900">Раунд ${round}/${game.rounds}</p>
          <div class="big">${expr.prompt} = ?</div>
          <div class="balloon-row">
            ${list.map((v) => `<button type="button" class="balloon-btn" data-v="${v}">${v}</button>`).join('')}
          </div>
        </div>`;
      $$('.balloon-btn').forEach((b) => {
        b.onclick = () => {
          if (Number(b.dataset.v) === expr.answer) {
            correct += 1;
            bumpStreak(true);
            sfx('ok');
            confetti(12);
          } else {
            bumpStreak(false);
            sfx('bad');
          }
          next();
        };
      });
    };
    next();
  }

  async function finishGame(id, correct, total) {
    const data = await api(`/api/games/${id}/submit`, {
      method: 'POST',
      body: JSON.stringify({ correct, total }),
    });
    setProgress(data.progress);
    markGameDone();
    openModal('Результат', '🎉');
    $('#modal-body').innerHTML = `
      <div class="win-screen">
        <div class="big">🌟</div>
        <p class="big" style="font-size:2rem">${correct}/${total}</p>
        <p style="font-weight:900">Очки добавлены!</p>
        <button type="button" class="btn btn-gold" id="close-game-result">Дальше к викторине</button>
      </div>`;
    sfx('win');
    $('#close-game-result').onclick = () => {
      closeModal();
      scrollToStep(7);
    };
  }

  /* ---------- Bindings ---------- */
  function bindUI() {
    $$('.nav-chip').forEach((btn) => {
      btn.addEventListener('click', () => showView(btn.dataset.view));
    });

    document.body.addEventListener('click', (e) => {
      const attr = e.target.closest('[data-open-attraction]');
      if (attr) startAttraction(attr.dataset.openAttraction);
      const gameBtn = e.target.closest('[data-open-game]');
      if (gameBtn) openGame(gameBtn.dataset.openGame);
    });

    $('#modal-close').onclick = closeModal;
    $('#modal').addEventListener('click', (e) => {
      if (e.target.id === 'modal') closeModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });

    $('#sound-btn').onclick = () => {
      state.soundOn = !state.soundOn;
      $('#sound-btn').setAttribute('aria-pressed', String(state.soundOn));
      $('#sound-btn').textContent = state.soundOn ? '🔊' : '🔇';
      if (state.soundOn) {
        ensureAudio();
        sfx('click');
      }
    };

    let nameTimer;
    $('#player-name').addEventListener('input', (e) => {
      clearTimeout(nameTimer);
      nameTimer = setTimeout(async () => {
        try {
          const data = await api('/api/profile', {
            method: 'POST',
            body: JSON.stringify({ name: e.target.value }),
          });
          setProgress(data.progress);
          if (e.target.value.trim()) say(`Привет, ${e.target.value.trim()}!`);
        } catch (_) {
          /* ignore */
        }
      }, 400);
    });

    $('#reset-btn').onclick = async () => {
      if (!confirm('Начать сначала и стереть прогресс?')) return;
      const data = await api('/api/reset', { method: 'POST', body: '{}' });
      state.journey = { factsDone: false, gamesDone: false };
      saveJourney();
      state.quizSession = false;
      state.streak = 0;
      bumpStreak(false);
      setProgress(data.progress);
      hideAnswers();
      toast('Прогресс сброшен');
      say('Новый старт!');
      showView('park');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    $('#answers-unlock-btn').onclick = unlockAnswers;
    $('#answers-hide-btn').onclick = hideAnswers;
    $('#answers-pin').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') unlockAnswers();
    });

    window.addEventListener(
      'pointerdown',
      () => {
        ensureAudio();
      },
      { once: true }
    );
  }

  async function init() {
    state.journey = loadJourney();
    bindUI();
    const data = await api('/api/bootstrap');
    state.about = data.about;
    state.facts = data.facts;
    state.games = data.games;
    state.attractions = data.attractions;
    $('#about-text').innerHTML = `${data.about.text} Парк создала: <strong>${data.about.author}</strong>. Учителям: ответы — код <strong>1234</strong>.`;
    setProgress(data.progress);
    showView('park');
    say('Поехали по порядку!');
  }

  init().catch((err) => {
    console.error(err);
    toast('Ошибка загрузки. Обнови страницу.');
  });
})();
