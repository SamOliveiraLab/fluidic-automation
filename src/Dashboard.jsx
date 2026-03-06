import { useState, useEffect, useRef, useCallback } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";

/* ═══════════════════════════════════════════════════
   CONFIGURATION — Change this to your Leader's address
   ═══════════════════════════════════════════════════ */
const API_BASE = ""; // Vite proxy handles routing to Pioreactor (see vite.config.js)

const REFRESH_INTERVAL = 10000; // 10 seconds

/* ═══════════════════════════════════════════════════
   API HELPERS
   ═══════════════════════════════════════════════════ */
const api = async (path) => {
  try {
    const res = await fetch(`${API_BASE}${path}`);
    if (!res.ok) throw new Error(res.statusText);
    return await res.json();
  } catch (e) {
    console.warn(`API call failed: ${path}`, e.message);
    return null;
  }
};

// Transform Pioreactor time_series response → chart-friendly format
// API returns: { series: ["unit1-ch","unit2-ch"], data: [[{x,y},...],[{x,y},...]] }
// We need:    [{ t:"HH:MM", r01: value, r02: value }, ...]
const transformTimeSeries = (raw, workers) => {
  if (!raw?.series?.length || !raw?.data?.length) return { data: [], keys: [] };
  
  // Build key mapping: series name → short key like "r01", "r02"
  const keyMap = {};
  const keys = [];
  raw.series.forEach((seriesName, i) => {
    // seriesName is like "oliveirapioreactor01-2" — extract the unit name
    const unitName = seriesName.replace(/-\d+$/, "");
    const workerIdx = workers.findIndex(w => w.id === unitName);
    const shortKey = `r${String(workerIdx + 1).padStart(2, "0")}`;
    const label = workers[workerIdx]?.label || unitName;
    keyMap[i] = shortKey;
    keys.push({ key: shortKey, label, s: `R-${String(workerIdx + 1).padStart(2, "0")}` });
  });

  // Merge all series into one array keyed by timestamp
  const timeMap = {};
  raw.data.forEach((seriesData, seriesIdx) => {
    const key = keyMap[seriesIdx];
    seriesData.forEach(point => {
      const timeStr = new Date(point.x).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
      if (!timeMap[timeStr]) timeMap[timeStr] = { t: timeStr };
      timeMap[timeStr][key] = point.y;
    });
  });

  // Sort by time and sample down if too many points (keep ~200 max for performance)
  let data = Object.values(timeMap).sort((a, b) => a.t.localeCompare(b.t));
  if (data.length > 200) {
    const step = Math.ceil(data.length / 200);
    data = data.filter((_, i) => i % step === 0);
  }

  return { data, keys };
};

// Transform /api/workers response → reactor card format
const transformWorkers = (raw) => {
  if (!raw?.length) return [];
  return raw.map((w, i) => ({
    id: w.pioreactor_unit,
    label: w.pioreactor_unit.replace(/pioreactor/i, "").replace(/oliveira/i, "Bioreactor ").replace(/worker/i, "Worker ").trim() || `Unit ${i + 1}`,
    role: i === 0 ? "Leader + Worker" : "Worker",
    status: w.is_active ? "online" : "offline",
    model: `${w.model_name?.replace("pioreactor_", "") || "unknown"} v${w.model_version || "?"}`,
    addedAt: w.added_at,
  }));
};

/* ═══════════════════════════════════════════════════
   CUSTOM HOOK: usePioreactorData
   Fetches all data from the API and refreshes periodically
   ═══════════════════════════════════════════════════ */
