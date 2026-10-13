import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Flag, GitCompareArrows, Info, Timer, Trophy, Users } from 'lucide-react';
import './weekend.css';

const teamColors = {
  mclaren:'#ff8700', ferrari:'#e80020', mercedes:'#27f4d2',
  red_bull:'#3671c6', aston_martin:'#229971', alpine:'#ff87bc',
  williams:'#64c4ff', haas:'#b4b4b4', rb:'#6692ff', racing_bulls:'#6692ff',
  sauber:'#50ff50', audi:'#ea3345', cadillac:'#b3b6bc'
};
const number = value => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};
const label = (value, prefix = 'P') => number(value) != null ? prefix + number(value) : '—';
const driverName = row => {
  const d = row?.Driver || {};
  return [d.givenName, d.familyName].filter(Boolean).join(' ') || d.code || '未知車手';
};
const driverKey = row => row?.Driver?.driverId || row?.number || '';
const finishStatus = row => {
  const status = String(row?.status || '');
  return status === 'Finished' || /^\+\d+ Laps?$/.test(status);
};
const finishLabel = row => {
  if (!row) return '—';
  if (finishStatus(row)) return label(row.position);
  const text = String(row.positionText || '').toUpperCase();
  if (text === 'D') return 'DSQ';
  if (text === 'W') return 'DNS';
  if (text === 'F' || text === 'R' || row.status) return 'DNF';
  return number(row.position) ? label(row.position) : '—';
};
const gridLabel = row => String(row?.grid) === '0' ? '維修區' : label(row?.grid);
const progress = row => {
  if (!row || !finishStatus(row)) return null;
  const start = number(row.grid), end = number(row.position);
  return start && end ? start - end : null;
};

function Driver({ row }) {
  const team = row?.Constructor || {};
  return <span className="weekend-driver">
    <span className="weekend-team-mark" style={{background:teamColors[team.constructorId] || '#a0afc2'}}/>
    <span className="weekend-driver-text"><strong>{driverName(row)}</strong><small>{team.name || '車隊未公布'}</small></span>
  </span>;
}
function Diff({ value }) {
  return <span className={'weekend-diff ' + (value > 0 ? 'positive' : value < 0 ? 'negative' : '')}>
    {value == null ? '—' : value > 0 ? <><ArrowUp size={14}/>{value}</> :
      value < 0 ? <><ArrowDown size={14}/>{Math.abs(value)}</> : '持平'}
  </span>;
}
function Empty({ title, detail }) {
  return <div className="weekend-empty"><Info size={22}/><strong>{title}</strong><p>{detail}</p></div>;
}
function StatusInfo() {
  return <div className="weekend-info"><Info size={15}/> 這裡使用已公布的 Jolpica 歷史賽事成績，並非即時排名；未取得的資料會以「—」表示。</div>;
}

