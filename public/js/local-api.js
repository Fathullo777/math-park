/** Локальный API + localStorage — сайт работает на GitHub Pages без сервера */
(function (global) {
  const C = () => global.ParkContent;
  const KEY = 'math_park_progress_v1';

  function emptyProgress() {
    return {
      name: '',
      score: 0,
      attractions: {},
      games: {},
      quiz: null,
      certificate: null,
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return emptyProgress();
      return { ...emptyProgress(), ...JSON.parse(raw) };
    } catch {
      return emptyProgress();
    }
  }

  function save(session) {
    localStorage.setItem(KEY, JSON.stringify(session));
    return session;
  }

  function answersEqual(expected, given) {
    if (typeof expected === 'number') {
      const n = Number(String(given).replace(',', '.').trim());
      return Number.isFinite(n) && n === expected;
    }
    return String(given).trim().toLowerCase() === String(expected).trim().toLowerCase();
  }

  function publicAttraction(a) {
    const base = {
      id: a.id,
      number: a.number,
      title: a.title,
      subtitle: a.subtitle,
      theme: a.theme,
      type: a.type,
      icon: a.icon,
      description: a.description,
      encouragement: a.encouragement,
    };
    if (a.facts) base.facts = a.facts;
    base.problems = a.problems.map((p) => {
      const { answer, ...rest } = p;
      const options = rest.options ? [...rest.options].sort(() => Math.random() - 0.5) : undefined;
      return options ? { ...rest, options } : rest;
    });
    return base;
  }

  function summarize(session) {
    const ids = C().REQUIRED_ATTRACTIONS;
    const completed = ids.filter((id) => session.attractions[id]?.completed);
    return {
      id: 'local',
      name: session.name || '',
      score: session.score || 0,
      attractions: session.attractions || {},
      games: session.games || {},
      quiz: session.quiz,
      certificate: session.certificate,
      completedAttractions: completed,
      completedCount: completed.length,
      totalAttractions: ids.length,
      quizUnlocked: completed.length >= ids.length,
      quizPassed: Boolean(session.quiz?.passed),
      mapProgress: ids.map((id) => ({
        id,
        done: Boolean(session.attractions[id]?.completed),
      })),
    };
  }

  function buildAnswerBook() {
    const { attractions, finalQuiz, games } = C();
    return {
      attractions: attractions.map((a) => ({
        id: a.id,
        number: a.number,
        title: a.title,
        icon: a.icon,
        items: a.problems.map((p) => ({
          id: p.id,
          prompt: p.prompt,
          answer: p.answer,
        })),
      })),
      quiz: {
        title: 'Финальная викторина',
        items: finalQuiz.map((q) => ({
          id: q.id,
          prompt: q.prompt,
          answer: q.answer,
        })),
      },
      games: {
        title: 'Игры (пары памяти)',
        items: (games.find((g) => g.id === 'memory')?.pairs || []).map((p, i) => ({
          id: `mem${i}`,
          prompt: p.q,
          answer: p.a,
        })),
      },
    };
  }

  function parseBody(options) {
    if (!options || options.body == null) return {};
    if (typeof options.body === 'string') {
      try {
        return JSON.parse(options.body);
      } catch {
        return {};
      }
    }
    return options.body;
  }

  async function handle(path, options = {}) {
    const method = (options.method || 'GET').toUpperCase();
    const body = parseBody(options);
    let session = load();

    if (path === '/api/bootstrap' && method === 'GET') {
      const { about, facts, games, attractions } = C();
      return {
        about,
        facts,
        games: games.map(({ id, title, description, type, durationSec, count, rounds }) => ({
          id,
          title,
          description,
          type,
          durationSec,
          count,
          rounds,
        })),
        attractions: attractions.map(publicAttraction),
        progress: summarize(session),
      };
    }

    if (path === '/api/profile' && method === 'POST') {
      session.name = String(body.name || '').trim().slice(0, 40);
      save(session);
      return { progress: summarize(session) };
    }

    if (path === '/api/reset' && method === 'POST') {
      const name = session.name;
      session = emptyProgress();
      session.name = name;
      save(session);
      return { progress: summarize(session) };
    }

    const attrCheck = path.match(/^\/api\/attractions\/([^/]+)\/check$/);
    if (attrCheck && method === 'POST') {
      const attraction = C().attractions.find((a) => a.id === attrCheck[1]);
      const problem = attraction?.problems.find((p) => p.id === body.problemId);
      if (!problem) {
        const err = new Error('Задание не найдено');
        err.status = 404;
        throw err;
      }
      return { correct: answersEqual(problem.answer, body.answer), problemId: problem.id };
    }

    const attrSubmit = path.match(/^\/api\/attractions\/([^/]+)\/submit$/);
    if (attrSubmit && method === 'POST') {
      const attraction = C().attractions.find((a) => a.id === attrSubmit[1]);
      if (!attraction) {
        const err = new Error('Аттракцион не найден');
        err.status = 404;
        throw err;
      }
      const answers = body.answers || {};
      const results = [];
      let correct = 0;
      for (const problem of attraction.problems) {
        const ok = answersEqual(problem.answer, answers[problem.id]);
        if (ok) correct += 1;
        results.push({ id: problem.id, correct: ok, given: answers[problem.id] ?? null });
      }
      const completed = correct === attraction.problems.length;
      const current = session.attractions[attraction.id] || {};
      const alreadyScored = current.bestCorrect || 0;
      const deltaCorrect = Math.max(0, correct - alreadyScored);
      const scoreGain = deltaCorrect * attraction.pointsPerCorrect;
      session.attractions[attraction.id] = {
        ...current,
        attempts: (current.attempts || 0) + 1,
        lastCorrect: correct,
        bestCorrect: Math.max(current.bestCorrect || 0, correct),
        total: attraction.problems.length,
        completed: current.completed || completed,
        lastAt: new Date().toISOString(),
      };
      session.score = (session.score || 0) + scoreGain;
      save(session);
      return {
        results,
        correct,
        total: attraction.problems.length,
        scoreGain,
        completed,
        progress: summarize(session),
      };
    }

    if (path === '/api/quiz' && method === 'GET') {
      const progress = summarize(session);
      if (!progress.quizUnlocked) {
        const err = new Error('Сначала пройди все аттракционы парка!');
        err.status = 403;
        err.data = { progress };
        throw err;
      }
      return {
        questions: C().finalQuiz.map(({ id, prompt, options }) => ({
          id,
          prompt,
          options: [...options].sort(() => Math.random() - 0.5),
        })),
        progress,
      };
    }

    if (path === '/api/quiz/check' && method === 'POST') {
      const progress = summarize(session);
      if (!progress.quizUnlocked) {
        const err = new Error('Викторина ещё закрыта');
        err.status = 403;
        throw err;
      }
      const q = C().finalQuiz.find((item) => item.id === body.problemId);
      if (!q) {
        const err = new Error('Вопрос не найден');
        err.status = 404;
        throw err;
      }
      return { correct: answersEqual(q.answer, body.answer), problemId: q.id };
    }

    if (path === '/api/quiz/submit' && method === 'POST') {
      const progress = summarize(session);
      if (!progress.quizUnlocked) {
        const err = new Error('Викторина ещё закрыта');
        err.status = 403;
        throw err;
      }
      const answers = body.answers || {};
      const results = C().finalQuiz.map((q) => {
        const ok = answersEqual(q.answer, answers[q.id]);
        return { id: q.id, correct: ok, given: answers[q.id] ?? null };
      });
      const correct = results.filter((r) => r.correct).length;
      const total = C().finalQuiz.length;
      const passed = correct / total >= C().QUIZ_PASS_RATIO;
      const prevBest = session.quiz?.bestCorrect || 0;
      const gain = Math.max(0, correct - prevBest) * 20;
      session.quiz = {
        correct,
        total,
        passed: session.quiz?.passed || passed,
        bestCorrect: Math.max(prevBest, correct),
        lastAt: new Date().toISOString(),
        results,
      };
      session.score = (session.score || 0) + gain;
      if ((session.quiz.passed || passed) && !session.certificate) {
        session.certificate = {
          code: `MP-${String(session.score).padStart(4, '0')}-${Date.now().toString(36).toUpperCase()}`,
          name: session.name || 'Юный математик',
          score: session.score,
          issuedAt: new Date().toISOString(),
          title: 'Сертификат лучшего посетителя',
          park: C().about.parkName,
        };
      }
      save(session);
      return {
        results,
        correct,
        total,
        passed,
        scoreGain: gain,
        progress: summarize(session),
      };
    }

    if (path === '/api/answer-book' && method === 'POST') {
      if (String(body.pin || '').trim() !== C().KEYS_PIN) {
        const err = new Error('Неверный код. Спроси у учителя или родителя.');
        err.status = 403;
        throw err;
      }
      return { book: buildAnswerBook() };
    }

    const gameStart = path.match(/^\/api\/games\/([^/]+)\/start$/);
    if (gameStart && method === 'GET') {
      const game = C().games.find((g) => g.id === gameStart[1]);
      if (!game) {
        const err = new Error('Игра не найдена');
        err.status = 404;
        throw err;
      }
      if (game.type === 'memory') {
        return { id: game.id, type: game.type, pairs: game.pairs.map((p) => ({ q: p.q, a: p.a })) };
      }
      return {
        id: game.id,
        type: game.type,
        durationSec: game.durationSec,
        count: game.count,
        rounds: game.rounds,
      };
    }

    const gameSubmit = path.match(/^\/api\/games\/([^/]+)\/submit$/);
    if (gameSubmit && method === 'POST') {
      const game = C().games.find((g) => g.id === gameSubmit[1]);
      if (!game) {
        const err = new Error('Игра не найдена');
        err.status = 404;
        throw err;
      }
      const correct = Math.max(0, Math.min(50, Number(body.correct) || 0));
      const total = Math.max(correct, Number(body.total) || correct);
      const current = session.games[game.id] || { best: 0, plays: 0 };
      const gain = Math.max(0, correct - (current.best || 0)) * game.pointsPerCorrect;
      session.games[game.id] = {
        plays: (current.plays || 0) + 1,
        best: Math.max(current.best || 0, correct),
        lastCorrect: correct,
        lastTotal: total,
        lastAt: new Date().toISOString(),
      };
      session.score = (session.score || 0) + gain;
      save(session);
      return { correct, total, earned: correct * game.pointsPerCorrect, progress: summarize(session) };
    }

    const err = new Error('Не найдено');
    err.status = 404;
    throw err;
  }

  global.ParkLocalAPI = { handle };
})(window);
