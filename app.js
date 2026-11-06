/* Career Compass: guided career-fit questionnaire over an O*NET results list. */
(function(){
"use strict";
const JOBS = window.JOBS || [];
const JC = window.JOBCORPS || {centers:[],summary:""};
const TRAINING = window.TRAINING || {};
const trainingFor = j => TRAINING[j.id] || (j.id===58 ? TRAINING[76] : null);
const CATALOG = window.CATALOG || {programs:[],byJob:{}};
const PATH_GROUPS = [
  ["Paid apprenticeships", p=>/apprentice/i.test(p.type)],
  ["Employer pays you to train", p=>/employer/i.test(p.type)],
  ["Military", p=>/military/i.test(p.type)],
  ["Live-in schools and corps", p=>p.residential===true||/residential|conservation|job corps/i.test(p.type)],
  ["Community college and trade school", p=>/college|school|certificate|nonprofit/i.test(p.type)],
];
function pathsFor(j){
  const groups=PATH_GROUPS.map(([label])=>({label,items:[]})), other={label:"Other programs",items:[]};
  (CATALOG.byJob[j.id]||[]).map(i=>CATALOG.programs[i]).forEach(p=>{
    const g=PATH_GROUPS.findIndex(([,f])=>f(p)); (g<0?other:groups[g]).items.push(p);
  });
  return groups.concat([other]).filter(g=>g.items.length);
}
const openJC = j => (j.jc_centers||[]).filter(c=>/^open/.test(c.status));
const KEY = "career_compass_v1";
const $ = (s, el=document) => el.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money = n => "$" + Math.round(n).toLocaleString("en-US");
const k = n => "$" + Math.round(n/1000) + "k";

/* ---------- State ---------- */
const blank = () => ({ step:0, name:"", a:{}, c:{}, s:{}, m:{}, t:{}, values:[], stories:["","",""],
  ratings:{}, notes:{}, queue:"top", qi:0, done:false, filter:"All", search:"" });
let S = load();
function load(){ try{ const v = JSON.parse(localStorage.getItem(KEY)); if(v && typeof v==="object") return Object.assign(blank(), v); }catch(e){} return blank(); }
function save(){ try{ localStorage.setItem(KEY, JSON.stringify(S)); }catch(e){} }

/* ---------- Icons ---------- */
const I = {
  hand:'<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11m0-1.5V4a1.5 1.5 0 0 1 3 0v6m0-4.5a1.5 1.5 0 0 1 3 0V12m0-3.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1.5a6 6 0 0 1-4.6-2.2L4.4 15a1.6 1.6 0 0 1 2.4-2.1L8 14"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  wallet:'<rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M3 10h18M16 14.5h2"/>',
  cap:'<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5M22 9v6"/>',
  star:'<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  cards:'<rect x="3" y="6" width="13" height="15" rx="2"/><path d="M8 3h11a2 2 0 0 1 2 2v13"/>',
  flag:'<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  compass:'<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  chev:'<path d="M9 6l6 6-6 6"/>'
};
const svg = (n, cls="step-ico") => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n]}</svg>`;

/* ---------- Question content ---------- */
const LIKE = ["Hate it","Meh","Okay","Like it","Love it"];
const ACTIVITIES = [
  {id:"fix", dim:"troubleshooting", t:"Figuring out why something broke, then fixing it", h:"Diagnosing a car, a PC, a game console, anything."},
  {id:"tech", dim:"tech", t:"Computers, electronics and diagnostic tools", h:"Wiring, gadgets, software, meters and scanners."},
  {id:"precise", dim:"precision", t:"Careful, exact work where measurements matter", h:"Getting it to the sixteenth of an inch, following specs."},
  {id:"build", cl:["Construction & Building Trades","Manufacturing & Production","Mechanical Repair"], t:"Building or making things with my hands", h:"Seeing something real that you made at the end of the day."},
  {id:"physical", dim:"physical", t:"Being physically active most of the day", h:"Moving, lifting, climbing instead of sitting."},
  {id:"outside", dim:"outdoors", t:"Being outside", h:"In good weather and bad."},
  {id:"people", dim:"people", t:"Helping people face to face", h:"Customers, patients, the public."},
  {id:"health", cl:["Healthcare"], t:"Working in a hospital, clinic or medical setting", h:"Scrubs, patients, medical equipment."},
  {id:"alone", dim:"independence", t:"Working on my own without someone watching", h:"You get the job and you handle it."},
  {id:"crew", dim:"teamwork", t:"Working as part of a crew", h:"Same team every day, everyone has a role."},
  {id:"routine", dim:"repetitive", t:"Doing the same task well, over and over", h:"Predictable, no surprises."},
];
const COND_OPTS = [["Deal-breaker","neg"],["Rather not",""],["Fine",""],["Love it","pos"]];
const CONDITIONS = [
  {id:"physical", t:"Heavy physical work", h:"Lifting 50+ lbs, on your feet all day, sore at night."},
  {id:"outdoors", t:"Outside in KC weather", h:"95° summers, icy winters, rain."},
  {id:"heights", t:"Heights", h:"Ladders, roofs, lifts, towers."},
  {id:"confined", t:"Tight spaces", h:"Crawlspaces, attics, under machines."},
  {id:"dirty", t:"Dirty, greasy, loud or smelly", h:"You'll need a good shower after work."},
  {id:"hazard", t:"Real danger", h:"High voltage, heavy machinery, chemicals, radiation."},
  {id:"bodily", t:"Blood, bodily fluids, sick or injured people", h:"Includes animals."},
  {id:"people", t:"Dealing with customers or the public all day", h:"Including upset ones."},
  {id:"repetitive", t:"Doing the same motions all shift", h:"Assembly-line style."},
  {id:"travel", t:"Driving between job sites all day", h:"Your truck is your office."},
];
const COND_LABEL = {physical:"heavy physical work",outdoors:"working outside",heights:"heights",confined:"tight spaces",dirty:"dirty or loud work",hazard:"danger",bodily:"blood or patients",people:"dealing with the public",repetitive:"repetitive work",travel:"driving all day"};
const DIM_LABEL = {troubleshooting:"troubleshooting",tech:"tech and electronics",precision:"precise detail work",physical:"physical activity",outdoors:"time outside",people:"helping people",independence:"working on your own",teamwork:"crew work",repetitive:"routine work"};

const SCHED = [
  {id:"hours", t:"Which hours could you live with for the first few years?", opts:[["Weekday days only",2],["Some evenings or weekends",3],["Shifts or nights are OK",4],["Anything, even on-call",5]]},
  {id:"ot", t:"Overtime", opts:[["Avoid it","avoid"],["Sometimes is fine","some"],["Bring it on, I want the money","love"]]},
  {id:"away", t:"Being away from home for days or weeks at a time", h:"Travel crews, rail, oilfield rotations, storm work.", opts:[["No","no"],["Sometimes","some"],["Fine with it","yes"]]},
  {id:"move", t:"Would you move for the right training or job?", opts:[["Stay in the KC area","stay"],["Missouri or Kansas","region"],["Anywhere","any"]]},
  {id:"stress", t:"How much pressure can you handle?", h:"Emergencies, life-or-death, being the one who decides.", opts:[["Keep it low","low"],["Some is fine","mid"],["I do well under pressure","high"]]},
  {id:"energy", t:"After work, I want...", opts:[["Energy left for friends and hobbies","energy"],["I don't mind being wiped out","fine"]]},
];
const MONEY = [
  {id:"housing", t:"Where do you live?", opts:[["With family",250],["Roommates",750],["My own 1-bedroom",1200],["Rent a house",1700],["Own a starter home",2000]]},
  {id:"car", t:"Car", opts:[["Paid-off car",0],["Car payment",500],["Truck payment",700]]},
  {id:"food", t:"Food", opts:[["Mostly cook",350],["Mix",500],["Eat out a lot",750]]},
  {id:"fun", t:"Fun, hobbies, games, going out", opts:[["Basic",150],["Comfortable",300],["Big spender",600]]},
  {id:"family", t:"Who are you supporting?", opts:[["Just me",0],["Me and a partner",400],["Kids someday",1200]]},
  {id:"saving", t:"Saving each month", opts:[["Not yet",0],["A little (5%)",5],["Solid (10%)",10],["Serious (20%)",20]]},
];
const MONEY_DEF = {housing:750, car:500, food:500, fun:300, family:0, saving:10};
const TRAIN = [
  {id:"months", t:"How long could you train before getting a paycheck in the field?", h:"Paid apprenticeships count as getting paid.", opts:[["Start working now",1],["About 3 months",3],["6 months",6],["A year",12],["2 years or more",30]]},
  {id:"earn", t:"Do you need to earn while you learn?", opts:[["Yes, I have to","must"],["I'd prefer it","prefer"],["Not required","no"]]},
  {id:"learn", t:"How do you learn best?", h:"Be honest. This one matters a lot.", opts:[["Show me, let me do it",1],["Mostly hands-on, some class",2],["Half and half",3],["I can handle textbooks",4],["Exams don't scare me",5]]},
  {id:"cost", t:"Paying for training", h:"Missouri Voc Rehab, a 529, and Pell grants can help with costs.", opts:[["Can't take on cost","none"],["Some, with help","some"],["Cost isn't a problem","fine"]]},
  {id:"live", t:"Live-in training programs", h:"Job Corps, some employer academies and conservation corps include housing.", opts:[["Interested","yes"],["Maybe","maybe"],["No","no"]]},
  {id:"mil", t:"Military as a training path", h:"Trains you in a trade, pays you, houses you. It's a 4+ year commitment.", opts:[["Open to it","yes"],["Maybe","maybe"],["No","no"]]},
  {id:"license", t:"Driver's license", opts:[["Have one","yes"],["Working on it","soon"],["No","no"]]},
  {id:"screen", t:"Many of these jobs drug test, and some need a clean record or a security clearance.", h:"Nobody sees this but you. It only changes which warnings show up.", opts:[["No problem","ok"],["I'd need to plan for it","plan"],["Skip","skip"]]},
];
const VALUES = [
  ["pay","Make good money"],["stable","Job security"],["fast","Start working fast"],["lowstress","Low stress"],
  ["outdoors","Be outdoors"],["helping","Help people"],["tech","Cool tech"],["indep","Be my own boss"],
  ["active","Stay active"],["craft","Pride in my craft"],["growth","Room to grow"],["steady","Steady hours"],["home","Home every night"]
];
const PROFILE = {R:15,C:15,I:13,S:8,A:5,E:4};

const STEPS = [
  {id:"welcome", label:"Start", icon:"compass", title:"Let's find your fit", sub:"Your O*NET results gave you 257 jobs. This sorts them by what each one is really like."},
  {id:"activities", label:"What you like doing", icon:"hand", title:"What you like doing", sub:"Rate how much you enjoy each. Think about times you actually did it, not what sounds good."},
  {id:"conditions", label:"Working conditions", icon:"sun", title:"Where you can work", sub:"Some things are fine, some you'd love, and some are deal-breakers. Mark the deal-breakers honestly."},
  {id:"schedule", label:"Schedule & life", icon:"clock", title:"Your schedule and life", sub:"Some jobs pay more because the hours or travel are rough. Decide what you'd trade."},
  {id:"money", label:"The life you want", icon:"wallet", title:"The life you want", sub:"Build a simple Kansas City budget. It sets the pay you actually need."},
  {id:"training", label:"Getting there", icon:"cap", title:"Getting there", sub:"How long, how much school, and how you'd want to train."},
  {id:"values", label:"What matters most", icon:"star", title:"What matters most", sub:"Pick your top three. These get extra weight."},
  {id:"review", label:"Job cards", icon:"cards", title:"Job cards", sub:"Now look at real jobs with the facts in front of you, and say yes, maybe or no."},
  {id:"results", label:"Your matches", icon:"flag", title:"Your best-matched paths", sub:"Ranked by fit. Tap any job to see the card or change your answer."},
];

/* ---------- Budget math ---------- */
function budget(){
  const m = Object.assign({}, MONEY_DEF, S.m);
  const util = m.housing<=250 ? 0 : m.housing<=750 ? 130 : m.housing<=1200 ? 190 : 320;
  const lines = [
    ["Housing", m.housing], ["Utilities & internet", util], ["Car payment", m.car],
    ["Insurance, gas, upkeep", 380], ["Phone", 80], ["Food", m.food], ["Health insurance (your share)", 160],
    ["Fun", m.fun], ["Family", m.family], ["Clothes, haircuts, misc", 120]
  ];
  const spend = lines.reduce((a,l)=>a+l[1],0);
  const save = Math.round(spend * (m.saving/100) / (1 - m.saving/100));
  if(save) lines.push(["Savings", save]);
  const net = spend + save;
  const gross = Math.round(net*12/0.78/1000)*1000;   // ~22% taxes (fed, FICA, MO)
  const floorPct = S.m.floorPct ?? 75;
  return {lines, net, gross, hourly: gross/2080, floor: Math.round(gross*floorPct/100/1000)*1000, floorPct};
}

/* ---------- Scoring ---------- */
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
function riasecFit(code){
  const w=[3,2,1]; let num=0, den=0;
  code.split("").forEach((l,i)=>{ if(PROFILE[l]!=null){ num+=w[i]*PROFILE[l]; den+=w[i]*15; } });
  return den ? num/den : .6;
}
function valueScore(v, j){
  const s=j.scores;
  switch(v){
    case "pay": return clamp((j.pay_median-55000)/30000,-1,1);
    case "stable": return (({"Growing fast":1,"Growing":.5,"Stable":0,"Shrinking":-1})[j.outlook] + (3-s.automation_risk)/2)/2;
    case "fast": return j.months_to_entry<=1?1:j.months_to_entry<=6?.5:j.months_to_entry<=12?0:j.months_to_entry<=24?-.5:-1;
    case "lowstress": return (3-s.stress)/2;
    case "outdoors": return (s.outdoors-3)/2;
    case "helping": return (s.people-3)/2;
    case "tech": return (s.tech-3)/2;
    case "indep": return (s.independence-3)/2;
    case "active": return (s.physical-3)/2;
    case "craft": return (s.precision-3)/2;
    case "growth": return clamp((j.pay_high/j.pay_median-1.45)*4 + (j.years_to_journey>=3?.3:0) + ({"Growing fast":.4,"Growing":.2,"Stable":0,"Shrinking":-.4})[j.outlook],-1,1);
    case "steady": return (3-s.schedule)/2;
    case "home": return (3-s.travel)/2 - (/away|weeks|rotation|travel/i.test(j.schedule_note)?.5:0);
  }
  return 0;
}
const VALUE_LABEL = Object.fromEntries(VALUES);

function score(j){
  const s=j.scores, pros=[], cons=[]; let x=50, deal=false;
  const add=(v,why,force)=>{ x+=v; if(why && (Math.abs(v)>=3 || force)) (v>0?pros:cons).push([Math.abs(v),why]); };
  // 1. Interests
  const rf=riasecFit(j.riasec); add((rf-.62)*28, rf>.8?"Lines up with your O*NET interests (hands-on and organized)":rf<.5?"Weak match with your O*NET interest profile":null);
  // 2. Activities
  ACTIVITIES.forEach(a=>{
    const like=S.a[a.id]; if(like==null) return; const d=(like-3)/2;
    if(a.dim){ const jv=(s[a.dim]-3)/2, v=d*jv*7;
      add(v, v>0 ? (d>0?`Lots of ${DIM_LABEL[a.dim]}, which you enjoy`:`Little ${DIM_LABEL[a.dim]}, which you don't enjoy`)
                 : (d>0?`Not much ${DIM_LABEL[a.dim]}, which you enjoy`:`Lots of ${DIM_LABEL[a.dim]}, which you don't enjoy`)); }
    else if(a.cl.includes(j.cluster)){ const v=d*(a.id==="health"?9:4); add(v, v>0?(a.id==="health"?"Medical setting, which you like":"Hands-on building and making"):(a.id==="health"?"Medical setting, which you'd rather avoid":"Hands-on making, which you don't enjoy")); }
  });
  // 3. Conditions
  CONDITIONS.forEach(c=>{
    const a=S.c[c.id]; if(a==null) return; const v=s[c.id]; const L=COND_LABEL[c.id];
    if(a===0){ if(v>=4){ add(-30,`Deal-breaker: ${L}`,true); deal=true; } else if(v===3) add(-10,`Some ${L} (your deal-breaker)`); }
    else if(a===1){ if(v>=4) add(-10,`A lot of ${L}`); else if(v===3) add(-4,`Some ${L}`); }
    else if(a===3){ if(v>=4) add(5,`Plenty of ${L}, which you like`); else if(v===3) add(2); }
  });
  // 4. Schedule & life
  const h=S.s.hours; if(h!=null && s.schedule>h) add(-(s.schedule-h)*10, `Schedule: ${j.schedule_note}`);
  if(S.s.ot==="avoid" && s.overtime>=4) add(-8,"Overtime is common");
  if(S.s.ot==="love" && s.overtime>=4) add(4,"Overtime available when you want more money");
  const awayJob = s.travel>=5 || /away|weeks|rotation|out of town|travel crew|traveling/i.test(j.schedule_note+" "+j.day_in_life);
  if(awayJob && S.s.away==="no") add(-15,"Time away from home");
  const mustMove = /not in KC|far from KC|no KC jobs|usually means moving|requires moving|few KC jobs|not KC|Wichita|coasts|western states|rural .* only|oil fields|Rural oil/i.test(j.watch_outs+" "+j.kc_pay_note);
  if(mustMove){ if(S.s.move==="stay") add(-14,"Usually means moving away from KC"); else if(S.s.move==="region") add(-5,"May mean moving"); }
  if(j.openings_kc==="Many") add(3,"Lots of openings around KC"); else if(j.openings_kc==="Few") add(-3,"Few openings around KC");
  if(S.s.stress==="low" && s.stress>=4) add(-8,"High-pressure work");
  if(S.s.energy==="energy" && s.physical>=5) add(-4,"Physically draining");
  // 5. Pay
  const B=budget(), pw=S.values.includes("pay")?1.5:1;
  if(Object.keys(S.m).length){
    const r=j.pay_median/B.gross;
    if(r>=1) add(12*pw,`Typical pay ${k(j.pay_median)} covers your ${k(B.gross)} lifestyle`,true);
    else if(r>=.85) add(3*pw);
    else if(r>=.7) add(-7*pw,`Typical pay ${k(j.pay_median)} is short of your ${k(B.gross)} goal`);
    else add(-18*pw,`Typical pay ${k(j.pay_median)} is far below your ${k(B.gross)} goal`,true);
    if(r<1 && j.pay_high>=B.gross) pros.push([2,`Top earners reach ${k(j.pay_high)}`]);
    if(j.pay_low<B.floor) add(-4,`Starting pay (~${k(j.pay_low)}) may be under your ${k(B.floor)} floor`);
  }
  // 6. Training
  const T=S.t;
  if(T.months!=null && j.months_to_entry>T.months) add(-Math.min(25,(j.months_to_entry-T.months)/2+10), `About ${j.months_to_entry} months of school before you can work`);
  if(j.paid_while_learning && T.earn && T.earn!=="no") add(T.earn==="must"?6:3,"Paid while you learn",true);
  if(!j.paid_while_learning && j.months_to_entry>2){ if(T.earn==="must") add(-10,"Unpaid school first"); else if(T.earn==="prefer") add(-4); }
  if(T.learn!=null){ const d=j.classroom_load-T.learn; if(d>=2) add(-15,"Heavy textbook and exam work"); else if(d===1) add(-5,"More book work than you'd like"); else if(d<=-1) add(2,"Hands-on learning style fits you"); }
  if(T.cost==="none"){ if(j.training_cost.startsWith("High")) add(-12,"Expensive training"); else if(j.training_cost.startsWith("Medium")) add(-6,"Training costs money"); }
  if(T.cost==="some" && j.training_cost.startsWith("High")) add(-5,"Expensive training");
  if(j.residential_option){
    if(T.live==="yes" && !/^Military/.test(j.residential_option)) add(4,"Live-in training option",true);
    if(T.mil==="yes" && /Military/.test(j.residential_option)) add(3,"Military trains for this",true);
  }
  const progs=(CATALOG.byJob[j.id]||[]).map(i=>CATALOG.programs[i]);
  const kc=p=>/kansas city|lee'?s summit|independence|overland|olathe|belton|raytown|blue springs|grandview|kck|liberty|lenexa|shawnee|claycomo|kingsville|north kansas/i.test(p.location||"");
  const paidKC=progs.find(p=>kc(p)&&/yes/i.test(p.paid_while_training)&&!/military/i.test(p.type));
  if(paidKC && T.earn && T.earn!=="no" && !j.paid_while_learning) add(T.earn==="must"?5:3,`Paid training in KC: ${paidKC.name} (${paidKC.provider})`,true);
  const house=progs.find(p=>p.residential===true&&!/military/i.test(p.type));
  if(house && T.live==="yes" && !j.residential_option) add(3,`Live-in training: ${house.name} (${house.location})`,true);
  if(T.mil==="yes" && progs.some(p=>/military/i.test(p.type)) && !/Military/.test(j.residential_option||"")) add(3,"Military trains for this",true);
  const jc=openJC(j);
  if(jc.length && T.live!=="no"){
    const es=jc.find(c=>/excelsior/i.test(c.c));
    if(es) add(4,"Excelsior Springs Job Corps trains for this (free, housing included)",true);
    else if(T.live==="yes" && S.s.move!=="stay") add(3,`Job Corps trains for this (nearest: ${jc[0].c}, ${jc[0].st}, ${jc[0].mi} mi)`,true);
  }
  if(T.license==="no" && s.travel>=4) add(-6,"Needs a driver's license");
  // 7. Values
  S.values.forEach(v=>{ if(v==="pay") return; const vs=valueScore(v,j)*8; add(vs, vs>0?`${VALUE_LABEL[v]}: strong here`:`${VALUE_LABEL[v]}: weak here`); });
  // 8. His card verdict + original O*NET mark
  const rating=S.ratings[j.id];
  if(rating==="Yes") add(20,"You said yes after reading the card",true);
  if(rating==="No") add(-30,"You said no after reading the card",true);
  x += j.original==="Yes"?3:-3;
  x = Math.round(clamp(50+(x-50)*0.6,0,100));
  let sug;
  if(rating==="Yes") sug = x>=47?"Yes":"Maybe";
  else if(rating==="No") sug = "No";
  else if(deal) sug = "No";
  else sug = x>=60?"Yes":x>=50?"Maybe":"No";
  pros.sort((a,b)=>b[0]-a[0]); cons.sort((a,b)=>b[0]-a[0]);
  const warn=[];
  if(T.screen==="plan" && /drug|clearance|background|clean record|security/i.test(j.watch_outs+" "+j.credential)) warn.push("Screening: "+j.watch_outs);
  return {score:x, sug, pros:pros.slice(0,3).map(p=>p[1]), cons:[...warn, ...cons.slice(0,3).map(c=>c[1])].slice(0,3), deal};
}
let RESULTS = null;
function results(){ if(!RESULTS){ RESULTS = JOBS.map(j=>({j, ...score(j)})).sort((a,b)=>b.score-a.score); } return RESULTS; }
const dirty = () => { RESULTS = null; };

