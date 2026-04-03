import { useState, useCallback } from "react";

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
function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day===0?-6:1);
  d.setDate(diff);
  return d.toISOString().split("T")[0];
}
function getCurrentWeekStart() { return getWeekStart(new Date()); }

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
          {initial?"Update Session":"Save Session"}
        </button>
      </div>
    </div>
  );
}

// ── Home Screen ──

function HomeScreen({ store, today, loading, error, hasProfile, onGeneratePlan, onSessionTap, onGoProfile }) {
  const goalLabel = store.profile.goal==="Custom..."?store.profile.goalCustom:store.profile.goal;
  const daysToRace = store.profile.goalDate ? Math.ceil((new Date(store.profile.goalDate)-new Date())/(1000*60*60*24)) : null;
  const weekPlan = store.weekPlan;
  const weekStart = getCurrentWeekStart();
  const isCurrentWeek = weekPlan?.weekStart === weekStart;

  return (
    <div style={{ padding:"0 16px 24px",overflowY:"auto",flex:1 }}>
      <div style={{ padding:"20px 0 14px",borderBottom:"1px solid #f0f0ec",marginBottom:16 }}>
        <div style={{ fontSize:11,color:"#aaa",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:2 }}>This week</div>
        <div style={{ fontSize:24,fontWeight:800,color:"#1a1a1a" }}>{store.profile.name?`${store.profile.name}'s Plan`:"Training Plan"}</div>
        {goalLabel&&(
          <div style={{ fontSize:13,color:"#888",marginTop:3,display:"flex",gap:8,alignItems:"center",flexWrap:"wrap" }}>
            <span>{goalLabel} · {store.profile.goalTime}</span>
            {daysToRace!==null&&daysToRace>0&&<span style={{ fontSize:11,padding:"2px 8px",borderRadius:6,background:"#f0f6ff",color:"#1B6FE8",fontWeight:700 }}>{daysToRace}d to go</span>}
            {daysToRace===0&&<span style={{ fontSize:11,padding:"2px 8px",borderRadius:6,background:"#fff8e0",color:"#b07000",fontWeight:700 }}>Race day! 🏁</span>}
          </div>
        )}
      </div>

      <div style={{ display:"flex",flexDirection:"column",gap:8,marginBottom:18 }}>
        {DAY_LABELS.map(day=>{
          const type=store.profile.schedule?.[day]||"rest";
          const isToday=day===today;
          const color=SESSION_COLORS[type];
          const isRun=type.startsWith("run");
          const dayGoal = weekPlan?.dayGoals?.[day];
          return (
            <button key={day} onClick={()=>isRun&&onSessionTap(day)}
              style={{ display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderRadius:10,background:isToday?"#f0f6ff":"#fff",border:isToday?`2px solid ${color}`:"1px solid #eee",cursor:isRun?"pointer":"default",textAlign:"left",width:"100%" }}>
              <div style={{ width:8,height:8,borderRadius:"50%",background:color,flexShrink:0 }}/>
              <span style={{ fontSize:12,fontWeight:700,width:32,color:"#aaa",textTransform:"uppercase",letterSpacing:"0.05em" }}>{day}</span>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14,color:"#1a1a1a",fontWeight:isToday?700:400 }}>{SESSION_LABELS[type]}</div>
                {dayGoal&&<div style={{ fontSize:11,color:"#888",marginTop:1 }}>{dayGoal}</div>}
              </div>
              {isToday&&<span style={{ fontSize:10,color,fontWeight:800,letterSpacing:"0.06em" }}>TODAY</span>}
              {isRun&&<span style={{ fontSize:20,color:"#ddd" }}>›</span>}
            </button>
          );
        })}
      </div>

      {!hasProfile?(
        <div style={{ padding:16,borderRadius:10,background:"#fff8f0",border:"1px solid #fcd0b0",marginBottom:14 }}>
          <div style={{ fontSize:13,color:"#c04a00",fontWeight:700,marginBottom:4 }}>Set up your profile first</div>
          <div style={{ fontSize:13,color:"#666",marginBottom:10 }}>Add your goal and benchmarks to generate a personalised plan.</div>
          <button onClick={onGoProfile} style={{ padding:"8px 16px",borderRadius:8,background:"#1B6FE8",color:"white",border:"none",fontSize:13,fontWeight:700,cursor:"pointer" }}>Go to Profile →</button>
        </div>
      ):(
        <button onClick={onGeneratePlan} disabled={loading}
          style={{ width:"100%",padding:14,borderRadius:10,background:loading?"#ccc":"#1B6FE8",color:"white",border:"none",fontSize:15,fontWeight:700,cursor:loading?"default":"pointer",marginBottom:10 }}>
          {loading?"Generating...":isCurrentWeek?"Regenerate Week Plan":"Generate Week Plan"}
        </button>
      )}

      <ErrorBox message={error}/>
      {loading&&!weekPlan&&<Dots/>}
      {weekPlan&&(
        <div>
          <div style={{ fontSize:11,color:"#aaa",marginBottom:4 }}>Generated {new Date(weekPlan.generated).toLocaleDateString()}</div>
          <WeekPlanGrid weekGoals={weekPlan.weekGoals} today={today} schedule={store.profile.schedule} weekStart={weekPlan.weekStart}/>
        </div>
      )}
    </div>
  );
}

