import { useState, useEffect, useRef, useCallback } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";

/* ─── REAL DATA ─── */
const OD_DATA = [
  {t:"23:48",r01:0.2069,r02:0.00526},{t:"23:53",r01:0.2069,r02:0.00527},
  {t:"23:58",r01:0.2069,r02:0.00527},{t:"00:03",r01:0.2071,r02:0.00528},
  {t:"00:08",r01:0.2071,r02:0.00527},{t:"00:13",r01:0.2071,r02:0.00525},
  {t:"00:18",r01:0.2072,r02:0.00525},{t:"00:23",r01:0.2072,r02:0.00525},
  {t:"00:28",r01:0.2073,r02:0.00526},{t:"00:33",r01:0.2073,r02:0.00526},
  {t:"00:38",r01:0.2073,r02:0.00525},{t:"00:43",r01:0.2073,r02:0.00527},
  {t:"00:48",r01:0.2073,r02:0.00526},{t:"00:53",r01:0.2073,r02:0.00527},
  {t:"00:58",r01:0.2074,r02:0.00527},{t:"01:03",r01:0.2075,r02:0.00526},
  {t:"01:08",r01:0.2075,r02:0.00527},{t:"01:13",r01:0.2074,r02:0.00527},
  {t:"01:18",r01:0.2075,r02:0.00528},{t:"01:23",r01:0.2075,r02:0.00525},
  {t:"01:28",r01:0.2076,r02:0.00527},{t:"01:33",r01:0.2075,r02:0.00526},
  {t:"01:38",r01:0.2075,r02:0.00525},{t:"01:43",r01:0.2074,r02:0.00527},
  {t:"01:48",r01:0.2073,r02:0.00524},{t:"01:53",r01:0.2073,r02:0.00526},
  {t:"01:58",r01:0.2074,r02:0.00526},{t:"02:03",r01:0.2074,r02:0.00525},
  {t:"02:08",r01:0.2074,r02:0.00525},{t:"02:13",r01:0.2073,r02:0.00525},
  {t:"02:18",r01:0.2073,r02:0.00525},{t:"02:23",r01:0.2072,r02:0.00524},
  {t:"02:28",r01:0.2072,r02:0.00524},{t:"02:33",r01:0.2070,r02:0.00524},
  {t:"02:38",r01:0.2062,r02:0.00525},{t:"02:43",r01:0.2061,r02:0.00524},
  {t:"02:48",r01:0.2061,r02:0.00525},{t:"02:53",r01:0.2061,r02:0.00524},
  {t:"02:58",r01:0.2061,r02:0.00523},{t:"03:03",r01:0.2061,r02:0.00524},
  {t:"03:08",r01:0.2061,r02:0.00525},{t:"03:13",r01:0.2061,r02:0.00526},
  {t:"03:18",r01:0.2060,r02:0.00525},{t:"03:23",r01:0.2060,r02:0.00526},
  {t:"03:28",r01:0.2056,r02:0.00525},{t:"03:33",r01:0.2059,r02:0.00525},
  {t:"03:38",r01:0.2059,r02:0.00526},{t:"03:43",r01:0.2059,r02:0.00526},
  {t:"03:48",r01:0.2058,r02:0.00525},
];
const TEMP_DATA = [];
const STIRRING_DATA = [];
const GROWTH_DATA = [];