/* ---------- Rendering helpers ---------- */
function opts(name, list, cur, cls=()=>"" ){
  return `<div class="opts" role="group">${list.map(([l,v])=>`<button type="button" class="opt ${cls(v)}" data-set="${name}" data-val='${JSON.stringify(v)}' aria-pressed="${cur===v}">${esc(l)}</button>`).join("")}</div>`;
}
function setPath(path, val){
  const [grp, id] = path.split(".");
  if(grp==="v"){ /* values handled separately */ return; }
  S[grp][id] = val;
}
function stepDone(i){
  const id=STEPS[i].id;
  if(id==="welcome") return S.step>0;
  if(id==="activities") return Object.keys(S.a).length>=ACTIVITIES.length-2;
  if(id==="conditions") return Object.keys(S.c).length>=CONDITIONS.length-2;
  if(id==="schedule") return Object.keys(S.s).length>=4;
  if(id==="money") return Object.keys(S.m).length>=3;
  if(id==="training") return Object.keys(S.t).length>=5;
  if(id==="values") return S.values.length===3;
  if(id==="review") return Object.keys(S.ratings).length>=10;
  if(id==="results") return S.done;
}
function summary(i){
  const id=STEPS[i].id;
  if(id==="welcome") return S.name?`Hi, ${esc(S.name)}`:"How this works";
  if(id==="activities"){ const top=ACTIVITIES.filter(a=>S.a[a.id]===5).map(a=>a.t.split(",")[0].split(" ").slice(0,3).join(" ")); return top.length?("Loves: "+top.slice(0,2).join("; ")):(Object.keys(S.a).length?`${Object.keys(S.a).length} rated`:"Not started"); }
  if(id==="conditions"){ const d=CONDITIONS.filter(c=>S.c[c.id]===0).map(c=>COND_LABEL[c.id]); return d.length?("No: "+d.slice(0,3).join(", ")):(Object.keys(S.c).length?"No deal-breakers":"Not started"); }
  if(id==="schedule"){ const h=SCHED[0].opts.find(o=>o[1]===S.s.hours); return h?h[0]:"Not started"; }
  if(id==="money"){ return Object.keys(S.m).length?`Needs ~${k(budget().gross)}/yr`:"Not started"; }
  if(id==="training"){ const o=TRAIN[0].opts.find(o=>o[1]===S.t.months); return o?`Train: ${o[0].toLowerCase()}`:"Not started"; }
  if(id==="values") return S.values.length?S.values.map(v=>VALUE_LABEL[v]).join(", "):"Not started";
  if(id==="review"){ const n=Object.keys(S.ratings).length; return n?`${n} jobs rated`:"Not started"; }
  if(id==="results"){ if(!S.done) return "Locked until you finish"; const r=results(); return `${r.filter(x=>x.sug==="Yes").length} yes · ${r.filter(x=>x.sug==="Maybe").length} maybe`; }
}
function renderSide(){
  const allDone = S.done;
  $("#sideTitle").textContent = allDone ? "Questionnaire completed!" : "Let's find your fit";
  $("#sideSub").textContent = allDone ? "Tap any step below to go back and change answers. Your matches update right away." : "Answer at your own pace. Everything saves in this browser as you go.";
  $("#stepList").innerHTML = STEPS.map((st,i)=>{
    const locked = st.id==="results" && !S.done && i!==S.step;
    return `<li><button class="step-item" type="button" data-step="${i}" ${i===S.step?'aria-current="step"':""} ${locked?"disabled":""}>
      ${svg(st.icon)}<span><span class="step-label">${esc(st.label)}</span><span class="step-val">${summary(i)}</span></span>
      <span class="step-go">${svg("chev","")}</span></button></li>`;
  }).join("");
  $("#stepList").querySelectorAll(".step-go svg").forEach(s=>{s.setAttribute("width","14");s.setAttribute("height","14");});
}
function renderTop(){
  const n=STEPS.length; $("#progressFill").style.width = ((S.step+1)/n*100)+"%";
  $("#stepCount").textContent = `Step ${S.step+1} of ${n}`;
  $("#backBtn").style.visibility = S.step===0?"hidden":"visible";
  const last = S.step===n-1;
  $("#nextBtn").classList.toggle("hide", last);
  $("#nextBtn").innerHTML = S.step===0 ? "Let's go <span aria-hidden='true'>&rarr;</span>" : STEPS[S.step].id==="review" ? "See my matches <span aria-hidden='true'>&rarr;</span>" : "Next <span aria-hidden='true'>&rarr;</span>";
}
function head(st){ return `<h1 class="h">${esc(st.title)}</h1><p class="lead">${esc(st.sub)}</p>`; }

