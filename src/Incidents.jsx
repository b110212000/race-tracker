import { useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ExternalLink, Flag, Info, Search, ShieldAlert } from 'lucide-react';
import './incidents.css';

const KINDS = {
  all:'所有事件', collision:'碰撞／接觸', investigation:'調查中／通報',
  decision:'判罰與裁決', safety:'安全車', flag:'旗號', retirement:'退賽／停車', other:'其他'
};
const TYPES = Object.entries(KINDS);

export function classifyIncident(e) {
  const msg = String(e.message || '').toUpperCase();
  const category = String(e.category || '').toLowerCase();
  if (/PENALT|NO FURTHER ACTION|NO FURTHER INVESTIGATION|REPRIMAND|DECISION/.test(msg)) return 'decision';
  if (/COLLISION|CONTACT BETWEEN|MADE CONTACT/.test(msg)) return 'collision';
  if (/INVESTIGAT|INCIDENT|SUMMON|NOTED|UNDER REVIEW/.test(msg)) return 'investigation';
  if (category === 'safetycar' || /SAFETY CAR|VIRTUAL SAFETY CAR/.test(msg)) return 'safety';
  if (e.flag || category === 'flag') return 'flag';
  if (/RETIRED|STOPPED|PULLING OFF/.test(msg)) return 'retirement';
  return 'other';
}

