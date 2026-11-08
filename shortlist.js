/* Career Shortlist: narrows Career Compass results to a ranked short list. */
"use strict";
const JOBS = window.JOBS || [];
const JOB = Object.fromEntries(JOBS.map(j => [j.id, j]));
const TRAINING = window.TRAINING || {};
const CATALOG = window.CATALOG || {programs: [], byJob: {}};
const KEY = "career_shortlist_v1", SRC_KEY = "career_compass_results";
const MAX_KEEP = 8;

const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const k = n => "$" + Math.round(n / 1000) + "k";
const when = m => m <= 1 ? "Start now" : m < 12 ? `~${m} months` : m < 24 ? "~1 year" : `~${Math.round(m / 12)} years`;
const dots = (n, max = 5) => "●".repeat(n) + "○".repeat(max - n);

const I = {
  upload:'<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
  undo:'<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
  sort:'<rect x="3" y="6" width="13" height="15" rx="2"/><path d="M8 3h11a2 2 0 0 1 2 2v13"/>',
  cut:'<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.1 8.1L20 20M8.1 15.9L20 4"/>',
  vs:'<path d="M4 6l4 12 4-12M20 7a3 3 0 0 0-3-1c-2 0-3 1-3 2.5 0 3.5 6 2 6 5.5 0 1.5-1.2 2.5-3 2.5a3.5 3.5 0 0 1-3-1.5"/>',
  flag:'<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  chev:'<path d="M9 6l6 6-6 6"/>'
};
const svg = (n, cls = "step-ico") => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n]}</svg>`;

const STEPS = [
  {id:"load", label:"Your results", icon:"upload", title:"Narrow it down", sub:"Your Career Compass results, cut down to a handful of jobs worth chasing, ranked, with a first step for each."},
  {id:"second", label:"A second look", icon:"undo", title:"A second look at what got cut", sub:"Your deal-breakers did a lot of the sorting. Check that they cut what you meant them to."},
  {id:"sort", label:"Quick sort", icon:"sort", title:"Quick sort", sub:"One job at a time. Go with your gut: keep it, cut it, or not sure."},
  {id:"cut", label:"Top picks", icon:"cut", title:"Pick your top 8", sub:"Get your keepers down to 8 or fewer. You can pull from the not-sure pile if you're short."},
  {id:"h2h", label:"Head to head", icon:"vs", title:"Head to head", sub:"Two jobs at a time. Pick the one you'd rather do. This puts your picks in order."},
  {id:"final", label:"Your shortlist", icon:"flag", title:"Your shortlist", sub:"Your picks in order, with what to do first for each."}
];

/* ---------- State ---------- */
const blank = () => ({step:0, src:null, revive:{}, sort:{}, hist:[], h2h:null, h2hHist:[]});
function load(){ try { const v = JSON.parse(localStorage.getItem(KEY)); if (v && typeof v === "object") return Object.assign(blank(), v); } catch(e) {} return blank(); }
function save(){ try { localStorage.setItem(KEY, JSON.stringify(S)); } catch(e) {} }
let S = load();

/* Pull fresh results from Career Compass in this browser if they exist */
function compassResults(){
  try { const v = JSON.parse(localStorage.getItem(SRC_KEY)); if (v && Array.isArray(v.rows) && v.rows.length) return v; } catch(e) {}
  return null;
}

/* ---------- CSV ---------- */
function parseCSV(text){
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i+1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i+1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  const head = rows.shift() || [];
  return rows.filter(r => r.length > 1).map(r => Object.fromEntries(head.map((h, i) => [h.trim(), r[i] ?? ""])));
}
function normalize(rows){
  return rows.map(r => ({
    id: +r.ID, sug: r.Suggested || "No", fit: +r["Fit Score"] || 0,
    pros: String(r["Why It Fits"] || "").split(/;\s*/).filter(Boolean),
    cons: String(r.Concerns || "").split(/;\s*/).filter(Boolean),
    rating: r["Card Rating"] || ""
  })).filter(r => JOB[r.id]);
}

/* ---------- Pools ---------- */
const R = () => S.src ? S.src.rows : [];
const breakersOf = r => r.cons.filter(c => /^Deal-breaker:/i.test(c)).map(c => c.replace(/^Deal-breaker:\s*/i, "").trim());
function breakerStats(){
  const m = {};
  R().forEach(r => breakersOf(r).forEach(b => {
    m[b] = m[b] || {name:b, total:0, liked:[]};
    m[b].total++;
    if (JOB[r.id].original === "Yes") m[b].liked.push(r);
  }));
  return Object.values(m).sort((a, b) => b.total - a.total);
}
function revived(){
  const on = Object.keys(S.revive).filter(b => S.revive[b]);
  if (!on.length) return [];
  return R().filter(r => r.sug === "No" && JOB[r.id].original === "Yes" && breakersOf(r).length && breakersOf(r).every(b => on.includes(b)))
            .sort((a, b) => b.fit - a.fit);
}
function pool(){
  const base = R().filter(r => r.sug === "Yes" || r.sug === "Maybe").sort((a, b) => b.fit - a.fit);
  const seen = new Set(base.map(r => r.id));
  return base.concat(revived().filter(r => !seen.has(r.id)));
}
const rowOf = id => R().find(r => r.id === id);
const inPile = p => pool().filter(r => S.sort[r.id] === p);
const nextUnsorted = () => pool().find(r => !S.sort[r.id]);

/* ---------- Job facts ---------- */
const LEVEL = ["", "very little", "a little", "some", "a lot", "constant"];
const KC_TOWNS = /kansas city|lee'?s summit|independence|overland|olathe|belton|raytown|blue springs|grandview|kck|liberty|lenexa|shawnee|claycomo|kingsville|north kansas|harrisonville|platte city/i;
function programsFor(id){ return (CATALOG.byJob[id] || []).map(i => CATALOG.programs[i]); }
function firstStep(id){
  const t = TRAINING[id] || (id === 58 ? TRAINING[76] : null);
  if (t && t.best_first_step) return {text: t.best_first_step};
  const ps = programsFor(id);
  const paidKC = ps.find(p => KC_TOWNS.test(p.location || "") && /^yes/i.test(p.paid_while_training || ""));
  const kc = paidKC || ps.find(p => KC_TOWNS.test(p.location || ""));
  const p = kc || ps.find(p => p.residential === true) || ps[0];
  if (p) return {text: `Look into ${p.name} (${p.provider}, ${p.location}).`, url: p.url};
  return {text: JOB[id].fastest_path};
}
function tagRow(j){
  return `<div class="tags">
    <span class="tag sun">${k(j.pay_median)} typical</span>
    <span class="tag green">${j.months_to_entry <= 1 ? "Start now" : when(j.months_to_entry) + " to start"}</span>
    ${j.paid_while_learning ? `<span class="tag sky">Paid while learning</span>` : `<span class="tag peach">${esc(j.training_cost)} training</span>`}
    <span class="tag plum">Book work ${dots(j.classroom_load)}</span>
    ${j.openings_kc ? `<span class="tag">KC openings: ${esc(j.openings_kc)}</span>` : ""}
  </div>`;
}
function feel(j){
  const s = j.scores;
  return `<div class="feel">
    <div><span>Physical</span><b>${LEVEL[s.physical]}</b></div>
    <div><span>Outdoors</span><b>${LEVEL[s.outdoors]}</b></div>
    <div><span>Tight spaces</span><b>${LEVEL[s.confined]}</b></div>
    <div><span>Troubleshooting</span><b>${LEVEL[s.troubleshooting]}</b></div>
  </div>`;
}
function why(r, n = 2){
  const pros = r.pros.slice(0, n), cons = r.cons.slice(0, n);
  if (!pros.length && !cons.length) return "";
  return `<div class="cols"><ul class="why pro">${pros.map(p => `<li>${esc(p)}</li>`).join("")}</ul><ul class="why con">${cons.map(p => `<li>${esc(p)}</li>`).join("")}</ul></div>`;
}
function moreFacts(j){
  return `<details class="more"><summary>More about this job</summary>
    <dl class="facts-dl">
      <dt>Fastest way in</dt><dd>${esc(j.fastest_path)}</dd>
      <dt>Life in and out of work</dt><dd>${esc(j.day_in_life)}</dd>
      <dt>Schedule</dt><dd>${esc(j.schedule_note)}</dd>
      <dt>Where it leads</dt><dd>${esc(j.ladder)}</dd>
      <dt>Watch out for</dt><dd>${esc(j.watch_outs)}</dd>
      <dt>Pay range</dt><dd>${k(j.pay_low)} starting to ${k(j.pay_high)} top</dd>
    </dl>
    <p class="links"><a href="https://www.onetonline.org/link/summary/${j.soc}" target="_blank" rel="noopener">O*NET details</a>
    <a href="https://www.youtube.com/results?search_query=${encodeURIComponent("day in the life " + j.name.replace(/,.*$/, ""))}" target="_blank" rel="noopener">Day-in-the-life videos</a></p>
  </details>`;
}

/* ---------- Views ---------- */
function head(st){ return `<h1 class="h">${esc(st.title)}</h1><p class="lead">${esc(st.sub)}</p>`; }

function vLoad(st){
  const fresh = compassResults();
  const have = S.src;
  const counts = have ? ["Yes","Maybe","No"].map(s => R().filter(r => r.sug === s).length) : null;
  return head(st) + `
    <div class="q">
      ${have ? `<p class="q-title">Loaded: ${R().length} jobs</p>
        <p class="q-help">${counts[0]} suggested yes, ${counts[1]} maybe, ${counts[2]} no. From ${esc(have.from)}${have.at ? ", " + new Date(have.at).toLocaleDateString() : ""}.</p>`
        : `<p class="q-title">First, load your results</p><p class="q-help">If you finished Career Compass in this browser, they're already here. Otherwise upload the CSV you downloaded from the results page.</p>`}
      <div class="btn-row">
        ${fresh ? `<button class="btn ${have ? "ghost" : "primary"} sm" type="button" data-act="useCompass">${have ? "Reload" : "Use"} my Career Compass results</button>` : ""}
        <button class="btn ghost sm" type="button" data-act="upload">Upload results CSV</button>
      </div>
      ${have && fresh && fresh.at > (have.at || 0) ? `<p class="q-help" style="margin-top:10px">Career Compass has newer results than these. Reload to use them; your sorting is kept where the jobs still match.</p>` : ""}
    </div>
    <div class="note"><span class="i-dot">i</span><span>How it works: a second look at what your deal-breakers cut, then a quick yes or no on each job, then down to 8, then head-to-head picks to put them in order. Plan on 15 to 20 minutes.</span></div>`;
}

function vSecond(st){
  if (!S.src) return head(st) + needData();
  const stats = breakerStats();
  if (!stats.length) return head(st) + `<div class="note"><span class="i-dot">i</span><span>You didn't mark any deal-breakers, so nothing was cut that way. On to the quick sort.</span></div>`;
  return head(st) + stats.map(b => {
    const names = b.liked.slice().sort((x, y) => y.fit - x.fit).map(r => JOB[r.id].name);
    const on = !!S.revive[b.name];
    return `<div class="q">
      <p class="q-title">"${esc(b.name)}" as a deal-breaker</p>
      <p class="q-help">This cut <b>${b.total}</b> jobs. <b>${b.liked.length}</b> of them are ones you said yes to on O*NET${names.length ? ", including " + esc(names.slice(0, 5).join("; ")) : ""}.</p>
      ${b.liked.length ? `<details class="more"><summary>See all ${b.liked.length}</summary><p class="q-help">${esc(names.join(" · "))}</p></details>` : ""}
      <p class="q-help" style="margin-top:12px">Was that a hard no, or did it just sound bad on paper?</p>
      <div class="opts">
        <button type="button" class="opt" data-revive="${esc(b.name)}" data-val="0" aria-pressed="${!on}">Hard no, keep them out</button>
        <button type="button" class="opt pos" data-revive="${esc(b.name)}" data-val="1" aria-pressed="${on}">Give the ones I liked another look</button>
      </div>
    </div>`;
  }).join("") + `<p class="q-help">Bringing them back adds them to the quick sort with a "second look" tag. You still decide on each one.</p>`;
}

