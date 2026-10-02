const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8').replace(/^\uFEFF/, '');
const seeds = JSON.parse(read('quizzes.json'));
const categories = JSON.parse(read('categories.json'));
const tick = () => new Promise(resolve => setImmediate(resolve));

async function setup(initial = {}) {
 const errors = [];
 const virtualConsole = new VirtualConsole();
 virtualConsole.on('jsdomError', error => errors.push(error.message));
 const dom = new JSDOM(read('static/index.html'), {url:'http://localhost/', runScripts:'outside-only', pretendToBeVisual:true, virtualConsole});
 const {window} = dom;
 for(const [key,value] of Object.entries(initial.storage || {})) window.localStorage.setItem(key,value);
 if(initial.blockStorage) Object.defineProperty(window,'localStorage',{get(){throw new Error('Storage blocked')}});
 window.scrollTo = () => {};
 window.HTMLDialogElement.prototype.showModal = function(){ this.setAttribute('open',''); };
 window.HTMLDialogElement.prototype.close = function(){ this.removeAttribute('open'); };
 const quizzes = seeds.map(({questions,...q})=>({...q,question_count:questions.length,minutes:questions.length,saved:false}));
 const attempts = initial.attempts || [];
 let active, activeId; let sequence=0; const snapshots=new Map();
 window.fetch = async (url,options={}) => {
  let data;
  if(url==='/api/quizzes' && options.method==='POST'){
   const body=JSON.parse(options.body);const quiz={...body,id:'custom',question_count:body.questions.length,minutes:body.questions.length,saved:false};quizzes.unshift(quiz);data=quiz;
  } else if(url==='/api/quizzes') data=quizzes;
  else if(url==='/api/categories') data=categories.map(c=>({...c,quiz_count:quizzes.filter(q=>q.category===c.id).length,question_count:quizzes.filter(q=>q.category===c.id).reduce((sum,q)=>sum+q.question_count,0)}));
  else if(url==='/api/progress') {
   const regular=attempts.filter(a=>!a.practice);
   data={attempts,completed:regular.length,practice_completed:attempts.length-regular.length,average:regular.length?Math.round(regular.reduce((n,a)=>n+a.score,0)/regular.length):0,best:Math.max(0,...regular.map(a=>a.score)),correct:regular.reduce((n,a)=>n+a.correct,0)};
  }
  else if(url.endsWith('/bookmark')){const quiz=quizzes.find(q=>url.includes('/'+q.id+'/'));quiz.saved=JSON.parse(options.body).saved;data={saved:quiz.saved};}
  else if(url.endsWith('/attempts')||url.endsWith('/practice')){
   if(url.endsWith('/practice')){
    const sourceId=url.split('/')[3];const source=attempts.find(a=>a.id===sourceId);
    const snapshot=snapshots.get(sourceId);
    active={...snapshot,original_title:snapshot.original_title||snapshot.title,title:'Tekrar: '+(snapshot.original_title||snapshot.title),practice:true,source_attempt_id:sourceId,questions:snapshot.questions.filter((_,i)=>!source.review[i].is_correct)};
   } else active=seeds.find(q=>url.includes('/'+q.id+'/'));
   activeId='test-attempt-'+(++sequence);snapshots.set(activeId,active);
   const {questions,...quiz}=active;
   data={id:activeId,quiz:{...quiz,question_count:questions.length,minutes:questions.length},questions:questions.map(q=>({text:q.text,options:q.options}))};
  }
  else if(url.endsWith('/submit')){
   const {answers,confidence}=JSON.parse(options.body);const correct=active.questions.filter((q,i)=>q.correct===answers[i]).length;
   const review=active.questions.map((q,i)=>({...q,selected:answers[i],is_correct:q.correct===answers[i],confidence:confidence?.[i]||null}));
   data={id:activeId,quiz_id:active.id,title:active.title,category:active.category,score:Math.round(correct/active.questions.length*100),correct,total:active.questions.length,seconds:35,completed:new Date().toISOString(),review,practice:active.practice||false,high_confidence_wrong:review.filter(q=>!q.is_correct&&q.confidence==='high').length};
   if(active.practice)data.source_attempt_id=active.source_attempt_id;
   attempts.unshift(data);
  }
  else throw new Error('Unhandled request: '+url);
  return {ok:true,json:async()=>JSON.parse(JSON.stringify(data))};
 };
 window.eval(read('static/vendor/vue.global.prod.js'));
 window.eval(read('static/app.js'));
 await tick();await tick();
 const doc=window.document;
 const click=async selector=>{const element=doc.querySelector(selector);assert.ok(element,'Missing element: '+selector);element.click();await tick();await tick();};
 const input=async(selector,value)=>{const element=doc.querySelector(selector);assert.ok(element);element.value=value;element.dispatchEvent(new window.Event('input',{bubbles:true}));await tick();};
 return {dom,window,doc,click,input,errors};
}

