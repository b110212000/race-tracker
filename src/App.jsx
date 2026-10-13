import { useEffect, useMemo, useState } from 'react';
import AnalysisPanel from './Analysis.jsx';
import IncidentPanel from './Incidents.jsx';
import WeekendPanel from './Weekend.jsx';
import Profiles from './Profiles.jsx';
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, BellOff, CalendarDays,
  CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Clock3, ExternalLink,
  Flag, FlagTriangleRight, Gauge, History, Info, MapPin, RefreshCw,
  Search, ShieldAlert, Timer, Trophy, Users, Wrench, Zap
} from 'lucide-react';

const TZ = 'Asia/Taipei';
const BASE = import.meta.env.BASE_URL;
const EMPTY = { season: new Date().getFullYear(), schedule: [], driverStandings: [], constructorStandings: [], standingsHistory: {driver:{},constructor:{}}, results: {}, qualifyingResults: {}, sprintResults: {}, events: {}, analysisAvailable: [], updatedAt: null, warnings: [] };
const t = (value, opts = {}) => value ? new Intl.DateTimeFormat('zh-TW', { timeZone: TZ, ...opts }).format(new Date(value)) : '—';
const twDate = (value) => t(value, { month: '2-digit', day: '2-digit', weekday: 'short' });
const twClock = (value) => t(value, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
const raceDate = (race) => new Date(`${race.date}T${race.time || '12:00:00Z'}`);
const sessionDate = (session) => session?.date ? new Date(`${session.date}T${session.time || '12:00:00Z'}`) : null;
const points = (s) => s == null ? '—' : Number(s).toLocaleString('en-US', { maximumFractionDigits: 1 });

const countries = {
  australia: '澳洲', china: '中國', japan: '日本', bahrain: '巴林', saudi_arabia: '沙烏地阿拉伯', miami: '邁阿密',
  emilia_romagna: '艾米利亞－羅馬涅', monaco: '摩納哥', spain: '西班牙', canada: '加拿大', austria: '奧地利',
  uk: '英國', belgium: '比利時', hungary: '匈牙利', netherlands: '荷蘭', italy: '義大利', azerbaijan: '亞塞拜然',
  singapore: '新加坡', usa: '美國', mexico: '墨西哥', brazil: '巴西', las_vegas: '拉斯維加斯', qatar: '卡達',
  abu_dhabi: '阿布達比', portugal: '葡萄牙', turkey: '土耳其'
};
const country = (race) => countries[race?.Circuit?.Location?.country?.toLowerCase()?.replaceAll(' ', '_')] || race?.Circuit?.Location?.country || 'Grand Prix';
const monthDay = (d) => t(d, { month: '2-digit', day: '2-digit' });
const nav = [
  { id: 'home', label: '總覽', icon: Gauge },
  { id: 'schedule', label: '賽程', icon: CalendarDays },
  { id: 'standings', label: '積分榜', icon: Trophy },
  { id: 'profiles', label: '車手／車隊', icon: Users },
  { id: 'races', label: '賽事紀錄', icon: Flag }
];
const teamColors = {
  mclaren: '#ff8700', ferrari: '#e80020', mercedes: '#27f4d2', red_bull: '#3671c6', aston_martin: '#229971',
  alpine: '#ff87bc', williams: '#64c4ff', haas: '#b4b4b4', rb: '#6692ff', racing_bulls: '#6692ff',
  sauber: '#50ff50', audi: '#ea3345', cadillac: '#a8abb1'
};
const getTeamColor = (teamId) => teamColors[teamId] || '#c4c8d2';
const categories = {
  SafetyCar: '安全車', Flag: '旗號', CarEvent: '車輛事件', SessionStatus: '賽事狀態', Other: '裁判訊息', Drs: 'DRS'
};

function countdown(date, now) {
  if (!date || date.getTime() <= now) return null;
  const d = Math.floor((date.getTime() - now) / 86400000);
  const h = Math.floor(((date.getTime() - now) / 3600000) % 24);
  const m = Math.floor(((date.getTime() - now) / 60000) % 60);
  return { d, h, m };
}

function Brand() {
  return <div className="brand"><div className="brand-mark"><span>R</span></div><div className="brand-copy"><strong>RACE<span>TRACKER</span></strong><small>FORMULA RACING HUB</small></div></div>;
}

function NavButton({ item, active, onClick }) {
  const Icon = item.icon;
  return <button className={`nav-item ${active ? 'active' : ''}`} onClick={onClick} type="button"><Icon size={19} strokeWidth={2.2} /><span>{item.label}</span>{active && <span className="nav-indicator" />}</button>;
}

function StatusDot({ live = false }) {
  return <span className={`status-dot ${live ? 'live' : ''}`} aria-hidden="true" />;
}

function PanelTitle({ eyebrow, title, action }) {
  return <div className="panel-title"><div><div className="eyebrow">{eyebrow}</div><h2>{title}</h2></div>{action}</div>;
}

function RacePill({ race, data }) {
  const result = data.results?.[race.round];
  if (result?.length) return <span className="pill subtle"><CheckCircle2 size={12} /> 已完賽</span>;
  return <span className="pill red"><Clock3 size={12} /> 尚未公布賽果</span>;
}

function EventBadge({ event }) {
  const msg = event.message?.toUpperCase() || '';
  const isDanger = event.flag === 'RED' || /COLLISION|INCIDENT|INVESTIGAT|PENALT|RETIRED/.test(msg);
  return <span className={`event-kind ${isDanger ? 'danger' : event.category === 'SafetyCar' ? 'yellow' : ''}`}>{categories[event.category] || event.category || '賽事訊息'}</span>;
}

function CircuitCard({ race, className = '', onClick, data, compact = false }) {
  return <button type="button" className={`circuit-card ${className}`} onClick={onClick}>
    <div className="round-block"><small>ROUND</small><strong>{String(race.round).padStart(2, '0')}</strong></div>
    <div className="circuit-main"><strong>{country(race)}大獎賽</strong><span>{race.raceName}</span><div className="circuit-place"><MapPin size={12}/>{race.Circuit?.circuitName || '—'}</div></div>
    <div className="circuit-right"><strong>{monthDay(raceDate(race))}</strong>{compact ? <ChevronRight size={16}/> : <RacePill race={race} data={data}/>}</div>
  </button>;
}

function EmptyState({ title, detail, icon: Icon = Info }) {
  return <div className="empty-state"><Icon size={28}/><strong>{title}</strong><span>{detail}</span></div>;
}

function SummaryHero({ upcoming, recent, now, data, onOpen }) {
  const selected = upcoming || recent;
  const left = upcoming && countdown(raceDate(upcoming), now);
  return <section className="hero">
    <div className="hero-grid" aria-hidden="true" />
    <div className="hero-top"><span className="hero-kicker"><span className="small-red-square"/> {upcoming ? 'UP NEXT · 下一站' : 'LATEST RACE · 最近一站'}</span><span className="hero-season">{data.season} SEASON</span></div>
    <div className="hero-body"><div>
      <h1>{selected ? <>{country(selected)}<span>大獎賽</span></> : <>全速前進<span>賽事追蹤</span></>}</h1>
      <div className="hero-en">{selected?.raceName || 'Your Formula Racing Companion'}</div>
      <div className="hero-meta"><span><MapPin size={15}/>{selected?.Circuit?.circuitName || '免費賽車賽事資訊'}</span><span><CalendarDays size={15}/>{selected ? twClock(raceDate(selected)) : '台灣時間 UTC+8'}</span></div>
      {selected && <button className="hero-action" onClick={() => onOpen(selected.round)} type="button">查看賽事資訊 <ArrowRight size={16}/></button>}
    </div>
    <div className="countdown-card"><div className="countdown-label">{left ? 'LIGHTS OUT IN' : 'SEASON TRACKER'}</div>
      {left ? <div className="countdown-numbers">{[['天',left.d],['時',left.h],['分',left.m]].map(([label,n]) => <div key={label}><b>{String(n).padStart(2,'0')}</b><small>{label}</small></div>)}</div> : <div className="season-big">{data.season}</div>}
      <span className="countdown-caption">{left ? '距離預定開賽時間（非即時倒數燈號）' : '查看已公布的賽事資訊'}</span>
    </div></div>
  </section>;
}

function Home({ data, upcoming, recent, now, onOpen, onTab, onProfile }) {
  const sorted = data.schedule || [];
  const future = sorted.filter((r) => raceDate(r).getTime() > now).slice(0, 4);
  const display = future.length ? future : [...sorted].reverse().slice(0, 4);
  const drivers = (data.driverStandings || []).slice(0, 5);
  return <div className="view home-view">
    <SummaryHero data={data} upcoming={upcoming} recent={recent} now={now} onOpen={onOpen}/>
    <div className="summary-band"><div><div className="summary-icon"><FlagTriangleRight size={20}/></div><div><strong>{sorted.length}</strong><span>年度分站</span></div></div><div><div className="summary-icon"><Users size={20}/></div><div><strong>{data.driverStandings?.length || '—'}</strong><span>車手積分榜</span></div></div><div><div className="summary-icon"><Trophy size={20}/></div><div><strong>{data.constructorStandings?.length || '—'}</strong><span>車隊排名</span></div></div></div>
    <div className="home-grid">
      <section className="surface-panel"><PanelTitle eyebrow="RACE CALENDAR" title="近期賽程" action={<button className="text-button" onClick={() => onTab('schedule')}>完整賽程 <ArrowRight size={15}/></button>}/>
        {display.length ? <div className="race-list">{display.map((race) => <CircuitCard compact data={data} race={race} key={race.round} onClick={() => onOpen(race.round)}/>)}</div> : <EmptyState title="尚未載入賽程" detail="請先執行 GitHub Actions 更新賽季資料" icon={CalendarDays}/>}</section>
      <section className="surface-panel"><PanelTitle eyebrow="DRIVERS CHAMPIONSHIP" title="車手積分前五名" action={<button className="text-button" onClick={() => onTab('standings')}>完整排名 <ArrowRight size={15}/></button>}/>
        {drivers.length ? <div className="leader-list">{drivers.map((d) => <button type="button" className="leader-row" onClick={() => onProfile('driver', d.Driver.driverId)} title="查看車手完整資料" key={d.Driver.driverId}><span className={`leader-rank ${d.position === '1' ? 'top' : ''}`}>{String(d.position).padStart(2,'0')}</span><span className="team-accent" style={{ '--team':getTeamColor(d.Constructors?.[0]?.constructorId) }} /><div className="leader-name"><strong>{d.Driver.givenName} {d.Driver.familyName}</strong><span>{d.Constructors?.map((c) => c.name).join(' / ')}</span></div><strong className="leader-points">{points(d.points)} <small>PTS</small></strong></button>)}</div> : <EmptyState title="尚無積分資料" detail="新賽季開始後會由資料來源更新" icon={Trophy}/>}</section>
    </div>
    <div className="disclaimer-inline"><Info size={15}/> 免費歷史／賽程資訊，不提供秒級即時位置或事故責任判定。</div>
  </div>;
}

function Schedule({ data, onOpen, now }) {
  const [show, setShow] = useState('all');
  const schedule = (data.schedule || []).filter((race) => show === 'all' || (show === 'upcoming' ? raceDate(race).getTime() > now : Boolean(data.results?.[race.round]?.length)));
  return <div className="view"><PanelTitle eyebrow={`WORLD CHAMPIONSHIP ${data.season}`} title="全年賽程" action={<span className="section-count">{data.schedule?.length || 0} 場賽事</span>}/>
    <div className="segmented" role="group" aria-label="賽程篩選">{[['all','全部'],['upcoming','未來賽事'],['finished','已完賽']].map(([key,label]) => <button key={key} type="button" className={show === key ? 'selected' : ''} onClick={() => setShow(key)}>{label}</button>)}</div>
    {schedule.length ? <div className="schedule-list">{schedule.map((race) => <CircuitCard key={race.round} race={race} data={data} onClick={() => onOpen(race.round)} />)}</div> : <EmptyState title="這個分類目前沒有賽事" detail="請切換篩選條件或等候資料更新" icon={CalendarDays}/>}</div>;
}

function Standings({ data, onProfile }) {
  const [kind, setKind] = useState('drivers');
  const drivers = data.driverStandings || [];
  const teams = data.constructorStandings || [];
  const ranking = kind === 'drivers' ? drivers : teams;
  return <div className="view"><PanelTitle eyebrow={`CHAMPIONSHIP / ${data.season}`} title="賽季積分榜" action={<span className="section-count">截至最近一次資料更新</span>}/>
    <div className="segmented" role="group" aria-label="積分榜分類"><button className={kind === 'drivers' ? 'selected' : ''} onClick={() => setKind('drivers')}><Users size={15}/> 車手積分</button><button className={kind === 'teams' ? 'selected' : ''} onClick={() => setKind('teams')}><Wrench size={15}/> 車隊積分</button></div>
    {ranking.length ? <div className="table-panel"><div className="table-head"><span>排名</span><span>{kind === 'drivers' ? '車手 / 車隊' : '車隊'}</span><span>勝場</span><span>積分</span></div>{ranking.map((d) => { const driver = kind === 'drivers'; const team = driver ? d.Constructors?.[0] : d.Constructor; return <button type="button" className="standings-row profile-open-row" onClick={() => onProfile(driver ? 'driver' : 'constructor', driver ? d.Driver.driverId : team?.constructorId)} key={driver ? d.Driver.driverId : team?.constructorId}>
      <span className={`placing ${d.position === '1' ? 'first' : ''}`}>{String(d.position).padStart(2,'0')}</span><span className="driver-identity"><span className="team-accent" style={{'--team':getTeamColor(team?.constructorId)}}/><span><strong>{driver ? `${d.Driver.givenName} ${d.Driver.familyName}` : team?.name}</strong><small>{driver ? team?.name : team?.nationality || 'Constructor'}</small></span></span>
      <span className="wins">{d.wins}</span><strong className="score">{points(d.points)}</strong></button>; })}</div> : <EmptyState title="積分榜尚未公布" detail="賽季開始後會自動帶入官方公布的成績資料" icon={Trophy}/>}</div>;
}

function SessionSchedule({ race }) {
  const sessions = [['練習一','FirstPractice'],['練習二','SecondPractice'],['練習三','ThirdPractice'],['衝刺排位','SprintQualifying'],['衝刺賽','Sprint'],['排位賽','Qualifying'],['正賽',null]];
  return <div className="session-list">{sessions.map(([label,key]) => { const date = key ? sessionDate(race[key]) : raceDate(race); return date && !Number.isNaN(date.getTime()) ? <div className="session-row" key={label}><span><Clock3 size={15}/>{label}</span><strong>{twClock(date)}</strong></div> : null; })}</div>;
}

function Results({ data, race, tab, setTab, onBack }) {
  const [focusedLap, setFocusedLap] = useState(null);
  useEffect(() => { setFocusedLap(null); }, [race?.round]);
  if (!race) return <EmptyState title="尚未選取賽事" detail="請先從賽程選擇一場比賽" icon={Flag}/>;
  const rows = data.results?.[race.round] || [];
  const events = data.events?.[race.round] || [];
  return <div className="view detail-view">
    <div className="detail-banner"><button className="backline" onClick={onBack}><ChevronLeft size={16}/> 返回賽程</button><span className="eyebrow">ROUND {String(race.round).padStart(2,'0')} / {data.season}</span><h1>{country(race)}大獎賽</h1><p>{race.raceName}</p><div className="detail-banner-meta"><span><MapPin size={14}/>{race.Circuit?.circuitName}</span><span><CalendarDays size={14}/>{twClock(raceDate(race))}</span></div></div>
    <div className="details-grid"><section className="surface-panel"><PanelTitle eyebrow="WEEKEND PROGRAM" title="比賽週末時間表"/><SessionSchedule race={race}/><p className="timezone-foot">所有時間已轉換為台灣時間（UTC+8）。</p></section><section className="surface-panel"><PanelTitle eyebrow="RACE INSIGHTS" title="賽事資訊"/><div className="facts"><div><span>場次</span><strong>ROUND {race.round}</strong></div><div><span>國家／地區</span><strong>{country(race)}</strong></div><div><span>賽道</span><strong>{race.Circuit?.circuitName || '—'}</strong></div><div><span>成績狀態</span><RacePill data={data} race={race}/></div></div></section></div>
    <section className="surface-panel result-panel"><PanelTitle eyebrow="RACE ARCHIVE" title="比賽週末與賽事分析"/><div className="segmented" role="group" aria-label="賽事資料"><button className={tab === 'weekend' ? 'selected' : ''} onClick={() => setTab('weekend')}><Timer size={15}/> 週末成績</button><button className={tab === 'analysis' ? 'selected' : ''} onClick={() => setTab('analysis')}><Activity size={15}/> 賽事分析</button><button className={tab === 'results' ? 'selected' : ''} onClick={() => setTab('results')}><Trophy size={15}/> 完賽成績</button><button className={tab === 'events' ? 'selected' : ''} onClick={() => setTab('events')}><ShieldAlert size={15}/> 事件紀錄</button></div>
      {tab === 'weekend' ? <WeekendPanel race={race} data={data}/> : tab === 'analysis' ? <AnalysisPanel race={race} season={data.season} available={data.analysisAvailable || []} onShowEvents={(lap) => { setFocusedLap(lap); setTab('events'); }}/> : tab === 'results' ? (rows.length ? <div className="results-list"><div className="results-heading"><span>名次</span><span>車手</span><span>時間／狀態</span><span>積分</span></div>{rows.map((r) => <div className="result-row" key={`${r.Driver.driverId}-${r.position}`}><b className="result-pos">{r.position}</b><div className="driver-identity"><span className="team-accent" style={{'--team':getTeamColor(r.Constructor?.constructorId)}}/><span><strong>{r.Driver.givenName} {r.Driver.familyName}</strong><small>{r.Constructor?.name}</small></span></div><span className="result-status">{r.Time?.time || r.status || '—'}</span><b className="score">{points(r.points)}</b></div>)}</div> : <EmptyState title="尚未公布正式賽果" detail="本頁只顯示已發布的歷史成績，不冒充即時排名" icon={Clock3}/>) : (
        <IncidentPanel events={events} focusedLap={focusedLap} setFocusedLap={setFocusedLap} raceKey={race.round}/>
      )}</section>
  </div>;
}

export default function App() {
  const [data, setData] = useState(EMPTY);
  const [status, setStatus] = useState('loading');
  const [tab, setTab] = useState('home');
  const [raceRound, setRaceRound] = useState(null);
  const [detailTab, setDetailTab] = useState('results');
  const [now, setNow] = useState(Date.now());
  const [showInfo, setShowInfo] = useState(false);
  const [profileRequest, setProfileRequest] = useState(null);

  useEffect(() => {
    let active = true;
    fetch(`${BASE}data/season.json`, { cache: 'no-store' })
      .then((response) => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json(); })
      .then((json) => { if (!active) return; setData({...EMPTY,...json}); setStatus(json.updatedAt ? 'ready' : 'pending'); })
      .catch(() => { if (active) setStatus('error'); });
    return () => { active = false; };
  }, []);
  useEffect(() => { const id = window.setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(id); }, []);
  const sorted = useMemo(() => [...(data.schedule || [])].sort((a,b) => Number(a.round) - Number(b.round)), [data.schedule]);
  const upcoming = sorted.find((r) => raceDate(r).getTime() > now);
  const completed = sorted.filter((r) => (data.results?.[r.round] || []).length);
  const recent = completed.at(-1) || sorted.find((r) => raceDate(r).getTime() > now) || sorted.at(-1);
  const selected = sorted.find((r) => String(r.round) === String(raceRound)) || recent || sorted[0];
  const openRace = (round) => { setRaceRound(round); setDetailTab((data.qualifyingResults?.[round]?.length || data.sprintResults?.[round]?.length) ? 'weekend' : (data.analysisAvailable || []).map(String).includes(String(round)) ? 'analysis' : 'results'); setTab('races'); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const go = (which) => { setTab(which); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const openProfile = (type,id) => { if(!id)return;setProfileRequest({type,id});setTab('profiles');window.scrollTo({top:0,behavior:'smooth'}); };

  return <div className="app-layout">
    <aside className="sidebar"><Brand/><div className="sidebar-section">EXPLORE</div><nav aria-label="主選單">{nav.map((item) => <NavButton key={item.id} item={item} active={tab === item.id} onClick={() => go(item.id)}/>)}</nav><div className="sidebar-spacer"/><div className="sidebar-info"><div className="sidebar-info-icon"><Activity size={18}/></div><strong>FREE DATA EDITION</strong><p>全年賽程 · 歷史成績 · Race Control 訊息</p><span>非即時追蹤</span></div><div className="sidebar-footer">UNOFFICIAL FAN PROJECT <br/>v1.5.0</div></aside>
    <div className="main-shell"><header className="topbar"><div className="mobile-brand"><Brand/></div><div className="breadcrumb"><span>F1 RACE TRACKER</span><ChevronRight size={14}/><strong>{nav.find((item) => item.id === tab)?.label}</strong></div><div className="topbar-right"><span className="desktop-season">{data.season} SEASON</span><div className="update-state"><StatusDot live={false}/><span>{status === 'ready' ? '歷史 / 排程資料' : status === 'loading' ? '載入中' : '等待資料'}</span></div><button className="top-icon" onClick={() => setShowInfo(true)} title="資料來源與更新方式"><Info size={18}/></button></div></header>
      <main className="main-content">
        {status === 'error' && <div className="warning-bar"><Info size={17}/> 無法載入賽事資料。請檢查 GitHub Actions 是否成功部署，或重新整理網頁。</div>}
        {status === 'pending' && <div className="warning-bar"><RefreshCw size={17}/> 專案已建立，等待首次 GitHub Actions 更新賽程與成績資料。</div>}
        {status === 'ready' && data.warnings?.length > 0 && <div className="warning-bar"><Info size={17}/>{data.warnings.join(' ')}</div>}
        {tab === 'home' && <Home data={data} upcoming={upcoming} recent={recent} now={now} onOpen={openRace} onTab={go} onProfile={openProfile}/>}
        {tab === 'schedule' && <Schedule data={data} now={now} onOpen={openRace}/>}
        {tab === 'standings' && <Standings data={data} onProfile={openProfile}/>}
        {tab === 'profiles' && <Profiles data={data} request={profileRequest} onRace={openRace}/> }
        {tab === 'races' && <Results data={data} race={selected} tab={detailTab} setTab={setDetailTab} onBack={() => go('schedule')}/>}
      </main>
      <footer className="main-footer"><span>資料來源：<a href="https://api.jolpi.ca/docs/" target="_blank" rel="noreferrer">Jolpica F1</a> · <a href="https://openf1.org/docs/" target="_blank" rel="noreferrer">OpenF1</a></span><span>最新產生：{data.updatedAt ? twClock(data.updatedAt) : '等待首次部署'}（台灣時間）</span><span>非官方 · 非即時 · v1.5.0</span></footer>
    </div>
    <nav className="mobile-nav" aria-label="手機主選單">{nav.map((item) => <NavButton key={item.id} item={item} active={tab === item.id} onClick={() => go(item.id)}/>)}</nav>
    {showInfo && <div className="modal-backdrop" onClick={() => setShowInfo(false)}><div className="info-dialog" role="dialog" aria-modal="true" aria-label="資料說明" onClick={(e) => e.stopPropagation()}><div className="dialog-head"><strong>關於 Race Tracker</strong><button onClick={() => setShowInfo(false)}><span aria-hidden="true">×</span></button></div><p>這是非官方、非商業的賽車資料展示專案。Jolpica 提供賽程、車手／車隊積分及成績；OpenF1 提供已結束賽事的 Race Control 歷史事件、輪胎與逐圈近似位置資料。事故摘要僅根據英文關鍵字分類，不能推定肇事責任。</p><p>資料由 GitHub Actions 約每六小時嘗試更新一次；實際時間可能因排程延遲或 API 限制而變動。不包含即時定位、即時事故播報或推播功能。</p><div className="dialog-links"><a href="https://api.jolpi.ca/docs/" target="_blank" rel="noreferrer">Jolpica API <ExternalLink size={14}/></a><a href="https://openf1.org/docs/" target="_blank" rel="noreferrer">OpenF1 API <ExternalLink size={14}/></a></div><button className="dialog-confirm" onClick={() => setShowInfo(false)}>我知道了</button></div></div>}
  </div>;
}