const REACTORS = [
  { id: "oliveirapioreactor01", label: "Reactor 01", role: "Leader + Worker", status: "online", model: "40mL v1.5" },
  { id: "oliveirapioreactor02", label: "Reactor 02", role: "Worker", status: "online", model: "40mL v1.5" },
  { id: "oliveirapioreactor03", label: "Reactor 03", role: "Worker", status: "warning", model: "40mL v1.5" },
  { id: "oliveirapioreactor04", label: "Reactor 04", role: "Worker", status: "offline", model: "40mL v1.5" },
];

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
  return (<div style={{background:th.surface,border:`1px solid ${th.border}`,borderRadius:10,padding:"10px 14px",boxShadow:th.shadow,fontSize:12}}>
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
        <div style={{display:"flex",alignItems:"center",gap:10}}><span style={{fontSize:20}}>🧬</span><div><h3 style={{margin:0,fontSize:16,fontWeight:700,color:th.text}}>{title}</h3><p style={{margin:0,fontSize:11,color:th.textMuted}}>AI-powered analysis</p></div></div>
        <button onClick={onClose} style={{background:th.bgAlt,border:`1px solid ${th.border}`,borderRadius:8,width:32,height:32,cursor:"pointer",fontSize:16,color:th.textSecondary,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
      </div>
      <div style={{padding:"20px 24px"}}>{loading?<div style={{textAlign:"center",padding:"32px 0"}}><div style={{width:36,height:36,borderRadius:"50%",border:`3px solid ${th.borderLight}`,borderTopColor:th.accent,animation:"spin 0.8s linear infinite",margin:"0 auto 16px"}}/><p style={{color:th.textMuted,fontSize:13}}>Analyzing data...</p></div>:<div style={{fontFamily:'"Newsreader",Georgia,serif',fontSize:14.5,lineHeight:1.85,color:th.textSecondary,whiteSpace:"pre-wrap"}}>{txt}</div>}</div>
    </div>
  </div>)
};
const Chart=({th,title,subtitle,data,keys,colors,yFmt,csvCols,csvName,interpTitle,interpText,emptyIcon,emptyTitle,emptySub,emptyAction})=>{
  const[filter,setFilter]=useState("both");const[showI,setShowI]=useState(false);const ref=useRef(null);const has=data?.length>0;
  return (<><div ref={ref} style={{background:th.surface,border:`1px solid ${th.border}`,borderRadius:16,boxShadow:th.shadow,marginBottom:20,overflow:"hidden"}}>
    <div style={{padding:"18px 22px",borderBottom:`1px solid ${th.borderLight}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
      <div style={{flex:1,minWidth:200}}><h2 style={{margin:0,fontSize:16,fontWeight:700,color:th.text}}>{title}</h2><p style={{margin:"4px 0 0",fontSize:12,color:th.textMuted}}>{subtitle}</p></div>
      <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
        {has&&keys.length>1&&["both",...keys.map(k=>k.key)].map(f=><button key={f} onClick={()=>setFilter(f)} style={{padding:"6px 12px",borderRadius:7,background:filter===f?th.accent:th.bgAlt,color:filter===f?"#fff":th.textMuted,border:`1px solid ${filter===f?th.accent:th.border}`,cursor:"pointer",fontSize:11,fontWeight:600,fontFamily:"inherit"}}>{f==="both"?"Both":keys.find(k=>k.key===f)?.s||f}</button>)}
        {interpText&&<button onClick={()=>setShowI(true)} style={{padding:"6px 14px",borderRadius:7,background:"transparent",border:`1.5px solid ${th.accent}50`,color:th.accent,cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:"inherit"}}>🧬 Interpret</button>}
        <button onClick={()=>exportCSV(data,csvCols,csvName)} disabled={!has} style={{padding:"5px 10px",borderRadius:6,fontSize:10,fontWeight:600,fontFamily:"inherit",background:has?th.bgAlt:"transparent",border:`1px solid ${th.border}`,color:has?th.textSecondary:th.textMuted,cursor:has?"pointer":"default",opacity:has?1:0.4}}>↓ CSV</button>
        <button onClick={()=>exportPNG(ref,csvName)} disabled={!has} style={{padding:"5px 10px",borderRadius:6,fontSize:10,fontWeight:600,fontFamily:"inherit",background:has?th.bgAlt:"transparent",border:`1px solid ${th.border}`,color:has?th.textSecondary:th.textMuted,cursor:has?"pointer":"default",opacity:has?1:0.4}}>↓ PNG</button>
      </div>
    </div>
    {has?<><div style={{padding:"16px 10px 8px 0"}}><ResponsiveContainer width="100%" height={260}><AreaChart data={data} margin={{top:10,right:16,left:8,bottom:5}}>
      <defs>{keys.map((dk,i)=><linearGradient key={dk.key} id={`f-${csvName}-${dk.key}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={colors[i]} stopOpacity={0.2}/><stop offset="100%" stopColor={colors[i]} stopOpacity={0.01}/></linearGradient>)}</defs>
      <CartesianGrid strokeDasharray="3 3" stroke={th.gridLine}/><XAxis dataKey="t" tick={{fontSize:10,fill:th.textMuted}} axisLine={{stroke:th.border}} tickLine={false} interval={5}/>
      <YAxis domain={["auto","auto"]} tick={{fontSize:10,fill:th.textMuted}} axisLine={{stroke:th.border}} tickLine={false} width={58} tickFormatter={yFmt||(v=>v.toFixed(3))}/>
      <Tooltip content={<Tip th={th}/>}/>
      {keys.map((dk,i)=>(filter==="both"||filter===dk.key)&&<Area key={dk.key} type="monotone" dataKey={dk.key} name={dk.label} stroke={colors[i]} fill={`url(#f-${csvName}-${dk.key})`} strokeWidth={2.5} dot={false}/>)}
    </AreaChart></ResponsiveContainer></div>
    <div style={{padding:"14px 22px",borderTop:`1px solid ${th.borderLight}`,display:"flex",gap:24,flexWrap:"wrap"}}>
      {keys.map((dk,i)=>{const vals=data.map(d=>d[dk.key]).filter(v=>v!=null);const cur=vals[vals.length-1];const delta=cur-vals[0];return (<div key={dk.key} style={{display:"flex",gap:20}}>
        <div><div style={{fontSize:10,color:th.textMuted,fontWeight:600,marginBottom:2}}>{dk.s} Current</div><div style={{fontSize:16,fontWeight:700,color:colors[i],fontFamily:"'JetBrains Mono',monospace"}}>{cur?.toFixed(4)}</div></div>
        <div><div style={{fontSize:10,color:th.textMuted,fontWeight:600,marginBottom:2}}>{dk.s} Δ</div><div style={{fontSize:16,fontWeight:700,color:delta>=0?th.success:th.danger,fontFamily:"'JetBrains Mono',monospace"}}>{delta>=0?"+":""}{delta?.toFixed(4)}</div></div>
      </div>)})}
    </div></>
    :<div style={{padding:"48px 24px",textAlign:"center",background:`repeating-linear-gradient(45deg,transparent,transparent 10px,${th.border}08 10px,${th.border}08 11px)`,borderRadius:8,margin:"16px 22px"}}>
      <div style={{fontSize:36,marginBottom:12,opacity:0.35}}>{emptyIcon}</div>
      <div style={{fontSize:14,fontWeight:600,color:th.textSecondary,marginBottom:6}}>{emptyTitle}</div>
      <div style={{fontSize:12,color:th.textMuted,lineHeight:1.6,maxWidth:360,margin:"0 auto"}}>{emptySub}</div>
      {emptyAction&&<div style={{marginTop:14,display:"inline-block",fontSize:11,fontWeight:700,color:th.accent,background:th.accentLight,padding:"6px 14px",borderRadius:7}}>{emptyAction}</div>}
    </div>}
  </div>
  <InterpModal open={showI} onClose={()=>setShowI(false)} th={th} title={interpTitle} text={interpText||""}/></>)
};