test('dashboard renders all quizzes; search, filters and empty states work',async()=>{
 const s=await setup();try{
  assert.equal(s.doc.querySelectorAll('.quiz-card').length,seeds.length);
  assert.match(s.doc.querySelector('h1').textContent,/meraklı zihin/);
  await s.input('[aria-label="Test ara"]','yazılımcı');
  assert.equal(s.doc.querySelectorAll('.quiz-card').length,1);
  await s.input('[aria-label="Test ara"]','not-a-real-topic');
  assert.equal(s.doc.querySelectorAll('.quiz-card').length,0);
  assert.match(s.doc.querySelector('.empty').textContent,/Test bulunamadı/);
  await s.click('.empty button');
  await s.click('.category-tabs button:nth-child(2)');
  assert.equal(s.doc.querySelectorAll('.quiz-card').length,2);
  assert.match(s.doc.querySelector('.quiz-card h3').textContent,/bilim/);
  assert.deepEqual(s.errors,[]);
 }finally{s.dom.window.close();}
});

test('bookmark flows into saved quizzes and can be removed',async()=>{
 const s=await setup();try{
  await s.click('.bookmark');
  await s.click('.nav-item:nth-child(2)');
  assert.equal(s.doc.querySelectorAll('.quiz-card').length,1);
  await s.click('.bookmark');
  assert.equal(s.doc.querySelectorAll('.quiz-card').length,0);
  assert.match(s.doc.querySelector('.empty').textContent,/Sonraki keşfin/);
  assert.deepEqual(s.errors,[]);
 }finally{s.dom.window.close();}
});

test('quiz answers, navigation, scoring, review, and history work',async()=>{
 const s=await setup();try{
  await s.click('.hero .button');
  assert.ok(s.doc.querySelector('.player-actions .primary').disabled);
  const choices=[1,2,2,1,3];
  for(let i=0;i<choices.length;i++){
   await s.click('.answer-option:nth-child('+(choices[i]+1)+')');
   assert.equal(s.doc.querySelectorAll('.chosen').length,1);
   await s.click('.player-actions .primary');
  }
  assert.match(s.doc.querySelector('.result-score').textContent,/100/);
  assert.equal(s.doc.querySelectorAll('.review-card').length,5);
  assert.equal(s.doc.querySelectorAll('.review-indicator.wrong').length,0);
  await s.click('.nav-item:nth-child(3)');
  assert.equal(s.doc.querySelectorAll('.history-row').length,1);
  await s.click('.history-row');
  assert.ok(s.doc.querySelector('.result-score'));
  assert.deepEqual(s.errors,[]);
 }finally{s.dom.window.close();}
});

test('leave quiz requires confirmation and permits cancellation',async()=>{
 const s=await setup();try{
  await s.click('.hero .button');await s.click('.play-top .text-button');
  assert.ok(s.doc.querySelector('dialog[open]'));
  await s.click('.dialog-card .outline');assert.equal(s.doc.querySelector('dialog[open]'),null);
  assert.ok(s.doc.querySelector('.quiz-player'));
  await s.click('.play-top .text-button');await s.click('.dialog-card .primary');
  assert.equal(s.doc.querySelector('.quiz-player'),null);
  assert.equal(s.doc.querySelectorAll('.quiz-card').length,seeds.length);
  assert.deepEqual(s.errors,[]);
 }finally{s.dom.window.close();}
});

test('builder creates a quiz and supports adding and removing questions',async()=>{
 const s=await setup();try{
  await s.click('.page-heading .button');
  await s.input('[placeholder="Testine bir ad ver"]','My new quiz');
  await s.input('[placeholder="Bu testte neler keşfedilecek?"]','A small test quiz');
  await s.input('[placeholder="Ne sormak istersin?"]','Which option is correct?');
  for(let i=0;i<4;i++)await s.input('[placeholder="Seçenek '+('ABCD'[i])+'"]','Answer '+i);
  await s.input('[placeholder="Kısa bir açıklama öğrenmeyi kalıcı kılar."]','The first answer is correct.');
  await s.click('.builder-actions .outline');assert.equal(s.doc.querySelectorAll('.builder-question').length,2);
  await s.click('.builder-question:last-of-type .text-button');assert.equal(s.doc.querySelectorAll('.builder-question').length,1);
  s.doc.querySelector('form').dispatchEvent(new s.window.Event('submit',{bubbles:true,cancelable:true}));await tick();await tick();
  assert.equal(s.doc.querySelectorAll('.quiz-card').length,seeds.length+1);
  assert.match(s.doc.querySelector('.quiz-card h3').textContent,/My new quiz/);
  assert.deepEqual(s.errors,[]);
 }finally{s.dom.window.close();}
});