const DOODLE = `<svg class="doodle" viewBox="0 0 280 240" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <ellipse cx="70" cy="190" rx="52" ry="30" fill="var(--salmon)" stroke="none" opacity=".85"/>
  <ellipse cx="220" cy="198" rx="44" ry="24" fill="var(--sun)" stroke="none" opacity=".85"/>
  <circle cx="232" cy="52" r="20" fill="var(--mint)" stroke="none" opacity=".8"/>
  <circle cx="140" cy="104" r="62" fill="var(--paper)"/><circle cx="140" cy="104" r="50"/>
  <path d="M140 54v8M140 146v8M90 104h8M182 104h8"/>
  <path d="M162 82l-14 30-30 14 14-30z" fill="var(--accent)" stroke="var(--ink)"/><circle cx="140" cy="104" r="4" fill="var(--paper)"/>
  <path d="M40 120c-8-12-4-30 10-34M28 100l8-6M236 120c10-6 14-20 8-30M248 104l6 4"/>
  <path d="M60 40l6 10M72 34l-2 12M52 52l12 2" stroke="var(--salmon)"/>
  <path d="M206 150l18 18 8-8-18-18c3-8-1-16-9-18l5 9-6 6-9-5c2 8 10 12 18 9z" fill="var(--paper)"/>
  <path d="M60 176l16-16 6 6-16 16zM82 166l14-14" />
</svg>`;