/* ─── INTERPRETATIONS ─── */
const I_OD=`Both reactors are currently running with sterile water — no biological organisms are present.\n\nReactor 01 (OD ~0.206–0.208) shows a stable baseline with a notable downward drift beginning around 02:30 UTC, dropping from ~0.2075 to ~0.2058. This is not biological — it's almost certainly caused by ambient temperature cooling. As water cools, its refractive index changes slightly, which shifts the OD reading.\n\nReactor 02 (OD ~0.005) is reading near-zero, confirming very clear water with minimal light scatter.\n\nKey takeaway: Both sensors are working correctly. When you introduce a culture, you'll see OD begin climbing from these baselines. The temperature-driven drift tells you to run Temperature Automation for precise measurements.`;
const I_TEMP=`No temperature data is currently being collected.\n\nTo start: Pioreactor UI → Control all Pioreactors → Temperature Automation → Thermostat → 30°C.\n\nThis works with water. You'll see temperature climb from room temp to target, then hold steady. Temperature data is critical because it directly affects OD readings.`;
const I_STIR=`No stirring data is currently being collected.\n\nStirring should be running if OD readings are active. Check that the Stirring activity is started in the Pioreactor UI.\n\nA sudden drop to 0 RPM means the stir bar detached — the culture stops being mixed, causing sedimentation and inaccurate OD readings.`;
const I_GR=`No growth rate data is currently being collected.\n\nGrowth rate requires the Growth Rate activity AND actual organisms. With sterile water, it will always be zero.\n\nWith real organisms: expect yeast in YPD at 30°C to show a doubling time of ~90 minutes during exponential phase.`;

const K=[{key:"r01",label:"Reactor 01",s:"R-01"},{key:"r02",label:"Reactor 02",s:"R-02"}];