function sortCard(r){
  const j = JOB[r.id];
  const back = r.sug === "No";
  return `<article class="jobcard sl-card">
    <div class="sl-head"><div class="kicker">${esc(j.cluster)} · O*NET: you said ${esc(j.original)}</div>
      ${back ? `<span class="fit-pill fit-Maybe">Second look</span>` : `<span class="fit-pill fit-${r.sug}">Fit ${r.fit}</span>`}</div>
    <h3>${esc(j.name)}</h3>
    <p class="sub">${esc(j.summary)}</p>
    ${tagRow(j)}
    ${feel(j)}
    ${why(r)}
    ${moreFacts(j)}
  </article>`;
}
function vSort(st){
  if (!S.src) return head(st) + needData();
  const P = pool(), cur = nextUnsorted();
  const done = P.filter(r => S.sort[r.id]).length;
  const n = p => P.filter(r => S.sort[r.id] === p).length;
  const bar = `<div class="sl-count"><span><b>${done}</b> of ${P.length} sorted</span>
    <span class="pile keep">Keep ${n("keep")}</span><span class="pile maybe">Not sure ${n("maybe")}</span><span class="pile cut">Cut ${n("cut")}</span>
    ${S.hist.length ? `<button class="btn ghost sm" type="button" data-act="undo">${svg("undo","ico-sm")} Undo</button>` : ""}</div>`;
  if (!cur) return head(st) + bar + `<div class="q"><p class="q-title">All sorted.</p><p class="q-help">${n("keep")} kept, ${n("maybe")} not sure. ${n("keep") > MAX_KEEP ? "Next you'll cut the keepers down to 8." : n("keep") < 3 ? "That's a short list. Next you can pull a few from the not-sure pile." : "Next, put them in order."}</p>
    <details class="more"><summary>Change a call</summary>${pileList(P)}</details></div>`;
  return head(st) + bar + sortCard(cur) + `
    <div class="verdict sl-verdict">
      <button type="button" class="btn ghost v-no" data-pile="cut">Cut <kbd>←</kbd></button>
      <button type="button" class="btn ghost v-maybe" data-pile="maybe">Not sure <kbd>↓</kbd></button>
      <button type="button" class="btn ghost v-yes" data-pile="keep">Keep <kbd>→</kbd></button>
    </div>`;
}
function pileList(P){
  return `<div class="pile-list">${P.map(r => `<div class="pl-row"><span>${esc(JOB[r.id].name)}</span>
    <span class="opts mini-opts">${["keep","maybe","cut"].map(p => `<button type="button" class="opt ${p==="keep"?"pos":p==="cut"?"neg":""}" data-set="${r.id}" data-p="${p}" aria-pressed="${S.sort[r.id]===p}">${p==="keep"?"Keep":p==="maybe"?"Not sure":"Cut"}</button>`).join("")}</span></div>`).join("")}</div>`;
}