/* ---------- Step renderers ---------- */
function vWelcome(st){
  const yes=JOBS.filter(j=>j.original==="Yes").length;
  return `<div class="hero">
    <div>
      <h1 class="h">${esc(st.title)}</h1>
      <p class="lead mt0">${esc(st.sub)}</p>
      <ul>
        <li>About 20 minutes. You can stop and come back anytime on this device.</li>
        <li>No wrong answers. It's about the life you want, not what sounds impressive.</li>
        <li>At the end you get a ranked list with a suggested yes, maybe or no for every job, and why.</li>
      </ul>
      <label class="q-help" for="nm" style="display:block;margin-bottom:6px">First name (optional, only shows on your results)</label>
      <input id="nm" type="text" value="${esc(S.name)}" placeholder="Your name" style="max-width:320px">
    </div>
    ${DOODLE}
  </div>
  <div class="note"><span class="i-dot">i</span><span>You already marked <b>${yes} of ${JOBS.length}</b> jobs as Yes on O*NET. That's a great start, but most were picked from a title. This walks through what each job is really like day to day.</span></div>
  <div class="note"><span class="i-dot">i</span><span>Pay numbers are approximate national figures (2024). Each job card links to O*NET and to Kansas City pay data so you can check.</span></div>`;
}
function vActivities(st){
  return head(st) + `<div class="q">${ACTIVITIES.map(a=>`<div class="row-q"><div><p class="q-title">${esc(a.t)}</p><p class="q-help">${esc(a.h)}</p></div>
    ${opts("a."+a.id, LIKE.map((l,i)=>[l,i+1]), S.a[a.id])}</div>`).join("")}</div>
  <p class="section-label">Optional: proud moments</p>
  <div class="q"><p class="q-title">Three times you were proud of something you did or made</p>
  <p class="q-help">The Parachute trick: small stories show what you're naturally good at. Fixing your bike, building a PC, helping a friend move, anything.</p>
  ${[0,1,2].map(i=>`<textarea data-story="${i}" placeholder="Story ${i+1}" style="margin-bottom:8px">${esc(S.stories[i])}</textarea>`).join("")}</div>`;
}
function vConditions(st){
  return head(st) + `<div class="q">${CONDITIONS.map(c=>`<div class="row-q"><div><p class="q-title">${esc(c.t)}</p><p class="q-help">${esc(c.h)}</p></div>
    ${opts("c."+c.id, COND_OPTS.map((o,i)=>[o[0],i]), S.c[c.id], v=>COND_OPTS[v][1])}</div>`).join("")}</div>`;
}
function vSchedule(st){
  return head(st) + SCHED.map(q=>`<div class="q"><p class="q-title">${esc(q.t)}</p>${q.h?`<p class="q-help">${esc(q.h)}</p>`:""}${opts("s."+q.id,q.opts,S.s[q.id])}</div>`).join("");
}
function vMoney(st){
  const B=budget(); const m=Object.assign({},MONEY_DEF,S.m);
  return head(st) + `<div class="budget"><div>
    ${MONEY.map(q=>`<div class="q"><p class="q-title">${esc(q.t)}</p>${opts("m."+q.id,q.opts,S.m[q.id]??null)}</div>`).join("")}
    <div class="q"><p class="q-title">Lowest pay you'd accept while you're starting out</p>
    <p class="q-help">Most trades start low and climb. How much of your goal do you need in year one or two?</p>
    <input type="range" min="50" max="100" step="5" value="${B.floorPct}" id="floor" aria-label="Starting pay floor percent">
    <p class="q-help" id="floorTxt">${B.floorPct}% of your goal: ${money(B.floor)}/yr (${money(B.floor/2080)}/hr)</p></div>
  </div>
  <aside class="total-card" aria-live="polite">
    <div class="sm">To live this life in KC you need about</div>
    <div class="big">${money(B.gross)}</div>
    <div class="sm">a year before taxes · ${money(B.hourly)}/hr · ${money(B.net)}/mo take-home</div>
    <hr>${B.lines.filter(l=>l[1]).map(l=>`<div class="line-item"><span>${esc(l[0])}</span><span>${money(l[1])}</span></div>`).join("")}
    <hr><div class="sm">Rough 2026 Kansas City costs. Taxes figured at about 22%. Defaults fill in anything you skip.</div>
  </aside></div>`;
}
function vTraining(st){
  return head(st) + TRAIN.map(q=>`<div class="q"><p class="q-title">${esc(q.t)}</p>${q.h?`<p class="q-help">${esc(q.h)}</p>`:""}${opts("t."+q.id,q.opts,S.t[q.id])}</div>`).join("");
}
function vValues(st){
  return head(st) + `<div class="q"><div class="opts">${VALUES.map(([id,l])=>`<button type="button" class="opt" data-value="${id}" aria-pressed="${S.values.includes(id)}">${esc(l)}</button>`).join("")}</div>
  <p class="q-help" style="margin-top:12px">${S.values.length}/3 picked${S.values.length===3?". Tap one to swap it.":""}</p></div>`;
}