test('Turkish labels and dotted/dotless I search retain API filter values',async()=>{
 const s=await setup();try{
  assert.equal(s.doc.documentElement.lang,'tr');
  assert.match(s.doc.querySelector('.category-tabs').textContent,/Tüm konular.*Bilim.*Matematik ve Mantık.*Teknoloji.*Coğrafya.*Tarih.*Sanat ve Edebiyat.*Doğa ve Çevre.*Genel Kültür/);
  await s.input('[aria-label="Test ara"]','BİLİM');
  assert.equal(s.doc.querySelectorAll('.quiz-card').length,2);
  await s.input('[aria-label="Test ara"]','YAZILIMCI');
  assert.equal(s.doc.querySelectorAll('.quiz-card').length,1);
  assert.match(s.doc.querySelector('.quiz-card h3').textContent,/yazılımcı/);
  await s.input('[aria-label="Test ara"]','');
  const difficulty=s.doc.querySelector('[aria-label="Zorluğa göre filtrele"]');
  difficulty.value='Medium';difficulty.dispatchEvent(new s.window.Event('change',{bubbles:true}));await tick();
  assert.equal(s.doc.querySelectorAll('.quiz-card').length,seeds.filter(q=>q.difficulty==='Medium').length);
  assert.ok([...s.doc.querySelectorAll('.difficulty')].every(el=>el.textContent==='Orta'));
  await s.click('.page-heading .button');
  const category=s.doc.querySelector('select');
  assert.equal(category.value,'Science');
  assert.equal(category.selectedOptions[0].textContent,'Bilim');
  assert.deepEqual(s.errors,[]);
 }finally{s.dom.window.close();}
});

test('form validation and connection failures are shown in Turkish',async()=>{
 const s=await setup();try{
  await s.click('.page-heading .button');
  const title=s.doc.querySelector('[placeholder="Testine bir ad ver"]');
  assert.equal(title.checkValidity(),false);
  assert.equal(title.validationMessage,'Lütfen bu alanı doldur.');
  await s.input('[placeholder="Testine bir ad ver"]','Yeni test');
  assert.equal(title.validationMessage,'');
  await s.click('.nav-item');
  s.window.fetch=async()=>{throw Error('offline')};
  await s.click('.hero .button');
  assert.match(s.doc.querySelector('.error-banner').textContent,/Bağlantı kurulamadı/);
  assert.deepEqual(s.errors,[]);
 }finally{s.dom.window.close();}
});

test('theme and list preferences are applied, saved, and work without storage',async()=>{
 const s=await setup({storage:{'quizly-theme':'dark','quizly-layout':'list'}});try{
  assert.equal(s.doc.documentElement.dataset.theme,'dark');
  assert.ok(s.doc.querySelector('.quiz-grid.list-layout'));
  await s.click('.theme-toggle');
  assert.equal(s.doc.documentElement.dataset.theme,'light');
  assert.equal(s.window.localStorage.getItem('quizly-theme'),'light');
  await s.click('[aria-label="Kart görünümü"]');
  assert.equal(s.doc.querySelector('.quiz-grid.list-layout'),null);
  assert.equal(s.window.localStorage.getItem('quizly-layout'),'grid');
  assert.equal(s.doc.querySelectorAll('.quiz-card').length,seeds.length);
  assert.deepEqual(s.errors,[]);
 }finally{s.dom.window.close();}
 const blocked=await setup({blockStorage:true});try{
  await blocked.click('.theme-toggle');
  assert.equal(blocked.doc.documentElement.dataset.theme,'dark');
  assert.equal(blocked.doc.querySelectorAll('.quiz-card').length,seeds.length);
  assert.deepEqual(blocked.errors,[]);
 }finally{blocked.dom.window.close();}
});