function miniRow(r, btn){
  const j = JOB[r.id];
  return `<div class="mini-card">
    <div class="mc-main"><b>${esc(j.name)}</b>
      <span class="muted">${k(j.pay_median)} · ${j.months_to_entry <= 1 ? "start now" : when(j.months_to_entry) + " to start"}${j.paid_while_learning ? " · paid while learning" : ""}</span></div>
    ${btn}
  </div>`;
}
function vCut(st){
  if (!S.src) return head(st) + needData();
  const keep = inPile("keep"), maybe = inPile("maybe");
  const msg = keep.length > MAX_KEEP ? `You have <b>${keep.length}</b> keepers. Drop <b>${keep.length - MAX_KEEP}</b> more. Ask yourself which ones you'd actually call about this week.`
    : keep.length < 2 ? `You have <b>${keep.length}</b>. Add at least ${2 - keep.length} from the not-sure pile to compare.`
    : `<b>${keep.length}</b> picks. Good to go. You can still swap any of them.`;
  return head(st) + `<div class="note"><span class="i-dot">i</span><span>${msg}</span></div>
    <p class="section-label">Keeping (${keep.length})</p>
    <div class="mini-list">${keep.map(r => miniRow(r, `<button class="btn ghost sm" type="button" data-set="${r.id}" data-p="maybe">Drop</button>`)).join("") || `<p class="q-help">Nothing yet.</p>`}</div>
    <p class="section-label">Not sure (${maybe.length})</p>
    <div class="mini-list">${maybe.map(r => miniRow(r, `<button class="btn ghost sm" type="button" data-set="${r.id}" data-p="keep" ${keep.length >= MAX_KEEP ? "disabled" : ""}>Keep</button>`)).join("") || `<p class="q-help">Empty.</p>`}</div>`;
}

