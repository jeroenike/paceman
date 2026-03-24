import { useState, useCallback } from "react";

const STORAGE_KEY = "paceman_v1";
const defaultProfile = {
  name: "", goal: "", goalTime: "", thresholdPace: "", racePace: "",
  longRunPace: "", easyHR: "", experience: "", injuries: [],
  schedule: { Mon:"rest", Tue:"run_threshold", Wed:"crossfit", Thu:"run_easy", Fri:"crossfit", Sat:"crossfit", Sun:"run_long" },
};
const DAY_LABELS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const SESSION_TYPES = ["rest","run_threshold","run_easy","run_long","crossfit","run_interval"];
const SESSION_COLORS = { rest:"#888780", run_threshold:"#1B6FE8", run_easy:"#0F6E56", run_long:"#3B6D11", crossfit:"#993C1D", run_interval:"#7C3AED" };
const SESSION_LABELS = { rest:"Rest", run_threshold:"Threshold", run_easy:"Easy Run", run_long:"Long Run", crossfit:"CrossFit", run_interval:"Intervals" };

function loadStore() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; } }
function saveStore(d) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch {} }

async function callClaude(system, user) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:1000, system, messages:[{role:"user",content:user}] }),
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

function Field({ label, value, onChange, placeholder, inputMode }) {
  return (
    <div>
      <label style={{ fontSize:11,color:"#888",display:"block",marginBottom:5,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.07em" }}>{label}</label>
      <input
        value={value||""}
        onChange={e=>onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode||"text"}
        style={{ width:"100%",padding:"11px 12px",borderRadius:8,border:"1px solid #e0e0dc",background:"#fff",color:"#1a1a1a",fontSize:15,outline:"none" }}
        onFocus={e=>e.target.style.borderColor="#1B6FE8"}
        onBlur={e=>e.target.style.borderColor="#e0e0dc"}
      />
    </div>
  );
}

function Chip({ label, color }) {
  return <span style={{ fontSize:11,padding:"3px 8px",borderRadius:6,background:color+"22",color,fontWeight:700 }}>{label}</span>;
}

function StatBox({ label, value }) {
  return (
    <div style={{ background:"#f5f7ff",borderRadius:8,padding:"8px 12px" }}>
      <div style={{ fontSize:10,color:"#888",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:2 }}>{label}</div>
      <div style={{ fontSize:14,fontWeight:700,color:"#1a1a1a" }}>{value}</div>
    </div>
  );
}

function ErrorBox({ message }) {
  if (!message) return null;
  return <div style={{ padding:12,borderRadius:8,background:"#fff0f0",border:"1px solid #fcc",fontSize:13,color:"#c00",marginBottom:12 }}>{message}</div>;
}

function HomeScreen({ store, today, loading, error, hasProfile, onGeneratePlan, onSessionTap, onGoProfile }) {
  return (
    <div style={{ padding:"0 16px 24px",overflowY:"auto",flex:1 }}>
      <div style={{ padding:"20px 0 14px",borderBottom:"1px solid #f0f0ec",marginBottom:16 }}>
        <div style={{ fontSize:11,color:"#aaa",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:2 }}>This week</div>
        <div style={{ fontSize:24,fontWeight:800,color:"#1a1a1a" }}>{store.profile.name?`${store.profile.name}'s Plan`:"Training Plan"}</div>
        {store.profile.goal&&<div style={{ fontSize:13,color:"#888",marginTop:3 }}>{store.profile.goal} · {store.profile.goalTime}</div>}
      </div>
      <div style={{ display:"flex",flexDirection:"column",gap:8,marginBottom:18 }}>
        {DAY_LABELS.map(day=>{
          const type=store.profile.schedule?.[day]||"rest";
          const isToday=day===today;
          const color=SESSION_COLORS[type];
          const isRun=type.startsWith("run");
          return (
            <button key={day} onClick={()=>isRun&&onSessionTap(day)}
              style={{ display:"flex",alignItems:"center",gap:12,padding:"13px 14px",borderRadius:10,background:isToday?"#f0f6ff":"#fff",border:isToday?`2px solid ${color}`:"1px solid #eee",cursor:isRun?"pointer":"default",textAlign:"left",width:"100%" }}>
              <div style={{ width:8,height:8,borderRadius:"50%",background:color,flexShrink:0 }}/>
              <span style={{ fontSize:12,fontWeight:700,width:32,color:"#aaa",textTransform:"uppercase",letterSpacing:"0.05em" }}>{day}</span>
              <span style={{ fontSize:14,color:"#1a1a1a",fontWeight:isToday?700:400,flex:1 }}>{SESSION_LABELS[type]}</span>
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
          {loading?"Generating...":"Generate Week Plan"}
        </button>
      )}
      <ErrorBox message={error}/>
      {loading&&!store.weekPlan&&<Dots/>}
      {store.weekPlan&&(
        <div>
          <div style={{ fontSize:11,color:"#aaa",marginBottom:10 }}>Generated {new Date(store.weekPlan.generated).toLocaleDateString()}</div>
          <MarkdownBlock content={store.weekPlan.content}/>
        </div>
      )}
    </div>
  );
}

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

function LogScreen({ loading, error, aiText, stravaLoading, stravaActivities, logData, setLogData, onImportStrava, onPrefillFromStrava, onAnalyze }) {
  return (
    <div style={{ padding:"0 16px 24px",overflowY:"auto",flex:1 }}>
      <div style={{ padding:"20px 0 14px",borderBottom:"1px solid #f0f0ec",marginBottom:16 }}>
        <div style={{ fontSize:24,fontWeight:800,color:"#1a1a1a" }}>Log Session</div>
        <div style={{ fontSize:13,color:"#888",marginTop:3 }}>Enter data manually or import from Strava.</div>
      </div>
      <button onClick={onImportStrava} disabled={stravaLoading}
        style={{ width:"100%",padding:13,borderRadius:10,background:stravaLoading?"#eee":"#FC4C02",color:stravaLoading?"#aaa":"white",border:"none",fontSize:14,fontWeight:700,cursor:stravaLoading?"default":"pointer",marginBottom:14,display:"flex",alignItems:"center",justifyContent:"center",gap:8 }}>
        <span>⚡</span>{stravaLoading?"Loading Strava...":"Import from Strava"}
      </button>
      {stravaActivities.length>0&&(
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:12,color:"#888",marginBottom:8,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.07em" }}>Recent runs — tap to prefill</div>
          {stravaActivities.map(a=>(
            <button key={a.id} onClick={()=>onPrefillFromStrava(a)}
              style={{ width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",marginBottom:6,borderRadius:10,border:"1px solid #e5e5e3",background:"#fff",cursor:"pointer",textAlign:"left" }}>
              <div>
                <div style={{ fontSize:14,fontWeight:600,color:"#1a1a1a",marginBottom:2 }}>{a.name}</div>
                <div style={{ fontSize:12,color:"#888" }}>{a.date} · {a.distance}km</div>
              </div>
              <div style={{ display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4 }}>
                {a.avgPace&&<Chip label={a.avgPace+"/km"} color="#1B6FE8"/>}
                {a.avgHR&&<Chip label={a.avgHR+" bpm"} color="#e05a00"/>}
              </div>
            </button>
          ))}
        </div>
      )}
      <ErrorBox message={error}/>
      <div style={{ height:1,background:"#f0f0ec",margin:"4px 0 16px" }}/>
      <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
        <div>
          <label style={{ fontSize:11,color:"#888",display:"block",marginBottom:5,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.07em" }}>Session type</label>
          <select value={logData.type||""} onChange={e=>setLogData(p=>({...p,type:e.target.value}))}
            style={{ width:"100%",padding:"11px 12px",borderRadius:8,border:"1px solid #e0e0dc",background:"#fff",color:"#1a1a1a",fontSize:15,outline:"none" }}>
            <option value="">Select...</option>
            {SESSION_TYPES.filter(t=>t!=="rest").map(t=><option key={t} value={t}>{SESSION_LABELS[t]}</option>)}
          </select>
        </div>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
          <Field label="Avg pace (/km)" value={logData.avgPace} onChange={v=>setLogData(p=>({...p,avgPace:v}))} placeholder="5:08"/>
          <Field label="Avg HR (bpm)" value={logData.avgHR} onChange={v=>setLogData(p=>({...p,avgHR:v}))} placeholder="158" inputMode="numeric"/>
          <Field label="Max HR (bpm)" value={logData.maxHR} onChange={v=>setLogData(p=>({...p,maxHR:v}))} placeholder="172" inputMode="numeric"/>
          <Field label="Cadence (spm)" value={logData.cadence} onChange={v=>setLogData(p=>({...p,cadence:v}))} placeholder="166" inputMode="numeric"/>
          <Field label="Aerobic TE" value={logData.te} onChange={v=>setLogData(p=>({...p,te:v}))} placeholder="3.8" inputMode="decimal"/>
          <Field label="RPE (1–10)" value={logData.rpe} onChange={v=>setLogData(p=>({...p,rpe:v}))} placeholder="7" inputMode="numeric"/>
        </div>
        <div>
          <label style={{ fontSize:11,color:"#888",display:"block",marginBottom:5,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.07em" }}>Notes</label>
          <textarea value={logData.notes||""} onChange={e=>setLogData(p=>({...p,notes:e.target.value}))}
            placeholder="How did it feel? Any issues?"
            style={{ width:"100%",padding:"11px 12px",borderRadius:8,border:"1px solid #e0e0dc",background:"#fff",color:"#1a1a1a",fontSize:15,minHeight:80,resize:"vertical",outline:"none" }}/>
        </div>
        <button onClick={onAnalyze} disabled={loading||!logData.type||!logData.avgPace}
          style={{ padding:14,borderRadius:10,background:(logData.type&&logData.avgPace)?"#1B6FE8":"#e0e0dc",color:(logData.type&&logData.avgPace)?"white":"#aaa",border:"none",fontSize:15,fontWeight:700,cursor:(logData.type&&logData.avgPace)?"pointer":"default" }}>
          {loading?"Analysing...":"Analyse Session"}
        </button>
      </div>
      {loading&&<Dots/>}
      {aiText&&!loading&&(
        <div style={{ marginTop:20 }}>
          <div style={{ padding:"10px 14px",borderRadius:8,background:"#f0f6ff",marginBottom:14,display:"flex",justifyContent:"space-between",alignItems:"center" }}>
            <span style={{ fontSize:12,color:"#1B6FE8",fontWeight:800,textTransform:"uppercase",letterSpacing:"0.08em" }}>Coach Analysis</span>
            <span style={{ fontSize:11,color:"#aaa" }}>{new Date().toLocaleDateString()}</span>
          </div>
          <MarkdownBlock content={aiText}/>
        </div>
      )}
    </div>
  );
}

function ProgressScreen({ store }) {
  const sessions = [...(store.sessions||[])].reverse().slice(0,15);
  return (
    <div style={{ padding:"0 16px 24px",overflowY:"auto",flex:1 }}>
      <div style={{ padding:"20px 0 14px",borderBottom:"1px solid #f0f0ec",marginBottom:16 }}>
        <div style={{ fontSize:24,fontWeight:800,color:"#1a1a1a" }}>Progress</div>
        <div style={{ fontSize:13,color:"#888",marginTop:3 }}>{store.sessions?.length||0} sessions logged</div>
      </div>
      {sessions.length===0?(
        <div style={{ padding:"48px 20px",textAlign:"center",border:"1px solid #eee",borderRadius:12 }}>
          <div style={{ fontSize:40,marginBottom:12 }}>📊</div>
          <div style={{ color:"#888",fontSize:15,marginBottom:6 }}>No sessions yet</div>
          <div style={{ color:"#aaa",fontSize:13 }}>Log your first run to start tracking.</div>
        </div>
      ):(
        <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
          {sessions.map(s=>(
            <div key={s.id} style={{ padding:14,borderRadius:10,border:"1px solid #eee",background:"#fff" }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10 }}>
                <div>
                  <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:3 }}>
                    <div style={{ width:7,height:7,borderRadius:"50%",background:SESSION_COLORS[s.type]||"#888" }}/>
                    <span style={{ fontSize:14,fontWeight:700,color:"#1a1a1a" }}>{SESSION_LABELS[s.type]||s.type}</span>
                    {s.stravaId&&<span style={{ fontSize:10,padding:"2px 6px",borderRadius:4,background:"#FC4C0222",color:"#FC4C02",fontWeight:700 }}>Strava</span>}
                  </div>
                  <div style={{ fontSize:12,color:"#aaa" }}>{s.date}</div>
                </div>
                <div style={{ display:"flex",gap:6,flexWrap:"wrap",justifyContent:"flex-end" }}>
                  {s.avgPace&&<Chip label={s.avgPace+"/km"} color="#1B6FE8"/>}
                  {s.te&&<Chip label={"TE "+s.te} color="#0F6E56"/>}
                </div>
              </div>
              <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8 }}>
                {s.avgHR&&<StatBox label="Avg HR" value={s.avgHR+" bpm"}/>}
                {s.cadence&&<StatBox label="Cadence" value={s.cadence+" spm"}/>}
                {s.rpe&&<StatBox label="RPE" value={s.rpe+"/10"}/>}
              </div>
              {s.analysis&&(
                <details style={{ marginTop:10 }}>
                  <summary style={{ fontSize:13,color:"#1B6FE8",cursor:"pointer",fontWeight:600 }}>Coach analysis ›</summary>
                  <div style={{ marginTop:10,paddingTop:10,borderTop:"1px solid #f0f0ec" }}><MarkdownBlock content={s.analysis} small/></div>
                </details>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProfileScreen({ store, persist, onSaved }) {
  const [draft, setDraft] = useState(()=>({...store.profile}));
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
        <Field label="Race goal" value={draft.goal} onChange={v=>set("goal",v)} placeholder="e.g. Half Marathon"/>
        <Field label="Goal time" value={draft.goalTime} onChange={v=>set("goalTime",v)} placeholder="e.g. 1:45:00"/>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
          <Field label="Threshold pace" value={draft.thresholdPace} onChange={v=>set("thresholdPace",v)} placeholder="5:00"/>
          <Field label="Race pace" value={draft.racePace} onChange={v=>set("racePace",v)} placeholder="5:15"/>
          <Field label="Long run pace" value={draft.longRunPace} onChange={v=>set("longRunPace",v)} placeholder="6:20"/>
          <Field label="Easy HR (bpm)" value={draft.easyHR} onChange={v=>set("easyHR",v)} placeholder="130-140"/>
        </div>
        <div>
          <label style={{ fontSize:11,color:"#888",display:"block",marginBottom:5,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.07em" }}>Experience</label>
          <select value={draft.experience} onChange={e=>set("experience",e.target.value)}
            style={{ width:"100%",padding:"11px 12px",borderRadius:8,border:"1px solid #e0e0dc",background:"#fff",color:"#1a1a1a",fontSize:15,outline:"none" }}>
            <option value="">Select level...</option>
            <option value="recreational">Recreational</option>
            <option value="competitive_recreational">Competitive recreational</option>
            <option value="club_athlete">Club athlete</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize:11,color:"#888",display:"block",marginBottom:8,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.07em" }}>Injuries</label>
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
          <label style={{ fontSize:11,color:"#888",display:"block",marginBottom:8,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.07em" }}>Weekly Schedule</label>
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

function NavBar({ screen, onNav }) {
  const nav = [{id:"home",label:"Plan",icon:"▦"},{id:"log",label:"Log",icon:"⊕"},{id:"progress",label:"Progress",icon:"↗"},{id:"profile",label:"Profile",icon:"◉"}];
  return (
    <div style={{ position:"sticky",bottom:0,background:"#fff",borderTop:"1px solid #eee",display:"flex",justifyContent:"space-around",padding:"8px 0 env(safe-area-inset-bottom, 12px)",zIndex:100 }}>
      {nav.map(n=>(
        <button key={n.id} onClick={()=>onNav(n.id)}
          style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:2,padding:"6px 20px",background:"none",border:"none",cursor:"pointer",color:screen===n.id?"#1B6FE8":"#aaa" }}>
          <span style={{ fontSize:18 }}>{n.icon}</span>
          <span style={{ fontSize:11,fontWeight:screen===n.id?700:400 }}>{n.label}</span>
        </button>
      ))}
    </div>
  );
}

export default function App() {
  const [store, setStore] = useState(()=>({ profile:defaultProfile, sessions:[], weekPlan:null, strava:null, ...loadStore() }));
  const [screen, setScreen] = useState("home");
  const [loading, setLoading] = useState(false);
  const [aiText, setAiText] = useState("");
  const [error, setError] = useState("");
  const [activeDay, setActiveDay] = useState(null);
  const [logData, setLogData] = useState({});
  const [stravaLoading, setStravaLoading] = useState(false);
  const [stravaActivities, setStravaActivities] = useState([]);

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

  function prefillFromStrava(activity) {
    setLogData({ type:activity.type, avgPace:activity.avgPace, avgHR:activity.avgHR?.toString(), maxHR:activity.maxHR?.toString(), cadence:activity.cadence?.toString(), te:"", rpe:"", notes:`${activity.name} — ${activity.distance}km, +${activity.elevGain}m`, stravaId:activity.id });
    setStravaActivities([]);
    setScreen("log");
  }

  async function generateWeekPlan() {
    await run(async () => {
      const p = store.profile;
      const r = await callClaude(SYSTEM, `Generate a detailed weekly training plan:
Goal: ${p.goal} in ${p.goalTime} | Level: ${p.experience}
Threshold: ${p.thresholdPace}/km | Easy HR: ${p.easyHR} bpm | Long run pace: ${p.longRunPace}/km
Schedule: ${JSON.stringify(p.schedule)}
Injuries: ${p.injuries.join(", ")||"none"}
Recent: ${store.sessions.slice(-3).map(s=>`${s.date}: ${s.type}, pace ${s.avgPace}, HR ${s.avgHR}`).join("; ")||"none"}
For each training day: warm-up, main set (reps/pace/HR/rest), cool-down, fueling, 1 cue, 1 mistake warning.
Start with 2-sentence fitness vs goal assessment.`);
      persist({ weekPlan:{ content:r, generated:new Date().toISOString() } });
      setAiText(r);
    });
  }

  async function analyzeSession() {
    await run(async () => {
      const p = store.profile;
      const r = await callClaude(SYSTEM, `Analyze session — ${p.goal} in ${p.goalTime} (threshold: ${p.thresholdPace}/km):
Type: ${logData.type} | Pace: ${logData.avgPace}/km | Avg HR: ${logData.avgHR} | Max HR: ${logData.maxHR} | Cadence: ${logData.cadence} spm | TE: ${logData.te} | RPE: ${logData.rpe}/10
${logData.notes?`Notes: ${logData.notes}`:""}
Injuries: ${p.injuries.join(", ")||"none"}
## Verdict\nOn target / Too hard / Too easy — data reasoning\n## Metric flags\n## Next session adjustment\n## Injury risk`);
      persist({ sessions:[...(store.sessions||[]), { id:Date.now(), date:new Date().toISOString().split("T")[0], ...logData, analysis:r }] });
      setAiText(r);
    });
  }

  async function getSessionDetail(day) {
    setActiveDay(day); setScreen("session"); setAiText(""); setError("");
    await run(async () => {
      const p = store.profile;
      const type = p.schedule[day];
      const r = await callClaude(SYSTEM, `Complete session plan: ${SESSION_LABELS[type]} on ${day}
Athlete: ${p.goal} in ${p.goalTime} | Threshold ${p.thresholdPace}/km | Easy HR ${p.easyHR} bpm | ${p.experience}
Injuries: ${p.injuries.join(", ")||"none"}
Recent load: ${store.sessions.slice(-2).map(s=>`${s.type} TE:${s.te}`).join(", ")||"unknown"}
## Warm-up\n## Main set\n## Cool-down\n## Fueling\n## 3 common mistakes
Include: exact paces, HR zones (bpm), cadence targets, rep structure, rest.`);
      setAiText(r);
    });
  }

  function handleNav(id) {
    setScreen(id); setAiText(""); setError(""); setStravaActivities([]);
    if (id !== "session") setActiveDay(null);
  }

  return (
    <div style={{ maxWidth:430,margin:"0 auto",minHeight:"100vh",display:"flex",flexDirection:"column",background:"#fff" }}>
      <div style={{ flex:1,overflowY:"auto",display:"flex",flexDirection:"column" }}>
        {screen==="home"&&<HomeScreen store={store} today={today} loading={loading} error={error} hasProfile={hasProfile} onGeneratePlan={generateWeekPlan} onSessionTap={getSessionDetail} onGoProfile={()=>setScreen("profile")}/>}
        {screen==="session"&&<SessionScreen store={store} activeDay={activeDay} loading={loading} error={error} aiText={aiText} onBack={()=>{ setScreen("home"); setAiText(""); setActiveDay(null); }}/>}
        {screen==="log"&&<LogScreen loading={loading} error={error} aiText={aiText} stravaLoading={stravaLoading} stravaActivities={stravaActivities} logData={logData} setLogData={setLogData} onImportStrava={importFromStrava} onPrefillFromStrava={prefillFromStrava} onAnalyze={analyzeSession}/>}
        {screen==="progress"&&<ProgressScreen store={store}/>}
        {screen==="profile"&&<ProfileScreen store={store} persist={persist} onSaved={()=>setScreen("home")}/>}
      </div>
      <NavBar screen={screen} onNav={handleNav}/>
    </div>
  );
}
