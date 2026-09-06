/** Контент парка — для работы на GitHub Pages без сервера */
(function (global) {
  const attractions = [
    {
      id: 'carousel',
      number: 1,
      title: 'Карусель сложения',
      subtitle: 'Сложи два числа',
      theme: 'purple',
      type: 'choice',
      icon: 'carousel',
      description: 'Крутись на карусели: выбери правильный ответ!',
      encouragement: 'Супер! Карусель крутится веселее!',
      problems: [
        { id: 'c1', prompt: '5 + 7 = ?', options: [10, 12, 14], answer: 12 },
        { id: 'c2', prompt: '8 + 6 = ?', options: [12, 14, 16], answer: 14 },
        { id: 'c3', prompt: '9 + 9 = ?', options: [16, 18, 19], answer: 18 },
        { id: 'c4', prompt: '11 + 5 = ?', options: [15, 16, 17], answer: 16 },
      ],
      pointsPerCorrect: 10,
    },
    {
      id: 'coaster',
      number: 2,
      title: 'Горки умножения',
      subtitle: 'Таблица умножения',
      theme: 'orange',
      type: 'choice',
      icon: 'coaster',
      description: 'Летим с горок! Выбери верный ответ.',
      encouragement: 'Ура! Ты справился с горками!',
      problems: [
        { id: 'm1', prompt: '2 × 8 = ?', options: [14, 16, 18], answer: 16 },
        { id: 'm2', prompt: '3 × 5 = ?', options: [12, 15, 18], answer: 15 },
        { id: 'm3', prompt: '4 × 4 = ?', options: [12, 16, 18], answer: 16 },
        { id: 'm4', prompt: '5 × 6 = ?', options: [25, 30, 35], answer: 30 },
      ],
      pointsPerCorrect: 15,
    },
    {
      id: 'shooting',
      number: 3,
      title: 'Математический тир',
      subtitle: 'Попади в ответ',
      theme: 'green',
      type: 'choice',
      icon: 'target',
      description: 'Вычитай числа и попади в мишень!',
      encouragement: 'Попадание! Ты меткий стрелок!',
      problems: [
        { id: 's1', prompt: '15 − 8 = ?', options: [6, 7, 9], answer: 7 },
        { id: 's2', prompt: '20 − 6 = ?', options: [12, 14, 16], answer: 14 },
        { id: 's3', prompt: '18 − 9 = ?', options: [7, 8, 9], answer: 9 },
        { id: 's4', prompt: '16 ÷ 4 = ?', options: [3, 4, 5], answer: 4 },
      ],
      pointsPerCorrect: 15,
    },
    {
      id: 'maze',
      number: 4,
      title: 'Геометрический лабиринт',
      subtitle: 'Найди фигуру',
      theme: 'blue',
      type: 'match',
      icon: 'maze',
      description: 'Выбери свойство фигуры — и найди выход!',
      encouragement: 'Лабиринт пройден! Ты знаешь фигуры!',
      problems: [
        { id: 'g1', prompt: 'У треугольника…', options: ['3 стороны', '4 стороны', 'нет углов'], answer: '3 стороны' },
        { id: 'g2', prompt: 'У квадрата…', options: ['3 стороны', '4 равные стороны', 'нет углов'], answer: '4 равные стороны' },
        { id: 'g3', prompt: 'У прямоугольника…', options: ['4 угла по 90°', 'нет углов', '3 стороны'], answer: '4 угла по 90°' },
        { id: 'g4', prompt: 'У круга…', options: ['4 стороны', 'нет углов', '3 стороны'], answer: 'нет углов' },
      ],
      pointsPerCorrect: 12,
    },
    {
      id: 'surprises',
      number: 5,
      title: 'Комната сюрпризов',
      subtitle: 'Тайны чисел',
      theme: 'pink',
      type: 'quiz-facts',
      icon: 'gift',
      description: 'Прочитай сюрприз и ответь на вопрос!',
      encouragement: 'Все сюрпризы открыты! Молодец!',
      facts: [
        'Знак «=» значит «равно».',
        'Ноль — это число «ничего».',
        'Цифра 7 многим очень нравится.',
        'У круга нет углов.',
      ],
      problems: [
        { id: 'f1', prompt: 'Знак «=» значит…', options: ['Равно', 'Больше', 'Меньше'], answer: 'Равно' },
        { id: 'f2', prompt: 'Ноль — это…', options: ['Ничего', 'Десять', 'Сто'], answer: 'Ничего' },
        { id: 'f3', prompt: 'У круга есть углы?', options: ['Нет', 'Да', 'Только один'], answer: 'Нет' },
      ],
      pointsPerCorrect: 12,
    },
  ];

  const facts = [
    { title: 'Магия числа 9', text: '9 + 9 = 18, а 1 + 8 = 9. Снова девятка!', emoji: '✨' },
    { title: 'Пицца и доли', text: 'Пиццу разрезали на 4 части. Одна часть — это 1/4.', emoji: '🍕' },
    { title: 'Симметрия', text: 'Бабочка похожа слева и справа — это симметрия!', emoji: '🦋' },
    { title: 'Число π', text: 'π помогает измерять круги. Оно начинается так: 3,14…', emoji: '🔵' },
    { title: 'Быстрый счёт', text: '5 + 5 легче считать как «две пятёрки» — это 10!', emoji: '⚡' },
    { title: 'Чётные числа', text: '2, 4, 6, 8 — чётные. Их можно делить пополам поровну.', emoji: '2️⃣' },
  ];

  const games = [
    {
      id: 'race',
      title: 'Гонка примеров',
      description: 'Успей решить 6 примеров за 45 секунд!',
      type: 'timed',
      durationSec: 45,
      count: 6,
      pointsPerCorrect: 8,
    },
    {
      id: 'memory',
      title: 'Память чисел',
      description: 'Найди пары: пример и ответ.',
      type: 'memory',
      pairs: [
        { q: '6 + 7', a: '13' },
        { q: '4 × 5', a: '20' },
        { q: '18 − 9', a: '9' },
        { q: '12 ÷ 3', a: '4' },
        { q: '3 × 3', a: '9' },
        { q: '10 + 5', a: '15' },
      ],
      pointsPerCorrect: 6,
    },
    {
      id: 'balloon',
      title: 'Шары с ответами',
      description: 'Лопни шар с верным ответом!',
      type: 'balloon',
      rounds: 5,
      pointsPerCorrect: 10,
    },
  ];

  const finalQuiz = [
    { id: 'q1', prompt: 'Сколько будет 8 × 5?', options: ['35', '40', '45'], answer: '40' },
    { id: 'q2', prompt: 'У какой фигуры 3 стороны?', options: ['Квадрат', 'Треугольник', 'Круг'], answer: 'Треугольник' },
    { id: 'q3', prompt: '15 + 10 = ?', options: ['20', '25', '30'], answer: '25' },
    { id: 'q4', prompt: '20 − 6 = ?', options: ['12', '14', '16'], answer: '14' },
    { id: 'q5', prompt: 'Знак «=» значит…', options: ['Больше', 'Равно', 'Меньше'], answer: 'Равно' },
  ];

  const about = {
    title: 'О парке',
    parkName: 'Математический парк развлечений',
    author: 'Гульнара',
    text: 'Этот парк сделан для учеников младших классов. Здесь можно учиться через игру: решать примеры, проходить аттракционы и получать диплом.',
    mission: 'Показать, что математика — это интересно и совсем не страшно!',
  };

  global.ParkContent = {
    attractions,
    facts,
    games,
    finalQuiz,
    about,
    REQUIRED_ATTRACTIONS: attractions.map((a) => a.id),
    QUIZ_PASS_RATIO: 0.6,
    KEYS_PIN: '1234',
  };
})(window);