/* Head to head: binary insertion sort, one question at a time */
const keepIds = () => inPile("keep").map(r => r.id);
const sig = ids => ids.slice().sort((a, b) => a - b).join(",");
function h2hInit(){
  const ids = inPile("keep").sort((a, b) => b.fit - a.fit).map(r => r.id);
  S.h2h = {sig: sig(ids), items: ids, ranked: ids.length ? [ids[0]] : [], i: 1, lo: 0, hi: ids.length ? 1 : 0};
  S.h2hHist = []; save();
}
function h2hState(){
  if (!S.h2h || S.h2h.sig !== sig(keepIds())) h2hInit();
  return S.h2h;
}
const h2hDone = h => h.i >= h.items.length;
function h2hPick(curWins){
  const h = h2hState(); if (h2hDone(h)) return;
  S.h2hHist.push(JSON.stringify(h));
  const mid = Math.floor((h.lo + h.hi) / 2);
  if (curWins) h.hi = mid; else h.lo = mid + 1;
  if (h.lo >= h.hi) { h.ranked.splice(h.lo, 0, h.items[h.i]); h.i++; h.lo = 0; h.hi = h.ranked.length; }
  save(); render(false);
}
function h2hLeft(h){
  let n = 0; const span = h.hi - h.lo; n += Math.ceil(Math.log2(span + 1));
  for (let i = h.i + 1, len = h.ranked.length + 1; i < h.items.length; i++, len++) n += Math.ceil(Math.log2(len + 1));
  return n;
}
function vsCard(id, side){
  const j = JOB[id], r = rowOf(id);
  return `<button type="button" class="vs-card" data-vs="${side}">
    <span class="vs-name">${esc(j.name)}</span>
    <span class="vs-sum">${esc(j.summary)}</span>
    <span class="vs-facts">
      <span><i>Typical pay</i>${k(j.pay_median)}</span>
      <span><i>To start</i>${j.months_to_entry <= 1 ? "Now" : when(j.months_to_entry)}</span>
      <span><i>Paid while learning</i>${j.paid_while_learning ? "Yes" : "No"}</span>
      <span><i>Book work</i>${dots(j.classroom_load)}</span>
      <span><i>Physical</i>${LEVEL[j.scores.physical]}</span>
      <span><i>Outdoors</i>${LEVEL[j.scores.outdoors]}</span>
      <span><i>Schedule</i>${esc(j.schedule_note)}</span>
      ${r && r.cons[0] ? `<span class="vs-con"><i>Biggest concern</i>${esc(r.cons[0])}</span>` : ""}
    </span>
    <span class="vs-pick">I'd rather do this</span>
  </button>`;
}
function vH2H(st){
  if (!S.src) return head(st) + needData();
  const ids = keepIds();
  if (ids.length < 2) return head(st) + `<div class="note"><span class="i-dot">i</span><span>You need at least 2 keepers to compare. Go back to Top picks and add some.</span></div>`;
  if (ids.length > MAX_KEEP) return head(st) + `<div class="note"><span class="i-dot">i</span><span>You have ${ids.length} keepers. Go back to Top picks and get it down to ${MAX_KEEP} first.</span></div>`;
  const h = h2hState();
  if (h2hDone(h)) return head(st) + `<div class="q"><p class="q-title">Done. Your order is set.</p><ol class="rank-list">${h.ranked.map(id => `<li>${esc(JOB[id].name)}</li>`).join("")}</ol>
    <div class="btn-row">${S.h2hHist.length ? `<button class="btn ghost sm" type="button" data-act="h2hUndo">${svg("undo","ico-sm")} Undo last pick</button>` : ""}<button class="btn ghost sm" type="button" data-act="h2hRedo">Redo head to head</button></div></div>`;
  const mid = Math.floor((h.lo + h.hi) / 2), cur = h.items[h.i], other = h.ranked[mid];
  return head(st) + `<div class="sl-count"><span>About <b>${h2hLeft(h)}</b> picks left</span>
    ${S.h2hHist.length ? `<button class="btn ghost sm" type="button" data-act="h2hUndo">${svg("undo","ico-sm")} Undo</button>` : ""}</div>
    <p class="vs-q">Which would you rather do every day for the next five years?</p>
    <div class="vs-grid">${vsCard(cur, "cur")}<div class="vs-or">or</div>${vsCard(other, "other")}</div>
    <p class="q-help" style="text-align:center">Tip: the left and right arrow keys pick too.</p>`;
}