/* Job card */
function meter(label, v, flag){ return `<div class="meter ${flag?"flag":""}">${esc(label)}<div class="bar">${[1,2,3,4,5].map(i=>`<i class="${i<=v?"on":""}"></i>`).join("")}</div></div>`; }
function links(j){
  const q=encodeURIComponent(j.name.replace(/,.*$/,""));
  return `<div class="links">
    <a href="https://www.onetonline.org/link/summary/${j.soc}" target="_blank" rel="noopener">O*NET details</a>
    <a href="https://www.careeronestop.org/Toolkit/Wages/find-salary.aspx?keyword=${q}&location=Kansas%20City%2C%20MO" target="_blank" rel="noopener">KC pay</a>
    <a href="https://www.youtube.com/results?search_query=${encodeURIComponent("day in the life "+j.name.replace(/,.*$/,""))}" target="_blank" rel="noopener">Day-in-the-life videos</a>
    <a href="https://www.apprenticeship.gov/apprenticeship-job-finder?keyword=${q}&location=Kansas%20City%2C%20MO" target="_blank" rel="noopener">Apprenticeships</a>
  </div>`;
}
function jobCard(j){
  const r=score(j), B=budget(), s=j.scores;
  const max=Math.max(j.pay_high, B.gross)*1.08, pos=v=>clamp(v/max*100,0,100);
  const flags = new Set(CONDITIONS.filter(c=>S.c[c.id]===0 && s[c.id]>=4).map(c=>c.id));
  const tags = [
    `<span class="tag green">${j.months_to_entry<=1?"Start now":"~"+j.months_to_entry+" months to start"}</span>`,
    `<span class="tag sun">${k(j.pay_median)} typical pay</span>`,
    j.paid_while_learning?`<span class="tag sky">Paid while learning</span>`:`<span class="tag peach">${esc(j.training_cost)} training</span>`,
    `<span class="tag plum">Book work ${"●".repeat(j.classroom_load)}${"○".repeat(5-j.classroom_load)}</span>`,
    openJC(j).some(c=>/excelsior/i.test(c.c))?`<span class="tag green">Excelsior Springs Job Corps</span>`:openJC(j).length?`<span class="tag green">Job Corps (${openJC(j).length})</span>`:"",
    j.residential_option?`<span class="tag peach">Housing-included option</span>`:"",
    `<span class="tag ${j.outlook.startsWith("Growing")?"green":j.outlook==="Shrinking"?"red":"sky"}">${esc(j.outlook)}</span>`
  ].join("");
  return `<article class="jobcard">
    <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap">
      <div class="kicker">${esc(j.cluster)} · O*NET: you said ${esc(j.original)}</div>
      <span class="fit-pill fit-${r.sug}">Fit ${r.score} · ${r.sug}</span>
    </div>
    <h3>${esc(j.name)}</h3>
    <p style="margin:0;font-size:17px;color:var(--ink-2)">${esc(j.summary)}</p>
    <div class="tags">${tags}</div>
    <div class="pay-bar" aria-label="Pay range">
      <div class="med" style="left:${pos(j.pay_median)}%" title="Typical"></div>
      ${Object.keys(S.m).length?`<div class="tgt" style="left:${pos(B.gross)}%">Your goal ${k(B.gross)}</div>`:""}
    </div>
    <div class="pay-labels"><span>Starting ~${k(j.pay_low)}</span><span>Typical ${k(j.pay_median)}</span><span>Top ~${k(j.pay_high)}</span></div>
    <div class="facts">
      <div class="fact"><h4>Fastest way in</h4><p>${esc(j.fastest_path)}</p></div>
      <div class="fact"><h4>Life in and out of work</h4><p>${esc(j.day_in_life)}</p></div>
      ${j.residential_option?`<div class="fact"><h4>Live-in / housing option</h4><p>${esc(j.residential_option)}</p></div>`:""}
      <div class="fact"><h4>Schedule</h4><p>${esc(j.schedule_note)}</p></div>
      <div class="fact"><h4>Where it leads</h4><p>${esc(j.ladder)}</p></div>
      <div class="fact"><h4>Watch out for</h4><p>${esc(j.watch_outs)}</p></div>
      <div class="fact"><h4>Credential</h4><p>${esc(j.credential)} · ${esc(j.education)}</p></div>
      <div class="fact"><h4>Around KC</h4><p>${esc(j.openings_kc)} openings · pay ${esc(j.kc_pay_note)}</p></div>
    </div>
    ${trainingBlock(j)}
    <div class="kicker" style="margin-top:6px">Working conditions</div>
    <div class="meters">
      ${meter("Physical",s.physical,flags.has("physical"))}${meter("Outdoors",s.outdoors,flags.has("outdoors"))}${meter("Danger",s.hazard,flags.has("hazard"))}
      ${meter("Dirty / loud",s.dirty,flags.has("dirty"))}${meter("Heights",s.heights,flags.has("heights"))}${meter("Tight spaces",s.confined,flags.has("confined"))}
      ${meter("Blood / patients",s.bodily,flags.has("bodily"))}${meter("Public contact",s.people,flags.has("people"))}${meter("Repetitive",s.repetitive,flags.has("repetitive"))}
      ${meter("Driving around",s.travel,flags.has("travel"))}${meter("Troubleshooting",s.troubleshooting)}${meter("Tech",s.tech)}
      ${meter("Odd hours",s.schedule)}${meter("Stress",s.stress)}${meter("Automation risk",s.automation_risk)}
    </div>
    ${(r.pros.length||r.cons.length)?`<div class="cols" style="margin-top:14px"><div><div class="kicker">Fits you</div><ul class="why pro">${r.pros.map(p=>`<li>${esc(p)}</li>`).join("")||"<li class='muted'>Nothing stands out yet</li>"}</ul></div>
      <div><div class="kicker">Concerns</div><ul class="why con">${r.cons.map(p=>`<li>${esc(p)}</li>`).join("")||"<li class='muted'>None</li>"}</ul></div></div>`:""}
    ${links(j)}
    <div class="verdict" role="group" aria-label="Your answer">
      <button type="button" class="btn ghost v-no" data-rate="No" aria-pressed="${S.ratings[j.id]==="No"}">No</button>
      <button type="button" class="btn ghost v-maybe" data-rate="Maybe" aria-pressed="${S.ratings[j.id]==="Maybe"}">Maybe</button>
      <button type="button" class="btn ghost v-yes" data-rate="Yes" aria-pressed="${S.ratings[j.id]==="Yes"}">Yes</button>
    </div>
    <input type="text" data-note="${j.id}" value="${esc(S.notes[j.id]||"")}" placeholder="Why? (optional, a few words)" style="margin-top:10px">
  </article>`;
}