// Names and responsibility cannot be reliably inferred from these messages.
// Only display explicitly mentioned car numbers, never assert who caused a crash.
export function mentionedCars(e) {
  const msg = String(e.message || '').toUpperCase();
  const numbers = new Set();
  const m = msg.match(/CARS?\s+#?(\d{1,3})\s+(?:AND|&|\/|,)\s*(?:CAR\s*)?#?(\d{1,3})/);
  if (m) { numbers.add(m[1]); numbers.add(m[2]); }
  const all = msg.matchAll(/\bCAR\s+#?(\d{1,3})\b/g);
  for (const item of all) numbers.add(item[1]);
  if (e.driverNumber != null) numbers.add(String(e.driverNumber));
  return [...numbers].slice(0, 6);
}

export function chineseEventSummary(e) {
  const msg = String(e.message || '').toUpperCase();
  if (/NO FURTHER (?:INVESTIGATION|ACTION)/.test(msg)) return '事件不再進一步調查／處理（以英文原文為準）';
  if (/PENALT|REPRIMAND/.test(msg)) return '裁判判罰／警告相關訊息（處罰細節請看原文）';
  if (/COLLISION|CONTACT BETWEEN|MADE CONTACT/.test(msg)) return '賽道上發生車輛碰撞／接觸通報';
  if (/INVESTIGAT|INCIDENT|SUMMON|NOTED/.test(msg)) return '事件調查或事故相關通報';
  if (/VIRTUAL SAFETY CAR/.test(msg)) return '虛擬安全車相關訊息';
  if (/SAFETY CAR/.test(msg)) return '安全車相關訊息';
  if (e.flag === 'RED' || /RED FLAG/.test(msg)) return '紅旗相關訊息';
  if (e.flag === 'YELLOW' || e.flag === 'DOUBLE YELLOW') return '黃旗警示';
  if (/RETIRED|STOPPED/.test(msg)) return '車輛停車或退賽相關訊息';
  return '賽事控制中心訊息';
}

function localTime(value) {
  const time = new Date(value);
  if (Number.isNaN(time.getTime())) return '時間未提供';
  return new Intl.DateTimeFormat('zh-TW', { timeZone:'Asia/Taipei', hour:'2-digit', minute:'2-digit', hour12:false }).format(time);
}

export default function IncidentPanel({ events = [], focusedLap, setFocusedLap, raceKey }) {
  const [kind, setKind] = useState('all');
  const [search, setSearch] = useState('');
  const [oldestFirst, setOldestFirst] = useState(false);
  const types = useMemo(() => events.map(e=>({...e, kind:classifyIncident(e)})), [events]);
  const laps = useMemo(() => [...new Set(types.map(e=>Number(e.lap)).filter(n=>Number.isInteger(n) && n>0))].sort((a,b)=>a-b), [types]);
  const counts = useMemo(() => types.reduce((acc,item)=>({...acc,[item.kind]:(acc[item.kind]||0)+1}),{}), [types]);
  const shown = useMemo(() => types.filter(e => {
    if (kind!=='all' && e.kind!==kind) return false;
    if (focusedLap!==null && Number(e.lap)!==focusedLap) return false;
    return !search || (String(e.message)+' '+chineseEventSummary(e)+' '+mentionedCars(e).map(n=>'#'+n+' '+n).join(' ')).toLowerCase().includes(search.trim().toLowerCase());
  }).sort((a,b) => oldestFirst ? String(a.date).localeCompare(String(b.date)) : String(b.date).localeCompare(String(a.date))), [types, kind, focusedLap, search, oldestFirst]);
  const sessionKey = types.find(x=>x.sessionKey)?.sessionKey;
  const origin = sessionKey ? 'https://api.openf1.org/v1/race_control?session_key=' + encodeURIComponent(sessionKey) : 'https://openf1.org/docs/';

  return <div className="incident-wrap" key={raceKey}>
    <div className="incident-disclaimer"><ShieldAlert size={18}/><p>這是 <b>賽後歷史事件</b>，不是即時事故快訊。中文為關鍵字摘要，請以英文原文與 FIA 公告為準。<b>涉及車號不代表肇事者，也不能判斷誰撞誰。</b></p></div>
    <div className="incident-stats">
      <div><b>{types.length}</b><span>已收錄事件</span></div>
      <div><b>{counts.collision||0}</b><span>接觸相關</span></div>
      <div><b>{counts.investigation||0}</b><span>調查通報</span></div>
      <div><b>{counts.decision||0}</b><span>判罰／裁定</span></div>
    </div>
    <div className="incident-filter-controls">
      <label className="incident-search"><Search size={15}/><input aria-label="搜尋事件" placeholder="搜尋車號或英文事件原文" value={search} onChange={e=>setSearch(e.target.value)}/></label>
      <label className="incident-select">圈數 <select aria-label="依圈數篩選" value={focusedLap ?? ''} onChange={e=>setFocusedLap(e.target.value===''?null:Number(e.target.value))}><option value="">全部</option>{laps.map(l=><option key={l} value={l}>Lap {l}</option>)}</select><ChevronDown size={13}/></label>
      <button className="incident-sort" type="button" onClick={()=>setOldestFirst(v=>!v)}>{oldestFirst?'最早在前':'最新在前'}</button>
    </div>
    <div className="incident-tabs" role="group" aria-label="事件類別">
      {TYPES.map(([id,label])=><button type="button" key={id} className={kind===id?'selected':''} onClick={()=>setKind(id)}>{label}{id!=='all'&&counts[id] ? <span>{counts[id]}</span>:null}</button>)}
    </div>
    {shown.length ? <div className="incident-list">
      {shown.map((e,i)=>{
        const cars=mentionedCars(e);
        return <article className={'incident-entry incident-'+e.kind} key={String(e.date)+'-'+i}>
          <div className="incident-entry-top"><span className="incident-type">{KINDS[e.kind]}</span><span>{e.lap != null ? 'LAP '+e.lap+' · ':''}{localTime(e.date)} 台灣時間</span></div>
          <strong>{chineseEventSummary(e)}</strong>
          <p className="incident-original">{e.message}</p>
          {cars.length>0&&<div className="incident-cars"><AlertTriangle size={13}/> 訊息提到車號 {cars.map(x=>'#'+x).join('、')}（不代表肇事責任）</div>}
        </article>;
      })}
    </div>:<div className="incident-empty"><Info size={23}/>{events.length?'這個條件下沒有符合的事件，試著清除圈數或類別篩選。':'這場比賽尚無可用的 OpenF1 歷史 Race Control 訊息。'}</div>}
    <a className="incident-source" target="_blank" rel="noreferrer" href={origin}>OpenF1 原始事件資料 <ExternalLink size={13}/></a>
  </div>;
}