test('sorting works with filters and both catalog layouts',async()=>{
 const s=await setup();try{
  const sort=s.doc.querySelector('[aria-label="Testleri sırala"]');
  sort.value='title';sort.dispatchEvent(new s.window.Event('change',{bubbles:true}));await tick();
  const actual=[...s.doc.querySelectorAll('.quiz-card h3')].map(el=>el.textContent);
  assert.deepEqual(actual,seeds.map(q=>q.title).sort((a,b)=>a.localeCompare(b,'tr')));
  await s.click('[aria-label="Liste görünümü"]');
  const difficulty=s.doc.querySelector('[aria-label="Zorluğa göre filtrele"]');
  difficulty.value='Medium';difficulty.dispatchEvent(new s.window.Event('change',{bubbles:true}));await tick();
  assert.equal(s.doc.querySelectorAll('.quiz-card').length,seeds.filter(q=>q.difficulty==='Medium').length);
  assert.ok(s.doc.querySelector('.list-layout'));
  await s.click('.clear-filters');
  assert.equal(s.doc.querySelectorAll('.quiz-card').length,seeds.length);
  assert.deepEqual(s.errors,[]);
 }finally{s.dom.window.close();}
});

test('keyboard shortcuts select and advance answers but never act behind a dialog',async()=>{
 const s=await setup();try{
  s.window.dispatchEvent(new s.window.KeyboardEvent('keydown',{key:'/',bubbles:true}));await tick();
  assert.equal(s.doc.activeElement,s.doc.querySelector('[aria-label="Test ara"]'));
  await s.click('.hero .button');
  s.window.dispatchEvent(new s.window.KeyboardEvent('keydown',{key:'2',bubbles:true}));await tick();
  assert.equal(s.doc.querySelector('.chosen .option-letter').textContent,'B');
  s.window.dispatchEvent(new s.window.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));await tick();
  assert.match(s.doc.querySelector('.question-progress').textContent,/Soru 2/);
  await s.click('.play-top .text-button');
  s.window.dispatchEvent(new s.window.KeyboardEvent('keydown',{key:'3',bubbles:true}));await tick();
  assert.equal(s.doc.querySelector('.chosen'),null);
  await s.click('.dialog-card .outline');
  s.window.dispatchEvent(new s.window.KeyboardEvent('keydown',{key:'3',ctrlKey:true,bubbles:true}));await tick();
  assert.equal(s.doc.querySelector('.chosen'),null);
  s.window.dispatchEvent(new s.window.KeyboardEvent('keydown',{key:'3',bubbles:true}));await tick();
  assert.equal(s.doc.querySelector('.chosen .option-letter').textContent,'C');
  assert.deepEqual(s.errors,[]);
 }finally{s.dom.window.close();}
});

test('wrong-answer review preserves question numbers and can show all answers again',async()=>{
 const s=await setup();try{
  await s.click('.quiz-card .card-footer button');
  for(const answer of [1,0,0,0,0]){
   await s.click('.answer-option:nth-child('+(answer+1)+')');
   await s.click('.player-actions .primary');
  }
  assert.match(s.doc.querySelector('.result-score').textContent,/%40/);
  await s.click('.review-filters button:nth-child(2)');
  assert.equal(s.doc.querySelectorAll('.review-card').length,3);
  assert.deepEqual([...s.doc.querySelectorAll('.review-number')].map(el=>el.textContent),['02','03','05']);
  assert.equal(s.doc.querySelectorAll('.incorrect-text').length,3);
  await s.click('.review-filters button');
  assert.equal(s.doc.querySelectorAll('.review-card').length,5);
  assert.deepEqual(s.errors,[]);
 }finally{s.dom.window.close();}
});

test('activity and category charts derive their values from real attempt records',async()=>{
 const today=new Date();today.setHours(12,0,0,0);
 const recent=new Date(today);recent.setDate(recent.getDate()-2);
 const old=new Date(today);old.setDate(old.getDate()-30);
 const record=(id,quiz,score,correct,date)=>({id,quiz_id:quiz.id,title:quiz.title,category:quiz.category,score,correct,total:5,seconds:60,completed:date.toISOString(),review:[]});
 const attempts=[record('a',seeds[0],40,2,today),record('b',seeds[0],100,5,today),record('c',seeds[2],80,4,recent),record('d',seeds[1],20,1,old)];
 const s=await setup({attempts});try{
  assert.deepEqual([...s.doc.querySelectorAll('.activity-value')].map(el=>Number(el.textContent)),[0,0,0,0,1,0,2]);
  assert.match(s.doc.querySelector('.daily-card').textContent,/Bugün 2 çalışma/);
  assert.match(s.doc.querySelector('.daily-footer').textContent,/3 çalışma tamamlandı/);
  assert.match(s.doc.querySelector('.completion-tag').textContent,/%100/);
  await s.click('.nav-item:nth-child(3)');
  assert.equal(s.doc.querySelectorAll('.score-column').length,4);
  assert.match(s.doc.querySelector('.category-progress').textContent,/Bilim2 test%70/);
  assert.equal(s.doc.querySelectorAll('.history-row').length,4);
  assert.deepEqual(s.errors,[]);
 }finally{s.dom.window.close();}
});