// ── Week Plan Grid ──

function WeekPlanGrid({ weekGoals, today, schedule, weekStart }) {
  const daySessions = weekGoals?.daySessions;
  const weekStartDate = new Date(weekStart + "T00:00:00");
  return (
    <div style={{ display:"flex",flexDirection:"column",gap:8,marginTop:8 }}>
      {DAY_LABELS.map((day, i) => {
        const session = daySessions?.[day];
        const type = session?.type || schedule?.[day] || "rest";
        const mainSet = session?.mainSet || null;
        const color = SESSION_COLORS[type] || "#888780";
        const label = SESSION_LABELS[type] || type;
        const isToday = day === today;
        const dayDate = new Date(weekStartDate);
        dayDate.setDate(weekStartDate.getDate() + i);
        const dateStr = dayDate.toLocaleDateString("en-GB", { day:"numeric", month:"short" });
        return (
          <div key={day} style={{ borderRadius:10, background:isToday?"#f0f6ff":"#fff", border:isToday?`1px solid ${color}`:"1px solid #eee", overflow:"hidden", display:"flex" }}>
            <div style={{ width:4, background:color, flexShrink:0 }}/>
            <div style={{ flex:1, padding:"11px 14px" }}>
              <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:mainSet?5:0 }}>
                <span style={{ fontSize:12,fontWeight:700,color:"#aaa",textTransform:"uppercase",letterSpacing:"0.05em",width:28 }}>{day}</span>
                <span style={{ fontSize:11,color:"#bbb" }}>{dateStr}</span>
                <span style={{ marginLeft:"auto",fontSize:11,fontWeight:700,color,background:`${color}18`,padding:"2px 8px",borderRadius:20 }}>{label}</span>
                {isToday&&<span style={{ fontSize:10,color,fontWeight:800,letterSpacing:"0.06em" }}>TODAY</span>}
              </div>
              {mainSet&&<div style={{ fontSize:13,color:"#333",lineHeight:1.55 }}>{mainSet}</div>}
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

function LogScreen({ store, loading, error, aiText, stravaLoading, stravaActivities, onImportStrava, onSaveSession, onBulkSave, onAnalyze, editingSession, setEditingSession }) {
  const [successMsg, setSuccessMsg] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [analysisSessionId, setAnalysisSessionId] = useState(null);

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
          <button onClick={()=>setShowForm(true)}
            style={{ padding:"9px 16px",borderRadius:10,background:"#1B6FE8",color:"white",border:"none",fontSize:14,fontWeight:700,cursor:"pointer" }}>
            + Log Run
          </button>
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
        <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
          {sessions.map(s=>(
            <div key={s.id} style={{ padding:14,borderRadius:10,border:"1px solid #eee",background:"#fff" }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8 }}>
                <div>
                  <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:3,flexWrap:"wrap" }}>
                    <div style={{ width:7,height:7,borderRadius:"50%",background:SESSION_COLORS[s.type]||"#888",flexShrink:0 }}/>
                    <span style={{ fontSize:14,fontWeight:700,color:"#1a1a1a" }}>{SESSION_LABELS[s.type]||s.type}</span>
                    {s.stravaId&&<span style={{ fontSize:10,padding:"2px 6px",borderRadius:4,background:"#FC4C0222",color:"#FC4C02",fontWeight:700 }}>Strava</span>}
                  </div>
                  <div style={{ fontSize:12,color:"#aaa" }}>
                    {s.date}{s.time?` · ${s.time}`:""}{s.location?` · ${s.location}`:""}
                  </div>
                </div>
                <div style={{ display:"flex",gap:6,flexWrap:"wrap",justifyContent:"flex-end" }}>
                  {s.avgPace&&<Chip label={s.avgPace+"/km"} color="#1B6FE8"/>}
                  {s.distance&&<Chip label={s.distance+"km"} color="#7C3AED"/>}
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

              <div style={{ display:"flex",gap:8,marginTop:8 }}>
                <button onClick={()=>{ setEditingSession(s); setShowForm(false); }}
                  style={{ flex:1,padding:"7px",borderRadius:8,background:"none",color:"#1B6FE8",border:"1px solid #1B6FE822",fontSize:13,fontWeight:600,cursor:"pointer" }}>Edit</button>
                <button onClick={()=>{ setAnalysisSessionId(s.id); onAnalyze(s); }} disabled={loading&&analysisSessionId===s.id}
                  style={{ flex:1,padding:"7px",borderRadius:8,background:"none",color:"#0F6E56",border:"1px solid #0F6E5622",fontSize:13,fontWeight:600,cursor:"pointer" }}>
                  {loading&&analysisSessionId===s.id?"...":"Analyse"}</button>
                <button onClick={()=>{ if(window.confirm("Delete this session?")) onSaveSession(null, s.id); }}
                  style={{ flex:1,padding:"7px",borderRadius:8,background:"none",color:"#c00",border:"1px solid #fcc",fontSize:13,fontWeight:600,cursor:"pointer" }}>Delete</button>
              </div>

              {s.analysis&&analysisSessionId===s.id&&!loading&&(
                <div style={{ marginTop:12,paddingTop:12,borderTop:"1px solid #f0f0ec" }}>
                  <MarkdownBlock content={s.analysis} small/>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {loading&&<Dots/>}
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
  const weekPlan = store.weekPlan;
  const weekGoals = weekPlan?.weekGoals;
  const isCurrentWeekPlan = weekPlan?.weekStart===weekStart;

  const thisWeekRuns = runSessions.filter(s=>getWeekStart(s.date)===weekStart);
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
          <Field label="Goal time" value={draft.goalTime} onChange={v=>set("goalTime",v)} placeholder="e.g. 1:45:00"/>
          <Field label="Race date" value={draft.goalDate} onChange={v=>set("goalDate",v)} type="date"/>
        </div>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
          <Field label="Threshold pace" value={draft.thresholdPace} onChange={v=>set("thresholdPace",v)} placeholder="5:00"/>
          <Field label="Race pace" value={draft.racePace} onChange={v=>set("racePace",v)} placeholder="5:15"/>
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
          <SectionLabel>Weekly Schedule</SectionLabel>
          {DAY_LABELS.map(day=>(
            <div key={day} style={{ display:"flex",alignItems:"center",gap:10,marginBottom:8 }}>
              <div style={{ width:8,height:8,borderRadius:"50%",background:SESSION_COLORS[draft.schedule?.[day]||"rest"],flexShrink:0 }}/>
              <span style={{ fontSize:12,fontWeight:700,width:34,color:"#aaa",textTransform:"uppercase",letterSpacing:"0.05em" }}>{day}</span>
              <select value={draft.schedule?.[day]||"rest"} onChange={e=>setSchedule(day,e.target.value)}
                style={{ flex:1,padding:"8px 10px",borderRadius:8,border:"1px solid #e0e0dc",background:"#fff",color:"#1a1a1a",fontSize:14,outline:"none" }}>
                {SESSION_TYPES.map(t=><option key={t} value={t}>{SESSION_LABELS[t]}</option>)}
              </select>
            </div>
          ))}
        </div>
        <button onClick={()=>{ persist({profile:draft}); onSaved(); }}
          style={{ padding:14,borderRadius:10,background:"#1B6FE8",color:"white",border:"none",fontSize:15,fontWeight:700,cursor:"pointer" }}>
          Save Profile
        </button>
        {store.sessions?.length>0&&(
          <button onClick={()=>{ if(window.confirm("Clear all session history?")) persist({sessions:[],weekPlan:null}); }}
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
  const nav = [{id:"home",label:"Plan",icon:"▦"},{id:"log",label:"Sessions",icon:"⊕"},{id:"progress",label:"Progress",icon:"↗"},{id:"profile",label:"Profile",icon:"◉"}];
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
  const [store, setStore] = useState(()=>({ profile:defaultProfile, sessions:[], weekPlan:null, strava:null, ...loadStore() }));
  const [screen, setScreen] = useState("home");
  const [loading, setLoading] = useState(false);
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
      const idx = sessions.findIndex(s=>s.id===session.id);
      updated = idx>=0 ? sessions.map(s=>s.id===session.id?session:s) : [...sessions, session];
    }
    persist({ sessions:updated });
    setEditingSession(null); setStravaActivities([]);
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
      const r = await callClaude(SYSTEM,
        `Analyze session — ${goalLabel} in ${p.goalTime} (threshold: ${p.thresholdPace}/km):
Type: ${d.type} | Date: ${d.date} | Location: ${d.location||"unknown"}
Distance: ${d.distance||"unknown"}km | Elevation: ${d.elevation||"unknown"}m
Pace: ${d.avgPace}/km | Avg HR: ${d.avgHR} | Max HR: ${d.maxHR} | Cadence: ${d.cadence} spm | TE: ${d.te} | RPE: ${d.rpe}/10
${d.notes?`Notes: ${d.notes}`:""}
Injuries: ${p.injuries.join(", ")||"none"}
## Verdict\nOn target / Too hard / Too easy\n## Metric flags\n## Next session adjustment\n## Injury risk`);
      saveSession({ ...d, analysis:r });
      setAiText(r);
    });
  }

  async function generateWeekPlan() {
    await run(async () => {
      const p = store.profile;
      const goalLabel = p.goal==="Custom..."?p.goalCustom:p.goal;
      const weekStart = getCurrentWeekStart();

      const recentSessions = (store.sessions||[])
        .sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,5)
        .map(s=>`${s.date}: ${SESSION_LABELS[s.type]||s.type}, ${s.distance?s.distance+"km, ":""}${s.elevation?"+"+s.elevation+"m, ":""}pace ${s.avgPace||"?"}, HR ${s.avgHR||"?"}, cadence ${s.cadence||"?"}, RPE ${s.rpe||"?"}`).join("\n");

      const prompt = `Generate a detailed weekly training plan for week starting ${weekStart}.

Athlete profile:
- Goal: ${goalLabel} in ${p.goalTime}${p.goalDate?` on ${p.goalDate}`:""}
- Level: ${p.experience}
- Threshold pace: ${p.thresholdPace}/km | Race pace: ${p.racePace}/km | Long run pace: ${p.longRunPace}/km | Easy HR: ${p.easyHR} bpm
- Schedule: ${JSON.stringify(p.schedule)}
- Injuries: ${p.injuries.join(", ")||"none"}

Recent logged sessions:
${recentSessions||"No sessions logged yet"}

Respond with ONLY the JSON block below — no other text:
WEEKGOALS_JSON
{
  "totalDistance": <number km>,
  "longRunDistance": <number km or null>,
  "runsPlanned": <number>,
  "targetPace": "<mm:ss>",
  "dayGoals": {
    "Mon": "<short goal or null>",
    "Tue": "<short goal>",
    "Wed": "<short goal or null>",
    "Thu": "<short goal>",
    "Fri": "<short goal or null>",
    "Sat": "<short goal or null>",
    "Sun": "<short goal>"
  },
  "daySessions": {
    "Mon": { "type": "<session_type>", "mainSet": <"concise main set: reps/distance @ pace, rest, zone" or null> },
    "Tue": { "type": "<session_type>", "mainSet": <"concise main set" or null> },
    "Wed": { "type": "<session_type>", "mainSet": <"concise main set" or null> },
    "Thu": { "type": "<session_type>", "mainSet": <"concise main set" or null> },
    "Fri": { "type": "<session_type>", "mainSet": <"concise main set" or null> },
    "Sat": { "type": "<session_type>", "mainSet": <"concise main set" or null> },
    "Sun": { "type": "<session_type>", "mainSet": <"concise main set" or null> }
  }
}
WEEKGOALS_JSON

session_type must be one of: rest, run_threshold, run_easy, run_long, crossfit, run_interval.
mainSet: null for rest/crossfit, otherwise 1–2 sentences with concrete targets (reps, pace, HR, rest).`;

      const r = await callClaude(SYSTEM, prompt);

      // Parse the week goals JSON from response
      let weekGoals = null;
      let content = r;
      const jsonMatch = r.match(/WEEKGOALS_JSON\s*([\s\S]*?)\s*WEEKGOALS_JSON/);
      if (jsonMatch) {
        try { weekGoals = JSON.parse(jsonMatch[1]); } catch(e) {}
        content = r.replace(/WEEKGOALS_JSON[\s\S]*?WEEKGOALS_JSON/, "").trim();
      }

      persist({ weekPlan:{ weekGoals, weekStart, generated:new Date().toISOString() } });
    });
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
        {screen==="home"&&<HomeScreen store={store} today={today} loading={loading} error={error} hasProfile={hasProfile} onGeneratePlan={generateWeekPlan} onSessionTap={getSessionDetail} onGoProfile={()=>setScreen("profile")}/>}
        {screen==="session"&&<SessionScreen store={store} activeDay={activeDay} loading={loading} error={error} aiText={aiText} onBack={()=>{ setScreen("home"); setAiText(""); setActiveDay(null); }}/>}
        {screen==="log"&&<LogScreen store={store} loading={loading} error={error} aiText={aiText} stravaLoading={stravaLoading} stravaActivities={stravaActivities} onImportStrava={importFromStrava} onSaveSession={saveSession} onBulkSave={bulkSaveSessions} onAnalyze={analyzeSession} editingSession={editingSession} setEditingSession={setEditingSession}/>}
        {screen==="progress"&&<ProgressScreen store={store}/>}
        {screen==="profile"&&<ProfileScreen store={store} persist={persist} onSaved={()=>setScreen("home")}/>}
      </div>
      <NavBar screen={screen} onNav={handleNav}/>
    </div>
  );
}