const usePioreactorData = () => {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [experiment, setExperiment] = useState(null);
  const [reactors, setReactors] = useState([]);
  const [odData, setOdData] = useState({ data: [], keys: [] });
  const [tempData, setTempData] = useState({ data: [], keys: [] });
  const [stirData, setStirData] = useState({ data: [], keys: [] });
  const [growthData, setGrowthData] = useState({ data: [], keys: [] });
  const [lastFetch, setLastFetch] = useState(null);
  const statusOverridesRef = useRef({}); // Always-current override values for fetchAll to read

  const fetchAll = useCallback(async () => {
    // 1. Fetch workers
    const workersRaw = await api("/api/workers");
    if (!workersRaw) { setConnected(false); setLoading(false); return; }
    
    setConnected(true);
    const workers = transformWorkers(workersRaw);
    // Merge with local overrides so toggles persist
    const overrides = statusOverridesRef.current;
    const merged = workers.map(w => overrides[w.id] 
      ? { ...w, status: overrides[w.id] } 
      : w
    );
    setReactors(merged);

    // 2. Fetch latest experiment
    const expsRaw = await api("/api/experiments");
    if (!expsRaw?.length) { setLoading(false); return; }
    const latestExp = expsRaw[expsRaw.length - 1];
    setExperiment(latestExp);
    const expName = encodeURIComponent(latestExp.experiment);

    // 3. Fetch all time series in parallel
    const [odRaw, tempRaw, stirRaw, growthRaw] = await Promise.all([
      api(`/api/experiments/${expName}/time_series/od_readings?filter_mod_N=1`),
      api(`/api/experiments/${expName}/time_series/temperature_readings?filter_mod_N=1`),
      api(`/api/experiments/${expName}/time_series/stirring_rates?filter_mod_N=1`),
      api(`/api/experiments/${expName}/time_series/growth_rates?filter_mod_N=1`),
    ]);

    setOdData(transformTimeSeries(odRaw, workers));
    setTempData(transformTimeSeries(tempRaw, workers));
    setStirData(transformTimeSeries(stirRaw, workers));
    setGrowthData(transformTimeSeries(growthRaw, workers));
    setLastFetch(new Date());
    setLoading(false);
  }, []);

  // Initial fetch + interval
  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, [fetchAll]);

  // Add reactor via API
  const addReactor = async (hostname) => {
    const res = await api(`/api/workers/${encodeURIComponent(hostname)}`);
    // Also try POST if available
    if (!res) {
      // Optimistic local add — will be confirmed on next refresh
      setReactors(prev => [...prev, {
        id: hostname, label: hostname, role: "Worker",
        status: "online", model: "unknown", addedAt: new Date().toISOString(),
      }]);
    }
    fetchAll(); // refresh
  };

  // Remove reactor via API
  const removeReactor = async (id) => {
    await fetch(`${API_BASE}/api/workers/${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {});
    setReactors(prev => prev.filter(r => r.id !== id));
    fetchAll();
  };

  // Toggle active status
  const toggleStatus = async (id) => {
    setReactors(prev => {
      const reactor = prev.find(r => r.id === id);
      if (!reactor) return prev;
      const newStatus = reactor.status === "offline" ? "online" : "offline";
      // Store override so auto-refresh doesn't revert it
      statusOverridesRef.current = { ...statusOverridesRef.current, [id]: newStatus };
      // Try API call (fire-and-forget)
      const newActive = newStatus === "online" ? 1 : 0;
      fetch(`${API_BASE}/api/workers/${encodeURIComponent(id)}/is_active`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: newActive }),
      }).catch(() => {});
      return prev.map(r => r.id === id ? { ...r, status: newStatus } : r);
    });
  };

  return {
    connected, loading, experiment, reactors, lastFetch,
    odData, tempData, stirData, growthData,
    addReactor, removeReactor, toggleStatus, refresh: fetchAll,
  };
};

const LOGO = "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";

/* ─── THEMES ─── */
const themes = {
  light: {
    bg:"#f5f1eb",bgAlt:"#ece7df",surface:"#fffdf9",border:"#ddd5c9",borderLight:"#e8e2d8",
    text:"#2c2418",textSecondary:"#7a6f60",textMuted:"#a89d8e",
    accent:"#0d5c63",accentLight:"#e6f2f3",accentSoft:"#1a8a94",
    warning:"#c4841d",warningBg:"#fdf3e3",danger:"#b83a3a",dangerBg:"#fce8e8",
    success:"#2d7a4f",successBg:"#e8f5ee",
    chartLine1:"#0d5c63",chartLine2:"#c4841d",gridLine:"#e8e2d810",dotGrid:"#d4cdc2",
    comingSoonBg:"#f0ece5",comingSoonBorder:"#ddd5c9",
    modalOverlay:"rgba(44,36,24,0.5)",
    shadow:"0 1px 3px rgba(44,36,24,0.06), 0 6px 16px rgba(44,36,24,0.04)",
    shadowHover:"0 2px 8px rgba(44,36,24,0.08), 0 12px 28px rgba(44,36,24,0.06)",
  },
  dark: {
    bg:"#151820",bgAlt:"#1c2029",surface:"#1e2230",border:"#2a3040",borderLight:"#232838",
    text:"#e2dfd8",textSecondary:"#8a8578",textMuted:"#5c5850",
    accent:"#4ec9b0",accentLight:"#4ec9b015",accentSoft:"#3da894",
    warning:"#e0a64a",warningBg:"#e0a64a12",danger:"#e06060",dangerBg:"#e0606012",
    success:"#5cb87a",successBg:"#5cb87a12",
    chartLine1:"#4ec9b0",chartLine2:"#e0a64a",gridLine:"#2a304020",dotGrid:"#2a3040",
    comingSoonBg:"#1a1e28",comingSoonBorder:"#2a3040",
    modalOverlay:"rgba(0,0,0,0.65)",
    shadow:"0 1px 3px rgba(0,0,0,0.2), 0 6px 16px rgba(0,0,0,0.15)",
    shadowHover:"0 2px 8px rgba(0,0,0,0.25), 0 12px 28px rgba(0,0,0,0.2)",
  },
};

/* ─── EXPORT HELPERS ─── */
const exportCSV = (data, cols, filename) => {
  if(!data?.length) return;
  const csv = [cols.map(c=>c.label).join(","), ...data.map(row=>cols.map(c=>row[c.key]??"").join(","))].join("\n");
  const a = document.createElement("a"); a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"})); a.download=`${filename}.csv`; a.click();
};
const exportPNG = (ref, filename) => {
  const svg = ref?.current?.querySelector("svg"); if(!svg) return;
  const canvas=document.createElement("canvas"), ctx=canvas.getContext("2d"), img=new Image();
  const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)],{type:"image/svg+xml"}));
  img.onload=()=>{canvas.width=img.width*2;canvas.height=img.height*2;ctx.scale(2,2);ctx.fillStyle="#fff";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0);canvas.toBlob(b=>{const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=`${filename}.png`;a.click()});URL.revokeObjectURL(url)};
  img.src=url;
};

/* ─── SMALL COMPONENTS ─── */
const Dot=({s,th})=>{const c={online:th.success,warning:th.warning,offline:th.danger}[s]||th.textMuted;return (<span style={{display:"inline-block",width:8,height:8,borderRadius:"50%",background:c,boxShadow:s==="online"?`0 0 6px ${c}80`:"none"}}/>)};

const Tip=({active,payload,label,th})=>{
  if(!active||!payload?.length)return null;
  return (<div style={{background:th.surface,border:`1px solid ${th.border}`,borderRadius:10,padding:"10px 14px",boxShadow:th.shadow,fontSize:16}}>
    <div style={{color:th.textMuted,marginBottom:6,fontWeight:600}}>{label} UTC</div>
    {payload.map((p,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:2}}>
      <div style={{width:8,height:8,borderRadius:3,background:p.color}}/><span style={{color:th.textSecondary}}>{p.name}:</span>
      <span style={{fontWeight:700,color:th.text,fontFamily:"'JetBrains Mono',monospace"}}>{p.value?.toFixed(6)}</span>
    </div>)}
  </div>)
};

/* ─── INTERPRETATION MODAL ─── */
const InterpModal=({open,onClose,th,title,text:interpText})=>{
  const[txt,setTxt]=useState("");const[loading,setL]=useState(false);
  useEffect(()=>{if(open){setL(true);setTxt("");const t=setTimeout(()=>{setTxt(interpText);setL(false)},1600);return()=>clearTimeout(t)}},[open,interpText]);
  if(!open)return null;
  return (<div onClick={onClose} style={{position:"fixed",inset:0,zIndex:1000,background:th.modalOverlay,display:"flex",alignItems:"center",justifyContent:"center",padding:20,backdropFilter:"blur(4px)"}}>
    <div onClick={e=>e.stopPropagation()} style={{background:th.surface,borderRadius:18,maxWidth:560,width:"100%",maxHeight:"80vh",overflowY:"auto",border:`1px solid ${th.border}`,boxShadow:th.shadowHover}}>
      <div style={{padding:"20px 24px",borderBottom:`1px solid ${th.borderLight}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}><span style={{fontSize:24}}>🧬</span><div><h3 style={{margin:0,fontSize:20,fontWeight:700,color:th.text}}>{title}</h3><p style={{margin:0,fontSize:15,color:th.textMuted}}>AI-powered analysis</p></div></div>
        <button onClick={onClose} style={{background:th.bgAlt,border:`1px solid ${th.border}`,borderRadius:8,width:32,height:32,cursor:"pointer",fontSize:20,color:th.textSecondary,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
      </div>
      <div style={{padding:"20px 24px"}}>{loading?<div style={{textAlign:"center",padding:"32px 0"}}><div style={{width:36,height:36,borderRadius:"50%",border:`3px solid ${th.borderLight}`,borderTopColor:th.accent,animation:"spin 0.8s linear infinite",margin:"0 auto 16px"}}/><p style={{color:th.textMuted,fontSize:17}}>Analyzing data...</p></div>:<div style={{fontFamily:'"Newsreader",Georgia,serif',fontSize:17.5,lineHeight:1.85,color:th.textSecondary,whiteSpace:"pre-wrap"}}>{txt}</div>}</div>
    </div>
  </div>)
};
const Chart=({th,title,subtitle,data,keys,colors,yFmt,csvCols,csvName,interpTitle,interpText,emptyIcon,emptyTitle,emptySub,emptyAction})=>{
  const[filter,setFilter]=useState("both");const[showI,setShowI]=useState(false);const ref=useRef(null);const has=data?.length>0;
  return (<><div ref={ref} style={{background:th.surface,border:`1px solid ${th.border}`,borderRadius:16,boxShadow:th.shadow,marginBottom:20,overflow:"hidden"}}>
    <div style={{padding:"18px 22px",borderBottom:`1px solid ${th.borderLight}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
      <div style={{flex:1,minWidth:200}}><h2 style={{margin:0,fontSize:20,fontWeight:700,color:th.text}}>{title}</h2><p style={{margin:"4px 0 0",fontSize:16,color:th.textMuted}}>{subtitle}</p></div>
      <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
        {has&&keys.length>1&&["both",...keys.map(k=>k.key)].map(f=><button key={f} onClick={()=>setFilter(f)} style={{padding:"6px 12px",borderRadius:7,background:filter===f?th.accent:th.bgAlt,color:filter===f?"#fff":th.textMuted,border:`1px solid ${filter===f?th.accent:th.border}`,cursor:"pointer",fontSize:15,fontWeight:600,fontFamily:"inherit"}}>{f==="both"?"Both":keys.find(k=>k.key===f)?.s||f}</button>)}
        {interpText&&<button onClick={()=>setShowI(true)} style={{padding:"6px 14px",borderRadius:7,background:"transparent",border:`1.5px solid ${th.accent}50`,color:th.accent,cursor:"pointer",fontSize:15,fontWeight:700,fontFamily:"inherit"}}>🧬 Interpret</button>}
        <button onClick={()=>exportCSV(data,csvCols,csvName)} disabled={!has} style={{padding:"5px 10px",borderRadius:6,fontSize:14,fontWeight:600,fontFamily:"inherit",background:has?th.bgAlt:"transparent",border:`1px solid ${th.border}`,color:has?th.textSecondary:th.textMuted,cursor:has?"pointer":"default",opacity:has?1:0.4}}>↓ CSV</button>
        <button onClick={()=>exportPNG(ref,csvName)} disabled={!has} style={{padding:"5px 10px",borderRadius:6,fontSize:14,fontWeight:600,fontFamily:"inherit",background:has?th.bgAlt:"transparent",border:`1px solid ${th.border}`,color:has?th.textSecondary:th.textMuted,cursor:has?"pointer":"default",opacity:has?1:0.4}}>↓ PNG</button>
      </div>
    </div>
    {has?<><div style={{padding:"16px 10px 8px 0"}}><ResponsiveContainer width="100%" height={260}><AreaChart data={data} margin={{top:10,right:16,left:8,bottom:5}}>
      <defs>{keys.map((dk,i)=><linearGradient key={dk.key} id={`f-${csvName}-${dk.key}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={colors[i]} stopOpacity={0.2}/><stop offset="100%" stopColor={colors[i]} stopOpacity={0.01}/></linearGradient>)}</defs>
      <CartesianGrid strokeDasharray="3 3" stroke={th.gridLine}/><XAxis dataKey="t" tick={{fontSize:14,fill:th.textMuted}} axisLine={{stroke:th.border}} tickLine={false} interval={5}/>
      <YAxis domain={["auto","auto"]} tick={{fontSize:14,fill:th.textMuted}} axisLine={{stroke:th.border}} tickLine={false} width={58} tickFormatter={yFmt||(v=>v.toFixed(3))}/>
      <Tooltip content={<Tip th={th}/>}/>
      {keys.map((dk,i)=>(filter==="both"||filter===dk.key)&&<Area key={dk.key} type="monotone" dataKey={dk.key} name={dk.label} stroke={colors[i]} fill={`url(#f-${csvName}-${dk.key})`} strokeWidth={2.5} dot={false}/>)}
    </AreaChart></ResponsiveContainer></div>
    <div style={{padding:"14px 22px",borderTop:`1px solid ${th.borderLight}`,display:"flex",gap:24,flexWrap:"wrap"}}>
      {keys.map((dk,i)=>{const vals=data.map(d=>d[dk.key]).filter(v=>v!=null);const cur=vals[vals.length-1];const delta=cur-vals[0];return (<div key={dk.key} style={{display:"flex",gap:20}}>
        <div><div style={{fontSize:14,color:th.textMuted,fontWeight:600,marginBottom:2}}>{dk.s} Current</div><div style={{fontSize:20,fontWeight:700,color:colors[i],fontFamily:"'JetBrains Mono',monospace"}}>{cur?.toFixed(4)}</div></div>
        <div><div style={{fontSize:14,color:th.textMuted,fontWeight:600,marginBottom:2}}>{dk.s} Δ</div><div style={{fontSize:20,fontWeight:700,color:delta>=0?th.success:th.danger,fontFamily:"'JetBrains Mono',monospace"}}>{delta>=0?"+":""}{delta?.toFixed(4)}</div></div>
      </div>)})}
    </div></>
    :<div style={{padding:"48px 24px",textAlign:"center",background:`repeating-linear-gradient(45deg,transparent,transparent 10px,${th.border}08 10px,${th.border}08 11px)`,borderRadius:8,margin:"16px 22px"}}>
      <div style={{fontSize:40,marginBottom:12,opacity:0.35}}>{emptyIcon}</div>
      <div style={{fontSize:17,fontWeight:600,color:th.textSecondary,marginBottom:6}}>{emptyTitle}</div>
      <div style={{fontSize:16,color:th.textMuted,lineHeight:1.6,maxWidth:360,margin:"0 auto"}}>{emptySub}</div>
      {emptyAction&&<div style={{marginTop:14,display:"inline-block",fontSize:15,fontWeight:700,color:th.accent,background:th.accentLight,padding:"6px 14px",borderRadius:7}}>{emptyAction}</div>}
    </div>}
  </div>
  <InterpModal open={showI} onClose={()=>setShowI(false)} th={th} title={interpTitle} text={interpText||""}/></>)
};