function ranked(){
  const h = S.h2h;
  if (h && h.sig === sig(keepIds()) && h2hDone(h)) return h.ranked;
  return inPile("keep").sort((a, b) => b.fit - a.fit).map(r => r.id);
}
function progsBlock(id){
  const ps = programsFor(id);
  if (!ps.length) return "";
  const near = ps.filter(p => KC_TOWNS.test(p.location || "")), away = ps.filter(p => !KC_TOWNS.test(p.location || ""));
  const li = p => `<li>${p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.name)}</a>` : esc(p.name)} <span class="muted">· ${esc(p.provider)} · ${esc(p.location)}${/^yes/i.test(p.paid_while_training || "") ? " · paid" : ""}${p.residential === true ? " · housing" : ""}</span></li>`;
  return `<details class="more"><summary>${ps.length} training programs (${near.length} around KC)</summary>
    ${near.length ? `<p class="mini-h">Around KC</p><ul class="mini">${near.map(li).join("")}</ul>` : ""}
    ${away.length ? `<p class="mini-h">Elsewhere</p><ul class="mini">${away.map(li).join("")}</ul>` : ""}
  </details>`;
}
function vFinal(st){
  if (!S.src) return head(st) + needData();
  const ids = ranked();
  if (!ids.length) return head(st) + `<div class="note"><span class="i-dot">i</span><span>No keepers yet. Go back to Quick sort.</span></div>`;
  const ordered = S.h2h && S.h2h.sig === sig(keepIds()) && h2hDone(S.h2h);
  return head(st) + (ordered ? "" : `<div class="note"><span class="i-dot">i</span><span>These are in fit-score order. Finish Head to head to put them in your order.</span></div>`) +
  `<div class="timeline">${ids.map((id, i) => { const j = JOB[id], r = rowOf(id), fs = firstStep(id); return `<div class="tl-row">
    <div class="tl-rail"><span class="rank">#${i + 1}</span><span class="dot"></span><span class="when">${when(j.months_to_entry)}</span></div>
    <div class="tl-card">
      <h3>${esc(j.name)}</h3>
      <p class="sub">${esc(j.summary)}</p>
      ${tagRow(j)}
      <p class="first-step"><b>First step:</b> ${esc(fs.text)}${fs.url ? ` <a href="${esc(fs.url)}" target="_blank" rel="noopener">Link</a>` : ""}</p>
      ${r ? why(r, 3) : ""}
      ${progsBlock(id)}
      ${moreFacts(j)}
    </div></div>`; }).join("")}</div>
  <p class="section-label">Share it</p>
  <div class="export">
    <div class="q"><p class="q-title">Copy for the Google Sheet</p><p>Paste into cell A1 of the "Shortlist" tab.</p><button class="btn primary sm" data-act="copy" type="button">Copy shortlist</button></div>
    <div class="q"><p class="q-title">Download</p><p>A CSV of the shortlist with first steps.</p><button class="btn ghost sm" data-act="csv" type="button">Download CSV</button></div>
    <div class="q"><p class="q-title">Print or PDF</p><p>Print this page or save it as a PDF.</p><button class="btn ghost sm" data-act="print" type="button">Print</button></div>
  </div>`;
}
function needData(){ return `<div class="note"><span class="i-dot">i</span><span>Load your results first. <button class="link-btn" type="button" data-step="0">Go to step 1</button></span></div>`; }

const VIEWS = {load:vLoad, second:vSecond, sort:vSort, cut:vCut, h2h:vH2H, final:vFinal};

/* ---------- Shell ---------- */
function summary(i){
  const id = STEPS[i].id;
  if (id === "load") return S.src ? `${R().length} jobs loaded` : "Not loaded";
  if (!S.src) return "Not started";
  if (id === "second") { const n = Object.values(S.revive).filter(Boolean).length; return Object.keys(S.revive).length ? (n ? `${revived().length} brought back` : "Kept them out") : "Not started"; }
  if (id === "sort") { const P = pool(), d = P.filter(r => S.sort[r.id]).length; return d ? `${d} of ${P.length} sorted` : "Not started"; }
  if (id === "cut") { const n = keepIds().length; return n ? `${n} keepers` : "Not started"; }
  if (id === "h2h") { const h = S.h2h; return h && h.sig === sig(keepIds()) ? (h2hDone(h) ? "Order set" : "In progress") : "Not started"; }
  if (id === "final") { const ids = ranked(), h = S.h2h, set = h && h.sig === sig(keepIds()) && h2hDone(h);
    return !ids.length ? "Not started" : set ? `#1 ${JOB[ids[0]].name}` : `${ids.length} picks, not ranked yet`; }
}
function renderSide(){
  $("#stepList").innerHTML = STEPS.map((st, i) => `<li><button class="step-item" type="button" data-step="${i}" ${i === S.step ? 'aria-current="step"' : ""} ${i > 0 && !S.src ? "disabled" : ""}>
      ${svg(st.icon)}<span><span class="step-label">${esc(st.label)}</span><span class="step-val">${esc(summary(i))}</span></span>
      <span class="step-go">${svg("chev", "")}</span></button></li>`).join("");
  $("#stepList").querySelectorAll(".step-go svg").forEach(s => { s.setAttribute("width", "14"); s.setAttribute("height", "14"); });
}
function renderTop(){
  const n = STEPS.length;
  $("#progressFill").style.width = ((S.step + 1) / n * 100) + "%";
  $("#stepCount").textContent = `Step ${S.step + 1} of ${n}`;
  $("#backBtn").style.visibility = S.step === 0 ? "hidden" : "visible";
  $("#nextBtn").classList.toggle("hide", S.step === n - 1);
  $("#nextBtn").disabled = !S.src;
  $("#nextBtn").innerHTML = STEPS[S.step].id === "h2h" ? "See my shortlist <span aria-hidden='true'>&rarr;</span>" : "Next <span aria-hidden='true'>&rarr;</span>";
}
function render(focus){
  $("#stage").innerHTML = VIEWS[STEPS[S.step].id](STEPS[S.step]);
  renderTop(); renderSide();
  if (focus) { $("#stage").focus({preventScroll: true}); window.scrollTo({top: 0, behavior: "smooth"}); $("#main").scrollTop = 0; }
}
function keepScroll(fn){ const y = window.scrollY, m = $("#main"), my = m.scrollTop; fn(); window.scrollTo(0, y); m.scrollTop = my; }
function go(i){ S.step = Math.max(0, Math.min(STEPS.length - 1, i)); if (STEPS[S.step].id === "cut" && keepIds().length < 2 && inPile("maybe").length === 0) {} save(); $("#side").classList.remove("open"); render(true); }