function jcBlock(j){
  const all=(j.jc_centers||[]); if(!all.length) return "";
  const open=all.filter(c=>/^open/.test(c.status));
  const row=c=>`<li><a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.c)}</a>, ${esc(c.st)} <span class="muted">· ${c.mi!=null?c.mi+" mi":""}${/^open/.test(c.status)?"":" · "+esc(c.status)}</span></li>`;
  const first=(open.length?open:all).slice(0,3);
  return `<div class="jc-box"><div class="kicker">Job Corps: free, housing included</div>
    <p class="q-help" style="margin:4px 0 6px">${all.length} center${all.length>1?"s":""} train for this${open.length!==all.length?` (${open.length} confirmed open)`:""}. Nearest:</p>
    <ul class="mini">${first.map(row).join("")}</ul>
    ${all.length>3?`<details><summary>See all ${all.length}</summary><ul class="mini">${all.map(row).join("")}</ul></details>`:""}
  </div>`;
}
function progCard(p){
  const d=x=>esc(String(x||"").trim().replace(/[.\s]+$/,""));
  const tag=(c,x)=>x&&!/^check with/i.test(x)?`<span class="tag ${c}">${esc(x)}</span>`:"";
  return `<div class="prog">
      <div class="prog-h">${p.url?`<a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.name)}</a>`:esc(p.name)}<span class="muted"> · ${esc(p.provider)}</span></div>
      <div class="tags" style="margin:6px 0">${tag("sky",p.location)}${p.residential===true?tag("peach","Housing included"):""}${/yes/i.test(p.paid_while_training)?tag("green","Paid while training"):/partial/i.test(p.paid_while_training)?tag("sun","Partly paid"):""}${tag("sun",p.length)}${tag("",p.cost)}${p.verified===false?tag("red","Not verified"):""}</div>
      <p class="prog-d">${p.next_start_or_application?`<b>Next start:</b> ${d(p.next_start_or_application)}. `:""}${p.entry_requirements?`<b>Needs:</b> ${d(p.entry_requirements)}. `:""}${p.hands_on_fit?`<b>Hands-on fit:</b> ${d(p.hands_on_fit)}. `:""}${p.funding?`<b>Funding:</b> ${d(p.funding)}. `:""}${p.notes?esc(p.notes):""}</p>
    </div>`;
}
function trainingBlock(j){
  const t=trainingFor(j), groups=pathsFor(j), jc=jcBlock(j);
  if(!groups.length && !jc && !(t&&t.best_first_step)) return `<div class="train-box"><div class="kicker">Ways in: specific programs</div><p class="q-help">We didn't find a training program for this one. People usually get in through a related job; see "Fastest way in" above.</p></div>`;
  const n=groups.reduce((a,g)=>a+g.items.length,0);
  return `<div class="train-box"><div class="kicker">Ways in: specific programs</div>
    ${t&&t.best_first_step?`<p class="first-step"><b>Best first step:</b> ${esc(t.best_first_step)}</p>`:""}
    ${groups.map(g=>`<details class="path-g"${g===groups[0]?" open":""}><summary><b>${esc(g.label)}</b> <span class="muted">· ${g.items.length}</span></summary>${g.items.map(progCard).join("")}</details>`).join("")}
    ${jc}
    ${!n?`<p class="q-help">Job Corps is the only specific program we found. See "Fastest way in" above for other routes.</p>`:""}
    ${t&&t.watch_outs?`<p class="q-help"><b>Watch out:</b> ${esc(t.watch_outs)}</p>`:""}
  </div>`;
}
function fundingBlock(){
  const t=TRAINING[0]; if(!t||!t.programs) return "";
  return `<p class="section-label">Ways to pay for training</p><div class="q">${t.programs.map(p=>`<div class="prog"><div class="prog-h"><a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.name)}</a><span class="muted"> · ${esc(p.provider)}</span></div><p class="prog-d">${esc(p.notes||p.funding||"")}${p.entry_requirements?` <b>Who qualifies:</b> ${esc(p.entry_requirements)}`:""}</p></div>`).join("")}</div>`;
}
function queue(){
  const R=results();
  if(S.queue==="top") return R.slice(0,25).map(r=>r.j);
  if(S.queue==="yes") return R.filter(r=>r.j.original==="Yes").map(r=>r.j);
  if(S.queue==="no") return R.filter(r=>r.j.original==="No").map(r=>r.j);
  if(S.queue==="unrated") return R.filter(r=>!S.ratings[r.j.id]).map(r=>r.j);
  if(S.queue==="one" && S.focus) return [JOBS.find(j=>j.id===S.focus)];
  return R.map(r=>r.j);
}
let Q=null;
function vReview(st){
  if(!Q) Q=queue();
  S.qi = clamp(S.qi,0,Math.max(0,Q.length-1));
  const j=Q[S.qi];
  const rated=Q.filter(x=>S.ratings[x.id]).length;
  const choices=[["top","Top 25 matches"],["yes","My O*NET yes list"],["no","My O*NET no list"],["unrated","Not rated yet"],["all","All 257"]];
  return head(st) + `<div class="review-top">
      <div class="opts">${choices.map(([v,l])=>`<button type="button" class="opt" data-queue="${v}" aria-pressed="${S.queue===v}">${l}</button>`).join("")}</div>
      <div class="muted" style="font-size:14px">${S.qi+1} of ${Q.length} · ${rated} rated</div>
    </div>
    ${j?jobCard(j):`<div class="q">Nothing in this list. Pick another.</div>`}
    <div style="display:flex;justify-content:space-between;margin-top:12px;gap:10px">
      <button class="btn ghost sm" type="button" data-qnav="-1" ${S.qi===0?"disabled":""}>&larr; Previous job</button>
      <button class="btn ghost sm" type="button" data-qnav="1" ${S.qi>=Q.length-1?"disabled":""}>Skip &rarr;</button>
    </div>
    <p class="q-help" style="margin-top:14px">Tip: rate at least 10. Your yes and no answers count a lot in the final ranking. Keys: Y, M, N, and arrows.</p>`;
}
function whenLabel(m){ return m<=1?"Start now":m<12?`~${m} months`:m<24?"~1 year":`~${Math.round(m/12)} years`; }
function vResults(st){
  S.done=true; save();
  const R=results(), shown=R.slice(0,10);
  const filt = R.filter(r=>(S.filter==="All"||r.sug===S.filter) && (!S.search || r.j.name.toLowerCase().includes(S.search.toLowerCase())));
  const cnt = s=>R.filter(r=>r.sug===s).length;
  return `<h1 class="h">${S.name?esc(S.name)+"'s":"Your"} best-matched paths</h1><p class="lead">${esc(st.sub)}</p>
  <p class="section-label">Your top 10</p><div class="timeline">${shown.map((r,i)=>{const j=r.j; return `<div class="tl-row">
    <div class="tl-rail"><span class="rank">#${i+1}</span><span class="dot"></span><span class="when">${whenLabel(j.months_to_entry)}</span></div>
    <div class="tl-card">
      <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><h3>${esc(j.name)}</h3><span class="fit-pill fit-${r.sug}">Fit ${r.score}</span></div>
      <p class="sub">${esc(j.summary)}</p>
      <p class="sub2">${esc(j.fastest_path)}</p>
      <div class="tags">
        <span class="tag green">${j.months_to_entry<=1?"Start now":whenLabel(j.months_to_entry)+" to start"}</span>
        <span class="tag sun">${k(j.pay_low)}–${k(j.pay_high)}</span>
        ${j.paid_while_learning?`<span class="tag sky">Paid while learning</span>`:""}
        ${openJC(j).length?`<span class="tag green">Job Corps (${openJC(j).length} centers)</span>`:j.residential_option?`<span class="tag peach">Housing option</span>`:""}
        ${(CATALOG.byJob[j.id]||[]).length?`<span class="tag plum">${CATALOG.byJob[j.id].length} training programs</span>`:""}
      </div>
      <div class="cols"><ul class="why pro">${r.pros.map(p=>`<li>${esc(p)}</li>`).join("")}</ul><ul class="why con">${r.cons.map(p=>`<li>${esc(p)}</li>`).join("")}</ul></div>
      <hr><button class="btn ghost sm" type="button" data-open="${j.id}">Change?</button>
    </div></div>`;}).join("")}</div>

  <p class="section-label">Every job</p>
  <div class="toolbar">
    <div class="opts">${["All","Yes","Maybe","No"].map(f=>`<button type="button" class="opt" data-filter="${f}" aria-pressed="${S.filter===f}">${f}${f!=="All"?" ("+cnt(f)+")":""}</button>`).join("")}</div>
    <input type="search" id="search" placeholder="Search jobs" value="${esc(S.search)}">
  </div>
  <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Job</th><th>Suggested</th><th>Fit</th><th>Typical pay</th><th>To start</th><th>Why / concerns</th></tr></thead><tbody>
  ${filt.map(r=>`<tr><td><button class="name" type="button" data-open="${r.j.id}">${esc(r.j.name)}</button><div class="muted" style="font-size:12px">${esc(r.j.cluster)}${S.ratings[r.j.id]?" · you said "+S.ratings[r.j.id]:""}</div></td>
    <td><span class="fit-pill fit-${r.sug}">${r.sug}</span></td><td class="num">${r.score}</td><td class="num">${k(r.j.pay_median)}</td><td class="num">${whenLabel(r.j.months_to_entry)}</td>
    <td style="font-size:13px">${esc(r.pros[0]||"")}${r.cons[0]?`<div style="color:var(--t-red)">${esc(r.cons[0])}</div>`:""}</td></tr>`).join("")}
  </tbody></table></div>

  ${fundingBlock()}
  ${JC.summary?`<div class="note"><span class="i-dot">i</span><span><b>Job Corps status:</b> ${esc(JC.summary)}</span></div>`:""}
  <p class="section-label">Share your results</p>
  <div class="export">
    <div class="q"><p class="q-title">Copy for the Google Sheet</p><p>Copies every job's suggestion. Paste into cell A1 of the "Assessment Results" tab.</p><button class="btn primary sm" data-act="copy" type="button">Copy results</button></div>
    <div class="q"><p class="q-title">Download spreadsheet</p><p>A CSV with all 257 jobs, your answers and the reasons.</p><button class="btn ghost sm" data-act="csv" type="button">Download CSV</button></div>
    <div class="q"><p class="q-title">Save or move your answers</p><p>Back up your answers or open them on another device.</p><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn ghost sm" data-act="json" type="button">Download answers</button><button class="btn ghost sm" data-act="import" type="button">Load answers</button></div></div>
    <div class="q"><p class="q-title">Print or PDF</p><p>Print this page, or save it as a PDF to share.</p><button class="btn ghost sm" data-act="print" type="button">Print</button></div>
  </div>
  <input type="file" id="importFile" accept="application/json" class="hide">`;
}
const VIEWS={welcome:vWelcome,activities:vActivities,conditions:vConditions,schedule:vSchedule,money:vMoney,training:vTraining,values:vValues,review:vReview,results:vResults};