/* ─── INTERPRETATIONS ─── */
const I_OD=`Both bioreactors are currently running with sterile water — no biological organisms are present.\n\nBioreactor 01 (OD ~0.206–0.208) shows a stable baseline with a notable downward drift beginning around 02:30 UTC, dropping from ~0.2075 to ~0.2058. This is not biological — it's almost certainly caused by ambient temperature cooling. As water cools, its refractive index changes slightly, which shifts the OD reading.\n\nBioreactor 02 (OD ~0.005) is reading near-zero, confirming very clear water with minimal light scatter.\n\nKey takeaway: Both sensors are working correctly. When you introduce a culture, you'll see OD begin climbing from these baselines. The temperature-driven drift tells you to run Temperature Automation for precise measurements.`;
const I_TEMP=`No temperature data is currently being collected.\n\nTo start: Pioreactor UI → Control all Pioreactors → Temperature Automation → Thermostat → 30°C.\n\nThis works with water. You'll see temperature climb from room temp to target, then hold steady. Temperature data is critical because it directly affects OD readings.`;
const I_STIR=`No stirring data is currently being collected.\n\nStirring should be running if OD readings are active. Check that the Stirring activity is started in the Pioreactor UI.\n\nA sudden drop to 0 RPM means the stir bar detached — the culture stops being mixed, causing sedimentation and inaccurate OD readings.`;
const I_GR=`No growth rate data is currently being collected.\n\nGrowth rate requires the Growth Rate activity AND actual organisms. With sterile water, it will always be zero.\n\nWith real organisms: expect yeast in YPD at 30°C to show a doubling time of ~90 minutes during exponential phase.`;


