const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const {
  attractions,
  facts,
  games,
  finalQuiz,
  about,
  REQUIRED_ATTRACTIONS,
  QUIZ_PASS_RATIO,
  KEYS_PIN,
  publicAttraction,
  getAttraction,
  findAttractionProblem,
  findQuizProblem,
  buildAnswerBook,
} = require('./content');
const { getOrCreateSession, updateSession } = require('./store');

const app = express();
const PORT = process.env.PORT || 3000;
const COOKIE = 'math_park_sid';

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '..', 'public')));

function attachSession(req, res) {
  const sid = req.cookies[COOKIE] || req.headers['x-session-id'];
  const session = getOrCreateSession(sid);
  if (!req.cookies[COOKIE] || req.cookies[COOKIE] !== session.id) {
    res.cookie(COOKIE, session.id, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24 * 365,
    });
  }
  req.session = session;
  return session;
}

function summarize(session) {
  const completed = REQUIRED_ATTRACTIONS.filter(
    (id) => session.attractions[id]?.completed
  );
  const quizUnlocked = completed.length >= REQUIRED_ATTRACTIONS.length;
  const quizPassed = Boolean(session.quiz?.passed);
  return {
    id: session.id,
    name: session.name || '',
    score: session.score || 0,
    attractions: session.attractions || {},
    games: session.games || {},
    quiz: session.quiz,
    certificate: session.certificate,
    completedAttractions: completed,
    completedCount: completed.length,
    totalAttractions: REQUIRED_ATTRACTIONS.length,
    quizUnlocked,
    quizPassed,
    mapProgress: REQUIRED_ATTRACTIONS.map((id) => ({
      id,
      done: Boolean(session.attractions[id]?.completed),
    })),
  };
}

function answersEqual(expected, given) {
  if (typeof expected === 'number') {
    const n = Number(String(given).replace(',', '.').trim());
    return Number.isFinite(n) && n === expected;
  }
  return String(given).trim().toLowerCase() === String(expected).trim().toLowerCase();
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, park: about.parkName });
});

app.get('/api/bootstrap', (req, res) => {
  const session = attachSession(req, res);
  res.json({
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
  });
});

app.post('/api/profile', (req, res) => {
  const session = attachSession(req, res);
  const name = String(req.body?.name || '')
    .trim()
    .slice(0, 40);
  const updated = updateSession(session.id, (s) => {
    s.name = name;
    return s;
  });
  res.json({ progress: summarize(updated) });
});

app.get('/api/progress', (req, res) => {
  const session = attachSession(req, res);
  res.json({ progress: summarize(session) });
});

/** Проверка одного ответа аттракциона — без выдачи ключа заранее */
app.post('/api/attractions/:id/check', (req, res) => {
  attachSession(req, res);
  const found = findAttractionProblem(req.params.id, req.body?.problemId);
  if (!found) return res.status(404).json({ error: 'Задание не найдено' });
  const given = req.body?.answer;
  const correct = answersEqual(found.problem.answer, given);
  res.json({
    correct,
    problemId: found.problem.id,
  });
});

app.post('/api/quiz/check', (req, res) => {
  const session = attachSession(req, res);
  const progress = summarize(session);
  if (!progress.quizUnlocked) {
    return res.status(403).json({ error: 'Викторина ещё закрыта', progress });
  }
  const q = findQuizProblem(req.body?.problemId);
  if (!q) return res.status(404).json({ error: 'Вопрос не найден' });
  const correct = answersEqual(q.answer, req.body?.answer);
  res.json({ correct, problemId: q.id });
});

/** Книга ответов — только с кодом учителя */
app.post('/api/answer-book', (req, res) => {
  attachSession(req, res);
  const pin = String(req.body?.pin || '').trim();
  if (pin !== KEYS_PIN) {
    return res.status(403).json({ error: 'Неверный код. Спроси у учителя или родителя.' });
  }
  res.json({ book: buildAnswerBook() });
});

app.post('/api/attractions/:id/submit', (req, res) => {
  const session = attachSession(req, res);
  const attraction = getAttraction(req.params.id);
  if (!attraction) return res.status(404).json({ error: 'Аттракцион не найден' });

  const answers = req.body?.answers || {};
  const results = [];
  let correct = 0;

  for (const problem of attraction.problems) {
    const given = answers[problem.id];
    const ok = answersEqual(problem.answer, given);
    if (ok) correct += 1;
    results.push({
      id: problem.id,
      correct: ok,
      given: given ?? null,
    });
  }

  const completed = correct === attraction.problems.length;
  const prev = session.attractions[attraction.id];
  const alreadyScored = prev?.bestCorrect || 0;
  const deltaCorrect = Math.max(0, correct - alreadyScored);
  const scoreGain = deltaCorrect * attraction.pointsPerCorrect;

  const updated = updateSession(session.id, (s) => {
    const current = s.attractions[attraction.id] || {};
    s.attractions[attraction.id] = {
      ...current,
      attempts: (current.attempts || 0) + 1,
      lastCorrect: correct,
      bestCorrect: Math.max(current.bestCorrect || 0, correct),
      total: attraction.problems.length,
      completed: current.completed || completed,
      lastAt: new Date().toISOString(),
    };
    s.score = (s.score || 0) + scoreGain;
    return s;
  });

  res.json({
    results,
    correct,
    total: attraction.problems.length,
    scoreGain,
    completed,
    progress: summarize(updated),
  });
});