function setSource(rows, from, at){
  const norm = normalize(rows);
  if (!norm.length) { toast("That file doesn't look like Career Compass results."); return; }
  S.src = {rows: norm, from, at: at || Date.now()};
  const ids = new Set(norm.map(r => r.id));
  Object.keys(S.sort).forEach(id => { if (!ids.has(+id)) delete S.sort[id]; });
  save(); render(false); toast(`Loaded ${norm.length} jobs.`);
}

/* ---------- Actions ---------- */
function pile(p){
  const cur = nextUnsorted(); if (!cur) return;
  S.sort[cur.id] = p; S.hist.push(cur.id); if (S.hist.length > 300) S.hist.shift();
  save(); render(false);
}
function exportRows(){
  return ranked().map((id, i) => { const j = JOB[id], fs = firstStep(id), r = rowOf(id); return {
    Rank: i + 1, ID: id, Job: j.name, "Fit Score": r ? r.fit : "", "Typical Pay": j.pay_median, "Months to Start": j.months_to_entry,
    "Paid While Learning": j.paid_while_learning ? "Yes" : "No", "First Step": fs.text, "Programs Found": programsFor(id).length,
    "Biggest Concern": r && r.cons[0] ? r.cons[0] : "" }; });
}
function toDelim(list, d){
  if (!list.length) return "";
  const cols = Object.keys(list[0]);
  const cell = v => { v = String(v ?? ""); return d === "," ? (/[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v) : v.replace(/[\t\n]/g, " "); };
  return [cols.join(d), ...list.map(r => cols.map(c => cell(r[c])).join(d))].join("\n");
}
function download(name, text, type){
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], {type})); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function act(a){
  if (a === "useCompass") { const v = compassResults(); if (v) setSource(v.rows, "Career Compass in this browser", v.at); }
  if (a === "upload") $("#csvFile").click();
  if (a === "undo") { const id = S.hist.pop(); if (id != null) delete S.sort[id]; save(); render(false); }
  if (a === "h2hUndo") { const prev = S.h2hHist.pop(); if (prev) S.h2h = JSON.parse(prev); save(); render(false); }
  if (a === "h2hRedo") { h2hInit(); render(false); }
  if (a === "copy") {
    const t = toDelim(exportRows(), "\t");
    (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => toast("Copied. Paste into A1 of the Shortlist tab."), () => { download("career-shortlist.tsv", t, "text/tab-separated-values"); toast("Couldn't copy, so it downloaded instead."); });
  }
  if (a === "csv") download("career-shortlist.csv", toDelim(exportRows(), ","), "text/csv");
  if (a === "print") window.print();
}
let resetArmed = 0;
function toast(msg){ const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 2600); }