test('confidence is optional, can be cleared, and highlights confidently wrong answers',async()=>{
 const s=await setup();try{
  await s.click('.quiz-card .card-footer button');
  assert.ok(s.doc.querySelector('.confidence-picker button').disabled);
  await s.click('.answer-option:nth-child(2)');
  await s.click('.confidence-picker button:nth-child(3)');
  await s.click('.player-actions .primary');
  await s.click('.player-actions .outline');
  assert.equal(s.doc.querySelector('.confidence-picker .selected').textContent,'Eminim');
  await s.click('.confidence-picker button:nth-child(3)');
  assert.equal(s.doc.querySelector('.confidence-picker .selected'),null);
  await s.click('.player-actions .primary');
  for(let i=1;i<5;i++){
   await s.click('.answer-option:nth-child(1)');
   if(i===1) await s.click('.confidence-picker button:nth-child(3)');
   if(i===2) await s.click('.confidence-picker button:nth-child(2)');
   await s.click('.player-actions .primary');
  }
  assert.match(s.doc.querySelector('.confidence-insight').textContent,/Emin olduğun 1 soruda/);
  assert.equal(s.doc.querySelectorAll('.review-confidence').length,2);
  await s.click('.review-filters button:nth-child(3)');
  assert.equal(s.doc.querySelectorAll('.review-card').length,1);
  assert.equal(s.doc.querySelector('.review-number').textContent,'02');
  assert.match(s.doc.querySelector('.confidence-warning').textContent,/Eminim/);
  assert.deepEqual(s.errors,[]);
 }finally{s.dom.window.close();}
});

test('wrong-answer practice completes a smaller quiz and keeps regular statistics unchanged',async()=>{
 const s=await setup();try{
  await s.click('.quiz-card .card-footer button');
  for(const answer of [1,0,0,0,0]){
   await s.click('.answer-option:nth-child('+(answer+1)+')');
   await s.click('.player-actions .primary');
  }
  await s.click('.result-actions .practice-button');
  assert.match(s.doc.querySelector('.practice-notice').textContent,/3 yanlış soru/);
  assert.equal(s.doc.querySelectorAll('.question-dots button').length,3);
  assert.equal(s.doc.querySelectorAll('.confidence-picker .selected').length,0);
  for(const answer of [2,3,1]){
   await s.click('.answer-option:nth-child('+(answer+1)+')');
   await s.click('.player-actions .primary');
  }
  assert.match(s.doc.querySelector('.result-score').textContent,/%100/);
  assert.match(s.doc.querySelector('.practice-notice').textContent,/Genel test ortalaman değişmedi/);
  assert.equal(s.doc.querySelector('.result-actions .practice-button'),null);
  await s.click('.nav-item:nth-child(3)');
  assert.equal(s.doc.querySelectorAll('.history-row').length,2);
  assert.equal(s.doc.querySelectorAll('.practice-badge').length,1);
  assert.match(s.doc.querySelector('.learning-panel .subtle-tag').textContent,/1 TEKRAR/);
  assert.equal(s.doc.querySelectorAll('.score-column').length,1);
  assert.match(s.doc.querySelector('.category-progress').textContent,/Bilim1 test%40/);
  // Practice also remains available from progress for the latest regular result.
  await s.click('.practice-card .practice-button');
  assert.equal(s.doc.querySelectorAll('.question-dots button').length,3);
  assert.deepEqual(s.errors,[]);
 }finally{s.dom.window.close();}
});

test('category metadata drives eight filters, question counts and builder choices',async()=>{
 const s=await setup();try{
  assert.equal(s.doc.querySelectorAll('.category-tabs button').length,9);
  assert.match(s.doc.querySelector('.category-summary').textContent,/80 soru.*16 test/);
  await s.click('.category-tabs button:nth-child(3)');
  assert.equal(s.doc.querySelectorAll('.quiz-card').length,2);
  assert.match(s.doc.querySelector('.category-summary').textContent,/10 soru.*2 test/);
  assert.match(s.doc.querySelector('.category-summary p').textContent,/akıl yürütme/);
  assert.equal(s.doc.querySelector('.category-tabs .selected .icon').innerHTML,s.doc.querySelector('.subject-symbol .icon').innerHTML);
  await s.click('.page-heading .button');
  const select=s.doc.querySelector('select');
  assert.equal(select.options.length,8);
  assert.deepEqual([...select.options].map(o=>o.value),categories.map(c=>c.id));
  assert.deepEqual(s.errors,[]);
 }finally{s.dom.window.close();}
});