app.get('/api/games/:id/start', (req, res) => {
  attachSession(req, res);
  const game = games.find((g) => g.id === req.params.id);
  if (!game) return res.status(404).json({ error: 'Игра не найдена' });
  if (game.type === 'memory') {
    return res.json({
      id: game.id,
      type: game.type,
      pairs: game.pairs.map((p) => ({ q: p.q, a: p.a })),
    });
  }
  res.json({
    id: game.id,
    type: game.type,
    durationSec: game.durationSec,
    count: game.count,
    rounds: game.rounds,
  });
});

app.post('/api/games/:id/submit', (req, res) => {
  const session = attachSession(req, res);
  const game = games.find((g) => g.id === req.params.id);
  if (!game) return res.status(404).json({ error: 'Игра не найдена' });

  const correct = Math.max(0, Math.min(50, Number(req.body?.correct) || 0));
  const total = Math.max(correct, Number(req.body?.total) || correct);
  const earned = correct * game.pointsPerCorrect;

  const updated = updateSession(session.id, (s) => {
    const current = s.games[game.id] || { best: 0, plays: 0 };
    const gain = Math.max(0, correct - (current.best || 0)) * game.pointsPerCorrect;
    s.games[game.id] = {
      plays: (current.plays || 0) + 1,
      best: Math.max(current.best || 0, correct),
      lastCorrect: correct,
      lastTotal: total,
      lastAt: new Date().toISOString(),
    };
    s.score = (s.score || 0) + gain;
    return s;
  });

  res.json({
    correct,
    total,
    earned,
    progress: summarize(updated),
  });
});

app.get('/api/quiz', (req, res) => {
  const session = attachSession(req, res);
  const progress = summarize(session);
  if (!progress.quizUnlocked) {
    return res.status(403).json({
      error: 'Сначала пройди все аттракционы парка!',
      progress,
    });
  }
  res.json({
    questions: finalQuiz.map(({ id, prompt, options }) => ({ id, prompt, options })),
    progress,
  });
});

app.post('/api/quiz/submit', (req, res) => {
  const session = attachSession(req, res);
  const progress = summarize(session);
  if (!progress.quizUnlocked) {
    return res.status(403).json({ error: 'Викторина ещё закрыта', progress });
  }

  const answers = req.body?.answers || {};
  const results = finalQuiz.map((q) => {
    const given = answers[q.id];
    const ok = answersEqual(q.answer, given);
    return { id: q.id, correct: ok, given: given ?? null };
  });
  const correct = results.filter((r) => r.correct).length;
  const total = finalQuiz.length;
  const ratio = correct / total;
  const passed = ratio >= QUIZ_PASS_RATIO;

  const updated = updateSession(session.id, (s) => {
    const prevBest = s.quiz?.bestCorrect || 0;
    const gain = Math.max(0, correct - prevBest) * 20;
    s.quiz = {
      correct,
      total,
      passed: s.quiz?.passed || passed,
      bestCorrect: Math.max(prevBest, correct),
      lastAt: new Date().toISOString(),
      results,
    };
    s.score = (s.score || 0) + gain;

    if ((s.quiz.passed || passed) && !s.certificate) {
      const code = `MP-${String(s.score).padStart(4, '0')}-${Date.now().toString(36).toUpperCase()}`;
      s.certificate = {
        code,
        name: s.name || 'Юный математик',
        score: s.score,
        issuedAt: new Date().toISOString(),
        title: 'Сертификат лучшего посетителя',
        park: about.parkName,
      };
    }
    return s;
  });

  res.json({
    results,
    correct,
    total,
    passed,
    scoreGain: Math.max(0, correct - (session.quiz?.bestCorrect || 0)) * 20,
    progress: summarize(updated),
  });
});

app.post('/api/reset', (req, res) => {
  const session = attachSession(req, res);
  const name = session.name;
  const updated = updateSession(session.id, (s) => {
    s.score = 0;
    s.attractions = {};
    s.games = {};
    s.quiz = null;
    s.certificate = null;
    s.name = name;
    return s;
  });
  res.json({ progress: summarize(updated) });
});

app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api/')) {
    return res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  }
  return next();
});

app.listen(PORT, () => {
  console.log(`🎢 Математический парк: http://localhost:${PORT}`);
});
