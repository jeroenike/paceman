import { useState, useCallback, useRef, useEffect } from "react";

const STORAGE_KEY = "paceman_v4";
const RACE_GOALS = ["5km","10km","15km","Half Marathon","Marathon","Trail Run","Custom..."];

const defaultProfile = {
  name:"", goal:"", goalCustom:"", goalDate:"", goalTime:"", thresholdPace:"", racePace:"",
  longRunPace:"", easyHR:"", experience:"", injuries:[],
  schedule:{ Mon:"rest", Tue:"run_threshold", Wed:"crossfit", Thu:"run_easy", Fri:"crossfit", Sat:"crossfit", Sun:"run_long" },
};
const DAY_LABELS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const SESSION_TYPES = ["rest","run_threshold","run_easy","run_long","crossfit","run_interval"];
const SESSION_COLORS = { rest:"#888780", run_threshold:"#1B6FE8", run_easy:"#0F6E56", run_long:"#3B6D11", crossfit:"#993C1D", run_interval:"#7C3AED" };
const SESSION_LABELS = { rest:"Rest", run_threshold:"Threshold", run_easy:"Easy Run", run_long:"Long Run", crossfit:"CrossFit", run_interval:"Intervals" };

function loadStore() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; } }
function saveStore(d) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch {} }

