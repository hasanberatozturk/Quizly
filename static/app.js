const { createApp } = Vue;
const paths = {
  compass: '<circle cx="12" cy="12" r="9"/><path d="m16 8-3 5-5 3 3-5z"/>',
  bookmark: '<path d="M6 4h12v17l-6-4-6 4z"/>',
  chart: '<path d="M4 3v17h17M8 15v-4m5 4V7m5 8V4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  back: '<path d="M20 12H5m6-6-6 6 6 6"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  award: '<circle cx="12" cy="9" r="6"/><path d="m8 14-2 7 6-3 6 3-2-7"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  moon: '<path d="M20.8 13A9 9 0 0 1 11 3.2 9 9 0 1 0 20.8 13Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  list: '<path d="M9 5h12M9 12h12M9 19h12M3 5h1M3 12h1M3 19h1"/>',
  bolt: '<path d="m13 2-9 12h7l-1 8 10-13h-7z"/>',
  globe: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 6.5h14M5 17.5h14"/>',
  science: '<path d="M9 3h6M10 3v6L4 19a1 1 0 0 0 1 2h14a1 1 0 0 0 1-2L14 9V3M7 15h10"/><path d="M10 18h.1M14 17h.1"/>',
  code: '<path d="m7 6-6 6 6 6m10-12 6 6-6 6M14 4l-4 16"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1-4 1.5 1.5 0 0 1 1-2h2a4 4 0 0 0 4-4c0-4-4-8-9-8Z"/><circle cx="7" cy="10" r=".7"/><circle cx="11" cy="7" r=".7"/><circle cx="16" cy="8" r=".7"/>',
  history: '<path d="m3 8 9-5 9 5H3Zm2 2v8m5-8v8m4-8v8m5-8v8M3 21h18M2 18h20"/>',
  spark: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z"/>',
  calculator: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M8 6h8M8 11h1m3 0h1m3 0h.1M8 15h1m3 0h1m3 0h.1M8 19h1m3 0h1m3 0h.1"/>',
  chip: '<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9" y="9" width="6" height="6" rx="1"/><path d="M9 2v4m6-4v4M9 18v4m6-4v4M2 9h4m-4 6h4M18 9h4m-4 6h4"/>',
  leaf: '<path d="M20 3c-8 0-15 3-15 10a6 6 0 0 0 6 6c7 0 9-8 9-16Z"/><path d="M3 21 15 9M8 16v-5m0 5h5"/>',
  book: '<path d="M12 5C8 2 3 3 3 3v16s5-1 9 2c4-3 9-2 9-2V3s-5-1-9 2Zm0 0v16M6 7h3m-3 4h3m6-4h3m-3 4h3"/>',
  retry: '<path d="M3 10a9 9 0 1 1 1 7M3 4v6h6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>'
};
function preference(key, fallback) {
  try { return localStorage.getItem('quizly-' + key) || fallback; }
  catch { return fallback; }
}
const app = createApp({
  data: () => ({
    view: 'explore', loading: true, busy: false, error: '', toast: '', quizzes: [],
    search: '', category: 'All topics', difficulty: 'All levels', sort: 'recommended',
    layout: preference('layout', 'grid') === 'list' ? 'list' : 'grid',
    colorMode: preference('theme', 'light') === 'dark' ? 'dark' : 'light',
    categoryMeta: [],
    navigation: [
      {id: 'explore', label: 'Testleri keşfet', icon: 'compass'},
      {id: 'saved', label: 'Kaydedilen testler', icon: 'bookmark'},
      {id: 'progress', label: 'Gelişimim', icon: 'chart'}
    ],
    progress: {completed: 0, average: 0, best: 0, correct: 0, attempts: []},
    attempt: null, answers: [], confidences: [], questionIndex: 0, result: null, reviewFilter: 'all',
    elapsed: 0, startedAt: 0, timer: null, toastTimer: null, exitDialog: false,
    draft: {title: '', description: '', category: 'Science', difficulty: 'Easy', questions: []}
  }),
  watch: {
    exitDialog(open) {
      this.$nextTick(() => {
        const modal = this.$refs.exitModal;
        if (open) modal.showModal(); else modal.close();
      });
    },
    colorMode(value) {
      document.documentElement.dataset.theme = value;
      this.savePreference('theme', value);
    },
    layout(value) { this.savePreference('layout', value); }
  },
  computed: {
    pageTitle() {
      return {explore: 'Testleri keşfet', saved: 'Kaydedilen testler', progress: 'Gelişimim',
        create: 'Test oluştur', play: 'Bilgini sına', result: 'Sonuçların'}[this.view];
    },
    categories() { return this.categoryMeta.map(category => category.id); },
    selectedCategory() { return this.categoryMeta.find(item => item.id === this.category); },
    catalogQuestionCount() { return this.filteredQuizzes.reduce((sum, quiz) => sum + quiz.question_count, 0); },
    practiceSources() {
      const seen = new Set();
      return this.progress.attempts.filter(attempt => {
        if (attempt.practice || seen.has(attempt.quiz_id)) return false;
        seen.add(attempt.quiz_id);
        return attempt.correct < attempt.total;
      }).slice(0, 3);
    },
    savedCount() { return this.quizzes.filter(q => q.saved).length; },
    filteredQuizzes() {
      const query = this.search.toLocaleLowerCase('tr-TR').trim();
      const quizzes = this.quizzes.filter(q =>
        (this.view !== 'saved' || q.saved) &&
        (this.category === 'All topics' || q.category === this.category) &&
        (this.difficulty === 'All levels' || q.difficulty === this.difficulty) &&
        `${q.title} ${q.description} ${this.categoryLabel(q.category)}`.toLocaleLowerCase('tr-TR').includes(query));
      if (this.sort === 'title') quizzes.sort((a, b) => a.title.localeCompare(b.title, 'tr'));
      if (this.sort === 'shortest') quizzes.sort((a, b) => a.question_count - b.question_count);
      if (this.sort === 'difficulty') {
        const levels = {Easy: 0, Medium: 1, Hard: 2};
        quizzes.sort((a, b) => levels[a.difficulty] - levels[b.difficulty]);
      }
      return quizzes;
    },
    hasFilters() { return this.search || this.category !== 'All topics' || this.difficulty !== 'All levels'; },
    currentQuestion() { return this.attempt?.questions[this.questionIndex]; },
    answeredCount() { return this.answers.filter(a => a !== null).length; },
    completedByQuiz() {
      const scores = {};
      for (const attempt of this.progress.attempts.filter(a => !a.practice)) {
        scores[attempt.quiz_id] = Math.max(scores[attempt.quiz_id] ?? 0, attempt.score);
      }
      return scores;
    },
    weeklyActivity() {
      const today = new Date();
      const days = Array.from({length: 7}, (_, index) => {
        const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6 + index);
        const count = this.progress.attempts.filter(attempt =>
          new Date(attempt.completed).toDateString() === date.toDateString()).length;
        return {date, count, label: new Intl.DateTimeFormat('tr-TR', {weekday: 'short'}).format(date), today: index === 6};
      });
      const max = Math.max(1, ...days.map(day => day.count));
      return days.map(day => ({...day, height: day.count / max * 100}));
    },
    weeklyTotal() { return this.weeklyActivity.reduce((sum, day) => sum + day.count, 0); },
    todayCompleted() { return this.weeklyActivity[6].count; },
    categoryProgress() {
      return this.categories.map(category => {
        const attempts = this.progress.attempts.filter(a => a.category === category && !a.practice);
        const total = attempts.reduce((sum, a) => sum + a.total, 0);
        const correct = attempts.reduce((sum, a) => sum + a.correct, 0);
        return {category, count: attempts.length, score: total ? Math.round(correct / total * 100) : 0};
      });
    },
    recentScores() { return this.progress.attempts.filter(a => !a.practice).slice(0, 8).reverse(); },
    filteredReview() {
      return (this.result?.review || []).map((q, index) => ({...q, number: index + 1}))
        .filter(q => this.reviewFilter === 'all' || (this.reviewFilter === 'wrong' && !q.is_correct) ||
          (this.reviewFilter === 'confident' && !q.is_correct && q.confidence === 'high'));
    }
  },
  async mounted() {
    document.documentElement.dataset.theme = this.colorMode;
    this.draft.questions = [this.newQuestion()];
    await this.load();
    window.addEventListener('beforeunload', this.beforeUnload);
    window.addEventListener('keydown', this.onKeydown);
  },
  beforeUnmount() {
    clearInterval(this.timer); clearTimeout(this.toastTimer);
    window.removeEventListener('beforeunload', this.beforeUnload);
    window.removeEventListener('keydown', this.onKeydown);
  },
  methods: {
    async load() {
      this.loading = true; this.error = '';
      try {
        // Establish the guest cookie before requesting private progress.
        this.quizzes = await this.api('/api/quizzes');
        [this.categoryMeta, this.progress] = await Promise.all([
          this.api('/api/categories'), this.api('/api/progress')
        ]);
      } catch (error) { this.error = error.message; }
      finally { this.loading = false; }
    },
    savePreference(key, value) {
      try { localStorage.setItem('quizly-' + key, value); } catch { /* Optional preference storage. */ }
    },
    toggleTheme() { this.colorMode = this.colorMode === 'light' ? 'dark' : 'light'; },
    categoryLabel(category) {
      return category === 'All topics' ? 'Tüm konular' : (this.categoryMeta.find(item => item.id === category)?.label || category);
    },
    difficultyLabel(difficulty) { return {Easy: 'Kolay', Medium: 'Orta', Hard: 'Zor'}[difficulty] || difficulty; },
    confidenceLabel(level) { return {low: 'Tahmin ettim', medium: 'Kısmen eminim', high: 'Eminim'}[level] || 'Belirtilmedi'; },
    theme(category) { return this.categoryMeta.find(item => item.id === category)?.color || 'mint'; },
    categoryIcon(category) { return this.categoryMeta.find(item => item.id === category)?.icon || 'grid'; },
    async api(path, options = {}) {
      let response;
      try { response = await fetch(path, {...options, headers: {'Content-Type': 'application/json', ...options.headers}}); }
      catch { throw new Error('Bağlantı kurulamadı. Bağlantını kontrol edip yeniden dene.'); }
      let data;
      try { data = await response.json(); }
      catch { throw new Error('Sunucudan yanıt alınamadı. Lütfen yeniden dene.'); }
      if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : 'Lütfen girdiğin bilgileri kontrol edip yeniden dene.');
      return data;
    },
    focusMain() {
      this.$nextTick(() => { document.getElementById('main').focus(); window.scrollTo({top: 0, behavior: 'instant'}); });
    },
    navigate(view) {
      if (this.busy) return;
      if (this.view === 'play') { this.exitDialog = true; return; }
      this.view = view; this.error = ''; this.resetSearch(); this.focusMain();
    },
    resetSearch() { this.search = ''; this.category = 'All topics'; this.difficulty = 'All levels'; },
    resetFilters() {
      this.resetSearch();
      if (this.view === 'saved' && !this.savedCount) this.navigate('explore');
    },
    notify(message) {
      this.toast = message; clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => this.toast = '', 3500);
    },
    async toggleSave(quiz) {
      if (quiz.saving) return;
      quiz.saving = true;
      try {
        const data = await this.api(`/api/quizzes/${quiz.id}/bookmark`, {method: 'PUT', body: JSON.stringify({saved: !quiz.saved})});
        quiz.saved = data.saved;
        this.notify(data.saved ? 'Bir sonraki keşfin için kaydedildi.' : 'Kaydedilen testlerden kaldırıldı.');
      } catch (error) { this.error = error.message; }
      finally { quiz.saving = false; }
    },
    surprise() { if (this.quizzes.length && this.view !== 'play') this.start(this.quizzes[Math.floor(Math.random() * this.quizzes.length)].id); },
    start(id) { return this.openAttempt('/api/quizzes/' + id + '/attempts'); },
    startPractice(id) { return this.openAttempt('/api/attempts/' + id + '/practice'); },
    async openAttempt(path) {
      if (this.busy) return;
      this.busy = true; this.error = '';
      try {
        this.attempt = await this.api(path, {method: 'POST'});
        this.answers = this.attempt.questions.map(() => null);
        this.confidences = this.attempt.questions.map(() => null); this.questionIndex = 0;
        this.view = 'play'; this.elapsed = 0; this.startedAt = Date.now();
        clearInterval(this.timer);
        this.timer = setInterval(() => this.elapsed = Math.floor((Date.now() - this.startedAt) / 1000), 1000);
        this.focusMain();
      } catch (error) { this.error = error.message; }
      finally { this.busy = false; }
    },
    async submit() {
      if (this.busy || this.answeredCount !== this.attempt.questions.length) return;
      this.busy = true; this.error = '';
      try {
        this.result = await this.api(`/api/attempts/${this.attempt.id}/submit`, {method: 'POST', body: JSON.stringify({answers: this.answers, confidence: this.confidences})});
        clearInterval(this.timer); this.reviewFilter = 'all'; this.view = 'result'; this.focusMain();
        this.progress = await this.api('/api/progress');
      } catch (error) { this.error = error.message; }
      finally { this.busy = false; }
    },
    onKeydown(event) {
      if (event.ctrlKey || event.metaKey || event.altKey || event.repeat || this.busy || this.exitDialog) return;
      if (event.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
      if (event.key === '/' && ['explore', 'saved'].includes(this.view)) {
        event.preventDefault(); this.$refs.searchInput?.focus(); return;
      }
      if (this.view !== 'play') return;
      if (/^[1-4]$/.test(event.key)) {
        event.preventDefault(); this.answers[this.questionIndex] = Number(event.key) - 1;
      }
      // Preserve native Enter behavior when a button or link has focus.
      if (event.key === 'Enter' && !event.target.closest?.('button, a')) {
        event.preventDefault();
        if (this.answers[this.questionIndex] === null) return;
        if (this.questionIndex < this.attempt.questions.length - 1) this.questionIndex++;
        else if (this.answeredCount === this.attempt.questions.length) this.submit();
      }
    },
    leaveQuiz() {
      if (this.busy) return;
      clearInterval(this.timer); this.exitDialog = false; this.attempt = null; this.view = 'explore'; this.focusMain();
    },
    showResult(result) { this.result = result; this.reviewFilter = 'all'; this.view = 'result'; this.focusMain(); },
    formatTime(seconds) { return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`; },
    formatDate(date) { return new Intl.DateTimeFormat('tr-TR', {month: 'short', day: 'numeric', year: 'numeric'}).format(new Date(date)); },
    beforeUnload(event) { if (this.view === 'play') { event.preventDefault(); event.returnValue = ''; } },
    newQuestion() { return {key: crypto.randomUUID(), text: '', options: ['', '', '', ''], correct: 0, explanation: ''}; },
    localizeValidation(event) {
      const field = event.target; field.setCustomValidity('');
      if (field.validity.valueMissing) field.setCustomValidity('Lütfen bu alanı doldur.');
      else if (field.validity.tooShort) field.setCustomValidity('Lütfen en az ' + field.minLength + ' karakter gir.');
      else if (field.validity.tooLong) field.setCustomValidity('Lütfen en fazla ' + field.maxLength + ' karakter gir.');
      else if (!field.validity.valid) field.setCustomValidity('Lütfen geçerli bir değer gir.');
    },
    clearValidation(event) { if (event.target.setCustomValidity) event.target.setCustomValidity(''); },
    async createQuiz() {
      if (this.busy) return;
      this.busy = true; this.error = '';
      try {
        const body = {...this.draft, questions: this.draft.questions.map(({key, ...q}) => q)};
        const quiz = await this.api('/api/quizzes', {method: 'POST', body: JSON.stringify(body)});
        this.quizzes.unshift(quiz);
        this.draft = {title: '', description: '', category: 'Science', difficulty: 'Easy', questions: [this.newQuestion()]};
        this.busy = false; this.sort = 'recommended'; this.navigate('explore');
        this.notify('Testin hazır. Keşifler başlasın!');
      } catch (error) { this.error = error.message; this.focusMain(); }
      finally { this.busy = false; }
    }
  }
});
app.component('icon', {
  props: ['name'],
  template: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" v-html="path"></svg>',
  computed: {path() { return paths[this.name] || paths.compass; }}
});
app.component('activity-chart', {
  props: ['days'],
  template: `<div class="activity-chart" role="list" aria-label="Son 7 günlük çalışma etkinliği">
    <div v-for="day in days" :key="day.date.toISOString()" role="listitem" :aria-label="day.date.toLocaleDateString('tr-TR') + ': ' + day.count + ' çalışma'" :class="['activity-day', {today:day.today}]">
      <span class="activity-value">{{day.count}}</span><div class="activity-track"><span :style="{height:Math.max(day.height, 4)+'%'}" :class="{zero:!day.count}"></span></div><span>{{day.label}}</span>
    </div></div>`
});
app.mount('#app');