function render(focus){
  const st=STEPS[S.step];
  $("#stage").innerHTML = VIEWS[st.id](st);
  renderTop(); renderSide();
  if(focus){ $("#stage").focus({preventScroll:true}); window.scrollTo({top:0,behavior:"smooth"}); $("#main").scrollTop=0; }
}
function go(i){ S.step=clamp(i,0,STEPS.length-1); if(STEPS[S.step].id==="review"){ Q=null; } save(); $("#side").classList.remove("open"); render(true); }

/* ---------- Export ---------- */
function rows(){
  return results().slice().sort((a,b)=>a.j.id-b.j.id).map(r=>({
    ID:r.j.id, Job:r.j.name, Suggested:r.sug, "Fit Score":r.score, "Card Rating":S.ratings[r.j.id]||"", "His Note":S.notes[r.j.id]||"",
    "Why It Fits":r.pros.join("; "), Concerns:r.cons.join("; ")
  }));
}
function toDelim(list, d){
  const cols=Object.keys(list[0]);
  const cell=v=>{ v=String(v??""); if(d===","){ return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v; } return v.replace(/[\t\n]/g," "); };
  return [cols.join(d), ...list.map(r=>cols.map(c=>cell(r[c])).join(d))].join("\n");
}
function download(name, text, type){
  const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([text],{type})); a.download=name; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},500);
}
function toast(msg){ const t=$("#toast"); t.textContent=msg; t.classList.add("show"); clearTimeout(t._h); t._h=setTimeout(()=>t.classList.remove("show"),2400); }
async function act(a){
  if(a==="copy"){ const txt=toDelim(rows(),"\t"); try{ await navigator.clipboard.writeText(txt); toast("Copied. Paste into A1 of the Assessment Results tab."); }catch(e){ download("career-compass-results.tsv",txt,"text/tab-separated-values"); toast("Clipboard blocked, so it downloaded instead."); } }
  if(a==="csv"){
    const full=results().slice().sort((x,y)=>x.j.id-y.j.id).map(r=>{const j=r.j; return {ID:j.id,Job:j.name,"O*NET Answer":j.original,Suggested:r.sug,"Fit Score":r.score,"Card Rating":S.ratings[j.id]||"","Why It Fits":r.pros.join("; "),Concerns:r.cons.join("; "),
      Cluster:j.cluster,Summary:j.summary,"Typical Pay":j.pay_median,"Starting Pay":j.pay_low,"Top Pay":j.pay_high,"Months to Start":j.months_to_entry,"Paid While Learning":j.paid_while_learning?"Yes":"No",
      "Fastest Path":j.fastest_path,"Housing Option":j.residential_option,"Schedule":j.schedule_note,"Watch Outs":j.watch_outs};});
    download("career-compass-results.csv", toDelim(full,","), "text/csv"); }
  if(a==="json") download("career-compass-answers.json", JSON.stringify(S,null,1), "application/json");
  if(a==="import") $("#importFile").click();
  if(a==="print") window.print();
}