function parsePace(str) {
  if (!str) return null;
  const [m,s] = str.split(":").map(Number);
  if (isNaN(m)||isNaN(s)) return null;
  return m*60+s;
}
function secsTopace(secs) {
  if (!secs) return null;
  const m = Math.floor(secs/60), s = Math.round(secs%60);
  return `${m}:${String(s).padStart(2,"0")}`;
}
const RACE_DISTANCES = { "5km":5, "10km":10, "15km":15, "Half Marathon":21.0975, "Marathon":42.195 };
function computeRacePace(goal, goalTime) {
  const dist = RACE_DISTANCES[goal];
  if (!dist || !goalTime) return null;
  const parts = goalTime.split(":").map(Number);
  let secs;
  if (parts.length===3) secs = parts[0]*3600+parts[1]*60+(parts[2]||0);
  else if (parts.length===2) secs = parts[0]*60+(parts[1]||0);
  else return null;
  if (!secs) return null;
  return secsTopace(Math.round(secs/dist));
}
function computeGoalTime(goal, racePace) {
  const dist = RACE_DISTANCES[goal];
  const paceSecs = parsePace(racePace);
  if (!dist || !paceSecs) return null;
  const t = Math.round(paceSecs * dist);
  const h = Math.floor(t/3600), m = Math.floor((t%3600)/60), s = t%60;
  return `${h}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}
function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day===0?-6:1);
  d.setDate(diff);
  // Use local date parts to avoid UTC offset shifting the date
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function getCurrentWeekStart() { return getWeekStart(new Date()); }
function getPlannedDay(sessionDate, weekPlan) {
  if (!weekPlan?.weekStart || !sessionDate) return null;
  if (getWeekStart(sessionDate) !== weekPlan.weekStart) return null;
  const d = new Date(sessionDate + "T00:00:00");
  return DAY_LABELS[d.getDay() === 0 ? 6 : d.getDay() - 1];
}
function getAutoLink(sessionDate, weekPlans) {
  if (!sessionDate || !weekPlans?.length) return null;
  const sessionWeekStart = getWeekStart(sessionDate);
  const plan = weekPlans.find(p => p.weekStart === sessionWeekStart);
  if (!plan) return null;
  const d = new Date(sessionDate + "T00:00:00");
  return { plannedDay: DAY_LABELS[d.getDay() === 0 ? 6 : d.getDay() - 1], plannedWeekStart: sessionWeekStart };
}
function computeAutoScore(session, weekPlan) {
  let paceScore = null;
  const tSecs = parsePace(weekPlan?.weekGoals?.targetPace);
  const aSecs = parsePace(session.avgPace);
  if (tSecs && aSecs) {
    const delta = aSecs - tSecs;
    paceScore = delta <= -30 ? 7 : delta <= -10 ? 9 : delta <= 10 ? 10 : delta <= 30 ? 8 : delta <= 60 ? 6 : delta <= 120 ? 4 : 2;
  }
  let rpeScore = null;
  const rpe = Number(session.rpe);
  if (rpe) { const m = {1:3,2:4,3:5,4:5,5:6,6:8,7:9,8:7,9:5,10:3}; rpeScore = m[rpe] ?? null; }
  if (paceScore !== null && rpeScore !== null) return { value: Math.round((paceScore+rpeScore)/2), verdict:"Auto: pace + RPE" };
  if (paceScore !== null) return { value: paceScore, verdict:"Auto: pace" };
  if (rpeScore !== null) return { value: rpeScore, verdict:"Auto: RPE" };
  return null;
}

async function callClaude(system, user) {
  const res = await fetch("/api/claude", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body:JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:1500, system, messages:[{role:"user",content:user}] }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.content?.[0]?.text || "";
}

const SYSTEM = `You are an elite, critical, data-driven running coach for hybrid athletes (CrossFit + running).
Tone: direct, technical, no filler. Domain language: lactate threshold, interference effect, neuromuscular fatigue, negative split, cardiac drift, aerobic TE.
If something is suboptimal, say so with data-backed reasoning. Never soften a diagnosis.
Core philosophy: 80/10/10 intensity. Progressive overload in 4-week blocks. Threshold sessions use rep density and rest reduction as primary lever.
Respond in the same language as the user profile (Dutch or English). Use markdown ## headers and - bullets. Be concise.`;

// ── Shared UI ──

function MarkdownBlock({ content, small }) {
  return (
    <div style={{ fontSize:small?13:14, lineHeight:1.75, color:"#1a1a1a" }}>
      {content.split("\n").map((line,i) => {
        if (line.startsWith("## ")) return <div key={i} style={{ fontSize:small?14:16,fontWeight:700,margin:"18px 0 6px",borderBottom:"1px solid #eee",paddingBottom:4 }}>{line.slice(3)}</div>;
        if (line.startsWith("### ")) return <div key={i} style={{ fontSize:small?13:14,fontWeight:700,margin:"12px 0 4px" }}>{line.slice(4)}</div>;
        if (line.startsWith("- ")||line.startsWith("• ")) return <div key={i} style={{ margin:"4px 0",paddingLeft:14,display:"flex",gap:6 }}><span style={{color:"#1B6FE8",flexShrink:0}}>·</span><span dangerouslySetInnerHTML={{__html:line.slice(2).replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>")}} /></div>;
        if (line.match(/^\d+\./)) return <div key={i} style={{ margin:"4px 0",paddingLeft:14 }} dangerouslySetInnerHTML={{__html:line.replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>")}} />;
        if (!line.trim()) return <div key={i} style={{ height:6 }} />;
        return <div key={i} style={{ margin:"3px 0" }} dangerouslySetInnerHTML={{__html:line.replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>")}} />;
      })}
    </div>
  );
}

function Dots() {
  return (
    <div style={{ display:"flex",gap:6,padding:"24px 0",justifyContent:"center" }}>
      {[0,1,2].map(i=><div key={i} style={{ width:7,height:7,borderRadius:"50%",background:"#1B6FE8",animation:"pulse 1.2s ease-in-out infinite",animationDelay:`${i*0.2}s` }}/>)}
      <style>{`@keyframes pulse{0%,80%,100%{opacity:.2}40%{opacity:1}}`}</style>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, inputMode, type, required, attempted }) {
  const invalid = required && attempted && !value;
  return (
    <div>
      <label style={{ fontSize:11,color:invalid?"#c00":"#888",display:"block",marginBottom:5,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.07em" }}>{label}{required?" *":""}</label>
      <input
        type={type||"text"} value={value||""} onChange={e=>onChange(e.target.value)}
        placeholder={placeholder} inputMode={inputMode||"text"}
        style={{ width:"100%",padding:"11px 12px",borderRadius:8,border:`1px solid ${invalid?"#f99":"#e0e0dc"}`,background:invalid?"#fff8f8":"#fff",color:"#1a1a1a",fontSize:15,outline:"none",boxSizing:"border-box" }}
        onFocus={e=>e.target.style.borderColor="#1B6FE8"} onBlur={e=>e.target.style.borderColor=invalid?"#f99":"#e0e0dc"}
      />
      {invalid&&<div style={{ fontSize:11,color:"#c00",marginTop:3 }}>Required</div>}
    </div>
  );
}

function Chip({ label, color }) {
  return <span style={{ fontSize:11,padding:"3px 8px",borderRadius:6,background:color+"22",color,fontWeight:700 }}>{label}</span>;
}

function ErrorBox({ message }) {
  if (!message) return null;
  return <div style={{ padding:12,borderRadius:8,background:"#fff0f0",border:"1px solid #fcc",fontSize:13,color:"#c00",marginBottom:12 }}>{message}</div>;
}

function SuccessBanner({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div style={{ padding:"12px 14px",borderRadius:10,background:"#e8f8f0",border:"1px solid #b0e8cc",marginBottom:14,display:"flex",justifyContent:"space-between",alignItems:"center" }}>
      <span style={{ fontSize:13,color:"#0a6640",fontWeight:600 }}>✓ {message}</span>
      <button onClick={onDismiss} style={{ background:"none",border:"none",color:"#0a6640",cursor:"pointer",fontSize:18,padding:0,lineHeight:1 }}>×</button>
    </div>
  );
}

function SectionLabel({ children }) {
  return <div style={{ fontSize:11,color:"#888",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:8 }}>{children}</div>;
}

function GoalBar({ label, actual, goal, unit, higherIsBetter=false }) {
  if (!goal) return null;
  const pct = Math.min((actual/goal)*100, 120);
  const over = actual > goal;
  const color = over ? (higherIsBetter?"#0F6E56":"#c00") : "#1B6FE8";
  return (
    <div style={{ marginBottom:14 }}>
      <div style={{ display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:5 }}>
        <span style={{ fontWeight:600,color:"#1a1a1a" }}>{label}</span>
        <span style={{ color, fontWeight:700 }}>{actual}{unit} <span style={{ color:"#aaa",fontWeight:400 }}>/ {goal}{unit}</span></span>
      </div>
      <div style={{ background:"#f0f0ec",borderRadius:6,height:8,overflow:"hidden" }}>
        <div style={{ height:"100%",background:color,borderRadius:6,width:`${Math.min(pct,100)}%`,transition:"width 0.4s" }}/>
      </div>
      {over&&!higherIsBetter&&<div style={{ fontSize:11,color:"#c00",marginTop:3 }}>Over target — check load</div>}
      {over&&higherIsBetter&&<div style={{ fontSize:11,color:"#0F6E56",marginTop:3 }}>Goal exceeded ✓</div>}
    </div>
  );
}

// ── Log Form ──

function LogForm({ initial, onSave, onCancel, stravaActivities, onImportStrava, stravaLoading, importedStravaIds, onBulkSave }) {
  const [d, setD] = useState(initial || {
    type:"", date:new Date().toISOString().split("T")[0], time:"", location:"",
    distance:"", elevation:"",
    avgPace:"", avgHR:"", maxHR:"", cadence:"", te:"", rpe:"", notes:"",
  });
  const [attempted, setAttempted] = useState(false);
  const [selected, setSelected] = useState([]);
  const set = (k,v) => setD(p=>({...p,[k]:v}));
  const isValid = d.type && d.date;
  function handleSave() { setAttempted(true); if(isValid) onSave(d); }

  const newActivities = (stravaActivities||[]).filter(a=>!importedStravaIds?.includes(a.id));

  function toggleSelect(id) { setSelected(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]); }
  function selectAll() { setSelected(newActivities.map(a=>a.id)); }
  function handleBulkSave() {
    const toSave = newActivities.filter(a=>selected.includes(a.id)).map(a=>({
      id: Date.now()+Math.random(), type:a.type, date:a.date, time:"", location:"",
      distance:a.distance||"", elevation:a.elevGain?.toString()||"",
      avgPace:a.avgPace||"", avgHR:a.avgHR?.toString()||"",
      maxHR:a.maxHR?.toString()||"", cadence:a.cadence?.toString()||"",
      te:"", rpe:"", notes:`${a.name}`, stravaId:a.id, savedAt:new Date().toISOString(),
    }));
    if(toSave.length>0) { onBulkSave(toSave); setSelected([]); }
  }

  return (
    <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
      {onImportStrava&&(
        <button onClick={onImportStrava} disabled={stravaLoading}
          style={{ width:"100%",padding:13,borderRadius:10,background:stravaLoading?"#eee":"#FC4C02",color:stravaLoading?"#aaa":"white",border:"none",fontSize:14,fontWeight:700,cursor:stravaLoading?"default":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8 }}>
          <span>⚡</span>{stravaLoading?"Loading Strava...":"Import from Strava"}
        </button>
      )}

      {stravaActivities&&stravaActivities.length>0&&(
        <div>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8 }}>
            <SectionLabel>Recent Strava runs</SectionLabel>
            {newActivities.length>0&&<button onClick={selectAll} style={{ fontSize:12,color:"#1B6FE8",fontWeight:600,background:"none",border:"none",cursor:"pointer",padding:0 }}>Select all</button>}
          </div>
          {stravaActivities.map(a=>{
            const alreadyImported = importedStravaIds?.includes(a.id);
            const isSelected = selected.includes(a.id);
            return (
              <div key={a.id} onClick={()=>!alreadyImported&&toggleSelect(a.id)}
                style={{ display:"flex",alignItems:"center",gap:10,padding:"11px 14px",marginBottom:6,borderRadius:10,
                  border:`1.5px solid ${alreadyImported?"#b0e8cc":isSelected?"#1B6FE8":"#e5e5e3"}`,
                  background:alreadyImported?"#f0faf5":isSelected?"#f0f6ff":"#fff",
                  cursor:alreadyImported?"default":"pointer" }}>
                {alreadyImported
                  ?<div style={{ width:20,height:20,borderRadius:10,background:"#0a6640",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}><span style={{ color:"white",fontSize:11,fontWeight:700 }}>✓</span></div>
                  :<div style={{ width:20,height:20,borderRadius:6,border:`2px solid ${isSelected?"#1B6FE8":"#ccc"}`,background:isSelected?"#1B6FE8":"#fff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>{isSelected&&<span style={{ color:"white",fontSize:11,fontWeight:700 }}>✓</span>}</div>
                }
                <div style={{ flex:1,minWidth:0 }}>
                  <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:2,flexWrap:"wrap" }}>
                    <span style={{ fontSize:14,fontWeight:600,color:"#1a1a1a" }}>{a.name}</span>
                    {alreadyImported&&<span style={{ fontSize:10,padding:"2px 6px",borderRadius:4,background:"#0a664022",color:"#0a6640",fontWeight:700 }}>Logged</span>}
                  </div>
                  <div style={{ fontSize:12,color:"#888" }}>{a.date} · {a.distance}km{a.elevGain?` · +${a.elevGain}m`:""}</div>
                </div>
                <div style={{ display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4 }}>
                  {a.avgPace&&<Chip label={a.avgPace+"/km"} color="#1B6FE8"/>}
                  {a.avgHR&&<Chip label={a.avgHR+" bpm"} color="#e05a00"/>}
                </div>
              </div>
            );
          })}
          {selected.length>0&&(
            <button onClick={handleBulkSave}
              style={{ width:"100%",padding:13,borderRadius:10,background:"#0F6E56",color:"white",border:"none",fontSize:14,fontWeight:700,cursor:"pointer",marginTop:4 }}>
              Log {selected.length} selected run{selected.length>1?"s":""}
            </button>
          )}
          <div style={{ height:1,background:"#f0f0ec",margin:"10px 0 4px" }}/>
        </div>
      )}

      <div>
        <SectionLabel>Session type {attempted&&!d.type&&<span style={{ color:"#c00" }}>— required</span>}</SectionLabel>
        <select value={d.type} onChange={e=>set("type",e.target.value)}
          style={{ width:"100%",padding:"11px 12px",borderRadius:8,border:`1px solid ${attempted&&!d.type?"#f99":"#e0e0dc"}`,background:attempted&&!d.type?"#fff8f8":"#fff",color:"#1a1a1a",fontSize:15,outline:"none" }}>
          <option value="">Select...</option>
          {SESSION_TYPES.filter(t=>t!=="rest").map(t=><option key={t} value={t}>{SESSION_LABELS[t]}</option>)}
        </select>
      </div>

      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
        <Field label="Date" value={d.date} onChange={v=>set("date",v)} type="date" required attempted={attempted}/>
        <Field label="Time" value={d.time} onChange={v=>set("time",v)} placeholder="07:30" type="time"/>
      </div>

      <Field label="Location" value={d.location} onChange={v=>set("location",v)} placeholder="e.g. Centennial Park"/>

      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
        <Field label="Distance (km)" value={d.distance} onChange={v=>set("distance",v)} placeholder="12.5" inputMode="decimal"/>
        <Field label="Elevation (m)" value={d.elevation} onChange={v=>set("elevation",v)} placeholder="120" inputMode="numeric"/>
      </div>

      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
        <Field label="Avg pace (/km)" value={d.avgPace} onChange={v=>set("avgPace",v)} placeholder="5:08"/>
        <Field label="Avg HR (bpm)" value={d.avgHR} onChange={v=>set("avgHR",v)} placeholder="158" inputMode="numeric"/>
        <Field label="Max HR (bpm)" value={d.maxHR} onChange={v=>set("maxHR",v)} placeholder="172" inputMode="numeric"/>
        <Field label="Cadence (spm)" value={d.cadence} onChange={v=>set("cadence",v)} placeholder="166" inputMode="numeric"/>
        <Field label="Aerobic TE" value={d.te} onChange={v=>set("te",v)} placeholder="3.8" inputMode="decimal"/>
        <Field label="RPE (1–10)" value={d.rpe} onChange={v=>set("rpe",v)} placeholder="7" inputMode="numeric"/>
      </div>

      <div>
        <SectionLabel>Notes</SectionLabel>
        <textarea value={d.notes||""} onChange={e=>set("notes",e.target.value)} placeholder="How did it feel? Any issues?"
          style={{ width:"100%",padding:"11px 12px",borderRadius:8,border:"1px solid #e0e0dc",background:"#fff",color:"#1a1a1a",fontSize:15,minHeight:80,resize:"vertical",outline:"none" }}/>
      </div>

      <div style={{ display:"flex",gap:10 }}>
        {onCancel&&<button onClick={onCancel} style={{ flex:1,padding:13,borderRadius:10,background:"none",color:"#888",border:"1px solid #e0e0dc",fontSize:15,fontWeight:600,cursor:"pointer" }}>Cancel</button>}
        <button onClick={handleSave}
          style={{ flex:2,padding:13,borderRadius:10,background:isValid?"#1B6FE8":"#e0e0dc",color:isValid?"white":"#aaa",border:"none",fontSize:15,fontWeight:700,cursor:"pointer" }}>
          {initial?.id?"Update Session":"Save Session"}
        </button>
      </div>
    </div>
  );
}

// ── Week Strip ──

function WeekStrip({ weekPlans, sessions, activeWeekStart, onSelect, raceDate }) {
  const stripRef = useRef(null);
  const activeRef = useRef(null);
  const weeks = [];
  const cur = new Date(getCurrentWeekStart() + "T00:00:00");
  const from = new Date(cur); from.setDate(from.getDate() - 42);
  const to = new Date(cur); to.setDate(to.getDate() + 56);
  const raceWeekStart = raceDate ? getWeekStart(new Date(raceDate + "T00:00:00")) : null;
  if (raceDate) { const rd = new Date(raceDate + "T00:00:00"); to.setTime(rd.getTime()); }
  for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 7)) weeks.push(getWeekStart(d));
  // Always include race week even if race is beyond default range
  if (raceWeekStart && !weeks.includes(raceWeekStart)) weeks.push(raceWeekStart);

  useEffect(() => {
    if (activeRef.current && stripRef.current) {
      activeRef.current.scrollIntoView({ inline:"center", block:"nearest", behavior:"smooth" });
    }
  }, [activeWeekStart]);

  return (
    <div ref={stripRef} style={{ display:"flex",gap:6,overflowX:"auto",padding:"4px 0 10px",scrollbarWidth:"none",WebkitOverflowScrolling:"touch" }}>
      {weeks.map(ws=>{
        const plan = (weekPlans||[]).find(p=>p.weekStart===ws);
        const isActive = ws===activeWeekStart;
        const label = new Date(ws+"T00:00:00").toLocaleDateString("en-GB",{day:"numeric",month:"short"});
        // One dot per planned run day; filled = session found by date (or fallback link)
        const wsDate = new Date(ws+"T00:00:00");
        const plannedDays = plan
          ? DAY_LABELS.filter(d=>{ const t=plan.weekGoals?.daySessions?.[d]?.type; return t&&t.startsWith("run"); })
              .map(d=>{
                const idx = DAY_LABELS.indexOf(d);
                const dd = new Date(wsDate); dd.setDate(wsDate.getDate()+idx);
                const dayStr = `${dd.getFullYear()}-${String(dd.getMonth()+1).padStart(2,"0")}-${String(dd.getDate()).padStart(2,"0")}`;
                const linked = (sessions||[]).some(s=>
                  s.date===dayStr || (s.plannedDay===d&&s.plannedWeekStart===ws)
                );
                return { day:d, type:plan.weekGoals.daySessions[d].type, linked };
              })
          : [];
        const isCurrentWeek = ws===getCurrentWeekStart();
        const isRaceWeek = raceWeekStart && ws===raceWeekStart;
        const chipBorder = isActive?"#1B6FE8":isRaceWeek?"#e8a020":isCurrentWeek?"#93b8f5":"#eee";
        const chipBg = isActive?"#f0f6ff":isRaceWeek?"#fff8ed":isCurrentWeek?"#f5f8ff":"#fff";
        const labelColor = isActive?"#1B6FE8":isRaceWeek?"#c07000":isCurrentWeek?"#4a85d4":"#888";
        return (
          <button key={ws} ref={isActive?activeRef:null} onClick={()=>onSelect(ws)}
            style={{ flexShrink:0,padding:"5px 9px",borderRadius:8,border:`1.5px solid ${chipBorder}`,background:chipBg,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2 }}>
            {isRaceWeek&&<span style={{ fontSize:12,lineHeight:1 }}>🏁</span>}
            <span style={{ fontSize:11,fontWeight:isActive||isRaceWeek?700:isCurrentWeek?600:400,color:labelColor,whiteSpace:"nowrap" }}>{label}</span>
            {isRaceWeek&&!isActive&&<span style={{ fontSize:9,fontWeight:700,color:"#c07000",letterSpacing:"0.04em",lineHeight:1 }}>RACE</span>}
            {isCurrentWeek&&!isActive&&!isRaceWeek&&<span style={{ fontSize:9,fontWeight:700,color:"#4a85d4",letterSpacing:"0.04em",lineHeight:1 }}>NOW</span>}
            <div style={{ display:"flex",gap:2,alignItems:"center" }}>
              {plannedDays.length>0
                ? plannedDays.map(({day,type,linked})=>{
                    const c=SESSION_COLORS[type]||"#888780";
                    return <div key={day} style={{ width:6,height:6,borderRadius:"50%",background:linked?c:"transparent",border:`1.5px solid ${c}` }}/>;
                  })
                : <div style={{ width:6,height:6,borderRadius:"50%",background:"transparent",border:"1.5px solid #ddd" }}/>
              }
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ── Week Schedule Editor ──

function WeekScheduleEditor({ weekStart, profile, weekScheduleOverrides, onSave }) {
  const [pickerDay, setPickerDay] = useState(null);
  const baseSchedule = { ...defaultProfile.schedule, ...(profile.schedule||{}) };
  const effective = weekScheduleOverrides[weekStart] || baseSchedule;
  const hasOverride = !!weekScheduleOverrides[weekStart];

  function setDayType(day, type) {
    const updated = { ...(weekScheduleOverrides[weekStart] || baseSchedule), [day]: type };
    onSave(weekStart, updated);
    setPickerDay(null);
  }

  function resetToProfile() {
    onSave(weekStart, null);
  }

  return (
    <div style={{ marginBottom:12 }}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6 }}>
        <span style={{ fontSize:11,color:"#999",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.06em" }}>Week Schedule</span>
        {hasOverride&&(
          <button onClick={resetToProfile} style={{ fontSize:11,color:"#1B6FE8",background:"none",border:"none",cursor:"pointer",padding:0 }}>
            Reset to profile
          </button>
        )}
      </div>
      <div style={{ display:"flex",gap:4 }}>
        {DAY_LABELS.map(day=>{
          const type = effective[day];
          const color = SESSION_COLORS[type]||"#888";
          const isOpen = pickerDay===day;
          return (
            <button key={day} onClick={()=>setPickerDay(isOpen?null:day)}
              style={{ flex:1,padding:"6px 2px",borderRadius:8,border:`2px solid ${color}`,
                background:isOpen?color:"transparent",color:isOpen?"#fff":color,
                fontSize:10,fontWeight:700,cursor:"pointer",textAlign:"center",lineHeight:1.4 }}>
              {day}<br/>
              <span style={{ fontWeight:400,fontSize:9 }}>{SESSION_LABELS[type]?.split(" ")[0]??type}</span>
            </button>
          );
        })}
      </div>
      {pickerDay&&(
        <div style={{ marginTop:8,background:"#f5f5f5",borderRadius:10,padding:10,display:"flex",flexWrap:"wrap",gap:6 }}>
          {SESSION_TYPES.map(t=>(
            <button key={t} onClick={()=>setDayType(pickerDay,t)}
              style={{ padding:"6px 12px",borderRadius:16,border:"none",
                background:effective[pickerDay]===t?SESSION_COLORS[t]:"#e0e0e0",
                color:effective[pickerDay]===t?"#fff":"#333",
                fontSize:12,fontWeight:600,cursor:"pointer" }}>
              {SESSION_LABELS[t]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Home Screen ──

function HomeScreen({ store, today, loading, loadingMsg, error, hasProfile, onGeneratePlan, onGenerateAllPlans, onGoProfile, onSaveScheduleOverride, onSaveSession }) {
  const [activeWeekStart, setActiveWeekStart] = useState(getCurrentWeekStart);
  const [scheduleEdit, setScheduleEdit] = useState(false);
  const goalLabel = store.profile.goal==="Custom..."?store.profile.goalCustom:store.profile.goal;
  const daysToRace = store.profile.goalDate ? Math.ceil((new Date(store.profile.goalDate)-new Date())/(1000*60*60*24)) : null;

  const activePlan = (store.weekPlans||[]).find(p=>p.weekStart===activeWeekStart)??null;
  const weekGoals = activePlan?.weekGoals;
  const hasPlan = !!activePlan;

  // Week date range label
  const weekStartDate = new Date(activeWeekStart+"T00:00:00");
  const weekEndDate = new Date(weekStartDate); weekEndDate.setDate(weekStartDate.getDate()+6);
  const weekRange = `${weekStartDate.toLocaleDateString("en-GB",{day:"numeric",month:"short"})} – ${weekEndDate.toLocaleDateString("en-GB",{day:"numeric",month:"short"})}`;

  function shiftWeek(dir) {
    const d = new Date(activeWeekStart+"T00:00:00");
    d.setDate(d.getDate()+dir*7);
    // activeWeekStart is always a Monday; just add/subtract 7 days, no re-normalization needed
    setActiveWeekStart(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`);
  }

  return (
    <div style={{ padding:"0 16px 24px",overflowY:"auto",flex:1 }}>
      {/* Header */}
      <div style={{ padding:"20px 0 10px",borderBottom:"1px solid #f0f0ec",marginBottom:10 }}>
        <div style={{ fontSize:11,color:"#aaa",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:2 }}>Training Plan</div>
        <div style={{ fontSize:24,fontWeight:800,color:"#1a1a1a" }}>{store.profile.name?`${store.profile.name}'s Plan`:"Training Plan"}</div>
        {goalLabel&&(
          <div style={{ fontSize:13,color:"#888",marginTop:3,display:"flex",gap:8,alignItems:"center",flexWrap:"wrap" }}>
            <span>{goalLabel} · {store.profile.goalTime}</span>
            {daysToRace!==null&&daysToRace>0&&<span style={{ fontSize:11,padding:"2px 8px",borderRadius:6,background:"#f0f6ff",color:"#1B6FE8",fontWeight:700 }}>{daysToRace}d to go</span>}
            {daysToRace===0&&<span style={{ fontSize:11,padding:"2px 8px",borderRadius:6,background:"#fff8e0",color:"#b07000",fontWeight:700 }}>Race day!</span>}
          </div>
        )}
      </div>

      {/* Week strip */}
      <WeekStrip weekPlans={store.weekPlans} sessions={store.sessions} activeWeekStart={activeWeekStart} onSelect={setActiveWeekStart} raceDate={store.profile.goalDate}/>

      {/* Arrow nav + week label */}
      {(()=>{ const currentWeekStart=getCurrentWeekStart(); return (
      <div style={{ display:"grid",gridTemplateColumns:"1fr auto 1fr",alignItems:"center",marginBottom:12 }}>
        <div/>
        <div style={{ display:"flex",alignItems:"center",gap:4 }}>
          <button onClick={()=>shiftWeek(-1)} style={{ padding:"6px 10px",borderRadius:8,background:"none",border:"1px solid #eee",color:"#888",fontSize:14,cursor:"pointer" }}>‹</button>
          <span style={{ fontSize:13,fontWeight:600,color:"#1a1a1a",minWidth:120,textAlign:"center" }}>{weekRange}</span>
          <button onClick={()=>shiftWeek(1)} style={{ padding:"6px 10px",borderRadius:8,background:"none",border:"1px solid #eee",color:"#888",fontSize:14,cursor:"pointer" }}>›</button>
        </div>
        <div style={{ display:"flex",justifyContent:"flex-end" }}>
          {activeWeekStart!==currentWeekStart&&(
            <button onClick={()=>setActiveWeekStart(currentWeekStart)}
              style={{ fontSize:12,color:"#1B6FE8",background:"none",border:"1px solid #1B6FE8",borderRadius:6,padding:"4px 10px",cursor:"pointer",fontWeight:600 }}>
              Today
            </button>
          )}
        </div>
      </div>
      );})()}

      {/* Generate button */}
      {(()=>{ const isPastWeek=activeWeekStart<getCurrentWeekStart(); return (
      !hasProfile?(
        <div style={{ padding:16,borderRadius:10,background:"#fff8f0",border:"1px solid #fcd0b0",marginBottom:14 }}>
          <div style={{ fontSize:13,color:"#c04a00",fontWeight:700,marginBottom:4 }}>Set up your profile first</div>
          <div style={{ fontSize:13,color:"#666",marginBottom:10 }}>Add your goal and benchmarks to generate a personalised plan.</div>
          <button onClick={onGoProfile} style={{ padding:"8px 16px",borderRadius:8,background:"#1B6FE8",color:"white",border:"none",fontSize:13,fontWeight:700,cursor:"pointer" }}>Go to Profile →</button>
        </div>
      ):isPastWeek?(
        <div style={{ padding:"10px 14px",borderRadius:10,background:"#f5f5f5",border:"1px solid #e0e0e0",marginBottom:12,display:"flex",alignItems:"center",gap:8 }}>
          <span style={{ fontSize:16,lineHeight:1 }}>🔒</span>
          <span style={{ fontSize:13,color:"#999" }}>Past week — plan generation not available</span>
        </div>
      ):(
        <div style={{ display:"flex",flexDirection:"column",gap:8,marginBottom:12 }}>
          <button onClick={()=>onGeneratePlan(activeWeekStart)} disabled={loading}
            style={{ width:"100%",padding:14,borderRadius:10,background:loading?"#ccc":"#1B6FE8",color:"white",border:"none",fontSize:15,fontWeight:700,cursor:loading?"default":"pointer" }}>
            {loading&&!loadingMsg?"Generating…":hasPlan?"Regenerate This Week":"Generate This Week"}
          </button>
          {store.profile.goalDate&&(
            <button onClick={onGenerateAllPlans} disabled={loading}
              style={{ width:"100%",padding:12,borderRadius:10,background:loading?"#ccc":"#0F6E56",color:"white",border:"none",fontSize:14,fontWeight:700,cursor:loading?"default":"pointer" }}>
              {loadingMsg||"Generate Full Plan to Race Day"}
            </button>
          )}
        </div>
      ));})()}

      {/* Week summary bar + edit schedule toggle */}
      {(()=>{
        const weekSessions = (store.sessions||[]).filter(s => (s.plannedWeekStart===activeWeekStart || getWeekStart(s.date)===activeWeekStart) && parseFloat(s.distance||"") > 0);
        const actualKm = weekSessions.reduce((sum,s) => sum + (parseFloat(s.distance)||0), 0);
        const plannedKm = weekGoals?.totalDistance || 0;
        const pct = plannedKm > 0 ? Math.min(100, Math.round((actualKm/plannedKm)*100)) : 0;
        const runsDone = weekSessions.length;
        const runsPlanned = weekGoals?.runsPlanned || 0;
        return (
          <div style={{ marginBottom:10 }}>
            {weekGoals&&(
              <div style={{ marginBottom:8 }}>
                <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4 }}>
                  <div style={{ fontSize:12,color:"#555" }}>
                    <span style={{ fontWeight:700 }}>{actualKm.toFixed(1)} km</span>
                    <span style={{ color:"#aaa" }}> / {plannedKm} km planned</span>
                  </div>
                  <div style={{ fontSize:12,color:"#aaa" }}>{runsDone} / {runsPlanned} runs</div>
                </div>
                <div style={{ height:6,borderRadius:4,background:"#f0f0ec",overflow:"hidden" }}>
                  <div style={{ height:"100%",borderRadius:4,background:pct>=90?"#0F6E56":pct>=50?"#1B6FE8":"#aaa",width:`${pct}%`,transition:"width 0.3s" }}/>
                </div>
              </div>
            )}
            {hasProfile&&(
              <div style={{ display:"flex",justifyContent:"flex-end" }}>
                {scheduleEdit
                  ? <button onClick={()=>setScheduleEdit(false)} style={{ fontSize:12,fontWeight:700,color:"#1B6FE8",background:"#f0f6ff",border:"none",borderRadius:6,padding:"4px 10px",cursor:"pointer" }}>Done</button>
                  : <button onClick={()=>setScheduleEdit(true)} style={{ fontSize:12,color:"#aaa",background:"none",border:"none",padding:"4px 0",cursor:"pointer" }}>Edit schedule</button>
                }
              </div>
            )}
          </div>
        );
      })()}

      <ErrorBox message={error}/>
      {loading&&<Dots/>}

      {/* Unified day list */}
      <WeekDayList
        schedule={store.profile.schedule}
        daySessions={weekGoals?.daySessions}
        today={today}
        weekStart={activeWeekStart}
        sessions={store.sessions}
        weekPlan={activePlan}
        scheduleEdit={scheduleEdit}
        weekScheduleOverrides={store.weekScheduleOverrides||{}}
        onSaveScheduleOverride={onSaveScheduleOverride}
        raceDate={store.profile.goalDate}
        onSaveSession={onSaveSession}
      />
    </div>
  );
}

// ── Week Day List ──

function WeekDayList({ schedule, daySessions, today, weekStart, sessions, weekPlan, scheduleEdit, weekScheduleOverrides, onSaveScheduleOverride, raceDate, onSaveSession }) {
  const [pickerDay, setPickerDay] = useState(null);
  const [inlineFormDay, setInlineFormDay] = useState(null); // {day, initial} or null
  const weekStartDate = new Date(weekStart + "T00:00:00");

  function setDayTypeOverride(day, type) {
    const baseSchedule = { ...defaultProfile.schedule, ...(schedule||{}) };
    const current = weekScheduleOverrides?.[weekStart] || baseSchedule;
    const updated = { ...current, [day]: type };
    onSaveScheduleOverride(weekStart, updated);
    setPickerDay(null);
  }

  function parseMainSet(mainSet) {
    if (!mainSet) return [];
    const parts = mainSet.split(/,\s+/).map(s => s.trim()).filter(Boolean);
    return parts.length > 1 ? parts : [mainSet];
  }

  const n = new Date();
  const todayStr = `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}-${String(n.getDate()).padStart(2,"0")}`;

  return (
    <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
      {DAY_LABELS.map((day, i) => {
        const dayDate = new Date(weekStartDate);
        dayDate.setDate(weekStartDate.getDate() + i);
        const dateStr = dayDate.toLocaleDateString("en-GB", { day:"numeric", month:"short" });
        const dayDateStr = `${dayDate.getFullYear()}-${String(dayDate.getMonth()+1).padStart(2,"0")}-${String(dayDate.getDate()).padStart(2,"0")}`;

        if (raceDate && dayDateStr > raceDate) return null;

        // Race day — special celebratory card
        if (raceDate && dayDateStr === raceDate) {
          const isToday = dayDateStr === todayStr;
          return (
            <div key={day} style={{ borderRadius:10,overflow:"hidden",border:"2px solid #e8a020",background:"linear-gradient(135deg,#fff8ed 0%,#fff3d6 100%)" }}>
              <div style={{ display:"flex" }}>
                <div style={{ width:4,background:"linear-gradient(180deg,#e8a020,#f0c040)",flexShrink:0,borderRadius:"10px 0 0 10px" }}/>
                <div style={{ flex:1,padding:"14px 14px" }}>
                  <div style={{ display:"flex",alignItems:"center",gap:6 }}>
                    <span style={{ fontSize:12,fontWeight:700,color:"#b07000",textTransform:"uppercase",letterSpacing:"0.05em",width:28 }}>{day}</span>
                    <span style={{ fontSize:11,color:"#c08000" }}>{dateStr}</span>
                    <span style={{ marginLeft:"auto",fontSize:13,fontWeight:800,color:"#b07000" }}>🏁 Race Day!</span>
                    {isToday&&<span style={{ fontSize:10,fontWeight:800,color:"#b07000",letterSpacing:"0.06em" }}>TODAY</span>}
                  </div>
                  <div style={{ marginTop:8,fontSize:14,fontWeight:700,color:"#8a5a00",lineHeight:1.5 }}>
                    This is what all the training was for. Go get it! 🏆
                  </div>
                </div>
              </div>
            </div>
          );
        }

        const session = daySessions?.[day];
        const overrideType = weekScheduleOverrides?.[weekStart]?.[day];
        const baseScheduleType = { ...defaultProfile.schedule, ...(schedule||{}) }[day] || "rest";
        const type = overrideType || session?.type || baseScheduleType;
        const mainSet = session?.mainSet || null;
        const color = SESSION_COLORS[type] || "#888780";
        const label = SESSION_LABELS[type] || type;
        const isRun = type.startsWith("run");
        const isRest = type === "rest";
        const isToday = dayDateStr === todayStr;
        const isPast = dayDateStr < todayStr;
        const linked = sessions?.find(s => s.date === dayDateStr)
          ?? sessions?.find(s => s.plannedDay === day && s.plannedWeekStart === weekPlan?.weekStart);
        const hasDone = !!linked && !!parseFloat(linked.distance||"");
        const isMissed = isPast && !isRest && !hasDone;
        const isPickerOpen = scheduleEdit && pickerDay === day;
        const isInlineForm = inlineFormDay?.day === day;

        let cardBg, cardBorder;
        if (isPickerOpen) { cardBg = "#fff"; cardBorder = `1.5px solid ${color}`; }
        else if (isToday) { cardBg = "#f0f6ff"; cardBorder = `1px solid ${color}`; }
        else if (hasDone) { cardBg = "#f4fbf7"; cardBorder = "1px solid #b8e8cd"; }
        else if (isMissed) { cardBg = "#fff9f3"; cardBorder = "1px solid #f5d8b0"; }
        else { cardBg = "#fff"; cardBorder = "1px solid #eee"; }

        const bullets = parseMainSet(mainSet);
        const dayGoal = weekPlan?.weekGoals?.dayGoals?.[day];

        return (
          <div key={day}
            onClick={scheduleEdit ? ()=>setPickerDay(pickerDay===day?null:day) : undefined}
            style={{ borderRadius:10,overflow:"hidden",background:cardBg,border:cardBorder,cursor:scheduleEdit?"pointer":"default" }}>
            <div style={{ display:"flex" }}>
              <div style={{ width:4,background:color,flexShrink:0,borderRadius:"10px 0 0 10px",alignSelf:"stretch" }}/>
              <div style={{ flex:1,minWidth:0 }}>

                {/* Card header */}
                <div style={{ padding:"11px 14px 10px",display:"flex",alignItems:"center",gap:6,flexWrap:"wrap" }}>
                  <span style={{ fontSize:12,fontWeight:700,color:"#aaa",textTransform:"uppercase",letterSpacing:"0.05em",width:28,flexShrink:0 }}>{day}</span>
                  <span style={{ fontSize:11,color:"#bbb",flexShrink:0 }}>{dateStr}</span>
                  {isToday&&<span style={{ fontSize:10,color,fontWeight:800,letterSpacing:"0.06em" }}>TODAY</span>}
                  <div style={{ marginLeft:"auto",display:"flex",alignItems:"center",gap:6 }}>
                    <span style={{ fontSize:11,fontWeight:700,color,background:`${color}18`,padding:"2px 8px",borderRadius:20,whiteSpace:"nowrap" }}>{label}</span>
                    {scheduleEdit&&<span style={{ fontSize:11,color:isPickerOpen?color:"#ccc" }}>{isPickerOpen?"▾":"✎"}</span>}
                  </div>
                </div>

                {/* Schedule edit picker */}
                {isPickerOpen&&(
                  <div style={{ padding:"8px 14px 12px",borderTop:`1px solid ${color}22`,display:"flex",flexWrap:"wrap",gap:6 }} onClick={e=>e.stopPropagation()}>
                    {SESSION_TYPES.map(t=>(
                      <button key={t} onClick={()=>setDayTypeOverride(day,t)}
                        style={{ padding:"5px 12px",borderRadius:16,border:"none",
                          background:type===t?SESSION_COLORS[t]:"#ebebeb",
                          color:type===t?"#fff":"#333",
                          fontSize:12,fontWeight:600,cursor:"pointer" }}>
                        {SESSION_LABELS[t]}
                      </button>
                    ))}
                  </div>
                )}

                {/* Plan + Actual sections */}
                {!isRest&&!scheduleEdit&&(
                  <div style={{ padding:"0 14px 14px" }}>

                    {/* PLAN section */}
                    <div style={{ marginBottom:12 }}>
                      <div style={{ fontSize:10,fontWeight:700,color:"#bbb",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:5 }}>Plan</div>
                      {dayGoal&&<div style={{ fontSize:12,color:"#888",marginBottom:5,fontStyle:"italic" }}>{dayGoal}</div>}
                      {bullets.length>0 ? (
                        <div style={{ display:"flex",flexDirection:"column",gap:4 }}>
                          {bullets.map((b,j)=>(
                            <div key={j} style={{ fontSize:13,color:"#333",display:"flex",gap:7,alignItems:"flex-start" }}>
                              <span style={{ color,flexShrink:0,marginTop:1,lineHeight:1.5 }}>•</span>
                              <span style={{ lineHeight:1.5 }}>{b}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ fontSize:12,color:"#bbb",fontStyle:"italic" }}>No training details yet.</div>
                      )}
                    </div>

                    {/* ACTUAL section — only when a session is logged or inline form is open */}
                    {(hasDone||isInlineForm)&&(
                      <div style={{ borderTop:"1px solid #f0f0ec",paddingTop:10 }}>
                        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8 }}>
                          <div style={{ fontSize:10,fontWeight:700,color:"#bbb",textTransform:"uppercase",letterSpacing:"0.08em" }}>Actual</div>
                          {hasDone&&<span style={{ fontSize:11,fontWeight:700,color:"#0F6E56" }}>✓ Done</span>}
                        </div>
                        {isInlineForm ? (
                          <div onClick={e=>e.stopPropagation()}>
                            <LogForm
                              initial={inlineFormDay.initial}
                              onSave={d=>{ onSaveSession({ id:inlineFormDay.initial?.id||Date.now(), ...d, savedAt:new Date().toISOString() }); setInlineFormDay(null); }}
                              onCancel={()=>setInlineFormDay(null)}
                            />
                          </div>
                        ) : (
                          <div>
                            {linked.type&&(
                              <div style={{ marginBottom:7 }}>
                                <span style={{ fontSize:11,fontWeight:700,color:SESSION_COLORS[linked.type]||"#888",background:`${SESSION_COLORS[linked.type]||"#888"}18`,padding:"2px 8px",borderRadius:20 }}>
                                  {SESSION_LABELS[linked.type]||linked.type}
                                </span>
                              </div>
                            )}
                            <div style={{ display:"flex",gap:10,flexWrap:"wrap",fontSize:13,color:"#333",marginBottom:6 }}>
                              {linked.distance&&<span style={{ fontWeight:700 }}>{linked.distance} km</span>}
                              {linked.avgPace&&<span>{linked.avgPace}/km</span>}
                              {linked.avgHR&&<span>HR {linked.avgHR}</span>}
                              {linked.rpe&&<span>RPE {linked.rpe}/10</span>}
                              {linked.te&&<span>TE {linked.te}</span>}
                            </div>
                            {linked.score&&(
                              <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:8 }}>
                                <span style={{ fontSize:15,fontWeight:800,color:linked.score.value>=8?"#0F6E56":linked.score.value>=6?"#b07000":"#c00" }}>{linked.score.value}/10</span>
                                {linked.score.verdict&&<span style={{ fontSize:12,color:"#666",fontStyle:"italic" }}>"{linked.score.verdict}"</span>}
                              </div>
                            )}
                            {onSaveSession&&(
                              <button onClick={e=>{ e.stopPropagation(); setInlineFormDay({day,initial:linked}); }}
                                style={{ padding:"6px 14px",borderRadius:8,background:"none",color:"#1B6FE8",border:"1px solid #1B6FE833",fontSize:12,fontWeight:600,cursor:"pointer" }}>
                                Edit
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Log button — shown below plan when nothing logged yet */}
                    {!hasDone&&!isInlineForm&&isRun&&onSaveSession&&(
                      <div style={{ marginTop:4 }}>
                        <button onClick={e=>{ e.stopPropagation(); setInlineFormDay({day,initial:{type,date:dayDateStr}}); }}
                          style={{ padding:"7px 14px",borderRadius:8,background:"none",color:"#1B6FE8",border:"1px solid #1B6FE833",fontSize:13,fontWeight:600,cursor:"pointer" }}>
                          + Log this session
                        </button>
                      </div>
                    )}

                  </div>
                )}

                {/* Rest day */}
                {isRest&&!scheduleEdit&&(
                  <div style={{ padding:"0 14px 12px",fontSize:12,color:"#ccc" }}>Rest day</div>
                )}

              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Session Screen ──

function SessionScreen({ store, activeDay, loading, error, aiText, onBack }) {
  const type = activeDay?store.profile.schedule?.[activeDay]:null;
  const color = type?SESSION_COLORS[type]:"#1B6FE8";
  return (
    <div style={{ padding:"0 16px 24px",overflowY:"auto",flex:1 }}>
      <button onClick={onBack} style={{ display:"flex",alignItems:"center",gap:4,padding:"16px 0",background:"none",border:"none",color:"#888",fontSize:14,cursor:"pointer" }}>‹ Back</button>
      {activeDay&&(
        <>
          <div style={{ marginBottom:16,padding:14,borderRadius:10,background:`${color}11`,border:`1px solid ${color}44` }}>
            <div style={{ fontSize:11,color:"#aaa",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:2 }}>{activeDay}</div>
            <div style={{ fontSize:22,fontWeight:800,color:"#1a1a1a" }}>{SESSION_LABELS[type]}</div>
          </div>
          {loading?<Dots/>:aiText?<MarkdownBlock content={aiText}/>:null}
          <ErrorBox message={error}/>
        </>
      )}
    </div>
  );
}

// ── Log Screen ──

function LogScreen({ store, loading, error, aiText, stravaLoading, stravaActivities, onImportStrava, onSaveSession, onBulkSave, onBulkDelete, onAnalyze, editingSession, setEditingSession }) {
  const [successMsg, setSuccessMsg] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [analysisSessionId, setAnalysisSessionId] = useState(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(new Set());

  function toggleSelect(id) {
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  }
  function exitSelectMode() { setSelectMode(false); setSelected(new Set()); }
  function deleteSelected() {
    if (!window.confirm(`Delete ${selected.size} session${selected.size>1?"s":""}?`)) return;
    onBulkDelete([...selected]);
    exitSelectMode();
  }
  function deleteAll() {
    if (!window.confirm(`Delete all ${sessions.length} sessions? This cannot be undone.`)) return;
    onBulkDelete(sessions.map(s=>s.id));
    exitSelectMode();
  }

  const sessions = [...(store.sessions||[])].sort((a,b)=>new Date(b.date)-new Date(a.date));
  const importedStravaIds = sessions.filter(s=>s.stravaId).map(s=>s.stravaId);

  function handleSave(d) {
    onSaveSession({ id:editingSession?.id||Date.now(), ...d, savedAt:new Date().toISOString() });
    setSuccessMsg(editingSession?"Session updated":"Session saved");
    setEditingSession(null); setShowForm(false);
    setTimeout(()=>setSuccessMsg(""),3000);
  }

  function handleBulkSave(sessions) {
    onBulkSave(sessions);
    setSuccessMsg(`${sessions.length} run${sessions.length>1?"s":""} logged`);
    setTimeout(()=>setSuccessMsg(""),3000);
  }

  const activeForm = showForm||editingSession;

  return (
    <div style={{ padding:"0 16px 24px",overflowY:"auto",flex:1 }}>
      <div style={{ padding:"20px 0 14px",borderBottom:"1px solid #f0f0ec",marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"flex-end" }}>
        <div>
          <div style={{ fontSize:24,fontWeight:800,color:"#1a1a1a" }}>Sessions</div>
          <div style={{ fontSize:13,color:"#888",marginTop:3 }}>{sessions.length} logged</div>
        </div>
        {!activeForm&&(
          <div style={{ display:"flex",gap:8 }}>
            {sessions.length>0&&(
              <button onClick={()=>{ if(selectMode) exitSelectMode(); else setSelectMode(true); }}
                style={{ padding:"9px 14px",borderRadius:10,background:selectMode?"#f0f6ff":"none",color:selectMode?"#1B6FE8":"#888",border:`1px solid ${selectMode?"#1B6FE8":"#e0e0e0"}`,fontSize:13,fontWeight:600,cursor:"pointer" }}>
                {selectMode?"Cancel":"Select"}
              </button>
            )}
            {!selectMode&&(
              <button onClick={()=>setShowForm(true)}
                style={{ padding:"9px 16px",borderRadius:10,background:"#1B6FE8",color:"white",border:"none",fontSize:14,fontWeight:700,cursor:"pointer" }}>
                + Log Run
              </button>
            )}
          </div>
        )}
      </div>

      <SuccessBanner message={successMsg} onDismiss={()=>setSuccessMsg("")}/>
      <ErrorBox message={error}/>

      {activeForm&&(
        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:16,fontWeight:700,color:"#1a1a1a",marginBottom:14 }}>{editingSession?"Edit Session":"New Session"}</div>
          <LogForm
            initial={editingSession||null}
            onSave={handleSave}
            onCancel={()=>{ setEditingSession(null); setShowForm(false); }}
            stravaActivities={stravaActivities}
            onImportStrava={onImportStrava}
            stravaLoading={stravaLoading}
            importedStravaIds={importedStravaIds}
            onBulkSave={handleBulkSave}
          />
          <div style={{ height:1,background:"#f0f0ec",margin:"20px 0" }}/>
        </div>
      )}

      {!activeForm&&sessions.length===0&&(
        <div style={{ padding:"48px 20px",textAlign:"center",border:"1px solid #eee",borderRadius:12 }}>
          <div style={{ fontSize:40,marginBottom:12 }}>🏃</div>
          <div style={{ color:"#888",fontSize:15,marginBottom:6 }}>No sessions yet</div>
          <div style={{ color:"#aaa",fontSize:13,marginBottom:16 }}>Log your first run to start tracking.</div>
          <button onClick={()=>setShowForm(true)} style={{ padding:"10px 20px",borderRadius:10,background:"#1B6FE8",color:"white",border:"none",fontSize:14,fontWeight:700,cursor:"pointer" }}>+ Log Run</button>
        </div>
      )}

      {!activeForm&&sessions.length>0&&(
        <div style={{ display:"flex",flexDirection:"column",gap:10,paddingBottom:selectMode?72:0 }}>
          {sessions.map(s=>{
            const isSelected = selected.has(s.id);
            return (
            <div key={s.id}
              onClick={selectMode ? ()=>toggleSelect(s.id) : undefined}
              style={{ padding:14,borderRadius:10,border:`1.5px solid ${isSelected?"#1B6FE8":"#eee"}`,background:isSelected?"#f0f6ff":"#fff",cursor:selectMode?"pointer":"default" }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8 }}>
                <div style={{ display:"flex",alignItems:"flex-start",gap:10,flex:1,minWidth:0 }}>
                  {selectMode&&(
                    <div style={{ width:20,height:20,borderRadius:6,border:`2px solid ${isSelected?"#1B6FE8":"#ccc"}`,background:isSelected?"#1B6FE8":"#fff",flexShrink:0,marginTop:2,display:"flex",alignItems:"center",justifyContent:"center" }}>
                      {isSelected&&<span style={{ color:"#fff",fontSize:13,fontWeight:700,lineHeight:1 }}>✓</span>}
                    </div>
                  )}
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:3,flexWrap:"wrap" }}>
                      <div style={{ width:7,height:7,borderRadius:"50%",background:SESSION_COLORS[s.type]||"#888",flexShrink:0 }}/>
                      <span style={{ fontSize:14,fontWeight:700,color:"#1a1a1a" }}>{SESSION_LABELS[s.type]||s.type}</span>
                      {s.stravaId&&<span style={{ fontSize:10,padding:"2px 6px",borderRadius:4,background:"#FC4C0222",color:"#FC4C02",fontWeight:700 }}>Strava</span>}
                      {s.plannedDay&&s.plannedWeekStart&&(()=>{const p=(store.weekPlans||[]).find(p=>p.weekStart===s.plannedWeekStart);const t=p?.weekGoals?.daySessions?.[s.plannedDay]?.type;return <Chip label={`Plan: ${s.plannedDay}`} color={SESSION_COLORS[t]||"#888780"}/>;})()}
                    </div>
                    <div style={{ fontSize:12,color:"#aaa" }}>
                      {s.date}{s.time?` · ${s.time}`:""}{s.location?` · ${s.location}`:""}
                    </div>
                  </div>
                </div>
                <div style={{ display:"flex",gap:6,flexWrap:"wrap",justifyContent:"flex-end",flexShrink:0 }}>
                  {s.avgPace&&<Chip label={s.avgPace+"/km"} color="#1B6FE8"/>}
                  {s.distance&&<Chip label={s.distance+"km"} color="#7C3AED"/>}
                  {s.score&&<span style={{ fontSize:12,fontWeight:800,padding:"3px 8px",borderRadius:6,background:s.score.value>=8?"#e8f8f0":s.score.value>=6?"#fff8e0":"#fff0f0",color:s.score.value>=8?"#0F6E56":s.score.value>=6?"#b07000":"#c00" }}>{s.score.value}/10</span>}
                </div>
              </div>

              <div style={{ display:"flex",gap:12,flexWrap:"wrap",fontSize:12,color:"#666",marginBottom:s.notes?8:0 }}>
                {s.avgHR&&<span>HR {s.avgHR} bpm</span>}
                {s.maxHR&&<span>max {s.maxHR}</span>}
                {s.cadence&&<span>· {s.cadence} spm</span>}
                {s.elevation&&<span>· +{s.elevation}m</span>}
                {s.rpe&&<span>· RPE {s.rpe}/10</span>}
                {s.te&&<span>· TE {s.te}</span>}
              </div>


              {s.notes&&<div style={{ fontSize:13,color:"#666",margin:"6px 0 8px",padding:"8px 10px",background:"#f9f9f7",borderRadius:6 }}>{s.notes}</div>}

              {!selectMode&&(
                <div style={{ display:"flex",gap:8,marginTop:8 }}>
                  <button onClick={()=>{ setEditingSession(s); setShowForm(false); }}
                    style={{ flex:1,padding:"7px",borderRadius:8,background:"none",color:"#1B6FE8",border:"1px solid #1B6FE822",fontSize:13,fontWeight:600,cursor:"pointer" }}>Edit</button>
                  <button onClick={()=>{ setAnalysisSessionId(s.id); onAnalyze(s); }} disabled={loading&&analysisSessionId===s.id}
                    style={{ flex:1,padding:"7px",borderRadius:8,background:"none",color:"#0F6E56",border:"1px solid #0F6E5622",fontSize:13,fontWeight:600,cursor:"pointer" }}>
                    {loading&&analysisSessionId===s.id?"...":"Analyse"}</button>
                  <button onClick={()=>{ if(window.confirm("Delete this session?")) onSaveSession(null, s.id); }}
                    style={{ flex:1,padding:"7px",borderRadius:8,background:"none",color:"#c00",border:"1px solid #fcc",fontSize:13,fontWeight:600,cursor:"pointer" }}>Delete</button>
                </div>
              )}

              {s.analysis&&analysisSessionId===s.id&&!loading&&(
                <div style={{ marginTop:12,paddingTop:12,borderTop:"1px solid #f0f0ec" }}>
                  <MarkdownBlock content={s.analysis} small/>
                </div>
              )}
            </div>
          );})}
        </div>
      )}
      {loading&&<Dots/>}

      {/* Select mode action bar */}
      {selectMode&&(
        <div style={{ position:"sticky",bottom:0,left:0,right:0,background:"#fff",borderTop:"1px solid #eee",padding:"12px 16px",display:"flex",gap:8,alignItems:"center" }}>
          <button onClick={()=>{ const allIds=new Set(sessions.map(s=>s.id)); setSelected(selected.size===sessions.length?new Set():allIds); }}
            style={{ fontSize:13,color:"#555",background:"#f5f5f5",border:"none",borderRadius:8,padding:"8px 14px",cursor:"pointer",fontWeight:600 }}>
            {selected.size===sessions.length?"Deselect all":"Select all"}
          </button>
          <button
            onClick={deleteSelected}
            disabled={selected.size===0}
            style={{ flex:1,padding:"10px",borderRadius:8,background:selected.size>0?"#c00":"#f5f5f5",color:selected.size>0?"#fff":"#bbb",border:"none",fontSize:13,fontWeight:700,cursor:selected.size>0?"pointer":"default" }}>
            {selected.size>0?`Delete ${selected.size} selected`:"Select sessions"}
          </button>
          <button onClick={deleteAll}
            style={{ fontSize:13,color:"#c00",background:"none",border:"1px solid #fcc",borderRadius:8,padding:"8px 14px",cursor:"pointer",fontWeight:600,whiteSpace:"nowrap" }}>
            Delete all
          </button>
        </div>
      )}
    </div>
  );
}

// ── Progress Screen ──

const METRIC_OPTIONS = [
  { id:"distance", label:"Distance", icon:"📏" },
  { id:"pace", label:"Pace", icon:"⚡" },
  { id:"hr", label:"Heart rate", icon:"❤️" },
  { id:"cadence", label:"Cadence", icon:"🔄" },
  { id:"elevation", label:"Elevation", icon:"⛰️" },
  { id:"te", label:"Training effect", icon:"📈" },
];

function ProgressScreen({ store }) {
  const [activeMetrics, setActiveMetrics] = useState(["distance","pace","hr","cadence"]);
  const p = store.profile;

  // Goal from profile — always compute these
  const goalLabel = p.goal === "Custom..." ? (p.goalCustom||"Custom goal") : (p.goal||null);
  const goalTime = p.goalTime || null;
  const goalDate = p.goalDate || null;
  const racePace = p.racePace || null;           // target race pace e.g. "5:15"
  const thresholdPace = p.thresholdPace || null; // threshold e.g. "5:00"
  const easyHR = p.easyHR || null;               // easy HR range e.g. "130-140"
  const daysToRace = goalDate ? Math.ceil((new Date(goalDate)-new Date())/(1000*60*60*24)) : null;

  const noProfile = !goalLabel && !racePace;

  const allSessions = [...(store.sessions||[])].sort((a,b)=>new Date(a.date)-new Date(b.date));
  const runSessions = allSessions.filter(s=>s.type&&s.type.startsWith("run"));

  const weekStart = getCurrentWeekStart();
  const weekPlan = (store.weekPlans||[]).find(p=>p.weekStart===weekStart)??null;
  const weekGoals = weekPlan?.weekGoals;
  const isCurrentWeekPlan = !!weekPlan;

  // Include runs linked to this week's plan OR runs whose date falls in this calendar week (unlinked)
  const thisWeekRuns = runSessions.filter(s=>
    s.plannedWeekStart===weekStart ||
    (!s.plannedWeekStart && getWeekStart(s.date)===weekStart)
  );
  const recentRuns = runSessions.slice(-10);

  // Actuals this week
  const totalDistThisWeek = thisWeekRuns.reduce((a,s)=>a+(parseFloat(s.distance)||0),0);
  const totalElevThisWeek = thisWeekRuns.reduce((a,s)=>a+(parseFloat(s.elevation)||0),0);
  const avgPaceThisWeek = (()=>{
    const paces = thisWeekRuns.filter(s=>s.avgPace).map(s=>parsePace(s.avgPace)).filter(Boolean);
    return paces.length ? secsTopace(paces.reduce((a,b)=>a+b,0)/paces.length) : null;
  })();
  const avgHRThisWeek = (()=>{
    const hrs = thisWeekRuns.filter(s=>s.avgHR).map(s=>Number(s.avgHR)).filter(Boolean);
    return hrs.length ? Math.round(hrs.reduce((a,b)=>a+b,0)/hrs.length) : null;
  })();

  // Trend data
  const latestRun = recentRuns.filter(s=>s.avgPace).slice(-1)[0];
  const latestPace = latestRun?.avgPace;
  const goalPaceSecs = parsePace(racePace);
  const latestPaceSecs = parsePace(latestPace);
  const paceGapSecs = goalPaceSecs && latestPaceSecs ? latestPaceSecs - goalPaceSecs : null;

  // Pace improvement over all logged runs
  const firstPace = runSessions.filter(s=>s.avgPace).slice(0,1)[0]?.avgPace;
  const firstPaceSecs = parsePace(firstPace);
  const paceImprovement = firstPaceSecs && latestPaceSecs ? firstPaceSecs - latestPaceSecs : null; // positive = improved

  // HR trend over recent runs
  const hrTrendRuns = recentRuns.filter(s=>s.avgHR).slice(-6);
  const hrTrend = hrTrendRuns.length >= 3
    ? Number(hrTrendRuns.slice(-1)[0].avgHR) - Number(hrTrendRuns[0].avgHR)
    : null;

  function toggleMetric(id) {
    setActiveMetrics(prev=>prev.includes(id)?prev.filter(m=>m!==id):[...prev,id]);
  }

  // ── Goal Summary Card ──
  function GoalSummary() {
    return (
      <div style={{ padding:14,borderRadius:12,background:"#f0f6ff",border:"1.5px solid #1B6FE833",marginBottom:16 }}>
        <div style={{ fontSize:11,color:"#1B6FE8",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8 }}>Race goal</div>
        {noProfile ? (
          <div style={{ fontSize:13,color:"#888" }}>Set your goal in Profile to track progress here.</div>
        ) : (
          <>
            <div style={{ fontSize:20,fontWeight:800,color:"#1a1a1a",marginBottom:4 }}>
              {goalLabel||"Goal not set"}{goalTime ? <span style={{ fontSize:14,fontWeight:500,color:"#666" }}> in {goalTime}</span> : null}
            </div>
            {goalDate && (
              <div style={{ fontSize:13,color:"#666",marginBottom:8 }}>
                {new Date(goalDate).toLocaleDateString("en-AU",{day:"numeric",month:"long",year:"numeric"})}
                {daysToRace !== null && daysToRace > 0 && <span style={{ marginLeft:8,padding:"2px 8px",borderRadius:6,background:"#1B6FE822",color:"#1B6FE8",fontWeight:700,fontSize:11 }}>{daysToRace}d to go</span>}
                {daysToRace === 0 && <span style={{ marginLeft:8,padding:"2px 8px",borderRadius:6,background:"#fff8e0",color:"#b07000",fontWeight:700,fontSize:11 }}>Race day! 🏁</span>}
                {daysToRace !== null && daysToRace < 0 && <span style={{ marginLeft:8,padding:"2px 8px",borderRadius:6,background:"#e8f8f0",color:"#0a6640",fontWeight:700,fontSize:11 }}>Completed ✓</span>}
              </div>
            )}
            <div style={{ display:"flex",gap:10,flexWrap:"wrap" }}>
              {racePace && <div style={{ padding:"6px 10px",borderRadius:8,background:"#fff",border:"1px solid #1B6FE822" }}><div style={{ fontSize:10,color:"#aaa",marginBottom:1 }}>Target pace</div><div style={{ fontSize:14,fontWeight:700,color:"#1B6FE8" }}>{racePace}/km</div></div>}
              {thresholdPace && <div style={{ padding:"6px 10px",borderRadius:8,background:"#fff",border:"1px solid #1B6FE822" }}><div style={{ fontSize:10,color:"#aaa",marginBottom:1 }}>Threshold</div><div style={{ fontSize:14,fontWeight:700,color:"#1B6FE8" }}>{thresholdPace}/km</div></div>}
              {easyHR && <div style={{ padding:"6px 10px",borderRadius:8,background:"#fff",border:"1px solid #1B6FE822" }}><div style={{ fontSize:10,color:"#aaa",marginBottom:1 }}>Easy HR</div><div style={{ fontSize:14,fontWeight:700,color:"#1B6FE8" }}>{easyHR} bpm</div></div>}
            </div>
            {paceImprovement !== null && runSessions.length >= 3 && (
              <div style={{ marginTop:10,padding:"8px 12px",borderRadius:8,background:paceImprovement>0?"#e8f8f0":"#fff8e0",display:"flex",alignItems:"center",gap:8 }}>
                <span style={{ fontSize:18 }}>{paceImprovement>0?"📉":"📈"}</span>
                <span style={{ fontSize:13,fontWeight:600,color:paceImprovement>0?"#0a6640":"#b07000" }}>
                  {paceImprovement>0
                    ? `${secsTopace(paceImprovement)} faster since first run`
                    : `${secsTopace(Math.abs(paceImprovement))} slower than first run`}
                </span>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // ── Week Planned vs Actual ──
  function WeekComparison() {
    if (!isCurrentWeekPlan || !weekGoals) return null;
    return (
      <div style={{ padding:14,borderRadius:10,border:"1px solid #eee",background:"#fff",marginBottom:12 }}>
        <div style={{ fontSize:14,fontWeight:700,color:"#1a1a1a",marginBottom:12 }}>This week — planned vs actual</div>
        <GoalBar label="Total distance" actual={parseFloat(totalDistThisWeek.toFixed(1))} goal={parseFloat(weekGoals.totalDistance)} unit="km" higherIsBetter/>
        {weekGoals.longRunDistance && (
          <GoalBar label="Long run" actual={parseFloat(thisWeekRuns.filter(s=>s.type==="run_long").reduce((a,s)=>a+(parseFloat(s.distance)||0),0).toFixed(1))} goal={parseFloat(weekGoals.longRunDistance)} unit="km" higherIsBetter/>
        )}
        {weekGoals.targetPace && avgPaceThisWeek && (
          <div style={{ marginBottom:14 }}>
            <div style={{ display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:5 }}>
              <span style={{ fontWeight:600,color:"#1a1a1a" }}>Avg pace</span>
              <span style={{ fontWeight:700,color:"#1a1a1a" }}>{avgPaceThisWeek}<span style={{ color:"#aaa",fontWeight:400 }}> / plan {weekGoals.targetPace}/km</span></span>
            </div>
            <div style={{ fontSize:12,fontWeight:600,color:parsePace(avgPaceThisWeek)<=parsePace(weekGoals.targetPace)?"#0F6E56":"#c00" }}>
              {parsePace(avgPaceThisWeek)<=parsePace(weekGoals.targetPace)?"On target ✓":"Behind planned pace"}
            </div>
          </div>
        )}
        <GoalBar label="Runs completed" actual={thisWeekRuns.length} goal={weekGoals.runsPlanned||3} unit="" higherIsBetter/>
        {(()=>{
          const scored = thisWeekRuns.filter(s=>s.score?.value!=null&&s.plannedWeekStart===weekStart);
          const avg = scored.length ? scored.reduce((a,s)=>a+s.score.value,0)/scored.length : null;
          if (avg!==null) return (
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 12px",borderRadius:8,marginTop:4,background:avg>=8?"#e8f8f0":avg>=6?"#fff8e0":"#fff0f0" }}>
              <span style={{ fontSize:13,fontWeight:600,color:"#1a1a1a" }}>Week score ({scored.length} session{scored.length!==1?"s":""})</span>
              <span style={{ fontSize:18,fontWeight:800,color:avg>=8?"#0F6E56":avg>=6?"#b07000":"#c00" }}>{avg.toFixed(1)}/10</span>
            </div>
          );
          if (thisWeekRuns.length>0) return <div style={{ fontSize:12,color:"#aaa",marginTop:4 }}>Analyse sessions to see week score</div>;
          return null;
        })()}
      </div>
    );
  }

  // ── Total Training Block ──
  function BlockComparison() {
    const plans = store.weekPlans||[];
    if (!plans.length) return null;
    // Planned totals across all stored weeks
    const plannedKm = plans.reduce((a,p)=>a+(parseFloat(p.weekGoals?.totalDistance)||0),0);
    const plannedRuns = plans.reduce((a,p)=>{
      const ds = p.weekGoals?.daySessions||{};
      return a+Object.values(ds).filter(d=>d?.type?.startsWith("run")).length;
    },0);
    // Actual totals — all linked run sessions (any week)
    const linkedRuns = runSessions.filter(s=>s.plannedWeekStart);
    const actualKm = linkedRuns.reduce((a,s)=>a+(parseFloat(s.distance)||0),0);
    const actualRuns = linkedRuns.length;
    // Weeks coverage
    const weeksWithPlan = plans.length;
    const weeksWithRun = new Set(linkedRuns.map(s=>s.plannedWeekStart)).size;
    const pct = plannedKm>0 ? Math.min(100,Math.round((actualKm/plannedKm)*100)) : 0;
    return (
      <div style={{ padding:14,borderRadius:10,border:"1px solid #eee",background:"#fff",marginBottom:12 }}>
        <div style={{ fontSize:14,fontWeight:700,color:"#1a1a1a",marginBottom:12 }}>Training block — total progress</div>
        {/* Progress bar */}
        <div style={{ marginBottom:14 }}>
          <div style={{ display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:5 }}>
            <span style={{ fontWeight:600,color:"#1a1a1a" }}>Distance logged</span>
            <span style={{ fontWeight:700 }}><span style={{ color:"#1B6FE8" }}>{actualKm.toFixed(0)}km</span><span style={{ color:"#aaa",fontWeight:400 }}> / {plannedKm.toFixed(0)}km</span></span>
          </div>
          <div style={{ height:8,borderRadius:4,background:"#f0f0ec",overflow:"hidden" }}>
            <div style={{ height:"100%",width:`${pct}%`,borderRadius:4,background:pct>=80?"#0F6E56":pct>=50?"#1B6FE8":"#b07000",transition:"width 0.4s" }}/>
          </div>
          <div style={{ fontSize:11,color:"#aaa",marginTop:3 }}>{pct}% of planned volume completed</div>
        </div>
        {/* Stats row */}
        <div style={{ display:"flex",gap:8 }}>
          <div style={{ flex:1,padding:"10px 10px",borderRadius:8,background:"#f8f8f6",textAlign:"center" }}>
            <div style={{ fontSize:18,fontWeight:800,color:"#1B6FE8" }}>{actualRuns}<span style={{ fontSize:12,color:"#aaa",fontWeight:400 }}>/{plannedRuns}</span></div>
            <div style={{ fontSize:11,color:"#888" }}>Runs logged</div>
          </div>
          <div style={{ flex:1,padding:"10px 10px",borderRadius:8,background:"#f8f8f6",textAlign:"center" }}>
            <div style={{ fontSize:18,fontWeight:800,color:"#1B6FE8" }}>{weeksWithRun}<span style={{ fontSize:12,color:"#aaa",fontWeight:400 }}>/{weeksWithPlan}</span></div>
            <div style={{ fontSize:11,color:"#888" }}>Weeks active</div>
          </div>
          {(()=>{
            const scored = linkedRuns.filter(s=>s.score?.value!=null);
            if (!scored.length) return null;
            const avg = scored.reduce((a,s)=>a+s.score.value,0)/scored.length;
            return (
              <div style={{ flex:1,padding:"10px 10px",borderRadius:8,background:"#f8f8f6",textAlign:"center" }}>
                <div style={{ fontSize:18,fontWeight:800,color:avg>=8?"#0F6E56":avg>=6?"#b07000":"#c00" }}>{avg.toFixed(1)}<span style={{ fontSize:12,color:"#aaa",fontWeight:400 }}>/10</span></div>
                <div style={{ fontSize:11,color:"#888" }}>Avg score</div>
              </div>
            );
          })()}
        </div>
      </div>
    );
  }

  // ── Pace trend chart ──
  function PaceTrend({ runs }) {
    const data = runs.filter(s=>s.avgPace&&parsePace(s.avgPace)).slice(-8);
    if (data.length < 2) return <div style={{ fontSize:12,color:"#aaa",marginTop:8 }}>Need 2+ runs to show trend.</div>;
    const paces = data.map(s=>parsePace(s.avgPace));
    const labels = data.map(s=>s.date.slice(5));
    const goalSecs = goalPaceSecs;
    const allValues = goalSecs ? [...paces, goalSecs] : paces;
    const min = Math.min(...allValues)-20, max = Math.max(...allValues)+20;
    const W=300, H=70;
    const x = (i) => (i/(paces.length-1))*W;
    const y = (v) => H-((v-min)/(max-min))*H;
    const pts = paces.map((p,i)=>`${x(i)},${y(p)}`).join(" ");
    const goalY = goalSecs ? y(goalSecs) : null;
    return (
      <div style={{ marginTop:12 }}>
        <div style={{ fontSize:11,color:"#aaa",marginBottom:4 }}>Pace over last {data.length} runs — lower is faster</div>
        <svg width="100%" viewBox={`0 0 ${W} ${H+22}`} style={{ overflow:"visible" }}>
          {goalY!==null&&goalY>=0&&goalY<=H&&<>
            <line x1="0" y1={goalY} x2={W} y2={goalY} stroke="#0F6E56" strokeWidth="1.5" strokeDasharray="5 3"/>
            <text x={W} y={goalY-4} fontSize="10" fill="#0F6E56" textAnchor="end">goal {racePace}</text>
          </>}
          <polyline points={pts} fill="none" stroke="#1B6FE8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          {paces.map((p,i)=>(
            <g key={i}>
              <circle cx={x(i)} cy={y(p)} r="4" fill="#1B6FE8"/>
              <text x={x(i)} y={H+16} fontSize="9" fill="#aaa" textAnchor="middle">{labels[i]}</text>
            </g>
          ))}
        </svg>
      </div>
    );
  }

  // ── Metric cards ──
  function MetricCard({ id }) {
    const base = { padding:"14px",borderRadius:10,border:"1px solid #eee",background:"#fff",marginBottom:12 };
    switch(id) {
      case "distance": return (
        <div style={base}>
          <div style={{ fontSize:11,color:"#888",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:8 }}>Distance</div>
          {recentRuns.filter(s=>s.distance).length===0 ? <div style={{ fontSize:13,color:"#aaa" }}>No distance logged yet</div> : (
            <>
              <div style={{ display:"flex",gap:16,marginBottom:10 }}>
                <div>
                  <div style={{ fontSize:11,color:"#aaa",marginBottom:2 }}>This week</div>
                  <div style={{ fontSize:22,fontWeight:800,color:"#1a1a1a" }}>{totalDistThisWeek.toFixed(1)}<span style={{ fontSize:13,color:"#888" }}>km</span></div>
                </div>
                {weekGoals?.totalDistance && (
                  <div>
                    <div style={{ fontSize:11,color:"#aaa",marginBottom:2 }}>Week plan</div>
                    <div style={{ fontSize:22,fontWeight:800,color:"#1B6FE8" }}>{weekGoals.totalDistance}<span style={{ fontSize:13,color:"#888" }}>km</span></div>
                  </div>
                )}
                <div>
                  <div style={{ fontSize:11,color:"#aaa",marginBottom:2 }}>Total logged</div>
                  <div style={{ fontSize:22,fontWeight:800,color:"#1a1a1a" }}>{runSessions.reduce((a,s)=>a+(parseFloat(s.distance)||0),0).toFixed(0)}<span style={{ fontSize:13,color:"#888" }}>km</span></div>
                </div>
              </div>
            </>
          )}
        </div>
      );
      case "pace": return (
        <div style={base}>
          <div style={{ fontSize:11,color:"#888",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6 }}>Pace vs race goal</div>
          {!latestPace ? <div style={{ fontSize:13,color:"#aaa" }}>No pace data yet</div> : (
            <>
              <div style={{ display:"flex",justifyContent:"space-between",marginBottom:10 }}>
                <div>
                  <div style={{ fontSize:11,color:"#aaa",marginBottom:2 }}>Latest run</div>
                  <div style={{ fontSize:22,fontWeight:800,color:"#1a1a1a" }}>{latestPace}<span style={{ fontSize:13,color:"#888" }}>/km</span></div>
                </div>
                {racePace ? (
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:11,color:"#aaa",marginBottom:2 }}>Race goal</div>
                    <div style={{ fontSize:22,fontWeight:800,color:"#1B6FE8" }}>{racePace}<span style={{ fontSize:13,color:"#888" }}>/km</span></div>
                  </div>
                ) : (
                  <div style={{ textAlign:"right",fontSize:12,color:"#aaa" }}>Set race pace in Profile</div>
                )}
              </div>
              {paceGapSecs !== null && (
                <div style={{ padding:"8px 12px",borderRadius:8,background:paceGapSecs<=0?"#e8f8f0":"#fff8e0",display:"inline-block",marginBottom:10 }}>
                  <span style={{ fontSize:13,fontWeight:700,color:paceGapSecs<=0?"#0a6640":"#b07000" }}>
                    {paceGapSecs<=0
                      ? `✓ ${secsTopace(Math.abs(paceGapSecs))} ahead of race goal`
                      : `${secsTopace(Math.abs(paceGapSecs))} behind race goal`}
                  </span>
                </div>
              )}
              {!racePace && <div style={{ fontSize:12,color:"#aaa",marginBottom:8 }}>Add race pace in Profile to see gap</div>}
              <PaceTrend runs={recentRuns}/>
            </>
          )}
        </div>
      );
      case "hr": return (
        <div style={base}>
          <div style={{ fontSize:11,color:"#888",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6 }}>Heart rate</div>
          {recentRuns.filter(s=>s.avgHR).length===0 ? <div style={{ fontSize:13,color:"#aaa" }}>No HR data yet</div> : (
            <>
              <div style={{ display:"flex",gap:16,marginBottom:8 }}>
                {avgHRThisWeek && <div><div style={{ fontSize:11,color:"#aaa",marginBottom:2 }}>This week avg</div><div style={{ fontSize:22,fontWeight:800,color:"#1a1a1a" }}>{avgHRThisWeek}<span style={{ fontSize:13,color:"#888" }}> bpm</span></div></div>}
                {easyHR && <div><div style={{ fontSize:11,color:"#aaa",marginBottom:2 }}>Easy zone</div><div style={{ fontSize:22,fontWeight:800,color:"#1B6FE8" }}>{easyHR}<span style={{ fontSize:13,color:"#888" }}> bpm</span></div></div>}
              </div>
              {hrTrend !== null && (
                <div style={{ fontSize:13,fontWeight:600,color:hrTrend<0?"#0a6640":"#c00" }}>
                  {hrTrend<0
                    ? `↓ HR down ${Math.abs(Math.round(hrTrend))} bpm over recent runs — aerobic fitness improving`
                    : `↑ HR up ${Math.abs(Math.round(hrTrend))} bpm over recent runs — check recovery`}
                </div>
              )}
            </>
          )}
        </div>
      );
      case "cadence": return (
        <div style={base}>
          <div style={{ fontSize:11,color:"#888",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6 }}>Cadence</div>
          {recentRuns.filter(s=>s.cadence).length===0 ? <div style={{ fontSize:13,color:"#aaa" }}>No cadence data yet</div> : (
            <>
              <div style={{ display:"flex",justifyContent:"space-between",marginBottom:8 }}>
                <div><div style={{ fontSize:11,color:"#aaa",marginBottom:2 }}>Latest</div><div style={{ fontSize:22,fontWeight:800,color:"#1a1a1a" }}>{recentRuns.filter(s=>s.cadence).slice(-1)[0]?.cadence||"—"}<span style={{ fontSize:13,color:"#888" }}> spm</span></div></div>
                <div style={{ textAlign:"right" }}><div style={{ fontSize:11,color:"#aaa",marginBottom:2 }}>Target</div><div style={{ fontSize:22,fontWeight:800,color:"#1B6FE8" }}>168–172<span style={{ fontSize:13,color:"#888" }}> spm</span></div></div>
              </div>
              {(()=>{ const c=Number(recentRuns.filter(s=>s.cadence).slice(-1)[0]?.cadence); return c ? <div style={{ fontSize:13,fontWeight:600,color:c>=168?"#0a6640":"#b07000" }}>{c>=168?"✓ On target":"Below target — shorten stride, increase frequency"}</div>:null; })()}
            </>
          )}
        </div>
      );
      case "elevation": return (
        <div style={base}>
          <div style={{ fontSize:11,color:"#888",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6 }}>Elevation</div>
          {totalElevThisWeek===0&&runSessions.filter(s=>s.elevation).length===0 ? <div style={{ fontSize:13,color:"#aaa" }}>No elevation data yet</div> : (
            <div style={{ display:"flex",gap:16 }}>
              {totalElevThisWeek>0&&<div><div style={{ fontSize:11,color:"#aaa",marginBottom:2 }}>This week</div><div style={{ fontSize:22,fontWeight:800,color:"#1a1a1a" }}>+{Math.round(totalElevThisWeek)}<span style={{ fontSize:13,color:"#888" }}>m</span></div></div>}
              <div><div style={{ fontSize:11,color:"#aaa",marginBottom:2 }}>Total logged</div><div style={{ fontSize:22,fontWeight:800,color:"#1a1a1a" }}>+{Math.round(runSessions.reduce((a,s)=>a+(parseFloat(s.elevation)||0),0))}<span style={{ fontSize:13,color:"#888" }}>m</span></div></div>
            </div>
          )}
        </div>
      );
      case "te": return (
        <div style={base}>
          <div style={{ fontSize:11,color:"#888",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6 }}>Training effect</div>
          {(()=>{ const te=recentRuns.filter(s=>s.te).slice(-1)[0]?.te; return !te ? <div style={{ fontSize:13,color:"#aaa" }}>No TE data yet — fill in Aerobic TE when logging runs</div> : (
            <>
              <div style={{ fontSize:22,fontWeight:800,color:"#1a1a1a",marginBottom:8 }}>{te}<span style={{ fontSize:13,color:"#888" }}> / 5.0</span></div>
              <div style={{ background:"#f0f0ec",borderRadius:6,height:8,marginBottom:8,overflow:"hidden" }}><div style={{ height:"100%",background:"#1B6FE8",borderRadius:6,width:`${Math.min(Number(te)/5*100,100)}%` }}/></div>
              <div style={{ fontSize:13,color:"#666" }}>{Number(te)>=4?"High aerobic stimulus — well targeted":Number(te)>=3?"Moderate — good base building":"Low — increase intensity or duration"}</div>
            </>
          ); })()}
        </div>
      );
      default: return null;
    }
  }

  return (
    <div style={{ padding:"0 16px 24px",overflowY:"auto",flex:1 }}>
      <div style={{ padding:"20px 0 14px",borderBottom:"1px solid #f0f0ec",marginBottom:16 }}>
        <div style={{ fontSize:24,fontWeight:800,color:"#1a1a1a" }}>Progress</div>
        <div style={{ fontSize:13,color:"#888",marginTop:3 }}>{runSessions.length} runs logged</div>
      </div>

      <GoalSummary/>

      {runSessions.length===0&&(
        <div style={{ padding:"32px 20px",textAlign:"center",border:"1px solid #eee",borderRadius:12,marginBottom:16 }}>
          <div style={{ fontSize:13,color:"#aaa" }}>Log your first run to see progress metrics here.</div>
        </div>
      )}

      <WeekComparison/>

      <BlockComparison/>

      <div style={{ marginBottom:16 }}>
        <div style={{ fontSize:11,color:"#888",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:8 }}>Metrics</div>
        <div style={{ display:"flex",flexWrap:"wrap",gap:8 }}>
          {METRIC_OPTIONS.map(m=>(
            <button key={m.id} onClick={()=>toggleMetric(m.id)}
              style={{ padding:"7px 12px",borderRadius:20,border:`1.5px solid ${activeMetrics.includes(m.id)?"#1B6FE8":"#eee"}`,background:activeMetrics.includes(m.id)?"#f0f6ff":"#fff",color:activeMetrics.includes(m.id)?"#1B6FE8":"#888",fontSize:12,fontWeight:activeMetrics.includes(m.id)?700:400,cursor:"pointer" }}>
              {m.icon} {m.label}
            </button>
          ))}
        </div>
      </div>

      {activeMetrics.map(id=><MetricCard key={id} id={id}/>)}
    </div>
  );
}

// ── Profile Screen ──

function ProfileScreen({ store, persist, onSaved }) {
  const [draft, setDraft] = useState(()=>({...defaultProfile,...store.profile}));
  const set = (k,v) => setDraft(prev=>({...prev,[k]:v}));
  const setSchedule = (day,val) => setDraft(prev=>({...prev,schedule:{...prev.schedule,[day]:val}}));
  const toggleInjury = (inj,checked) => setDraft(prev=>({...prev,injuries:checked?[...(prev.injuries||[]),inj]:(prev.injuries||[]).filter(i=>i!==inj)}));
  const [scheduleEditMode, setScheduleEditMode] = useState(false);
  const [schedulePickerDay, setSchedulePickerDay] = useState(null);
  // Race pace: auto or manual override
  const autoRacePace = computeRacePace(draft.goal, draft.goalTime);
  const [racePaceOverride, setRacePaceOverride] = useState(()=>{
    // Start in override mode only if a manual value exists that differs from computed
    const auto = computeRacePace(store.profile.goal, store.profile.goalTime);
    return !!(store.profile.racePace && store.profile.racePace !== auto);
  });

  return (
    <div style={{ padding:"0 16px 24px",overflowY:"auto",flex:1 }}>
      <div style={{ padding:"20px 0 14px",borderBottom:"1px solid #f0f0ec",marginBottom:16 }}>
        <div style={{ fontSize:24,fontWeight:800,color:"#1a1a1a" }}>Profile</div>
        <div style={{ fontSize:13,color:"#888",marginTop:3 }}>Everything adapts to your goal and benchmarks.</div>
      </div>
      <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
        <Field label="Name" value={draft.name} onChange={v=>set("name",v)} placeholder="Your name"/>
        <div>
          <SectionLabel>Race goal</SectionLabel>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:draft.goal==="Custom..."?10:0 }}>
            {RACE_GOALS.map(g=>(
              <button key={g} onClick={()=>set("goal",g)}
                style={{ padding:"10px 6px",borderRadius:8,border:`1.5px solid ${draft.goal===g?"#1B6FE8":"#eee"}`,background:draft.goal===g?"#f0f6ff":"#fff",color:draft.goal===g?"#1B6FE8":"#1a1a1a",fontSize:13,fontWeight:draft.goal===g?700:400,cursor:"pointer" }}>
                {g}
              </button>
            ))}
          </div>
          {draft.goal==="Custom..."&&<Field label="Custom goal" value={draft.goalCustom} onChange={v=>set("goalCustom",v)} placeholder="e.g. 30km trail race"/>}
        </div>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
          {/* Goal time — editable when time is source; read-only (derived from pace) when pace is source */}
          <div>
            <label style={{ fontSize:11,fontWeight:700,color:"#aaa",textTransform:"uppercase",letterSpacing:"0.06em",display:"block",marginBottom:5 }}>Goal time</label>
            {racePaceOverride && computeGoalTime(draft.goal, draft.racePace) ? (
              <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"11px 12px",borderRadius:8,border:"1px solid #e0e0dc",background:"#f8f8f6" }}>
                <span style={{ fontSize:15,color:"#1a1a1a",fontWeight:600 }}>{computeGoalTime(draft.goal, draft.racePace)}</span>
                <button onClick={()=>{ set("racePace",""); setRacePaceOverride(false); }}
                  style={{ fontSize:11,color:"#1B6FE8",background:"none",border:"none",cursor:"pointer",padding:0 }}>Edit</button>
              </div>
            ) : (
              <input value={draft.goalTime} onChange={e=>set("goalTime",e.target.value)} placeholder="e.g. 1:45:00" inputMode="text"
                style={{ width:"100%",padding:"11px 12px",borderRadius:8,border:"1px solid #e0e0dc",background:"#fff",color:"#1a1a1a",fontSize:15,outline:"none",boxSizing:"border-box" }}/>
            )}
          </div>
          <Field label="Race date" value={draft.goalDate} onChange={v=>set("goalDate",v)} type="date"/>
        </div>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
          <Field label="Threshold pace" value={draft.thresholdPace} onChange={v=>set("thresholdPace",v)} placeholder="5:00"/>
          <div>
            <label style={{ fontSize:11,fontWeight:700,color:"#aaa",textTransform:"uppercase",letterSpacing:"0.06em",display:"block",marginBottom:5 }}>Race pace</label>
            {!racePaceOverride && autoRacePace ? (
              <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"11px 12px",borderRadius:8,border:"1px solid #e0e0dc",background:"#f8f8f6" }}>
                <span style={{ fontSize:15,color:"#1a1a1a",fontWeight:600 }}>{autoRacePace}/km</span>
                <button onClick={()=>{ set("racePace",autoRacePace); setRacePaceOverride(true); }}
                  style={{ fontSize:11,color:"#1B6FE8",background:"none",border:"none",cursor:"pointer",padding:0 }}>Edit</button>
              </div>
            ) : (
              <div>
                <input value={draft.racePace}
                  onChange={e=>{ set("racePace",e.target.value); const gt=computeGoalTime(draft.goal,e.target.value); if(gt) set("goalTime",gt); }}
                  placeholder={autoRacePace||"5:15"} inputMode="text"
                  style={{ width:"100%",padding:"11px 12px",borderRadius:8,border:"1px solid #1B6FE855",background:"#fff",color:"#1a1a1a",fontSize:15,outline:"none",boxSizing:"border-box" }}/>
                {autoRacePace && <button onClick={()=>{ set("racePace",""); setRacePaceOverride(false); }}
                  style={{ fontSize:11,color:"#aaa",background:"none",border:"none",cursor:"pointer",marginTop:4,padding:0 }}>← Auto ({autoRacePace}/km)</button>}
              </div>
            )}
          </div>
          <Field label="Long run pace" value={draft.longRunPace} onChange={v=>set("longRunPace",v)} placeholder="6:20"/>
          <Field label="Easy HR (bpm)" value={draft.easyHR} onChange={v=>set("easyHR",v)} placeholder="130-140"/>
        </div>
        <div>
          <SectionLabel>Experience</SectionLabel>
          <select value={draft.experience} onChange={e=>set("experience",e.target.value)}
            style={{ width:"100%",padding:"11px 12px",borderRadius:8,border:"1px solid #e0e0dc",background:"#fff",color:"#1a1a1a",fontSize:15,outline:"none" }}>
            <option value="">Select level...</option>
            <option value="recreational">Recreational</option>
            <option value="competitive_recreational">Competitive recreational</option>
            <option value="club_athlete">Club athlete</option>
          </select>
        </div>
        <div>
          <SectionLabel>Injuries</SectionLabel>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:6 }}>
            {["Posterior tibial tendon","Achilles","IT band","Plantar fascia","Knee","Hip flexor"].map(inj=>(
              <label key={inj} style={{ display:"flex",alignItems:"center",gap:8,padding:"9px 10px",fontSize:13,color:"#1a1a1a",border:"1px solid #eee",borderRadius:8,cursor:"pointer",background:(draft.injuries||[]).includes(inj)?"#f0f6ff":"#fff" }}>
                <input type="checkbox" checked={(draft.injuries||[]).includes(inj)} onChange={e=>toggleInjury(inj,e.target.checked)} style={{ accentColor:"#1B6FE8" }}/>
                <span style={{ fontSize:12 }}>{inj}</span>
              </label>
            ))}
          </div>
        </div>
        <div>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10 }}>
            <span style={{ fontSize:11,color:"#888",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.07em" }}>Weekly Schedule</span>
            {scheduleEditMode
              ? <button onClick={()=>{ setScheduleEditMode(false); setSchedulePickerDay(null); }}
                  style={{ fontSize:12,fontWeight:700,color:"#1B6FE8",background:"#f0f6ff",border:"none",borderRadius:6,padding:"4px 10px",cursor:"pointer" }}>Done</button>
              : <button onClick={()=>setScheduleEditMode(true)}
                  style={{ fontSize:12,color:"#1B6FE8",background:"none",border:"none",cursor:"pointer",padding:0 }}>Edit</button>
            }
          </div>
          {DAY_LABELS.map(day=>{
            const type = draft.schedule?.[day]||"rest";
            const color = SESSION_COLORS[type]||"#888780";
            const label = SESSION_LABELS[type]||type;
            const isOpen = scheduleEditMode && schedulePickerDay===day;
            return (
              <div key={day} style={{ marginBottom:6,borderRadius:8,border:isOpen?`1.5px solid ${color}`:"1px solid #eee",overflow:"hidden" }}>
                <div onClick={()=>scheduleEditMode&&setSchedulePickerDay(isOpen?null:day)}
                  style={{ display:"flex",alignItems:"center",gap:10,padding:"10px 12px",cursor:scheduleEditMode?"pointer":"default",background:isOpen?`${color}0d`:"#fff" }}>
                  <div style={{ width:8,height:8,borderRadius:"50%",background:color,flexShrink:0 }}/>
                  <span style={{ fontSize:12,fontWeight:700,width:34,color:"#aaa",textTransform:"uppercase",letterSpacing:"0.05em" }}>{day}</span>
                  <span style={{ fontSize:14,color:"#1a1a1a",flex:1 }}>{label}</span>
                  {scheduleEditMode&&<span style={{ fontSize:11,color:isOpen?color:"#ccc" }}>{isOpen?"▾":"✎"}</span>}
                </div>
                {isOpen&&(
                  <div style={{ padding:"8px 12px 12px",borderTop:`1px solid ${color}22`,display:"flex",flexWrap:"wrap",gap:6 }}>
                    {SESSION_TYPES.map(t=>(
                      <button key={t} onClick={()=>{ setSchedule(day,t); setSchedulePickerDay(null); }}
                        style={{ padding:"5px 12px",borderRadius:16,border:"none",
                          background:type===t?SESSION_COLORS[t]:"#ebebeb",
                          color:type===t?"#fff":"#333",
                          fontSize:12,fontWeight:600,cursor:"pointer" }}>
                        {SESSION_LABELS[t]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <button onClick={()=>{
          const toSave = {...draft};
          if (!racePaceOverride && autoRacePace) toSave.racePace = autoRacePace;
          if (racePaceOverride) { const gt=computeGoalTime(draft.goal,draft.racePace); if(gt) toSave.goalTime=gt; }
          persist({profile:toSave}); onSaved();
        }}
          style={{ padding:14,borderRadius:10,background:"#1B6FE8",color:"white",border:"none",fontSize:15,fontWeight:700,cursor:"pointer" }}>
          Save Profile
        </button>
        {store.sessions?.length>0&&(
          <button onClick={()=>{ if(window.confirm("Clear all session history?")) persist({sessions:[],weekPlans:[]}); }}
            style={{ padding:12,borderRadius:10,background:"none",color:"#c00",border:"1px solid #fcc",fontSize:14,cursor:"pointer" }}>
            Clear history
          </button>
        )}
      </div>
    </div>
  );
}

// ── Nav ──

function NavBar({ screen, onNav }) {
  const nav = [{id:"home",label:"Training",icon:"▦"},{id:"log",label:"Sessions",icon:"⊕"},{id:"progress",label:"Progress",icon:"↗"},{id:"profile",label:"Profile",icon:"◉"}];
  return (
    <div style={{ position:"sticky",bottom:0,background:"#fff",borderTop:"1px solid #eee",display:"flex",justifyContent:"space-around",padding:"8px 0 env(safe-area-inset-bottom, 12px)",zIndex:100 }}>
      {nav.map(n=>(
        <button key={n.id} onClick={()=>onNav(n.id)}
          style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:2,padding:"6px 16px",background:"none",border:"none",cursor:"pointer",color:screen===n.id?"#1B6FE8":"#aaa" }}>
          <span style={{ fontSize:18 }}>{n.icon}</span>
          <span style={{ fontSize:11,fontWeight:screen===n.id?700:400 }}>{n.label}</span>
        </button>
      ))}
    </div>
  );
}

// ── Main App ──

export default function App() {
  const [store, setStore] = useState(()=>{
    const s = { profile:defaultProfile, sessions:[], weekPlans:[], strava:null, weekScheduleOverrides:{}, ...loadStore() };
    // Migrate legacy single weekPlan → weekPlans array
    if (s.weekPlan && !(s.weekPlans?.length)) s.weekPlans = [s.weekPlan];
    if (!s.weekPlans) s.weekPlans = [];
    delete s.weekPlan;
    // Strip legacy content fields
    s.weekPlans = s.weekPlans.map(p => { const { content:_, ...r } = p; return r; });
    if (!s.weekScheduleOverrides) s.weekScheduleOverrides = {};
    return s;
  });
  const [screen, setScreen] = useState("home");
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [aiText, setAiText] = useState("");
  const [error, setError] = useState("");
  const [activeDay, setActiveDay] = useState(null);
  const [stravaLoading, setStravaLoading] = useState(false);
  const [stravaActivities, setStravaActivities] = useState([]);
  const [editingSession, setEditingSession] = useState(null);

  const persist = useCallback((updates) => {
    setStore(prev=>{ const next={...prev,...updates}; saveStore(next); return next; });
  }, []);

  const hasProfile = store.profile?.name && store.profile?.goal;
  const today = DAY_LABELS[new Date().getDay()===0?6:new Date().getDay()-1];

  async function run(fn) {
    setLoading(true); setError("");
    try { await fn(); } catch(e) { setError(e.message||"Something went wrong"); }
    setLoading(false);
  }

  async function getStravaToken() {
    const stored = store.strava;
    if (stored?.access_token && stored.expires_at > Date.now()/1000+60) return stored.access_token;
    const res = await fetch("/api/strava-token", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ refresh_token:stored?.refresh_token }) });
    const data = await res.json();
    if (data.error) throw new Error("Strava: "+data.error);
    persist({ strava:{...stored,...data} });
    return data.access_token;
  }

  async function importFromStrava() {
    setStravaLoading(true); setError("");
    try {
      const token = await getStravaToken();
      const res = await fetch("/api/strava-activities?per_page=10", { headers:{Authorization:`Bearer ${token}`} });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setStravaActivities(data);
    } catch(e) { setError(e.message); }
    setStravaLoading(false);
  }

  function saveSession(session, deleteId) {
    const sessions = store.sessions||[];
    let updated;
    if (deleteId) { updated = sessions.filter(s=>s.id!==deleteId); }
    else {
      let enriched = session;
      // Auto-link new sessions; preserve explicit overrides (plannedDay already present)
      if (!("plannedDay" in session)) {
        const link = getAutoLink(session.date, store.weekPlans);
        enriched = link ? { ...session, ...link } : { ...session, plannedDay:null, plannedWeekStart:null };
      }
      // Auto-score: fires when linked and no Claude score exists
      if (enriched.plannedDay && enriched.plannedWeekStart && !enriched.score?.verdict?.startsWith("Claude")) {
        const plan = (store.weekPlans||[]).find(p=>p.weekStart===enriched.plannedWeekStart);
        const autoScore = computeAutoScore(enriched, plan);
        if (autoScore) enriched = { ...enriched, score:autoScore };
      }
      const idx = sessions.findIndex(s=>s.id===enriched.id);
      updated = idx>=0 ? sessions.map(s=>s.id===enriched.id?enriched:s) : [...sessions, enriched];
    }
    persist({ sessions:updated });
    setEditingSession(null); setStravaActivities([]);
  }

  function bulkDeleteSessions(ids) {
    const idSet = new Set(ids);
    persist({ sessions:(store.sessions||[]).filter(s=>!idSet.has(s.id)) });
  }

  function bulkSaveSessions(newSessions) {
    const existing = store.sessions||[];
    const existingStravaIds = existing.filter(s=>s.stravaId).map(s=>s.stravaId);
    const toAdd = newSessions.filter(s=>!existingStravaIds.includes(s.stravaId));
    persist({ sessions:[...existing, ...toAdd] });
    setStravaActivities([]);
  }

  async function analyzeSession(d) {
    await run(async () => {
      const p = store.profile;
      const goalLabel = p.goal==="Custom..."?p.goalCustom:p.goal;
      const planCtx = (() => {
        if (!d.plannedDay || !d.plannedWeekStart) return "";
        const plan = (store.weekPlans||[]).find(p=>p.weekStart===d.plannedWeekStart);
        const planned = plan?.weekGoals?.daySessions?.[d.plannedDay];
        if (!planned) return "";
        return `\nPlanned for ${d.plannedDay}: type=${planned.type}, mainSet="${planned.mainSet||"none"}", targetPace=${plan.weekGoals.targetPace||"n/a"}`;
      })();
      const r = await callClaude(SYSTEM,
        `Analyze session — ${goalLabel} in ${p.goalTime} (threshold: ${p.thresholdPace}/km):
Type: ${d.type} | Date: ${d.date} | Location: ${d.location||"unknown"}
Distance: ${d.distance||"unknown"}km | Elevation: ${d.elevation||"unknown"}m
Pace: ${d.avgPace}/km | Avg HR: ${d.avgHR} | Max HR: ${d.maxHR} | Cadence: ${d.cadence} spm | TE: ${d.te} | RPE: ${d.rpe}/10
${d.notes?`Notes: ${d.notes}`:""}${planCtx}
Injuries: ${p.injuries.join(", ")||"none"}
## Verdict\nOn target / Too hard / Too easy\n## Metric flags\n## Next session adjustment\n## Injury risk
After your analysis output exactly this block:
SCORE_JSON
{"value":<1-10>,"verdict":"Claude: <max 10 words>"}
SCORE_JSON`);
      const scoreMatch = r.match(/SCORE_JSON\s*(\{[\s\S]*?\})\s*SCORE_JSON/);
      let score = null;
      if (scoreMatch) { try { score = JSON.parse(scoreMatch[1]); } catch {} }
      const analysis = r.replace(/SCORE_JSON[\s\S]*?SCORE_JSON/g, "").trim();
      saveSession({ ...d, analysis, score });
      setAiText(analysis);
    });
  }

  // Core plan builder — pure async function, no state side-effects
  async function buildWeekPlanGoals(weekStart, { prevWeekPlan, weekNumber, totalWeeks } = {}) {
    const p = store.profile;
    const goalLabel = p.goal==="Custom..."?p.goalCustom:p.goal;
    const effectiveSchedule = (store.weekScheduleOverrides||{})[weekStart] || p.schedule;

    const recentSessions = (store.sessions||[])
      .sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,5)
      .map(s=>`${s.date}: ${SESSION_LABELS[s.type]||s.type}, ${s.distance?s.distance+"km, ":""}pace ${s.avgPace||"?"}, HR ${s.avgHR||"?"}, RPE ${s.rpe||"?"}`).join("\n");

    // Periodization context
    const weeksToRace = p.goalDate ? Math.ceil((new Date(p.goalDate)-new Date(weekStart+"T00:00:00"))/(1000*60*60*24*7)) : null;
    const isTaper = weeksToRace !== null && weeksToRace <= 2;
    const isPeak = weeksToRace !== null && weeksToRace === 3;
    const isRecovery = weekNumber && weekNumber % 4 === 0 && !isTaper;
    const weekPhase = isTaper ? "TAPER — reduce volume 30–40%, keep some intensity, prioritise freshness"
      : isPeak ? "PEAK — highest volume/intensity week of the block"
      : isRecovery ? "RECOVERY — reduce volume ~20%, easy effort, no hard sessions"
      : "BUILD — progressive overload, slight increase from previous week";

    const periodCtx = [
      weekNumber && totalWeeks ? `Week ${weekNumber} of ${totalWeeks} in training block` : null,
      weeksToRace !== null ? `${weeksToRace} week${weeksToRace!==1?"s":""} to race` : null,
      `Phase: ${weekPhase}`,
    ].filter(Boolean).join(" · ");

    const prevWeekSummary = prevWeekPlan?.weekGoals ? (() => {
      const g = prevWeekPlan.weekGoals;
      const runDays = Object.entries(g.daySessions||{}).filter(([,v])=>v?.mainSet).map(([d,v])=>`${d}: ${v.mainSet}`).join("; ");
      return `Previous week (${prevWeekPlan.weekStart}): ${g.totalDistance}km total, ${g.runsPlanned} runs, target pace ${g.targetPace||"n/a"}. Sessions: ${runDays}`;
    })() : null;

    const prompt = `Generate a detailed weekly training plan for week starting ${weekStart}.

${periodCtx}
${prevWeekSummary ? `\n${prevWeekSummary}\n` : ""}
Athlete profile:
- Goal: ${goalLabel} in ${p.goalTime}${p.goalDate?` on ${p.goalDate}`:""}
- Level: ${p.experience}
- Threshold pace: ${p.thresholdPace}/km | Race pace: ${p.racePace}/km | Long run pace: ${p.longRunPace}/km | Easy HR: ${p.easyHR} bpm
- Schedule (FIXED — use exactly these session types in daySessions): ${JSON.stringify(effectiveSchedule)}
- Injuries: ${p.injuries.join(", ")||"none"}

Recent sessions:
${recentSessions||"No sessions logged yet"}

Coaching rules:
- Build volume ~10% per week (unless recovery/taper week)
- Long run = 30–40% of weekly volume
- Hard sessions (threshold/intervals) max 2x/week, never back-to-back
- Easy runs at HR ${p.easyHR||"below 145"} bpm, truly conversational
- mainSet: specific targets — exact distance, pace, reps, rest, HR zone
- Taper: drop volume, keep 1 quality session, race pace strides

Respond with ONLY this JSON — no other text:
WEEKGOALS_JSON
{
  "totalDistance": <number km>,
  "longRunDistance": <number km or null>,
  "runsPlanned": <number>,
  "targetPace": "<mm:ss>",
  "dayGoals": { "Mon":"<short goal or null>","Tue":"<short goal>","Wed":"<short goal or null>","Thu":"<short goal>","Fri":"<short goal or null>","Sat":"<short goal or null>","Sun":"<short goal>" },
  "daySessions": {
    "Mon": { "type": "<session_type>", "mainSet": <"concrete targets" or null> },
    "Tue": { "type": "<session_type>", "mainSet": <"concrete targets" or null> },
    "Wed": { "type": "<session_type>", "mainSet": <"concrete targets" or null> },
    "Thu": { "type": "<session_type>", "mainSet": <"concrete targets" or null> },
    "Fri": { "type": "<session_type>", "mainSet": <"concrete targets" or null> },
    "Sat": { "type": "<session_type>", "mainSet": <"concrete targets" or null> },
    "Sun": { "type": "<session_type>", "mainSet": <"concrete targets" or null> }
  }
}
WEEKGOALS_JSON

session_type must be one of: rest, run_threshold, run_easy, run_long, crossfit, run_interval.
Each day's type MUST match the Schedule exactly. mainSet null for rest/crossfit.`;

    const r = await callClaude("You are an elite running coach AI. Output valid JSON only — no markdown, no prose.", prompt);
    const delimMatch = r.match(/WEEKGOALS_JSON\s*([\s\S]*?)\s*WEEKGOALS_JSON/);
    const fenceMatch = r.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    const rawMatch = r.match(/\{[\s\S]*\}/);
    const candidate = delimMatch?.[1] ?? fenceMatch?.[1] ?? rawMatch?.[0] ?? null;
    let weekGoals = null;
    if (candidate) { try { weekGoals = JSON.parse(candidate); } catch(e) {} }
    return weekGoals;
  }

  async function generateWeekPlan(weekStart) {
    await run(async () => {
      // Include previous week's plan as context if available
      const d = new Date(weekStart+"T00:00:00"); d.setDate(d.getDate()-7);
      const prevWS = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
      const prevWeekPlan = (store.weekPlans||[]).find(p=>p.weekStart===prevWS) || null;
      const weekGoals = await buildWeekPlanGoals(weekStart, { prevWeekPlan });
      const newPlan = { weekGoals, weekStart, generated:new Date().toISOString() };
      const existing = store.weekPlans||[];
      persist({ weekPlans:[...existing.filter(p=>p.weekStart!==weekStart), newPlan].sort((a,b)=>a.weekStart.localeCompare(b.weekStart)) });
    });
  }

  async function generateAllPlans() {
    const raceDate = store.profile.goalDate;
    if (!raceDate) { setError("Set a race date in your profile first."); return; }
    setLoading(true); setError(""); setLoadingMsg("");
    try {
      // Build list of weeks: current → race week
      const currentWS = getCurrentWeekStart();
      const raceWS = getWeekStart(new Date(raceDate+"T00:00:00"));
      const weeks = [];
      let ws = currentWS;
      while (ws <= raceWS) {
        weeks.push(ws);
        const nd = new Date(ws+"T00:00:00"); nd.setDate(nd.getDate()+7);
        ws = `${nd.getFullYear()}-${String(nd.getMonth()+1).padStart(2,"0")}-${String(nd.getDate()).padStart(2,"0")}`;
      }
      const totalWeeks = weeks.length;
      let allPlans = [...(store.weekPlans||[])];

      for (let i = 0; i < weeks.length; i++) {
        setLoadingMsg(`Generating week ${i+1} of ${totalWeeks}…`);
        const prevPlan = i > 0 ? allPlans.find(p=>p.weekStart===weeks[i-1]) : null;
        const weekGoals = await buildWeekPlanGoals(weeks[i], { prevWeekPlan:prevPlan, weekNumber:i+1, totalWeeks });
        const newPlan = { weekGoals, weekStart:weeks[i], generated:new Date().toISOString() };
        allPlans = [...allPlans.filter(p=>p.weekStart!==weeks[i]), newPlan].sort((a,b)=>a.weekStart.localeCompare(b.weekStart));
        persist({ weekPlans:allPlans });
      }
    } catch(e) { setError(e.message); }
    finally { setLoading(false); setLoadingMsg(""); }
  }

  async function getSessionDetail(day) {
    setActiveDay(day); setScreen("session"); setAiText(""); setError("");
    await run(async () => {
      const p = store.profile;
      const type = p.schedule[day];
      const goalLabel = p.goal==="Custom..."?p.goalCustom:p.goal;
      const dayGoal = store.weekPlan?.weekGoals?.dayGoals?.[day];
      const r = await callClaude(SYSTEM,
        `Complete session plan: ${SESSION_LABELS[type]} on ${day}
Athlete: ${goalLabel} in ${p.goalTime} | Threshold ${p.thresholdPace}/km | Easy HR ${p.easyHR} bpm | ${p.experience}
Injuries: ${p.injuries.join(", ")||"none"}
${dayGoal?`Week goal for this session: ${dayGoal}`:""}
Recent load: ${(store.sessions||[]).slice(-2).map(s=>`${s.type} TE:${s.te}`).join(", ")||"unknown"}
## Warm-up\n## Main set\n## Cool-down\n## Fueling\n## 3 common mistakes
Include: exact paces, HR zones (bpm), cadence targets, rep structure, rest.`);
      setAiText(r);
    });
  }

  function handleNav(id) {
    setScreen(id); setAiText(""); setError(""); setStravaActivities([]);
    if (id!=="session") setActiveDay(null);
    if (id!=="log") setEditingSession(null);
  }

  return (
    <div style={{ maxWidth:430,margin:"0 auto",minHeight:"100vh",display:"flex",flexDirection:"column",background:"#fff" }}>
      <div style={{ flex:1,overflowY:"auto",display:"flex",flexDirection:"column" }}>
        {screen==="home"&&<HomeScreen store={store} today={today} loading={loading} loadingMsg={loadingMsg} error={error} hasProfile={hasProfile} onGeneratePlan={generateWeekPlan} onGenerateAllPlans={generateAllPlans} onGoProfile={()=>setScreen("profile")} onSaveScheduleOverride={(weekStart,scheduleOrNull)=>{ const u={...(store.weekScheduleOverrides||{})}; if(scheduleOrNull===null){delete u[weekStart];}else{u[weekStart]=scheduleOrNull;} persist({weekScheduleOverrides:u}); }} onSaveSession={saveSession}/>}
        {screen==="session"&&<SessionScreen store={store} activeDay={activeDay} loading={loading} error={error} aiText={aiText} onBack={()=>{ setScreen("home"); setAiText(""); setActiveDay(null); }}/>}
        {screen==="log"&&<LogScreen store={store} loading={loading} error={error} aiText={aiText} stravaLoading={stravaLoading} stravaActivities={stravaActivities} onImportStrava={importFromStrava} onSaveSession={saveSession} onBulkSave={bulkSaveSessions} onBulkDelete={bulkDeleteSessions} onAnalyze={analyzeSession} editingSession={editingSession} setEditingSession={setEditingSession}/>}
        {screen==="progress"&&<ProgressScreen store={store}/>}
        {screen==="profile"&&<ProfileScreen store={store} persist={persist} onSaved={()=>setScreen("home")}/>}
      </div>
      <NavBar screen={screen} onNav={handleNav}/>
    </div>
  );
}