document.addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.step != null) { go(+b.dataset.step); return; }
  if (b.id === "nextBtn") { go(S.step + 1); return; }
  if (b.id === "backBtn") { go(S.step - 1); return; }
  if (b.id === "menuBtn") { $("#side").classList.toggle("open"); return; }
  if (b.id === "resetBtn") { const now = Date.now(); if (now - resetArmed < 4000) { const src = S.src; S = blank(); S.src = src; save(); render(true); toast("Sorting cleared. Your results are still loaded."); } else { resetArmed = now; toast("Tap Start over again to clear your sorting."); } return; }
  if (b.dataset.revive != null) { S.revive[b.dataset.revive] = b.dataset.val === "1"; save(); keepScroll(() => render(false)); return; }
  if (b.dataset.pile) { pile(b.dataset.pile); return; }
  if (b.dataset.set) { const id = +b.dataset.set; S.sort[id] = b.dataset.p; save(); keepScroll(() => render(false)); return; }
  if (b.dataset.vs) { h2hPick(b.dataset.vs === "cur"); return; }
  if (b.dataset.act) act(b.dataset.act);
});
document.addEventListener("keydown", e => {
  if (e.target.closest("input,textarea,select") || e.metaKey || e.ctrlKey || e.altKey) return;
  const id = STEPS[S.step].id;
  if (id === "sort" && nextUnsorted()) {
    const m = {ArrowLeft: "cut", ArrowDown: "maybe", ArrowRight: "keep"}[e.key];
    if (m) { e.preventDefault(); pile(m); }
    if (e.key === "z" || e.key === "Backspace") { e.preventDefault(); act("undo"); }
  }
  if (id === "h2h" && S.h2h && !h2hDone(S.h2h)) {
    if (e.key === "ArrowLeft") { e.preventDefault(); h2hPick(true); }
    if (e.key === "ArrowRight") { e.preventDefault(); h2hPick(false); }
  }
});
$("#csvFile").addEventListener("change", e => {
  const f = e.target.files[0]; if (!f) return;
  const rd = new FileReader();
  rd.onload = () => { try { setSource(parseCSV(String(rd.result)), f.name, f.lastModified); } catch(err) { toast("Couldn't read that file."); } e.target.value = ""; };
  rd.readAsText(f);
});

/* First visit: pick up Career Compass results automatically */
if (!S.src) { const v = compassResults(); if (v) S.src = {rows: normalize(v.rows), from: "Career Compass in this browser", at: v.at}; save(); }
render(false);