/* ---------- Events ---------- */
document.addEventListener("click", e=>{
  const b=e.target.closest("button"); if(!b) return;
  if(b.dataset.step!=null){ go(+b.dataset.step); return; }
  if(b.id==="nextBtn"){ go(S.step+1); return; }
  if(b.id==="backBtn"){ go(S.step-1); return; }
  if(b.id==="menuBtn"){ $("#side").classList.toggle("open"); return; }
  if(b.id==="resetBtn"){ if(confirmReset()) { S=blank(); dirty(); save(); render(true); } return; }
  if(b.dataset.set){ const v=JSON.parse(b.dataset.val); const [g,id]=b.dataset.set.split("."); S[g][id]=v; dirty(); save();
    const keep=window.scrollY; render(false); window.scrollTo(0,keep); return; }
  if(b.dataset.value){ const v=b.dataset.value; if(S.values.includes(v)) S.values=S.values.filter(x=>x!==v); else { if(S.values.length>=3) S.values.shift(); S.values.push(v);} dirty(); save(); render(false); return; }
  if(b.dataset.queue){ S.queue=b.dataset.queue; S.qi=0; Q=null; save(); render(false); return; }
  if(b.dataset.qnav){ S.qi+=+b.dataset.qnav; save(); render(false); return; }
  if(b.dataset.rate){ rate(b.dataset.rate); return; }
  if(b.dataset.filter){ S.filter=b.dataset.filter; save(); render(false); return; }
  if(b.dataset.open){ S.queue="one"; S.focus=+b.dataset.open; S.qi=0; S.step=STEPS.findIndex(s=>s.id==="review"); Q=null; save(); render(true); return; }
  if(b.dataset.act){ act(b.dataset.act); }
});
let resetArmed=0;
function confirmReset(){ const now=Date.now(); if(now-resetArmed<4000) return true; resetArmed=now; toast("Tap Start over again to erase all answers."); return false; }
function rate(v){
  const j=Q[S.qi]; if(!j) return;
  S.ratings[j.id] = S.ratings[j.id]===v ? undefined : v; if(!S.ratings[j.id]) delete S.ratings[j.id];
  dirty(); save();
  if(S.ratings[j.id] && S.qi<Q.length-1 && S.queue!=="one") S.qi++;
  render(false);
}
document.addEventListener("input", e=>{
  const t=e.target;
  if(t.id==="nm"){ S.name=t.value.slice(0,40); save(); renderSide(); }
  if(t.dataset.story!=null){ S.stories[+t.dataset.story]=t.value; save(); }
  if(t.dataset.note){ S.notes[t.dataset.note]=t.value; save(); }
  if(t.id==="floor"){ S.m.floorPct=+t.value; dirty(); save(); const B=budget(); $("#floorTxt").textContent=`${B.floorPct}% of your goal: ${money(B.floor)}/yr (${money(B.floor/2080)}/hr)`; }
  if(t.id==="search"){ S.search=t.value; save(); const pos=t.selectionStart; render(false); const n=$("#search"); n.focus(); n.setSelectionRange(pos,pos); }
});
document.addEventListener("change", e=>{
  if(e.target.id==="importFile"){ const f=e.target.files[0]; if(!f) return; const r=new FileReader();
    r.onload=()=>{ try{ S=Object.assign(blank(), JSON.parse(r.result)); dirty(); save(); render(true); toast("Answers loaded."); }catch(err){ toast("That file didn't look right."); } }; r.readAsText(f); }
});
document.addEventListener("keydown", e=>{
  if(STEPS[S.step].id!=="review" || /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
  const m={y:"Yes",n:"No",m:"Maybe"}[e.key.toLowerCase()];
  if(m){ rate(m); e.preventDefault(); }
  if(e.key==="ArrowRight" && S.qi<Q.length-1){ S.qi++; render(false); }
  if(e.key==="ArrowLeft" && S.qi>0){ S.qi--; render(false); }
});

render(false);
})();