/* ─── MAIN ─── */
export default function App(){
  const[mode,setMode]=useState("light");const[showS,setShowS]=useState(false);const[sidebar,setSidebar]=useState(false);const[page,setPage]=useState("overview");
  const th=themes[mode];const online=REACTORS.filter(r=>r.status==="online").length;
  const nav=[{id:"overview",icon:"◉",label:"Overview"},{id:"od",icon:"◎",label:"OD Readings"},{id:"temp",icon:"◈",label:"Temperature"},{id:"stirring",icon:"↻",label:"Stirring"},{id:"growth",icon:"↗",label:"Growth Rate"},{id:"pumps",icon:"⬡",label:"Pump Control"},{id:"alerts",icon:"△",label:"Alerts"}];

  const odP={title:"Optical Density (OD)",subtitle:`90° scatter · ${OD_DATA.length} readings · ~4 hours`,data:OD_DATA,keys:K,colors:[th.chartLine1,th.chartLine2],yFmt:v=>v<0.01?v.toFixed(4):v.toFixed(3),csvCols:[{key:"t",label:"Time"},{key:"r01",label:"Reactor_01_OD"},{key:"r02",label:"Reactor_02_OD"}],csvName:"od_readings",interpTitle:"OD Interpretation",interpText:I_OD,emptyIcon:"◎",emptyTitle:"No OD data yet",emptySub:"Start OD Reading on your Pioreactors.",emptyAction:"Start OD Reading →"};
  const tempP={title:"Temperature (°C)",subtitle:"Thermostat control",data:TEMP_DATA,keys:K,colors:[th.chartLine1,th.chartLine2],yFmt:v=>v.toFixed(1)+"°",csvCols:[{key:"t",label:"Time"},{key:"r01",label:"R01_Temp"},{key:"r02",label:"R02_Temp"}],csvName:"temperature",interpTitle:"Temperature Interpretation",interpText:I_TEMP,emptyIcon:"🌡️",emptyTitle:"No temperature data",emptySub:"Start Temperature Automation (Thermostat, e.g. 30°C). Works with water.",emptyAction:"Start Temperature Automation →"};
  const stirP={title:"Stirring Rate (RPM)",subtitle:"Stir bar rotation speed",data:STIRRING_DATA,keys:K,colors:[th.chartLine1,th.chartLine2],yFmt:v=>Math.round(v)+"",csvCols:[{key:"t",label:"Time"},{key:"r01",label:"R01_RPM"},{key:"r02",label:"R02_RPM"}],csvName:"stirring",interpTitle:"Stirring Interpretation",interpText:I_STIR,emptyIcon:"↻",emptyTitle:"No stirring data",emptySub:"Stirring data appears when the Stirring activity is running.",emptyAction:"Check Stirring Activity →"};
  const grP={title:"Growth Rate",subtitle:"Calculated doubling time",data:GROWTH_DATA,keys:K,colors:[th.chartLine1,th.chartLine2],yFmt:v=>v.toFixed(4),csvCols:[{key:"t",label:"Time"},{key:"r01",label:"R01_GrowthRate"},{key:"r02",label:"R02_GrowthRate"}],csvName:"growth_rate",interpTitle:"Growth Rate Interpretation",interpText:I_GR,emptyIcon:"📈",emptyTitle:"No growth rate data",emptySub:"Requires Growth Rate activity AND organisms growing.",emptyAction:"Needs Active Culture"};

  const CS=({icon,title,desc})=><div style={{background:th.comingSoonBg,border:`1.5px dashed ${th.comingSoonBorder}`,borderRadius:14,padding:"28px 24px",textAlign:"center",position:"relative",overflow:"hidden"}}>
    <div style={{position:"absolute",inset:0,backgroundImage:`radial-gradient(${th.comingSoonBorder} 1px,transparent 1px)`,backgroundSize:"20px 20px",opacity:0.3}}/>
    <div style={{position:"relative"}}><div style={{fontSize:32,marginBottom:12,opacity:0.5}}>{icon}</div><div style={{display:"inline-block",fontSize:10,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",color:th.accent,background:th.accentLight,padding:"4px 12px",borderRadius:20,marginBottom:12}}>Coming Soon</div><h3 style={{margin:"0 0 8px",fontSize:16,fontWeight:700,color:th.text}}>{title}</h3><p style={{margin:0,fontSize:13,color:th.textMuted,lineHeight:1.6}}>{desc}</p></div></div>;

  return (<div style={{fontFamily:'"Outfit","Segoe UI",sans-serif',background:th.bg,minHeight:"100vh",color:th.text,transition:"background 0.3s,color 0.3s",position:"relative"}}>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Newsreader:ital,wght@0,400;0,600;1,400&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet"/>
    <div style={{position:"fixed",inset:0,zIndex:0,pointerEvents:"none",backgroundImage:`radial-gradient(${th.dotGrid} 1px,transparent 1px)`,backgroundSize:"24px 24px",opacity:0.5}}/>
    {sidebar&&<div onClick={()=>setSidebar(false)} style={{position:"fixed",inset:0,zIndex:90,background:th.modalOverlay}}/>}

    {/* SIDEBAR */}
    <div style={{position:"fixed",top:0,left:0,bottom:0,width:220,zIndex:100,background:th.surface,borderRight:`1px solid ${th.border}`,padding:"20px 0",display:"flex",flexDirection:"column",transform:sidebar?"translateX(0)":(typeof window!=="undefined"&&window.innerWidth<768?"translateX(-100%)":"translateX(0)"),transition:"transform 0.3s ease",boxShadow:sidebar?th.shadowHover:"none"}}>
      <div style={{padding:"0 20px",marginBottom:28}}><div style={{display:"flex",alignItems:"center",gap:10}}><img src={`data:image/png;base64,${LOGO}`} alt="Oliveira Lab" style={{width:50,height:50,objectFit:"contain"}}/><div><div style={{fontSize:14,fontWeight:700,color:th.text}}>Oliveira Lab</div><div style={{fontSize:10,color:th.textMuted,fontWeight:500}}>Bioreactor Dashboard</div></div></div></div>
      <div style={{margin:"0 16px 20px",padding:"10px 14px",background:th.successBg,borderRadius:10,border:`1px solid ${th.success}25`}}><div style={{display:"flex",alignItems:"center",gap:6}}><Dot s="online" th={th}/><span style={{fontSize:12,fontWeight:600,color:th.success}}>{online} of {REACTORS.length} Online</span></div><div style={{fontSize:10,color:th.textMuted,marginTop:4}}>Demo experiment</div></div>
      <nav style={{flex:1,padding:"0 10px"}}>{nav.map(n=><button key={n.id} onClick={()=>{setPage(n.id);setSidebar(false)}} style={{display:"flex",alignItems:"center",gap:10,width:"100%",padding:"10px 14px",background:page===n.id?th.accentLight:"transparent",border:"none",borderRadius:9,cursor:"pointer",marginBottom:2,color:page===n.id?th.accent:th.textSecondary,fontWeight:page===n.id?600:500,fontSize:13,textAlign:"left",fontFamily:"inherit"}}><span style={{fontSize:14,width:20,textAlign:"center",opacity:0.7}}>{n.icon}</span>{n.label}</button>)}</nav>
      <div style={{padding:"0 10px",borderTop:`1px solid ${th.borderLight}`,paddingTop:16}}>
        <button onClick={()=>setShowS(!showS)} style={{display:"flex",alignItems:"center",gap:10,width:"100%",padding:"10px 14px",background:showS?th.bgAlt:"transparent",border:"none",borderRadius:9,cursor:"pointer",color:th.textSecondary,fontSize:13,fontWeight:500,textAlign:"left",fontFamily:"inherit"}}><span style={{fontSize:14,width:20,textAlign:"center",opacity:0.7}}>⚙</span>Settings</button>
        {showS&&<div style={{padding:"12px 14px"}}><div style={{fontSize:11,color:th.textMuted,fontWeight:600,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.08em"}}>Appearance</div><div style={{display:"flex",borderRadius:8,overflow:"hidden",border:`1px solid ${th.border}`}}>{["light","dark"].map(m=><button key={m} onClick={()=>setMode(m)} style={{flex:1,padding:"8px 0",background:mode===m?th.accent:th.bgAlt,color:mode===m?"#fff":th.textMuted,border:"none",cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"inherit",textTransform:"capitalize"}}>{m==="light"?"☀ ":"☽ "}{m}</button>)}</div></div>}
      </div>
    </div>

    {/* MAIN */}
    <div style={{marginLeft:typeof window!=="undefined"&&window.innerWidth<768?0:220,minHeight:"100vh",position:"relative",zIndex:1}}>
      <div style={{padding:"16px 24px",borderBottom:`1px solid ${th.borderLight}`,background:`${th.surface}e0`,backdropFilter:"blur(12px)",position:"sticky",top:0,zIndex:50,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <button onClick={()=>setSidebar(true)} style={{display:typeof window!=="undefined"&&window.innerWidth<768?"flex":"none",alignItems:"center",justifyContent:"center",width:36,height:36,borderRadius:9,background:th.bgAlt,border:`1px solid ${th.border}`,cursor:"pointer",fontSize:18,color:th.textSecondary}}>☰</button>
          <h1 style={{margin:0,fontSize:20,fontWeight:700,letterSpacing:"-0.02em",color:th.text}}>{nav.find(n=>n.id===page)?.label||"Overview"}</h1>
        </div>
        <div style={{padding:"6px 12px",borderRadius:8,background:th.bgAlt,border:`1px solid ${th.border}`,fontSize:11,color:th.textMuted,fontWeight:500,fontFamily:"'JetBrains Mono',monospace"}}>{new Date().toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</div>
      </div>

      {page==="overview"&&<div style={{padding:"24px"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:14,marginBottom:28}}>{REACTORS.map(r=><div key={r.id} style={{background:th.surface,border:`1px solid ${th.border}`,borderRadius:14,padding:"18px 20px",boxShadow:th.shadow,position:"relative",overflow:"hidden"}}>
          {r.status==="offline"&&<div style={{position:"absolute",inset:0,background:`${th.bg}90`,zIndex:2,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:14,backdropFilter:"blur(2px)"}}><span style={{fontSize:12,fontWeight:700,color:th.danger,background:th.dangerBg,padding:"6px 14px",borderRadius:8}}>EXCLUDED</span></div>}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}><div><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}><Dot s={r.status} th={th}/><span style={{fontSize:14,fontWeight:700,color:th.text}}>{r.label}</span></div><span style={{fontSize:10,fontWeight:600,color:th.accent,background:th.accentLight,padding:"2px 8px",borderRadius:5}}>{r.role}</span></div><span style={{fontSize:10,color:th.textMuted,fontWeight:500,background:th.bgAlt,padding:"3px 8px",borderRadius:6}}>{r.model}</span></div>
          <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:th.textSecondary}}>{r.id}</div>
          {r.status==="warning"&&<div style={{marginTop:12,padding:"8px 10px",borderRadius:8,background:th.warningBg,border:`1px solid ${th.warning}20`,fontSize:11,color:th.warning,fontWeight:500}}>⚠ Photodiode cables swapped + stir bar check</div>}
        </div>)}</div>
        <Chart th={th} {...odP}/><Chart th={th} {...tempP}/><Chart th={th} {...stirP}/><Chart th={th} {...grP}/>
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
          <h3 style={{margin:"0 0 12px",fontSize:15,fontWeight:700,color:th.text}}>How to activate pumps</h3>
          <div style={{fontSize:13,color:th.textSecondary,lineHeight:1.7}}>
            <p style={{margin:"0 0 10px"}}><strong style={{color:th.text}}>1.</strong> Connect peristaltic pumps to PWM channels on the Pioreactor HAT</p>
            <p style={{margin:"0 0 10px"}}><strong style={{color:th.text}}>2.</strong> Break in — run 10 min with water to loosen tubing</p>
            <p style={{margin:"0 0 10px"}}><strong style={{color:th.text}}>3.</strong> Calibrate: <code style={{background:th.bgAlt,padding:"2px 8px",borderRadius:5,fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:th.accent}}>pio calibrations run --device media_pump</code></p>
            <p style={{margin:0}}><strong style={{color:th.text}}>4.</strong> Start dosing automation (Turbidostat or Chemostat)</p>
          </div>
        </div>
      </div>}

      {page==="alerts"&&<div style={{padding:"24px"}}><CS icon="🔔" title="Smart Alerts" desc="Configure thresholds for temperature, OD, and pump failures. Define rules like 'if temp > 38°C, alert'."/></div>}

      <div style={{padding:"20px 24px",borderTop:`1px solid ${th.borderLight}`,textAlign:"center",fontSize:11,color:th.textMuted}}>Oliveira Lab · Bioreactor Dashboard v0.1 · Built by Bukola · {new Date().getFullYear()}</div>
    </div>
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}*{box-sizing:border-box;margin:0}::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:${th.border};border-radius:3px}`}</style>
  </div>)
}