/* ─── ADD REACTOR MODAL ─── */
const AddReactorModal = ({open, onClose, onAdd, th}) => {
  const [hostname, setHostname] = useState("");
  const [label, setLabel] = useState("");
  const [model, setModel] = useState("40mL v1.5");
  const [step, setStep] = useState(1);
  const [adding, setAdding] = useState(false);

  const reset = () => { setHostname(""); setLabel(""); setModel("40mL v1.5"); setStep(1); setAdding(false); };
  const handleAdd = async () => {
    if (!hostname.trim()) return;
    setAdding(true);
    await onAdd(hostname.trim());
    setAdding(false);
    reset();
    onClose();
  };

  if (!open) return null;
  const inp = {width:"100%",padding:"10px 14px",borderRadius:9,border:`1px solid ${th.border}`,background:th.bgAlt,color:th.text,fontSize:17,fontFamily:"inherit",outline:"none"};

  return (
    <div onClick={()=>{reset();onClose()}} style={{position:"fixed",inset:0,zIndex:1000,background:th.modalOverlay,display:"flex",alignItems:"center",justifyContent:"center",padding:20,backdropFilter:"blur(4px)"}}>
      <div onClick={e=>e.stopPropagation()} style={{background:th.surface,borderRadius:18,maxWidth:480,width:"100%",border:`1px solid ${th.border}`,boxShadow:th.shadowHover,overflow:"hidden"}}>
        <div style={{padding:"20px 24px",borderBottom:`1px solid ${th.borderLight}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:24}}>➕</span>
            <div>
              <h3 style={{margin:0,fontSize:20,fontWeight:700,color:th.text}}>Add Bioreactor</h3>
              <p style={{margin:0,fontSize:15,color:th.textMuted}}>Step {step} of 2</p>
            </div>
          </div>
          <button onClick={()=>{reset();onClose()}} style={{background:th.bgAlt,border:`1px solid ${th.border}`,borderRadius:8,width:32,height:32,cursor:"pointer",fontSize:20,color:th.textSecondary,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
        </div>

        {step === 1 && (
          <div style={{padding:"24px"}}>
            <div style={{marginBottom:20,padding:"14px 16px",background:th.accentLight,borderRadius:10,border:`1px solid ${th.accent}20`}}>
              <p style={{margin:0,fontSize:16,color:th.accent,lineHeight:1.6}}>
                <strong>Before adding here:</strong> Make sure the Pioreactor has Worker software installed and is connected to the same Wi-Fi network as your Leader.
              </p>
            </div>
            <div style={{marginBottom:16}}>
              <label style={{display:"block",fontSize:16,fontWeight:600,color:th.textSecondary,marginBottom:6}}>Hostname *</label>
              <input value={hostname} onChange={e=>setHostname(e.target.value)} placeholder="e.g. worker05 or oliveirapioreactor05" style={inp}/>
              <p style={{margin:"6px 0 0",fontSize:15,color:th.textMuted}}>The name you gave it during SD card setup in Raspberry Pi Imager</p>
            </div>
            <div style={{marginBottom:16}}>
              <label style={{display:"block",fontSize:16,fontWeight:600,color:th.textSecondary,marginBottom:6}}>Display Label</label>
              <input value={label} onChange={e=>setLabel(e.target.value)} placeholder="e.g. Bioreactor 05 (optional)" style={inp}/>
            </div>
            <div style={{marginBottom:20}}>
              <label style={{display:"block",fontSize:16,fontWeight:600,color:th.textSecondary,marginBottom:6}}>Model</label>
              <div style={{display:"flex",gap:8}}>
                {["20mL v1.1","40mL v1.5"].map(m=>(
                  <button key={m} onClick={()=>setModel(m)} style={{flex:1,padding:"10px",borderRadius:8,border:`1.5px solid ${model===m?th.accent:th.border}`,background:model===m?th.accentLight:"transparent",color:model===m?th.accent:th.textSecondary,fontSize:16,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{m}</button>
                ))}
              </div>
            </div>
            <button onClick={()=>{if(hostname.trim()) setStep(2)}} disabled={!hostname.trim()} style={{width:"100%",padding:"12px",borderRadius:10,border:"none",background:hostname.trim()?th.accent:th.border,color:hostname.trim()?"#fff":th.textMuted,fontSize:17,fontWeight:700,cursor:hostname.trim()?"pointer":"default",fontFamily:"inherit"}}>
              Next →
            </button>
          </div>
        )}

        {step === 2 && (
          <div style={{padding:"24px"}}>
            <div style={{marginBottom:24}}>
              <div style={{fontSize:16,fontWeight:600,color:th.textMuted,marginBottom:12,textTransform:"uppercase",letterSpacing:"0.08em"}}>Confirm Details</div>
              <div style={{background:th.bgAlt,borderRadius:12,padding:"16px 18px",border:`1px solid ${th.border}`}}>
                {[
                  {k:"Hostname",v:hostname},
                  {k:"Label",v:label || hostname},
                  {k:"Role",v:"Worker"},
                  {k:"Model",v:model},
                ].map((row,i)=>(
                  <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:i<3?`1px solid ${th.borderLight}`:"none"}}>
                    <span style={{fontSize:16,color:th.textMuted}}>{row.k}</span>
                    <span style={{fontSize:16,fontWeight:600,color:th.text,fontFamily:"'JetBrains Mono',monospace"}}>{row.v}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{marginBottom:20,padding:"14px 16px",background:th.warningBg,borderRadius:10,border:`1px solid ${th.warning}20`}}>
              <p style={{margin:0,fontSize:16,color:th.warning,lineHeight:1.6}}>
                <strong>On the lab network:</strong> This will run <code style={{fontSize:15,background:`${th.warning}15`,padding:"1px 6px",borderRadius:4}}>pio workers add {hostname}</code> on the Leader. Make sure the Pioreactor is powered on.
              </p>
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setStep(1)} style={{flex:1,padding:"12px",borderRadius:10,border:`1px solid ${th.border}`,background:"transparent",color:th.textSecondary,fontSize:17,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>← Back</button>
              <button onClick={handleAdd} disabled={adding} style={{flex:2,padding:"12px",borderRadius:10,border:"none",background:th.accent,color:"#fff",fontSize:17,fontWeight:700,cursor:adding?"wait":"pointer",fontFamily:"inherit",opacity:adding?0.7:1}}>{adding?"Adding...":"Add to Cluster"}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
};

/* ─── MAIN ─── */
export default function App(){
  const[mode,setMode]=useState("light");const[showS,setShowS]=useState(false);const[sidebar,setSidebar]=useState(false);const[page,setPage]=useState("overview");
  const[showAddReactor,setShowAddReactor]=useState(false);
  const th=themes[mode];
  
  // Live API data
  const {
    connected, loading, experiment, reactors, lastFetch,
    odData, tempData, stirData, growthData,
    addReactor, removeReactor, toggleStatus, refresh,
  } = usePioreactorData();

  const online=reactors.filter(r=>r.status==="online").length;
  const nav=[{id:"overview",icon:"◉",label:"Overview"},{id:"reactors",icon:"⬢",label:"Bioreactors"},{id:"od",icon:"◎",label:"OD Readings"},{id:"temp",icon:"◈",label:"Temperature"},{id:"stirring",icon:"↻",label:"Stirring"},{id:"growth",icon:"↗",label:"Growth Rate"},{id:"pumps",icon:"⬡",label:"Pump Control"},{id:"alerts",icon:"△",label:"Alerts"}];

  // Use dynamic keys from API data, or fallback
  const odKeys = odData.keys.length ? odData.keys : [{key:"r01",label:"Bioreactor 01",s:"R-01"}];
  const tempKeys = tempData.keys.length ? tempData.keys : odKeys;
  const stirKeys = stirData.keys.length ? stirData.keys : odKeys;
  const growthKeys = growthData.keys.length ? growthData.keys : odKeys;

  // Dynamic colors for however many reactors exist
  const palette = [th.chartLine1, th.chartLine2, "#e06060", "#8b5cf6", "#22c55e", "#f59e0b", "#ec4899", "#06b6d4"];

  const odP={title:"Optical Density (OD)",subtitle:odData.data.length?`90° scatter · ${odData.data.length} readings · Live`:"Waiting for data...",data:odData.data,keys:odKeys,colors:palette,yFmt:v=>v<0.01?v.toFixed(4):v.toFixed(3),csvCols:[{key:"t",label:"Time"},...odKeys.map(k=>({key:k.key,label:`${k.label}_OD`}))],csvName:"od_readings",interpTitle:"OD Interpretation",interpText:I_OD,emptyIcon:"◎",emptyTitle:"No OD data yet",emptySub:connected?"Start OD Reading on your Pioreactors.":"Cannot reach Pioreactor API. Are you on the lab network?",emptyAction:connected?"Start OD Reading →":"Check Connection"};
  const tempP={title:"Temperature (°C)",subtitle:tempData.data.length?`${tempData.data.length} readings · Live`:"Not running",data:tempData.data,keys:tempKeys,colors:palette,yFmt:v=>v.toFixed(1)+"°",csvCols:[{key:"t",label:"Time"},...tempKeys.map(k=>({key:k.key,label:`${k.label}_Temp`}))],csvName:"temperature",interpTitle:"Temperature Interpretation",interpText:I_TEMP,emptyIcon:"🌡️",emptyTitle:"No temperature data",emptySub:connected?"Start Temperature Automation (Thermostat, e.g. 30°C). Works with water.":"Cannot reach Pioreactor API.",emptyAction:connected?"Start Temperature Automation →":"Check Connection"};
  const stirP={title:"Stirring Rate (RPM)",subtitle:stirData.data.length?`${stirData.data.length} readings · Live`:"Not running",data:stirData.data,keys:stirKeys,colors:palette,yFmt:v=>Math.round(v)+"",csvCols:[{key:"t",label:"Time"},...stirKeys.map(k=>({key:k.key,label:`${k.label}_RPM`}))],csvName:"stirring",interpTitle:"Stirring Interpretation",interpText:I_STIR,emptyIcon:"↻",emptyTitle:"No stirring data",emptySub:connected?"Stirring data appears when the Stirring activity is running.":"Cannot reach Pioreactor API.",emptyAction:connected?"Check Stirring Activity →":"Check Connection"};
  const grP={title:"Growth Rate",subtitle:growthData.data.length?`${growthData.data.length} readings · Live`:"Not running",data:growthData.data,keys:growthKeys,colors:palette,yFmt:v=>v.toFixed(4),csvCols:[{key:"t",label:"Time"},...growthKeys.map(k=>({key:k.key,label:`${k.label}_GrowthRate`}))],csvName:"growth_rate",interpTitle:"Growth Rate Interpretation",interpText:I_GR,emptyIcon:"📈",emptyTitle:"No growth rate data",emptySub:connected?"Requires Growth Rate activity AND organisms growing.":"Cannot reach Pioreactor API.",emptyAction:connected?"Needs Active Culture":"Check Connection"};

  const CS=({icon,title,desc})=><div style={{background:th.comingSoonBg,border:`1.5px dashed ${th.comingSoonBorder}`,borderRadius:14,padding:"28px 24px",textAlign:"center",position:"relative",overflow:"hidden"}}>
    <div style={{position:"absolute",inset:0,backgroundImage:`radial-gradient(${th.comingSoonBorder} 1px,transparent 1px)`,backgroundSize:"20px 20px",opacity:0.3}}/>
    <div style={{position:"relative"}}><div style={{fontSize:36,marginBottom:12,opacity:0.5}}>{icon}</div><div style={{display:"inline-block",fontSize:14,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",color:th.accent,background:th.accentLight,padding:"4px 12px",borderRadius:20,marginBottom:12}}>Coming Soon</div><h3 style={{margin:"0 0 8px",fontSize:20,fontWeight:700,color:th.text}}>{title}</h3><p style={{margin:0,fontSize:17,color:th.textMuted,lineHeight:1.6}}>{desc}</p></div></div>;

  return (<div style={{fontFamily:'"Outfit","Segoe UI",sans-serif',background:th.bg,minHeight:"100vh",color:th.text,transition:"background 0.3s,color 0.3s",position:"relative"}}>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Newsreader:ital,wght@0,400;0,600;1,400&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet"/>
    <div style={{position:"fixed",inset:0,zIndex:0,pointerEvents:"none",backgroundImage:`radial-gradient(${th.dotGrid} 1px,transparent 1px)`,backgroundSize:"24px 24px",opacity:0.5}}/>
    {sidebar&&<div onClick={()=>setSidebar(false)} style={{position:"fixed",inset:0,zIndex:90,background:th.modalOverlay}}/>}

    {/* SIDEBAR */}
    <div style={{position:"fixed",top:0,left:0,bottom:0,width:260,zIndex:100,background:th.surface,borderRight:`1px solid ${th.border}`,padding:"20px 0",display:"flex",flexDirection:"column",transform:sidebar?"translateX(0)":(typeof window!=="undefined"&&window.innerWidth<768?"translateX(-100%)":"translateX(0)"),transition:"transform 0.3s ease",boxShadow:sidebar?th.shadowHover:"none"}}>
      <div style={{padding:"0 20px",marginBottom:28}}><div style={{display:"flex",alignItems:"center",gap:10}}><img src={`data:image/png;base64,${LOGO}`} alt="Oliveira Lab" style={{width:44,height:44,objectFit:"contain"}}/><div style={{whiteSpace:"nowrap"}}><div style={{fontSize:20,fontWeight:700,color:th.text}}>Oliveira Lab</div><div style={{fontSize:15,color:th.textMuted,fontWeight:500}}>Bioreactor Dashboard</div></div></div></div>
      <div style={{margin:"0 16px 20px",padding:"10px 14px",background:connected?th.successBg:th.dangerBg,borderRadius:10,border:`1px solid ${connected?th.success:th.danger}25`}}><div style={{display:"flex",alignItems:"center",gap:6}}><Dot s={connected?"online":"offline"} th={th}/><span style={{fontSize:16,fontWeight:600,color:connected?th.success:th.danger}}>{connected?`${online} of ${reactors.length} Online`:"Offline — Not Connected"}</span></div><div style={{fontSize:14,color:th.textMuted,marginTop:4}}>{experiment?experiment.experiment:"No experiment"}{lastFetch&&` · ${lastFetch.toLocaleTimeString()}`}</div></div>
      <nav style={{flex:1,padding:"0 10px"}}>{nav.map(n=><button key={n.id} onClick={()=>{setPage(n.id);setSidebar(false)}} style={{display:"flex",alignItems:"center",gap:10,width:"100%",padding:"10px 14px",background:page===n.id?th.accentLight:"transparent",border:"none",borderRadius:9,cursor:"pointer",marginBottom:2,color:page===n.id?th.accent:th.textSecondary,fontWeight:page===n.id?600:500,fontSize:17,textAlign:"left",fontFamily:"inherit"}}><span style={{fontSize:17,width:20,textAlign:"center",opacity:0.7}}>{n.icon}</span>{n.label}</button>)}</nav>
      <div style={{padding:"0 10px",borderTop:`1px solid ${th.borderLight}`,paddingTop:16}}>
        <button onClick={()=>setShowS(!showS)} style={{display:"flex",alignItems:"center",gap:10,width:"100%",padding:"10px 14px",background:showS?th.bgAlt:"transparent",border:"none",borderRadius:9,cursor:"pointer",color:th.textSecondary,fontSize:17,fontWeight:500,textAlign:"left",fontFamily:"inherit"}}><span style={{fontSize:17,width:20,textAlign:"center",opacity:0.7}}>⚙</span>Settings</button>
        {showS&&<div style={{padding:"12px 14px"}}><div style={{fontSize:15,color:th.textMuted,fontWeight:600,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.08em"}}>Appearance</div><div style={{display:"flex",borderRadius:8,overflow:"hidden",border:`1px solid ${th.border}`}}>{["light","dark"].map(m=><button key={m} onClick={()=>setMode(m)} style={{flex:1,padding:"8px 0",background:mode===m?th.accent:th.bgAlt,color:mode===m?"#fff":th.textMuted,border:"none",cursor:"pointer",fontSize:16,fontWeight:600,fontFamily:"inherit",textTransform:"capitalize"}}>{m==="light"?"☀ ":"☽ "}{m}</button>)}</div></div>}
      </div>
    </div>

    {/* MAIN */}
    <div style={{marginLeft:typeof window!=="undefined"&&window.innerWidth<768?0:260,minHeight:"100vh",position:"relative",zIndex:1}}>
      <div style={{padding:"16px 24px",borderBottom:`1px solid ${th.borderLight}`,background:`${th.surface}e0`,backdropFilter:"blur(12px)",position:"sticky",top:0,zIndex:50,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <button onClick={()=>setSidebar(true)} style={{display:typeof window!=="undefined"&&window.innerWidth<768?"flex":"none",alignItems:"center",justifyContent:"center",width:36,height:36,borderRadius:9,background:th.bgAlt,border:`1px solid ${th.border}`,cursor:"pointer",fontSize:22,color:th.textSecondary}}>☰</button>
          <h1 style={{margin:0,fontSize:27,fontWeight:700,letterSpacing:"-0.02em",color:th.text}}>{nav.find(n=>n.id===page)?.label||"Overview"}</h1>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {loading&&<div style={{width:16,height:16,borderRadius:"50%",border:`2px solid ${th.borderLight}`,borderTopColor:th.accent,animation:"spin 0.8s linear infinite"}}/>}
          <button onClick={refresh} title="Refresh data" style={{padding:"6px 10px",borderRadius:7,background:th.bgAlt,border:`1px solid ${th.border}`,cursor:"pointer",fontSize:16,color:th.textSecondary,fontFamily:"inherit",fontWeight:600}}>↻</button>
          <div style={{padding:"6px 12px",borderRadius:8,background:connected?th.successBg:th.dangerBg,border:`1px solid ${connected?th.success:th.danger}25`,fontSize:15,color:connected?th.success:th.danger,fontWeight:600,fontFamily:"'JetBrains Mono',monospace"}}>{connected?"● Connected":"○ Offline"}</div>
        </div>
      </div>

      {page==="overview"&&<div style={{padding:"24px"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:14,marginBottom:28}}>{reactors.map(r=><div key={r.id} style={{background:th.surface,border:`1px solid ${th.border}`,borderRadius:14,padding:"18px 20px",boxShadow:th.shadow,position:"relative",overflow:"hidden"}}>
          {r.status==="offline"&&<div style={{position:"absolute",inset:0,background:`${th.bg}90`,zIndex:2,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:14,backdropFilter:"blur(2px)"}}><span style={{fontSize:16,fontWeight:700,color:th.danger,background:th.dangerBg,padding:"6px 14px",borderRadius:8}}>EXCLUDED</span></div>}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}><div><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}><Dot s={r.status} th={th}/><span style={{fontSize:17,fontWeight:700,color:th.text}}>{r.label}</span></div><span style={{fontSize:14,fontWeight:600,color:th.accent,background:th.accentLight,padding:"2px 8px",borderRadius:5}}>{r.role}</span></div><span style={{fontSize:14,color:th.textMuted,fontWeight:500,background:th.bgAlt,padding:"3px 8px",borderRadius:6}}>{r.model}</span></div>
          <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:14,color:th.textSecondary}}>{r.id}</div>
          {r.status==="warning"&&<div style={{marginTop:12,padding:"8px 10px",borderRadius:8,background:th.warningBg,border:`1px solid ${th.warning}20`,fontSize:15,color:th.warning,fontWeight:500}}>⚠ Photodiode cables swapped + stir bar check</div>}
        </div>)}</div>
        <Chart th={th} {...odP}/><Chart th={th} {...tempP}/><Chart th={th} {...stirP}/><Chart th={th} {...grP}/>
      </div>}

      {/* REACTORS MANAGEMENT PAGE */}
      {page==="reactors"&&<div style={{padding:"24px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div>
            <p style={{margin:0,fontSize:17,color:th.textSecondary}}>{reactors.length} bioreactors · {online} online · {reactors.filter(r=>r.status==="offline").length} offline</p>
          </div>
          <button onClick={()=>setShowAddReactor(true)} style={{padding:"10px 20px",borderRadius:10,border:"none",background:th.accent,color:"#fff",fontSize:17,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:22,lineHeight:1}}>+</span> Add Bioreactor
          </button>
        </div>

        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {reactors.map(r=>(
            <div key={r.id} style={{background:th.surface,border:`1px solid ${th.border}`,borderRadius:14,padding:"20px 24px",boxShadow:th.shadow,display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
              <div style={{flex:"0 0 auto"}}><Dot s={r.status} th={th}/></div>
              <div style={{flex:1,minWidth:160}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                  <span style={{fontSize:19,fontWeight:700,color:th.text}}>{r.label}</span>
                  <span style={{fontSize:14,fontWeight:600,color:th.accent,background:th.accentLight,padding:"2px 8px",borderRadius:5}}>{r.role}</span>
                </div>
                <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:15,color:th.textMuted}}>{r.id}</div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                <span style={{fontSize:15,color:th.textMuted,background:th.bgAlt,padding:"4px 10px",borderRadius:6,fontWeight:500}}>{r.model}</span>
                <span style={{fontSize:15,fontWeight:600,padding:"4px 10px",borderRadius:6,
                  color:r.status==="online"?th.success:r.status==="warning"?th.warning:th.danger,
                  background:r.status==="online"?th.successBg:r.status==="warning"?th.warningBg:th.dangerBg,
                }}>{r.status==="online"?"Online":r.status==="warning"?"Needs Fix":"Offline"}</span>
              </div>
              <div style={{display:"flex",gap:6}}>
                {r.role!=="Leader + Worker"&&(
                  <button onClick={()=>toggleStatus(r.id)} style={{padding:"6px 12px",borderRadius:7,border:`1px solid ${th.border}`,background:th.bgAlt,color:th.textSecondary,fontSize:15,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                    {r.status==="offline"?"Enable":"Disable"}
                  </button>
                )}
                {r.role!=="Leader + Worker"&&(
                  <button onClick={()=>{if(confirm(`Remove ${r.label} from the cluster?`))removeReactor(r.id)}} style={{padding:"6px 12px",borderRadius:7,border:`1px solid ${th.danger}30`,background:th.dangerBg,color:th.danger,fontSize:15,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                    Remove
                  </button>
                )}
              </div>
              {r.status==="warning"&&<div style={{width:"100%",padding:"8px 12px",borderRadius:8,background:th.warningBg,border:`1px solid ${th.warning}20`,fontSize:15,color:th.warning,fontWeight:500,marginTop:4}}>⚠ Photodiode cables swapped + stir bar check needed in lab</div>}
            </div>
          ))}
        </div>

        {/* How to add guide */}
        <div style={{marginTop:24,padding:"20px 24px",background:th.surface,border:`1px solid ${th.border}`,borderRadius:14,boxShadow:th.shadow}}>
          <h3 style={{margin:"0 0 14px",fontSize:19,fontWeight:700,color:th.text}}>How to add a new bioreactor</h3>
          <div style={{fontSize:17,color:th.textSecondary,lineHeight:1.8}}>
            <p style={{margin:"0 0 10px"}}><strong style={{color:th.text}}>1.</strong> Flash SD card with <strong>Worker</strong> image using Raspberry Pi Imager — give it a unique hostname</p>
            <p style={{margin:"0 0 10px"}}><strong style={{color:th.text}}>2.</strong> Set the same Wi-Fi network as your Leader (<code style={{background:th.bgAlt,padding:"2px 8px",borderRadius:5,fontFamily:"'JetBrains Mono',monospace",fontSize:15,color:th.accent}}>oliveirapioreactor01</code>)</p>
            <p style={{margin:"0 0 10px"}}><strong style={{color:th.text}}>3.</strong> Power it on and wait for the blue LED blink</p>
            <p style={{margin:"0 0 10px"}}><strong style={{color:th.text}}>4.</strong> Click <strong>"+ Add Bioreactor"</strong> above, or add via terminal: <code style={{background:th.bgAlt,padding:"2px 8px",borderRadius:5,fontFamily:"'JetBrains Mono',monospace",fontSize:15,color:th.accent}}>pio workers add hostname</code></p>
            <p style={{margin:0}}><strong style={{color:th.text}}>5.</strong> Run the Self-test from the Pioreactor web UI to verify all sensors are working</p>
          </div>
        </div>
      </div>}

      {page==="od"&&<div style={{padding:"24px"}}><Chart th={th} {...odP}/></div>}
      {page==="temp"&&<div style={{padding:"24px"}}><Chart th={th} {...tempP}/></div>}
      {page==="stirring"&&<div style={{padding:"24px"}}><Chart th={th} {...stirP}/></div>}
      {page==="growth"&&<div style={{padding:"24px"}}><Chart th={th} {...grP}/></div>}

      {page==="pumps"&&<div style={{padding:"24px"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:14}}>
          <CS icon="💧" title="Media Pump" desc="Controls nutrient delivery. Connect to PWM channel 2 and calibrate."/>
          <CS icon="🗑️" title="Waste Pump" desc="Removes used media. Connect to PWM channel 4 and calibrate."/>
          <CS icon="🧪" title="Alt-Media Pump" desc="Alternative nutrients. Connect to PWM channel 3 and calibrate."/>
          <CS icon="📜" title="Dosing Event Log" desc="Full history of every pump action. Requires active pumps."/>
        </div>
        <div style={{marginTop:20,padding:"20px 24px",background:th.surface,border:`1px solid ${th.border}`,borderRadius:14,boxShadow:th.shadow}}>
          <h3 style={{margin:"0 0 12px",fontSize:19,fontWeight:700,color:th.text}}>How to activate pumps</h3>
          <div style={{fontSize:17,color:th.textSecondary,lineHeight:1.7}}>
            <p style={{margin:"0 0 10px"}}><strong style={{color:th.text}}>1.</strong> Connect peristaltic pumps to PWM channels on the Pioreactor HAT</p>
            <p style={{margin:"0 0 10px"}}><strong style={{color:th.text}}>2.</strong> Break in — run 10 min with water to loosen tubing</p>
            <p style={{margin:"0 0 10px"}}><strong style={{color:th.text}}>3.</strong> Calibrate: <code style={{background:th.bgAlt,padding:"2px 8px",borderRadius:5,fontFamily:"'JetBrains Mono',monospace",fontSize:15,color:th.accent}}>pio calibrations run --device media_pump</code></p>
            <p style={{margin:0}}><strong style={{color:th.text}}>4.</strong> Start dosing automation (Turbidostat or Chemostat)</p>
          </div>
        </div>
      </div>}

      {page==="alerts"&&<div style={{padding:"24px"}}><CS icon="🔔" title="Smart Alerts" desc="Configure thresholds for temperature, OD, and pump failures. Define rules like 'if temp > 38°C, alert'."/></div>}

      <div style={{padding:"20px 24px",borderTop:`1px solid ${th.borderLight}`,textAlign:"center",fontSize:15,color:th.textMuted}}>Oliveira Lab · Bioreactor Dashboard v0.1 · Built by Bukola · {new Date().getFullYear()}</div>
    </div>
    <AddReactorModal open={showAddReactor} onClose={()=>setShowAddReactor(false)} onAdd={addReactor} th={th}/>
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}*{box-sizing:border-box;margin:0}::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:${th.border};border-radius:3px}`}</style>
  </div>)
}