export default function WeekendPanel({ race, data }) {
  const [mode, setMode] = useState('qualifying');
  const [teamPick, setTeamPick] = useState('');
  const round = String(race?.round || '');
  const qualifying = data.qualifyingResults?.[round] || [];
  const sprint = data.sprintResults?.[round] || [];
  const results = data.results?.[round] || [];

  const teams = useMemo(() => {
    const found = new Map();
    for (const row of [...qualifying, ...results, ...sprint]) {
      const c = row.Constructor;
      if (c?.constructorId) found.set(c.constructorId, c.name || c.constructorId);
    }
    return [...found].map(([id, name]) => ({id, name})).sort((a,b)=>a.name.localeCompare(b.name));
  }, [qualifying, sprint, results]);
  const team = teams.some(t=>t.id===teamPick) ? teamPick : teams[0]?.id;
  const teammateRows = useMemo(() => {
    const found = new Map();
    for (const [kind, source] of [['q', qualifying], ['race', results], ['sprint', sprint]]) {
      for (const row of source) {
        if (row.Constructor?.constructorId !== team) continue;
        const id = driverKey(row);
        if (!id) continue;
        const current = found.get(id) || {id, q:null, race:null, sprint:null};
        current[kind] = row;
        found.set(id, current);
      }
    }
    return [...found.values()].sort((a,b) => (number(a.q?.position) || 99)-(number(b.q?.position) || 99)
      || (number(a.race?.position) || 99)-(number(b.race?.position) || 99));
  }, [qualifying, results, sprint, team]);

  return <section className="weekend-wrap">
    <StatusInfo/>
    <div className="weekend-switch" role="group" aria-label="週末戰績分類">
      {[
        ['qualifying','排位賽',Timer],
        ['sprint','Sprint',Flag],
        ['positions','名次升降',Trophy],
        ['teammates','同隊比較',GitCompareArrows]
      ].map(([id,title,Icon])=><button key={id} type="button" className={mode===id?'chosen':''} onClick={()=>setMode(id)}>
        <Icon size={15}/>{title}
      </button>)}
    </div>
    {mode==='qualifying' && <div className="weekend-content">
      <header className="weekend-heading"><div><small>QUALIFYING RESULTS</small><h3>排位賽 Q1 / Q2 / Q3</h3></div><span>{qualifying.length} 位車手</span></header>
      {qualifying.length ? <div className="weekend-scroll-table" role="region" aria-label="排位賽成績表" tabIndex={0}>
        <div className="weekend-table weekend-qualifying">
          <div className="weekend-table-head"><span>排名</span><span>車手</span><span>Q1</span><span>Q2</span><span>Q3</span></div>
          {qualifying.map(row=><div className="weekend-table-row" key={driverKey(row)}>
            <b className="weekend-place">{label(row.position)}</b><Driver row={row}/>
            <span className="weekend-timing">{row.Q1 || '—'}</span><span className="weekend-timing">{row.Q2 || '—'}</span><span className="weekend-timing">{row.Q3 || '—'}</span>
          </div>)}
        </div>
      </div>:<Empty title="排位賽成績尚未公布" detail="等資料來源發布後，會顯示 Q1、Q2、Q3 的圈速。"/>}
      <p className="weekend-footnote">排位排名不一定等於正賽實際起跑位置，罰退、維修區起跑等應以正賽結果欄位的起跑順位為準。</p>
    </div>}
    {mode==='sprint' && <div className="weekend-content">
      <header className="weekend-heading"><div><small>SPRINT RESULTS</small><h3>Sprint 衝刺賽結果</h3></div><span>{sprint.length ? sprint.length+' 位車手' : ''}</span></header>
      {sprint.length ? <div className="weekend-scroll-table" role="region" aria-label="Sprint 成績表" tabIndex={0}>
        <div className="weekend-table weekend-sprint">
          <div className="weekend-table-head"><span>排名</span><span>車手</span><span>起跑</span><span>狀態</span><span>積分</span></div>
          {sprint.map(row=><div className="weekend-table-row" key={driverKey(row)}>
            <b className="weekend-place">{finishLabel(row)}</b><Driver row={row}/>
            <span>{gridLabel(row)}</span><span className="weekend-status">{row.Time?.time || row.status || '—'}</span>
            <b className="weekend-points">{row.points ?? '—'}</b>
          </div>)}
        </div>
      </div>:<Empty title={race?.Sprint?'Sprint 成績尚未公布':'這站沒有 Sprint 賽程'} detail={race?.Sprint?'這站有 Sprint 賽程，等待免費資料來源發布成績。':'只有舉辦 Sprint 的週末會有衝刺賽成績。'}/>}
    </div>}
    {mode==='positions' && <div className="weekend-content">
      <header className="weekend-heading"><div><small>GRID VS CLASSIFICATION</small><h3>實際起跑 → 正賽排名</h3></div><span>{results.length} 位車手</span></header>
      {results.length ? <div className="weekend-scroll-table" role="region" aria-label="起跑與正賽排名比較" tabIndex={0}>
        <div className="weekend-table weekend-movement">
          <div className="weekend-table-head"><span>結果</span><span>車手</span><span>起跑</span><span>變化</span><span>備註</span></div>
          {results.map(row=><div className="weekend-table-row" key={driverKey(row)}>
            <b className="weekend-place">{finishLabel(row)}</b><Driver row={row}/>
            <span>{gridLabel(row)}</span><Diff value={progress(row)}/><span className="weekend-status">{row.status || '—'}</span>
          </div>)}
        </div>
      </div>:<Empty title="正賽結果尚未公布" detail="比賽結束並取得成績後，才能計算起跑和正賽排名變化。"/>}
      <p className="weekend-footnote">只對已列為完賽／落後若干圈且起跑位置為正整數的車手計算名次變化。DNF、DSQ、DNS 或維修區起跑不自行推算。</p>
    </div>}
    {mode==='teammates' && <div className="weekend-content">
      <header className="weekend-heading"><div><small>TEAMMATE HEAD-TO-HEAD</small><h3>同車隊戰績比較</h3></div><span>{teams.length} 支車隊</span></header>
      {teams.length ? <>
        <label className="weekend-team-select">選擇車隊 <select aria-label="選擇比較車隊" value={team || ''} onChange={e=>setTeamPick(e.target.value)}>
          {teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
        </select></label>
        <div className="weekend-teammates">
          {teammateRows.map(row=><div className="weekend-teammate" key={row.id}>
            <Driver row={row.race || row.q || row.sprint}/>
            <div className="weekend-teammate-facts">
              <div><small>排位</small><strong>{label(row.q?.position)}</strong></div>
              <div><small>起跑</small><strong>{row.race ? gridLabel(row.race) : '—'}</strong></div>
              <div><small>正賽</small><strong>{finishLabel(row.race)}</strong></div>
              <div><small>正賽積分</small><strong>{row.race?.points ?? '—'}</strong></div>
              <div><small>Sprint</small><strong>{finishLabel(row.sprint)}</strong></div>
            </div>
          </div>)}
        </div>
        <p className="weekend-footnote">這裡比較同一站已公布的賽事成績，並非整季隊友戰績；不同場次可能有替補車手。</p>
      </>:<Empty title="還沒有車隊比較資料" detail="等這站有排位或賽事成績後，便能查看同隊比較。"/>}
    </div>}
  </section>;
}
