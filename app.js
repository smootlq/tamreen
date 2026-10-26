/* تمرين — PWA بدون سيرفر. كل البيانات في localStorage على جوالك. */
(function () {
'use strict';
var EX = window.EXERCISES, EQ = window.EQUIP, GR = window.GROUPS;
var KEY = 'tamreen.v1';
var $ = function (s, r) { return (r || document).querySelector(s); };
var view = $('#view'), overlay = $('#overlay');

/* ---------- التخزين ---------- */
var DEF = { sessions: [], plan: null, settings: { minutes: 10, sound: true, voice: true, equip: { bar: true, band: true, wheel: true, db: true, ball: true, body: true } },
  reroll: { date: '', n: 0 }, snacks: { date: '', done: [] }, xp: 0, badges: [], boredBoost: 0, bestStreak: 0 };
var S = load();
function load() {
  try { var s = JSON.parse(localStorage.getItem(KEY)); if (s) { return merge(JSON.parse(JSON.stringify(DEF)), s); } } catch (e) {}
  return JSON.parse(JSON.stringify(DEF));
}
function merge(a, b) { for (var k in b) { if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object') merge(a[k], b[k]); else a[k] = b[k]; } return a; }
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('ما قدرت أحفظ البيانات'); } }
if (navigator.storage && navigator.storage.persist) { navigator.storage.persist().catch(function () {}); }

/* ---------- أدوات التاريخ ---------- */
function pad(n) { return (n < 10 ? '0' : '') + n; }
function dkey(d) { d = d || new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
function fromKey(k) { var p = k.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
function dayDiff(a, b) { return Math.round((fromKey(a) - fromKey(b)) / 864e5); }
var DAYS = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
function weekStart(d) { return addDays(d, -d.getDay()); } // الأسبوع يبدأ الأحد
function fmtTime(t) { if (!t) return ''; var p = t.split(':'), h = +p[0], m = p[1]; var ap = h < 12 ? 'ص' : 'م'; var hh = h % 12 || 12; return hh + ':' + m + ' ' + ap; }

/* ---------- عشوائي ثابت لليوم ---------- */
function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { var a = seed; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function shuffle(arr, r) { for (var i = arr.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; }

/* ---------- الجلسات والستريك ---------- */
function activeDays() { var m = {}; S.sessions.forEach(function (s) { if (s.sec >= 60) m[s.date] = (m[s.date] || 0) + s.sec; }); return m; }
function streakInfo() {
  var act = activeDays(), today = dkey(), d = new Date(), count = 0, grace = {}, graceUsed = {}, i = 0;
  if (!act[today]) { d = addDays(d, -1); }
  while (i < 400) {
    var k = dkey(d);
    if (act[k]) { count++; }
    else {
      var wk = dkey(weekStart(d)); graceUsed[wk] = graceUsed[wk] || 0;
      if (count === 0 && !Object.keys(act).some(function (x) { return x < k; })) break;
      if (graceUsed[wk] < 2) { graceUsed[wk]++; grace[k] = 1; }
      else break;
    }
    d = addDays(d, -1); i++;
    if (!Object.keys(act).some(function (x) { return x <= dkey(d); })) break;
  }
  if (count > (S.bestStreak || 0)) { S.bestStreak = count; }
  return { count: count, grace: grace, act: act };
}
function lastActiveBefore(today) { var ks = Object.keys(activeDays()).filter(function (k) { return k < today; }).sort(); return ks[ks.length - 1]; }
function isComeback() { var t = dkey(), l = lastActiveBefore(t); return !!l && dayDiff(t, l) >= 2 && !activeDays()[t]; }
function weekCount() { var ws = dkey(weekStart(new Date())), act = activeDays(); return Object.keys(act).filter(function (k) { return k >= ws; }).length; }
var LEVELS = ['مبتدئ متحمس', 'نشيط', 'مثابر', 'ماكينة', 'وحش البيت', 'أسطورة'];
function level() { var l = Math.floor(Math.sqrt((S.xp || 0) / 60)) + 1; return { n: l, title: LEVELS[Math.min(l - 1, LEVELS.length - 1)], next: Math.pow(l, 2) * 60 }; }

/* ---------- مولّد التمرين ---------- */
var THEMES = [
  { name: 'يوم السحب والبطن', icon: '🪝', slots: ['pull', 'core', 'pull', 'cardio', 'pull', 'core', 'legs'] },
  { name: 'يوم الأرجل والطاقة', icon: '🦵', slots: ['legs', 'cardio', 'legs', 'core', 'pull', 'legs', 'push'] },
  { name: 'يوم الدفع والكتف', icon: '💪', slots: ['push', 'core', 'push', 'legs', 'push', 'cardio', 'pull'] },
  { name: 'جسم كامل', icon: '⚡', slots: ['legs', 'pull', 'push', 'core', 'cardio', 'legs', 'pull'] }
];
var FORMATS = [{ w: 40, r: 20, n: '٤٠ ث شغل / ٢٠ ث راحة' }, { w: 30, r: 15, n: '٣٠ ث شغل / ١٥ ث راحة' }, { w: 45, r: 15, n: '٤٥ ث شغل / ١٥ ث راحة' }];
function pool(filter) { return EX.filter(function (e) { return e.eq.every(function (q) { return q === 'body' || S.settings.equip[q]; }) && (!filter || filter(e)); }); }
function prevSession(today) { var p = S.sessions.filter(function (s) { return s.date < today && s.ex && s.ex.length; }); return p[p.length - 1]; }
function todayPlan(minutes) {
  var today = dkey(); if (S.reroll.date !== today) { S.reroll = { date: today, n: 0 }; }
  var r = rng(hash(today + ':' + S.reroll.n + ':' + minutes));
  var prev = prevSession(today), dayN = Math.floor(fromKey(today) / 864e5);
  var ti = (dayN + S.reroll.n) % THEMES.length;
  if (prev && prev.theme === THEMES[ti].name) ti = (ti + 1) % THEMES.length;
  var theme = THEMES[ti], fmt = FORMATS[Math.floor(r() * FORMATS.length)];
  var avail = minutes * 60 - 45, slots = Math.max(3, Math.floor(avail / (fmt.w + fmt.r))), rounds, nEx;
  if (slots <= 5) { rounds = 1; nEx = slots; } else { rounds = slots >= 15 ? 3 : 2; nEx = Math.min(7, Math.round(slots / rounds)); }
  var avoid = {}; if (prev) prev.ex.forEach(function (k) { avoid[k] = 1; });
  var picks = pickFor(theme.slots.slice(0, nEx), r, avoid, {});
  return { kind: 'full', theme: theme.name, icon: theme.icon, fmt: fmt, rounds: rounds, ex: picks, minutes: minutes };
}
function pickFor(groups, r, avoid, opt) {
  var used = {}, usedEq = {}, hard = 0, out = [];
  groups.forEach(function (g) {
    var cands = pool(function (e) { return e.g === g && !used[e.key] && (!opt.low || e.low) && (!opt.maxLvl || e.lvl <= opt.maxLvl); });
    if (!cands.length) cands = pool(function (e) { return !used[e.key] && (!opt.low || e.low); });
    var best = null, bs = -1;
    cands.forEach(function (e) {
      var s = r() + (avoid[e.key] ? -0.9 : 0) + (e.eq.some(function (q) { return q !== 'body' && !usedEq[q]; }) ? 0.6 : 0) + (e.eq[0] === 'body' ? -0.15 : 0) + (e.lvl === 3 && hard >= 1 ? -2 : 0) + (S.boredBoost && avoid[e.key] ? -1 : 0);
      if (s > bs) { bs = s; best = e; }
    });
    if (best) { used[best.key] = 1; best.eq.forEach(function (q) { usedEq[q] = 1; }); if (best.lvl === 3) hard++; out.push(best); }
  });
  return out;
}
function tinyPlan() { var r = rng(hash(dkey() + 'tiny' + S.sessions.length)); return { kind: 'tiny', theme: 'دقيقتين بس', icon: '🤏', fmt: { w: 25, r: 5 }, rounds: 1, ex: pickFor(shuffle(['legs', 'push', 'core', 'pull'], r), r, {}, { maxLvl: 2 }), minutes: 2, noWarm: true }; }
function lowPlan() { var r = rng(hash(dkey() + 'low' + S.sessions.length)); return { kind: 'low', theme: 'جلسة التعبان', icon: '😴', fmt: { w: 40, r: 20 }, rounds: 1, ex: pickFor(['mobility', 'legs', 'pull', 'core', 'mobility'], r, {}, { low: true }), minutes: 5, noWarm: true }; }
function snackPlans() {
  var full = todayPlan(S.settings.minutes), ex = full.ex.slice(), parts = [[], [], []];
  ex.forEach(function (e, i) { parts[i % 3].push(e); });
  return parts.map(function (p, i) { return { kind: 'snack', snackIdx: i, theme: 'سناك ' + (i + 1) + ' من 3', icon: '🍪', fmt: { w: 40, r: 15 }, rounds: 1, ex: p, minutes: 3, noWarm: true, parentTheme: full.theme }; });
}
function buildSteps(p) {
  var st = [];
  if (!p.noWarm) st.push({ t: 'warm', ex: window.WARMUP, d: 45 });
  for (var r = 0; r < p.rounds; r++) {
    var list = r % 2 ? p.ex.slice().reverse() : p.ex;
    list.forEach(function (e, i) {
      st.push({ t: 'work', ex: e, d: p.fmt.w, round: r + 1 });
      var last = r === p.rounds - 1 && i === list.length - 1;
      if (!last) st.push({ t: 'rest', ex: (i + 1 < list.length ? list[i + 1] : (r % 2 ? p.ex : p.ex.slice().reverse())[0]), d: p.fmt.r });
    });
  }
  return st;
}
function planSeconds(p) { return buildSteps(p).reduce(function (a, s) { return a + s.d; }, 0); }

/* ---------- صوت ونطق ---------- */
var AC = null;
function unlockAudio() {
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
  try { if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); } catch (e) {}
}
function beep(f, ms, vol) {
  if (!S.settings.sound || !AC) return;
  try { var o = AC.createOscillator(), g = AC.createGain(); o.frequency.value = f || 880; o.type = 'sine'; g.gain.value = vol || 0.25; o.connect(g); g.connect(AC.destination); var t = AC.currentTime; g.gain.setValueAtTime(vol || 0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + (ms || 150) / 1000); o.start(t); o.stop(t + (ms || 150) / 1000 + 0.02); } catch (e) {}
}
function buzz(p) { if (navigator.vibrate) { try { navigator.vibrate(p); } catch (e) {} } }
function say(txt) {
  if (!S.settings.voice || !window.speechSynthesis) return;
  try { speechSynthesis.cancel(); var u = new SpeechSynthesisUtterance(txt); u.lang = 'ar-SA'; u.rate = 1; var v = speechSynthesis.getVoices().filter(function (x) { return /^ar/.test(x.lang); }); if (v.length) u.voice = v[0]; speechSynthesis.speak(u); } catch (e) {}
}
var wakeLock = null;
function keepAwake(on) {
  try { if (on && 'wakeLock' in navigator) navigator.wakeLock.request('screen').then(function (w) { wakeLock = w; }).catch(function () {}); else if (!on && wakeLock) { wakeLock.release(); wakeLock = null; } } catch (e) {}
}

/* ---------- واجهة: مساعدات ---------- */
function img(e, f) { return 'img/ex/' + e.id + '-' + (f || 0) + '.jpg'; }
function anim(e) { return '<div class="anim"><img src="' + img(e, 0) + '" alt="' + e.name + '"><img class="b" src="' + img(e, 1) + '" alt=""></div>'; }
function eqLabel(e) { return e.eq.map(function (q) { return EQ[q].emoji + ' ' + EQ[q].name; }).join(' + '); }
function toast(t) { var d = document.createElement('div'); d.className = 'toast'; d.textContent = t; document.body.appendChild(d); setTimeout(function () { d.remove(); }, 2600); }
function openOverlay(html) { overlay.innerHTML = html; overlay.classList.remove('hidden'); overlay.scrollTop = 0; document.body.style.overflow = 'hidden'; }
function closeOverlay() { overlay.classList.add('hidden'); overlay.innerHTML = ''; document.body.style.overflow = ''; }
var PRAISE = ['يا سلااام! 🔥', 'وحش والله 💪', 'كذا الشغل!', 'فخور فيك 👏', 'ولا غلطة، كفو!', 'جسمك يقول لك شكراً 🙏', 'هذا اللي نبيه!', 'أسطوري اليوم ⭐'];
var TIPS = [
  'ابدأ بدقيقتين بس. أصعب شي هو البداية، والباقي يجي لحاله.',
  'حط الدنابل والحبل قدّام عينك. اللي تشوفه تسويه.',
  'لا تأجل لآخر اليوم: النعاس يغلب. ثبّت وقت مبكر بعد شي تسويه كل يوم.',
  'فاتك يوم؟ عادي. الدراسات تقول يوم واحد ما يخرّب العادة — المهم ترجع.',
  'ملّيت؟ اضغط 🎲 وغيّر التمرين. التنويع يزيد الالتزام.',
  'شغّل أغنيتك أو البودكاست اللي تحبه وقت التمرين بس — خله مكافأة خاصة بالتمرين.',
  'تمرين قصير اليوم أحسن من تمرين مثالي ما صار.',
  '٤ أيام بالأسبوع لمدة ٦ أسابيع = بداية عادة حقيقية.'
];

/* ---------- التبويبات ---------- */
var tab = 'home';
$('#tabs').addEventListener('click', function (ev) { var b = ev.target.closest('button'); if (!b) return; tab = b.dataset.tab; document.querySelectorAll('#tabs button').forEach(function (x) { x.classList.toggle('active', x === b); }); render(); window.scrollTo(0, 0); });
function render() { ({ home: renderHome, library: renderLib, progress: renderProgress, plan: renderPlan, why: renderWhy })[tab](); }

/* ---------- الرئيسية ---------- */
var curPlan = null;
function renderHome() {
  var h = new Date().getHours(), today = dkey(), st = streakInfo(), lv = level(), act = st.act;
  var done = !!act[today], greet = h < 12 ? 'صباح الخير' : 'مساء الخير';
  curPlan = todayPlan(S.settings.minutes);
  var html = '<div class="row between"><div><div class="mut small">' + greet + ' 👋</div><h1>هلا شافي</h1></div>' +
    '<div style="text-align:left"><div class="streak">🔥 ' + st.count + ' يوم</div><div class="tiny mut">⭐ ' + lv.title + ' · ' + S.xp + ' XP</div></div></div>';
  if (!navigator.standalone && !window.matchMedia('(display-mode: standalone)').matches) html += '<div class="card small">📲 <b>ثبّته على الشاشة:</b> من Safari اضغط زر المشاركة <b>⬆️</b> ثم <b>«إضافة إلى الشاشة الرئيسية»</b>. بعدها يشتغل بدون نت.</div>';
  if (done) html += '<div class="banner">✅ سويت تمرين اليوم! أي شي زيادة = بونص.</div>';
  else if (isComeback()) html += '<div class="banner">🎁 رجعتك اليوم = نقاط ×2. الرجوع أهم من الستريك!</div>';
  // خطة إذا-ثم
  if (S.plan && S.plan.time) {
    var now = new Date(), pt = S.plan.time.split(':'), tgt = new Date(); tgt.setHours(+pt[0], +pt[1], 0, 0);
    var diff = Math.round((tgt - now) / 60000), when;
    if (done) when = 'خلصت اليوم 👏';
    else if (diff > 0) when = 'باقي ' + (diff >= 60 ? Math.floor(diff / 60) + ' س ' : '') + (diff % 60) + ' د على موعدك';
    else when = 'الحين وقتك! ابدأ بدقيقتين ⏱️';
    html += '<div class="card hl"><div class="tiny mut">خطتي (إذا… ثم…)</div><div class="plan-sentence">' + planSentence() + '</div><div class="row between" style="margin-top:8px"><span class="pill">⏰ ' + fmtTime(S.plan.time) + '</span><b class="small">' + when + '</b></div></div>';
    if (!done && diff < -30) html += '<div class="card warn"><b>فات الموعد؟ ولا يهمك.</b><div class="small">دقيقتين الحين أحسن من صفر. لا تخليها لين يجيك النوم 😴</div></div>';
  } else {
    html += '<div class="card warn"><b>⚠️ أهم خطوة: حدد وقتك</b><div class="small mut">اللي يحدد «متى وبعد إيش» يتمرن أكثر بشكل واضح في الدراسات.</div><button class="btn sm pri" style="margin-top:10px" data-go="plan">حدّد وقتي الحين</button></div>';
  }
  if (!done && h >= 21) html += '<div class="card warn"><b>الوقت متأخر والنعاس قريب.</b><div class="small">بدل ما تأجل لبكرة: جلسة التعبان ٥ دقايق، أو دقيقتين بس.</div></div>';
  html += '<button class="btn pri big" id="tiny">🤏 ابدأ بدقيقتين بس</button>';
  // تمرين اليوم
  var mins = planSeconds(curPlan) / 60;
  html += '<div class="card"><div class="row between"><h3>' + curPlan.icon + ' تمرين اليوم: ' + curPlan.theme + '</h3><button class="btn sm" id="reroll">🎲 غيّره</button></div>' +
    '<div class="tiny mut">' + curPlan.ex.length + ' تمارين × ' + curPlan.rounds + ' جولة · ' + curPlan.fmt.n + ' · ~' + Math.round(mins) + ' د</div>' +
    '<div class="chips" style="margin:10px 0">' + [5, 10, 15, 20].map(function (m) { return '<button class="chip' + (S.settings.minutes === m ? ' on' : '') + '" data-min="' + m + '">' + m + ' د</button>'; }).join('') + '</div>' +
    '<div class="thumbs">' + curPlan.ex.map(function (e) { return '<button class="thumb" data-ex="' + e.key + '"><img loading="lazy" src="' + img(e) + '" alt=""><div>' + e.name + '</div></button>'; }).join('') + '</div>' +
    '<button class="btn pri" id="go" style="margin-top:8px">▶️ ابدأ التمرين الموجّه</button></div>';
  var sn = S.snacks.date === today ? S.snacks.done : [];
  html += '<div class="grid2"><button class="btn" id="low">😴 تعبان؟<br>٥ د خفيفة</button><button class="btn" id="snack">🍪 سناكات<br>(' + sn.filter(Boolean).length + '/3)</button></div>';
  // الأسبوع
  var ws = weekStart(new Date()), wk = '';
  for (var i = 0; i < 7; i++) { var d = addDays(ws, i), k = dkey(d); wk += '<div><b class="' + (act[k] ? 'done' : st.grace[k] ? 'grace' : '') + (k === today ? ' today' : '') + '">' + (act[k] ? '✓' : st.grace[k] ? '🛡' : '') + '</b>' + DAYS[i] + '</div>'; }
  html += '<div class="card"><div class="row between"><b>هدف الأسبوع: ٤ أيام</b><span class="pill">' + weekCount() + '/4</span></div><div class="week">' + wk + '</div><div class="tiny mut" style="margin-top:6px">🛡 = يوم سماح (عندك يومين سماح كل أسبوع، الستريك ما ينكسر)</div></div>';
  html += '<div class="card small">💡 ' + TIPS[Math.floor(Date.now() / 864e5) % TIPS.length] + '</div>';
  view.innerHTML = html;
  $('#tiny').onclick = function () { startSession(tinyPlan()); };
  $('#go').onclick = function () { startSession(curPlan); };
  $('#low').onclick = function () { startSession(lowPlan()); };
  $('#snack').onclick = showSnacks;
  $('#reroll').onclick = function () { S.reroll.n++; save(); renderHome(); toast('🎲 خلطة جديدة!'); };
  view.querySelectorAll('[data-min]').forEach(function (b) { b.onclick = function () { S.settings.minutes = +b.dataset.min; save(); renderHome(); }; });
  view.querySelectorAll('[data-ex]').forEach(function (b) { b.onclick = function () { showEx(b.dataset.ex); }; });
  var g = view.querySelector('[data-go]'); if (g) g.onclick = function () { document.querySelector('#tabs [data-tab=plan]').click(); };
}
function planSentence() {
  var p = S.plan; if (!p) return '';
  return 'إذا ' + (p.anchor || 'جت الساعة') + ' (' + fmtTime(p.time) + ')، ألبس جوتي وأبدأ بدقيقتين تمرين.';
}
function showSnacks() {
  var today = dkey(); if (S.snacks.date !== today) { S.snacks = { date: today, done: [false, false, false] }; save(); }
  var ps = snackPlans();
  openOverlay('<div class="player"><div class="p-top"><h2>🍪 سناكات التمرين</h2><button class="btn sm" id="x">✕</button></div>' +
    '<p class="small mut">قسّم تمرين اليوم على ٣ دفعات قصيرة (٢-٣ دقايق) على مدار اليوم: مثلاً الصبح، بعد الغدا، بعد العصر. كل سناك ينحسب.</p>' +
    ps.map(function (p, i) { return '<div class="card' + (S.snacks.done[i] ? ' hl' : '') + '"><div class="row between"><b>' + (S.snacks.done[i] ? '✅ ' : '') + p.theme + '</b><span class="pill">~' + Math.ceil(planSeconds(p) / 60) + ' د</span></div><div class="thumbs">' + p.ex.map(function (e) { return '<div class="thumb"><img src="' + img(e) + '" alt=""><div>' + e.name + '</div></div>'; }).join('') + '</div><button class="btn ' + (S.snacks.done[i] ? '' : 'pri') + '" data-s="' + i + '">' + (S.snacks.done[i] ? 'عيده' : 'ابدأ السناك') + '</button></div>'; }).join('') + '</div>');
  $('#x', overlay).onclick = closeOverlay;
  overlay.querySelectorAll('[data-s]').forEach(function (b) { b.onclick = function () { startSession(ps[+b.dataset.s]); }; });
}

/* ---------- تفاصيل تمرين ---------- */
function findEx(k) { return EX.filter(function (e) { return e.key === k; })[0]; }
function showEx(k) {
  var e = findEx(k); if (!e) return;
  openOverlay('<div class="player"><div class="p-top"><span class="pill">' + GR[e.g] + '</span><button class="btn sm" id="x">✕</button></div>' +
    '<h2>' + e.name + '</h2><div class="small mut">' + eqLabel(e) + ' · ' + '⭐'.repeat(e.lvl) + '</div><div style="margin:12px 0">' + anim(e) + '</div>' +
    '<div class="card"><b>كيف تسويها:</b><ol class="steps">' + e.steps.map(function (s) { return '<li>' + s + '</li>'; }).join('') + '</ol><div class="pill">🎯 ' + e.hint + '</div></div>' +
    '<button class="btn pri" id="try">⚡ جرّبه الحين ٤٠ ثانية</button></div>');
  $('#x', overlay).onclick = closeOverlay;
  $('#try', overlay).onclick = function () { startSession({ kind: 'single', theme: e.name, icon: '⚡', fmt: { w: 40, r: 0 }, rounds: 1, ex: [e], minutes: 1, noWarm: true }); };
}

/* ---------- المشغّل الموجّه ---------- */
var P = null;
function startSession(plan) {
  unlockAudio(); keepAwake(true);
  if (!plan.ex.length) { toast('ما فيه تمارين — فعّل أدواتك من «خطتي»'); return; }
  P = { plan: plan, steps: buildSteps(plan), i: 0, end: 0, left: 0, paused: false, startT: Date.now(), workSec: 0, lastBeep: -1, timer: null };
  beginStep(0);
  P.timer = setInterval(tick, 200);
  document.addEventListener('visibilitychange', onVis);
}
function onVis() { if (P && !document.hidden) { keepAwake(true); tick(); } }
function beginStep(i) {
  P.i = i; var s = P.steps[i]; if (!s) { return finish(false); }
  P.end = Date.now() + s.d * 1000; P.left = s.d; P.lastBeep = -1;
  if (s.t === 'work' || s.t === 'warm') { beep(1046, 350, 0.3); buzz(200); say((s.t === 'warm' ? 'إحماء. ' : '') + s.ex.name); }
  else { beep(523, 250, 0.2); buzz([80, 60, 80]); say('راحة. الجاي: ' + s.ex.name); }
  drawPlayer();
}
function tick() {
  if (!P || P.paused) return;
  var s = P.steps[P.i], left = Math.ceil((P.end - Date.now()) / 1000);
  if (left <= 0) {
    if (s.t === 'work') P.workSec += s.d;
    // لو التطبيق كان بالخلفية، نلحق الخطوات
    var over = -left, j = P.i + 1;
    while (P.steps[j] && over >= P.steps[j].d) { over -= P.steps[j].d; if (P.steps[j].t === 'work') P.workSec += P.steps[j].d; j++; }
    if (!P.steps[j]) return finish(false);
    beginStep(j); P.end -= over * 1000; return;
  }
  if (left !== P.left) { P.left = left; if (left <= 3 && left !== P.lastBeep) { P.lastBeep = left; beep(740, 120, 0.2); } updateCount(); }
}
function updateCount() {
  var s = P.steps[P.i], c = $('#cnt', overlay), ring = $('#ringc', overlay);
  if (c) c.textContent = P.left;
  if (ring) { var C = 2 * Math.PI * 66; ring.setAttribute('stroke-dashoffset', C * (1 - P.left / s.d)); }
  var bar = $('#pbar', overlay); if (bar) { var tot = P.steps.reduce(function (a, x) { return a + x.d; }, 0), done = P.steps.slice(0, P.i).reduce(function (a, x) { return a + x.d; }, 0) + (s.d - P.left); bar.style.width = Math.min(100, done / tot * 100) + '%'; var rem = $('#rem', overlay); if (rem) rem.textContent = 'باقي ' + Math.ceil((tot - done) / 60) + ' د'; }
}
function drawPlayer() {
  var s = P.steps[P.i], e = s.ex, works = P.steps.filter(function (x) { return x.t === 'work'; }), wi = P.steps.slice(0, P.i + 1).filter(function (x) { return x.t === 'work'; }).length;
  var isRest = s.t === 'rest', C = 2 * Math.PI * 66;
  var label = s.t === 'warm' ? '🔥 إحماء' : isRest ? '😮‍💨 راحة — الجاي:' : '💪 تمرين ' + wi + ' من ' + works.length + (P.plan.rounds > 1 ? ' · جولة ' + s.round + '/' + P.plan.rounds : '');
  openOverlay('<div class="player">' +
    '<div class="p-top"><button class="btn sm" id="stop">✕ إنهاء</button><span class="pill">' + P.plan.icon + ' ' + P.plan.theme + '</span><span class="tiny mut" id="rem"></span></div>' +
    '<div class="p-bar"><i id="pbar"></i></div>' +
    '<div class="p-label' + (isRest ? ' rest' : '') + '">' + label + '</div>' +
    '<div class="p-name">' + e.name + '</div><div class="tiny mut">' + eqLabel(e) + ' · 🎯 ' + e.hint + (e.side && !isRest ? ' · بدّل الجهة بالنص' : '') + '</div>' +
    '<div style="margin:10px 0">' + anim(e) + '</div>' +
    '<div class="ring"><svg width="150" height="150"><circle cx="75" cy="75" r="66" stroke="#20242d" stroke-width="12" fill="none"/><circle id="ringc" cx="75" cy="75" r="66" stroke="' + (isRest ? '#38bdf8' : '#22c55e') + '" stroke-width="12" fill="none" stroke-linecap="round" stroke-dasharray="' + C + '" stroke-dashoffset="0"/></svg><div class="p-count' + (isRest ? ' rest' : '') + '" id="cnt">' + P.left + '</div></div>' +
    '<details class="small" style="margin-top:6px"><summary class="mut">طريقة الأداء</summary><ol class="steps">' + e.steps.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ol></details>' +
    '<div class="p-ctrl"><button class="btn" id="prev">→ السابق</button><button class="btn pri" id="pause">' + (P.paused ? '▶️ كمّل' : '⏸ وقّف') + '</button><button class="btn" id="next">التالي ←</button></div></div>');
  updateCount();
  $('#pause', overlay).onclick = function () { if (P.paused) { P.paused = false; P.end = Date.now() + P.left * 1000; } else { P.paused = true; } drawPlayer(); };
  $('#next', overlay).onclick = function () { var s2 = P.steps[P.i]; if (s2.t === 'work') P.workSec += s2.d - P.left; beginStep(P.i + 1); };
  $('#prev', overlay).onclick = function () { beginStep(Math.max(0, P.i - 1)); };
  $('#stop', overlay).onclick = function () {
    var s2 = P.steps[P.i]; var el = (Date.now() - P.startT) / 1000;
    if (confirm(el >= 60 ? 'تنهي الحين؟ اللي سويته ينحسب لك 💪' : 'تنهي الحين؟ (أقل من دقيقة ما تنحسب، بس عادي!)')) { if (s2.t === 'work') P.workSec += s2.d - P.left; finish(true); }
  };
}
function stopTimer() { if (P && P.timer) clearInterval(P.timer); document.removeEventListener('visibilitychange', onVis); keepAwake(false); try { speechSynthesis.cancel(); } catch (e) {} }

/* ---------- الإنهاء والمكافأة ---------- */
function finish(early) {
  stopTimer();
  var plan = P.plan, sec = Math.round((Date.now() - P.startT) / 1000);
  if (plan.kind === 'tiny' && !early) { return tinyDone(sec); }
  logSession(plan, sec, early);
}
function tinyDone(sec) {
  beep(1318, 400, 0.3);
  openOverlay('<div class="player celebrate"><div class="emoji">🎉</div><h1>كسرت حاجز البداية!</h1><p class="mut">دقيقتين خلصت. جسمك الحين دافي. تكمل شوي؟</p>' +
    '<button class="btn pri big" id="more">🚀 كمّل للتمرين الكامل</button><div style="height:10px"></div><button class="btn" id="m5">⚡ ٥ دقايق زيادة بس</button><div style="height:10px"></div><button class="btn ghost" id="enough">✅ يكفي اليوم، احسبها</button></div>');
  var tp = P.plan;
  $('#more', overlay).onclick = function () { var p = todayPlan(S.settings.minutes); p.noWarm = true; logSession(tp, sec, false, true); startSession(p); };
  $('#m5', overlay).onclick = function () { var p = todayPlan(5); p.noWarm = true; logSession(tp, sec, false, true); startSession(p); };
  $('#enough', overlay).onclick = function () { logSession(tp, sec, false); };
}
function logSession(plan, sec, early, silent) {
  var today = dkey(), comeback = isComeback(), now = new Date();
  var onPlan = false;
  if (S.plan && S.plan.time) { var pt = S.plan.time.split(':'), t = new Date(); t.setHours(+pt[0], +pt[1], 0, 0); onPlan = Math.abs(now - t) <= 45 * 60000; }
  var mins = Math.max(1, Math.round(sec / 60)), xp = mins * 10, notes = [];
  if (sec < 60) xp = 0;
  if (onPlan && xp) { xp += 20; notes.push('⏰ في موعدك +20'); }
  if (comeback && xp) { xp *= 2; notes.push('🔄 بونص الرجعة ×2'); }
  if (xp && Math.random() < 0.15) { xp += 25; notes.push('🎁 مفاجأة +25'); }
  if (sec >= 60) {
    S.sessions.push({ t: now.toISOString(), date: today, kind: plan.kind, theme: plan.parentTheme || plan.theme, sec: sec, ex: plan.ex.map(function (e) { return e.key; }), eq: [].concat.apply([], plan.ex.map(function (e) { return e.eq; })), partial: !!early, xp: xp, onPlan: onPlan, hour: now.getHours() });
    S.xp = (S.xp || 0) + xp;
    if (plan.kind === 'snack') { if (S.snacks.date !== today) S.snacks = { date: today, done: [false, false, false] }; S.snacks.done[plan.snackIdx] = true; }
    if (S.boredBoost > 0) S.boredBoost--;
  }
  var nb = checkBadges(comeback);
  save();
  if (silent) return;
  if (sec < 60) { closeOverlay(); P = null; render(); toast('ولا يهمك، المرة الجاية دقيقتين بس 👍'); return; }
  celebrate(xp, notes, nb, early);
}
var BADGES = [
  { id: 'first', i: '🌱', n: 'أول تمرين' }, { id: 'tiny5', i: '🤏', n: 'بدأت صغير ×5' }, { id: 's3', i: '🔥', n: 'ستريك ٣' },
  { id: 's7', i: '⚡', n: 'ستريك ٧' }, { id: 'w4', i: '🎯', n: '٤ أيام بأسبوع' }, { id: 'back', i: '🔄', n: 'رجعة الأبطال' },
  { id: 'tools', i: '🧰', n: 'كل الأدوات' }, { id: 'ten', i: '🏅', n: '١٠ جلسات' }, { id: 'early', i: '🌅', n: 'تمرين قبل العصر' },
  { id: 'plan', i: '⏰', n: 'في الموعد ×3' }, { id: 'low', i: '😴', n: 'ما استسلمت للتعب' }, { id: 's30', i: '👑', n: 'ستريك ٣٠' }
];
function checkBadges(comeback) {
  var ss = S.sessions, st = streakInfo(), has = {}, out = [];
  S.badges.forEach(function (b) { has[b] = 1; });
  var eqs = {}; ss.forEach(function (s) { (s.eq || []).forEach(function (q) { eqs[q] = 1; }); });
  var cond = {
    first: ss.length >= 1, tiny5: ss.filter(function (s) { return s.kind === 'tiny'; }).length >= 5, s3: st.count >= 3, s7: st.count >= 7, s30: st.count >= 30,
    w4: weekCount() >= 4, back: comeback && ss.length > 1, tools: ['bar', 'band', 'wheel', 'db', 'ball'].every(function (q) { return eqs[q]; }), ten: ss.length >= 10,
    early: ss.some(function (s) { return s.hour < 15; }), plan: ss.filter(function (s) { return s.onPlan; }).length >= 3, low: ss.some(function (s) { return s.kind === 'low'; })
  };
  BADGES.forEach(function (b) { if (cond[b.id] && !has[b.id]) { S.badges.push(b.id); out.push(b); } });
  return out;
}
function celebrate(xp, notes, nb, early) {
  beep(784, 150, 0.3); setTimeout(function () { beep(988, 150, 0.3); }, 160); setTimeout(function () { beep(1318, 400, 0.3); }, 320);
  buzz([100, 50, 100, 50, 300]); confetti();
  var st = streakInfo(), lv = level();
  openOverlay('<div class="player celebrate"><div class="emoji">' + (early ? '💪' : '🏆') + '</div><h1>' + PRAISE[Math.floor(Math.random() * PRAISE.length)] + '</h1>' +
    '<p class="mut">' + (early ? 'خلصت جزء — وهذا ينحسب. أحسن من صفر بمراحل.' : 'خلصت التمرين كامل!') + '</p>' +
    '<div class="card"><div style="font-size:34px;font-weight:800;color:var(--acc)" dir="ltr">+' + xp + ' XP</div>' + notes.map(function (n) { return '<div class="small">' + n + '</div>'; }).join('') +
    '<div class="small" style="margin-top:6px">🔥 ستريك: ' + st.count + ' · ⭐ ' + lv.title + '</div></div>' +
    (nb.length ? '<div class="card hl"><b>وسام جديد!</b><div style="font-size:30px">' + nb.map(function (b) { return b.i + ' <span class="small">' + b.n + '</span>'; }).join('<br>') + '</div></div>' : '') +
    '<div class="card"><b>كيف كان؟</b><div class="grid2" style="grid-template-columns:repeat(3,1fr);margin-top:8px"><button class="btn" data-m="love">😍<br>حلو</button><button class="btn" data-m="ok">🙂<br>عادي</button><button class="btn" data-m="bored">🥱<br>ممل</button></div></div>' +
    '<button class="btn" id="bonus">🎴 تحدي مفاجئ ٣٠ ثانية (+١٥)</button><div style="height:10px"></div><button class="btn pri" id="home">تمام 👌</button></div>');
  overlay.querySelectorAll('[data-m]').forEach(function (b) { b.onclick = function () { var l = S.sessions[S.sessions.length - 1]; if (l) l.mood = b.dataset.m; if (b.dataset.m === 'bored') { S.boredBoost = 3; toast('تم! بكرة نخلّطها أكثر 🎲'); } else toast('تسلم 🙏'); save(); overlay.querySelectorAll('[data-m]').forEach(function (x) { x.disabled = true; x.style.opacity = x === b ? 1 : .4; }); }; });
  $('#home', overlay).onclick = function () { closeOverlay(); P = null; render(); };
  $('#bonus', overlay).onclick = function () { var pl = pool(function (e) { return e.g !== 'mobility' && e.lvl <= 2; }); var e = pl[Math.floor(Math.random() * pl.length)]; S.xp += 15; save(); startSession({ kind: 'bonus', theme: 'تحدي مفاجئ', icon: '🎴', fmt: { w: 30, r: 0 }, rounds: 1, ex: [e], minutes: 1, noWarm: true }); };
}
function confetti() {
  var c = $('#confetti'), x = c.getContext('2d'), W = c.width = innerWidth, H = c.height = innerHeight, ps = [], cols = ['#22c55e', '#38bdf8', '#f59e0b', '#f472b6', '#fff'];
  for (var i = 0; i < 140; i++) ps.push({ x: W / 2, y: H / 3, vx: (Math.random() - .5) * 14, vy: Math.random() * -14 - 2, s: Math.random() * 7 + 4, c: cols[i % 5], r: Math.random() * 6 });
  var t = 0; (function f() { x.clearRect(0, 0, W, H); ps.forEach(function (p) { p.vy += .35; p.x += p.vx; p.y += p.vy; p.r += .1; x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c; x.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); x.restore(); }); if (t++ < 120) requestAnimationFrame(f); else x.clearRect(0, 0, W, H); })();
}

/* ---------- المكتبة ---------- */
var libF = 'all';
function renderLib() {
  var list = EX.filter(function (e) { return libF === 'all' || e.eq.indexOf(libF) >= 0; });
  view.innerHTML = '<h1>📚 مكتبة التمارين</h1><div class="mut small">' + EX.length + ' تمرين لأدواتك. اضغط أي تمرين تشوف الصورة والشرح.</div>' +
    '<div class="chips" style="margin:12px 0"><button class="chip' + (libF === 'all' ? ' on' : '') + '" data-f="all">الكل</button>' + Object.keys(EQ).map(function (k) { return '<button class="chip' + (libF === k ? ' on' : '') + '" data-f="' + k + '">' + EQ[k].emoji + ' ' + EQ[k].name + '</button>'; }).join('') + '</div>' +
    list.map(function (e) { return '<button class="lib-item" data-ex="' + e.key + '"><img loading="lazy" src="' + img(e) + '" alt=""><div><b>' + e.name + '</b><div class="tiny mut">' + eqLabel(e) + '</div><div class="tiny mut">' + GR[e.g] + ' · ' + '⭐'.repeat(e.lvl) + '</div></div></button>'; }).join('') +
    '<p class="tiny mut">الصور من مشروع free-exercise-db (رخصة Unlicense — ملكية عامة).</p>';
  view.querySelectorAll('[data-f]').forEach(function (b) { b.onclick = function () { libF = b.dataset.f; renderLib(); }; });
  view.querySelectorAll('[data-ex]').forEach(function (b) { b.onclick = function () { showEx(b.dataset.ex); }; });
}

/* ---------- التقدّم ---------- */
function renderProgress() {
  var st = streakInfo(), lv = level(), ss = S.sessions, tot = ss.reduce(function (a, s) { return a + s.sec; }, 0);
  var start = addDays(weekStart(new Date()), -21), heat = '';
  for (var i = 0; i < 28; i++) { var k = dkey(addDays(start, i)), v = st.act[k] || 0; heat += '<i title="' + k + '" class="' + (v >= 600 ? 'l3' : v >= 300 ? 'l2' : v ? 'l1' : st.grace[k] ? 'g' : '') + '"></i>'; }
  var has = {}; S.badges.forEach(function (b) { has[b] = 1; });
  view.innerHTML = '<h1>🔥 تقدّمي</h1>' +
    '<div class="grid2"><div class="card"><div class="mut tiny">الستريك</div><div style="font-size:30px;font-weight:800">' + st.count + ' 🔥</div><div class="tiny mut">أفضل: ' + (S.bestStreak || 0) + '</div></div>' +
    '<div class="card"><div class="mut tiny">المستوى</div><div style="font-size:20px;font-weight:800">' + lv.title + '</div><div class="tiny mut">' + S.xp + ' / ' + lv.next + ' XP</div></div>' +
    '<div class="card"><div class="mut tiny">الجلسات</div><div style="font-size:30px;font-weight:800">' + ss.length + '</div></div>' +
    '<div class="card"><div class="mut tiny">الدقائق</div><div style="font-size:30px;font-weight:800">' + Math.round(tot / 60) + '</div></div></div>' +
    '<div class="card"><b>آخر ٤ أسابيع</b><div class="row tiny mut between" style="margin:6px 0">' + DAYS.map(function (d) { return '<span>' + d + '</span>'; }).join('') + '</div><div class="heat">' + heat + '</div><div class="tiny mut" style="margin-top:6px">رمادي = يوم سماح 🛡 — الغياب ما يكسر الستريك لين يومين بالأسبوع.</div></div>' +
    '<h2>الأوسمة</h2><div class="badges">' + BADGES.map(function (b) { return '<div class="badge' + (has[b.id] ? ' on' : '') + '"><span>' + b.i + '</span>' + b.n + '</div>'; }).join('') + '</div>' +
    '<h2>السجل</h2>' + (ss.length ? ss.slice(-40).reverse().map(function (s) { var d = new Date(s.t); return '<div class="hist"><span>' + ({ full: '🏋️', tiny: '🤏', low: '😴', snack: '🍪', single: '⚡', bonus: '🎴' }[s.kind] || '•') + ' ' + s.theme + (s.partial ? ' <span class="pill">جزئي</span>' : '') + '</span><span class="mut small">' + Math.round(s.sec / 60) + ' د · ' + d.getDate() + '/' + (d.getMonth() + 1) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + '</span></div>'; }).join('') : '<p class="mut">لسه ما فيه جلسات — أول دقيقتين تفتح أول وسام 🌱</p>');
}

/* ---------- الخطة والتذكير والإعدادات ---------- */
var ANCHORS = ['صليت الفجر', 'خلصت الفطور', 'رجعت من الدوام وغيّرت ملابسي', 'صليت العصر', 'صليت المغرب'];
var BARRIERS = ['إذا جاني النعاس ← أسوي «جلسة التعبان» ٥ دقايق', 'إذا ملّيت ← أضغط 🎲 وأغيّر التمرين', 'إذا ما عندي وقت ← أسوي دقيقتين بس', 'إذا فاتني الموعد ← أسوي سناك قبل المغرب'];
function renderPlan() {
  var p = S.plan || { anchor: 'صليت العصر', time: '16:00', barriers: [BARRIERS[0], BARRIERS[2]], backup: true };
  var late = p.time && +p.time.split(':')[0] >= 20;
  view.innerHTML = '<h1>⏰ خطتي</h1><p class="mut small">الدراسات: لما تحدد «إذا صار كذا ← أسوي كذا» بوقت ومكان ثابت، تزيد فرصة إنك تتمرن. ولا تخليها آخر اليوم.</p>' +
    '<div class="card"><b>١) بعد إيش بتتمرن؟ (المرساة)</b><div class="chips" style="margin-top:8px">' + ANCHORS.map(function (a) { return '<button class="chip' + (p.anchor === a ? ' on' : '') + '" data-a="' + a + '">بعد ما ' + a + '</button>'; }).join('') + '</div>' +
    '<b style="display:block;margin-top:14px">٢) الساعة كم تقريباً؟</b><input type="time" id="ptime" value="' + (p.time || '16:00') + '">' +
    (late ? '<div class="small" style="color:var(--warn);margin-top:6px">⚠️ الوقت متأخر — قلت إنك تنعس آخر اليوم. جرّب وقت أبكر.</div>' : '') +
    '<b style="display:block;margin-top:14px">٣) خطة الطوارئ (إذا… ←)</b>' + BARRIERS.map(function (b, i) { return '<div class="toggle" data-b="' + i + '"><span class="small">' + b + '</span><span class="sw' + ((p.barriers || []).indexOf(b) >= 0 ? ' on' : '') + '"></span></div>'; }).join('') +
    '<div class="card hl" style="margin-top:14px"><div class="tiny mut">جملتك:</div><div class="plan-sentence" id="psent"></div></div>' +
    '<button class="btn pri" id="psave">💾 احفظ خطتي</button></div>' +
    '<div class="card"><b>🔔 التذكير اليومي (تقويم الآيفون)</b><p class="small mut">التطبيق ما عنده سيرفر، فما يقدر يرسل إشعارات Push بشكل صادق. الحل: نضيف موعد يومي متكرر في <b>تقويم الآيفون</b> فيه تنبيه — التقويم هو اللي يذكرك حتى لو التطبيق مقفل.</p>' +
    '<div class="toggle" id="bk"><span class="small">تذكير احتياطي بعد ساعتين: «ما تمرنت؟ جلسة ٥ دقايق»</span><span class="sw' + (p.backup !== false ? ' on' : '') + '"></span></div>' +
    '<div style="height:10px"></div><button class="btn pri" id="ics">📅 أضف التذكير للتقويم</button><div style="height:8px"></div><button class="btn" id="icsShare">📤 شارك ملف التذكير (لو الأول ما اشتغل)</button>' +
    '<ol class="small mut steps"><li>اضغط الزر — بيطلع لك ملف تقويم.</li><li>اختر «إضافة الكل» / Add All.</li><li>لو ما فتح من التطبيق المثبت: افتح نفس الرابط في Safari واضغط الزر هناك.</li><li>تأكد إن إشعارات التقويم شغالة: الإعدادات ← التقويم ← الإشعارات.</li></ol></div>' +
    '<div class="card"><b>⚙️ أدواتي</b>' + Object.keys(EQ).filter(function (k) { return k !== 'body'; }).map(function (k) { return '<div class="toggle" data-eq="' + k + '"><span>' + EQ[k].emoji + ' ' + EQ[k].name + '</span><span class="sw' + (S.settings.equip[k] ? ' on' : '') + '"></span></div>'; }).join('') +
    '<div class="toggle" id="snd"><span>🔊 أصوات العد</span><span class="sw' + (S.settings.sound ? ' on' : '') + '"></span></div>' +
    '<div class="toggle" id="vc"><span>🗣️ ينطق اسم التمرين</span><span class="sw' + (S.settings.voice ? ' on' : '') + '"></span></div>' +
    '<p class="tiny mut">ملاحظة: الآيفون ما يسمح بالاهتزاز من تطبيقات الويب، ولو الجوال على الصامت ممكن ما تطلع الأصوات. العدّ الكبير والألوان تكفي.</p></div>' +
    '<div class="card"><b>💾 نسخة احتياطية</b><p class="small mut">كل بياناتك محفوظة في جوالك بس. صدّرها كل فترة عشان ما تضيع لو مسحت التطبيق.</p><div class="grid2"><button class="btn" id="exp">⬇️ تصدير</button><label class="btn" for="imp">⬆️ استيراد</label></div><input type="file" id="imp" accept="application/json,.json" class="hidden">' +
    '<div style="height:10px"></div><button class="btn ghost" id="reset" style="color:var(--red)">🗑️ مسح كل البيانات</button></div>';
  function sentence() { $('#psent').textContent = 'إذا ' + p.anchor + ' (' + fmtTime($('#ptime').value) + ')، ألبس جوتي وأبدأ بدقيقتين تمرين.' + ((p.barriers || []).length ? ' و' + p.barriers.join('، و') : ''); }
  sentence();
  view.querySelectorAll('[data-a]').forEach(function (b) { b.onclick = function () { p.anchor = b.dataset.a; view.querySelectorAll('[data-a]').forEach(function (x) { x.classList.toggle('on', x === b); }); sentence(); }; });
  $('#ptime').onchange = function () { p.time = $('#ptime').value; sentence(); };
  view.querySelectorAll('[data-b]').forEach(function (t) { t.onclick = function () { var b = BARRIERS[+t.dataset.b]; p.barriers = p.barriers || []; var i = p.barriers.indexOf(b); if (i >= 0) p.barriers.splice(i, 1); else p.barriers.push(b); t.querySelector('.sw').classList.toggle('on', i < 0); sentence(); }; });
  $('#bk').onclick = function () { p.backup = p.backup === false; this.querySelector('.sw').classList.toggle('on', p.backup); };
  $('#psave').onclick = function () { p.time = $('#ptime').value; S.plan = p; save(); toast('✅ انحفظت خطتك'); renderPlan(); };
  $('#ics').onclick = function () { p.time = $('#ptime').value; S.plan = p; save(); downloadICS(p); };
  $('#icsShare').onclick = function () { p.time = $('#ptime').value; S.plan = p; save(); shareICS(p); };
  view.querySelectorAll('[data-eq]').forEach(function (t) { t.onclick = function () { var k = t.dataset.eq; S.settings.equip[k] = !S.settings.equip[k]; save(); t.querySelector('.sw').classList.toggle('on', S.settings.equip[k]); }; });
  $('#snd').onclick = function () { S.settings.sound = !S.settings.sound; save(); this.querySelector('.sw').classList.toggle('on', S.settings.sound); };
  $('#vc').onclick = function () { S.settings.voice = !S.settings.voice; save(); this.querySelector('.sw').classList.toggle('on', S.settings.voice); };
  $('#exp').onclick = function () { dl(new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' }), 'tamreen-backup-' + dkey() + '.json'); };
  $('#imp').onchange = function (ev) { var f = ev.target.files[0]; if (!f) return; var rd = new FileReader(); rd.onload = function () { try { var d = JSON.parse(rd.result); if (!d.sessions) throw 0; S = merge(JSON.parse(JSON.stringify(DEF)), d); save(); toast('✅ رجعت بياناتك'); render(); } catch (e) { toast('الملف مو صحيح'); } }; rd.readAsText(f); };
  $('#reset').onclick = function () { if (confirm('أكيد تبي تمسح كل شي؟ ما يرجع.')) { localStorage.removeItem(KEY); S = load(); render(); } };
}
function icsText(p) {
  var t = (p.time || '16:00').split(':'), d = new Date(); d.setHours(+t[0], +t[1], 0, 0); if (d < new Date()) d = addDays(d, 1);
  function f(x) { return x.getFullYear() + pad(x.getMonth() + 1) + pad(x.getDate()) + 'T' + pad(x.getHours()) + pad(x.getMinutes()) + '00'; }
  var now = new Date(), stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  function esc(s) { return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n'); }
  var L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Tamreen PWA//AR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:تمرين'];
  function ev(uid, start, title, desc, alarms) {
    L.push('BEGIN:VEVENT', 'UID:' + uid + '-' + stamp + '@tamreen.local', 'DTSTAMP:' + stamp, 'DTSTART:' + f(start), 'DURATION:PT15M', 'RRULE:FREQ=DAILY', 'SUMMARY:' + esc(title), 'DESCRIPTION:' + esc(desc));
    alarms.forEach(function (a) { L.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:' + a[0], 'DESCRIPTION:' + esc(a[1]), 'END:VALARM'); });
    L.push('END:VEVENT');
  }
  ev('tamreen-daily', d, '🏋️ تمرين اليوم — دقيقتين بس وابدأ', 'إذا ' + p.anchor + '، ألبس جوتي وأفتح تطبيق «تمرين» وأبدأ بدقيقتين.', [['-PT10M', 'بعد ١٠ دقايق تمرينك — جهّز الدنابل والحبل 👀'], ['PT0M', 'الحين! افتح «تمرين» واضغط «ابدأ بدقيقتين» 💪']]);
  if (p.backup !== false) ev('tamreen-backup', new Date(d.getTime() + 2 * 3600e3), '😴 ما تمرنت؟ جلسة ٥ دقايق', 'لو ما تمرنت لسه: جلسة التعبان ٥ دقايق قبل لا يجيك النوم. لو تمرنت تجاهلها 👏', [['PT0M', 'ما تمرنت؟ ٥ دقايق خفيفة بس 😴']]);
  L.push('END:VCALENDAR');
  return L.map(fold).join('\r\n') + '\r\n';
}
function fold(line) { // RFC 5545: سطور ≤ 75 بايت
  var out = [], cur = '', n = 0, enc = new TextEncoder();
  Array.from(line).forEach(function (ch) { var b = enc.encode(ch).length; if (n + b > (out.length ? 74 : 75)) { out.push(cur); cur = ''; n = 0; } cur += ch; n += b; });
  out.push(cur); return out.join('\r\n ');
}
function dl(blob, name) { var u = URL.createObjectURL(blob), a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(u); a.remove(); }, 4000); }
function downloadICS(p) {
  var blob = new Blob([icsText(p)], { type: 'text/calendar;charset=utf-8' });
  if (/iPhone|iPad|iPod/.test(navigator.userAgent)) { var r = new FileReader(); r.onload = function () { location.href = r.result; }; r.readAsDataURL(blob); }
  else dl(blob, 'tamreen-reminder.ics');
  toast('📅 افتح الملف واضغط «إضافة الكل»');
}
function shareICS(p) {
  try { var file = new File([icsText(p)], 'tamreen-reminder.ics', { type: 'text/calendar' }); if (navigator.canShare && navigator.canShare({ files: [file] })) { navigator.share({ files: [file], title: 'تذكير تمرين' }).catch(function () {}); return; } } catch (e) {}
  dl(new Blob([icsText(p)], { type: 'text/calendar' }), 'tamreen-reminder.ics');
}

/* ---------- ليش ينفع ---------- */
var WHY = [
  ['🧠', 'الرياضة تساعد عقل ADHD', 'تحليلات تجميعية (2025 و2026) لقت إن حتى جلسة رياضة وحدة تحسّن التحكم بالاندفاع والتركيز عند البالغين المصابين بـ ADHD. يعني التمرين نفسه علاج مساعد.', [['Journal of Global Health 2025', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11907377/'], ['Psychology of Sport & Exercise 2026', 'https://doi.org/10.1016/j.psychsport.2026.103088']]],
  ['📍', 'خطة «إذا… ثم…» بوقت ثابت', 'تحليل لـ 26 دراسة: لما تحدد متى وفين وتجهّز حل للعوائق، يزيد النشاط البدني. وأقوى أثر لما الخطة فيها «إدارة العوائق». عشان كذا فيه خطة طوارئ.', [['Bélanger-Gravel 2013', 'https://doi.org/10.1080/17437199.2011.560095']]],
  ['🔁', 'الثبات أهم من الساعة نفسها', 'اللي يتمرنون بنفس الوقت كل يوم يتمرنون أكثر — والمهم الثبات مو إنه الصبح بالضرورة. وعادة الرياضة تتكوّن تقريباً بـ ٤ مرات بالأسبوع لمدة ٦ أسابيع. وبما إنك تنعس آخر اليوم: اختر وقت مبكر ثابت.', [['Schumacher 2019', 'https://doi.org/10.1002/oby.22535'], ['Kaushal & Rhodes 2015', 'https://pubmed.ncbi.nlm.nih.gov/25851609/']]],
  ['🛡', 'يوم واحد فايت ما يخرّب العادة', 'دراسة تكوين العادات: تفويت مرة وحدة ما أثّر فعلياً على تكوّن العادة. عشان كذا الستريك فيه أيام سماح، وما فيه عقاب.', [['Lally 2010', 'https://doi.org/10.1002/ejsp.674']]],
  ['🔄', 'مكافأة الرجعة بعد الغياب', 'أكبر تجربة على ٦١ ألف شخص (54 أسلوب تحفيز): أفضل أسلوب كان مكافأة صغيرة لما ترجع بعد ما فوّت تمرين. عشان كذا الرجعة = نقاط ×2.', [['Milkman 2021, Nature', 'https://www.nature.com/articles/s41586-021-04128-4']]],
  ['🎲', 'التنويع يزيد الالتزام', 'تجربة عشوائية: البرنامج المنوّع رفع الالتزام (64% مقابل 51%). عشان كذا التمرين يتغير كل يوم، وفيه زر 🎲 وتحدي مفاجئ.', [['Sylvester 2016', 'https://pubmed.ncbi.nlm.nih.gov/26546241/']]],
  ['⚡', 'سناكات تمرين قصيرة تنفع', 'دفعات قصيرة (دقيقة أو أقل) قوية على مدار اليوم تحسن اللياقة وتكسر الجلوس الطويل — بدون ما تحتاج وقت طويل.', [['Islam, Gibala & Little 2022', 'https://doi.org/10.1249/JES.0000000000000275'], ['Jenkins 2019', 'https://pubmed.ncbi.nlm.nih.gov/30649897/']]],
  ['🎁', 'مكافأة فورية', 'ADHD مرتبط بتفضيل المكافأة الفورية على المتأخرة. عشان كذا: احتفال ونقاط وأوسمة فوراً بعد كل جلسة، مو بس «نتيجة بعد شهور».', [['Jackson & MacKillop 2016 (تحليل تجميعي)', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5049699/']]],
  ['🎧', 'اربط التمرين بشي تحبه', 'تجربة «ربط المغريات»: اللي خلّوا كتب صوتية يحبونها حصرياً للجيم راحوا أكثر. جرّب: بودكاستك المفضل وقت التمرين بس.', [['Milkman, Minson & Volpp 2014', 'https://doi.org/10.1287/mnsc.2013.1784']]]
];
function renderWhy() {
  view.innerHTML = '<h1>🧠 ليش هالطريقة تنفع؟</h1><p class="mut small">كل ميزة في التطبيق مبنية على دراسة. باختصار:</p>' +
    WHY.map(function (w) { return '<div class="card"><h3>' + w[0] + ' ' + w[1] + '</h3><div class="small">' + w[2] + '</div><div class="src">' + w[3].map(function (s) { return '🔗 <a href="' + s[1] + '" target="_blank" rel="noopener">' + s[0] + '</a>'; }).join(' · ') + '</div></div>'; }).join('') +
    '<div class="card small"><b>⚠️ تنبيه:</b> هذا تطبيق تحفيز وتنظيم، مو بديل عن الطبيب. لو عندك ألم أو إصابة خفف أو استشر مختص.</div>' +
    '<div class="card tiny mut"><b>حقوق الصور:</b> صور التمارين من <a href="https://github.com/yuhonas/free-exercise-db" target="_blank" rel="noopener">free-exercise-db</a> — رخصة <a href="https://unlicense.org/" target="_blank" rel="noopener">Unlicense</a> (ملكية عامة). شكراً لهم.<br>كل بياناتك محفوظة على جوالك فقط، بدون سيرفر وبدون حساب.</div>';
}

/* ---------- تشغيل ---------- */
render();
if (S.reroll.date !== dkey()) { S.reroll = { date: dkey(), n: 0 }; save(); }
if ('serviceWorker' in navigator) { window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); }); }
document.addEventListener('visibilitychange', function () { if (!document.hidden && !P && overlay.classList.contains('hidden')) render(); });
window.__tamreen = { todayPlan: todayPlan, tinyPlan: tinyPlan, lowPlan: lowPlan, snackPlans: snackPlans, icsText: icsText, streakInfo: streakInfo, state: function () { return S; } };
})();
