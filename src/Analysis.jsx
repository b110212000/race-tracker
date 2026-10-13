import { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowDown, ArrowUp, Clock3, Flag, Gauge, Info, RefreshCw, Timer, Wrench } from 'lucide-react';
import './analysis.css';

const colors = {
  mclaren:'#ff8700', ferrari:'#e80020', mercedes:'#27f4d2', red_bull:'#3671c6',
  aston_martin:'#229971', alpine:'#ff87bc', williams:'#64c4ff', haas:'#b4b4b4',
  rb:'#6692ff', racing_bulls:'#6692ff', sauber:'#50ff50', audi:'#ea3345', cadillac:'#a8abb1'
};
const compoundColors = {
  SOFT:'#f35358', MEDIUM:'#f5c94a', HARD:'#dce0e6',
  INTERMEDIATE:'#42c988', WET:'#4694ed', UNKNOWN:'#858b9b'
};
const compoundNames = {
  SOFT:'軟胎', MEDIUM:'中性胎', HARD:'硬胎', INTERMEDIATE:'半雨胎',
  WET:'全雨胎', UNKNOWN:'未知'
};
const fmt = n => Number.isFinite(Number(n)) && n !== null ? Number(n).toFixed(1) + ' 秒' : '—';
function DriverTag({ driver }) {
  if (!driver) return <span>未知車手</span>;
  return <span className="analysis-driver"><span className="analysis-team-dot" style={{background: colors[driver.teamId] || '#9398a4'}}/><b>{driver.code || '#' + driver.number}</b><small>{driver.name}</small></span>;
}
function AnalysisNotice({ title, children }) {
  return <div className="analysis-notice"><Info size={18}/><div><strong>{title}</strong><p>{children}</p></div></div>;
}

export default function AnalysisPanel({ race, season, available = [], onShowEvents }) {
  const [state, setState] = useState({ status:'loading', data:null, error:null });
  const [view, setView] = useState('replay');
  const [index, setIndex] = useState(0);
  const [driverFilter, setDriverFilter] = useState(null);
  const round = String(race?.round || '');
  const enabled = available.map(String).includes(round);
  useEffect(() => {
    setIndex(0); setDriverFilter(null);
    if (!enabled || !/^\d{1,2}$/.test(round)) {
      setState({status:'missing',data:null,error:null});
      return;
    }
    const controller = new AbortController();
    setState({status:'loading',data:null,error:null});
    fetch(import.meta.env.BASE_URL + 'data/analysis/' + season + '-' + round + '.json', {
      signal: controller.signal
    }).then(response => {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    }).then(json => {
      if (String(json.round) !== round || Number(json.season) !== Number(season))
        throw new Error('賽事資料不一致');
      setState({status:'ready',data:json,error:null});
    }).catch(err => {
      if (!controller.signal.aborted) setState({status:'error',data:null,error:String(err.message)});
    });
    return () => controller.abort();
  }, [round, season, enabled]);

  const analysis = state.data;
  const snapshots = analysis?.lapSnapshots || [];
  const safeIndex = Math.min(index, Math.max(0,snapshots.length - 1));
  const current = snapshots[safeIndex];
  const previous = snapshots[Math.max(0,safeIndex - 1)];
  const drivers = useMemo(() => Object.fromEntries((analysis?.drivers || []).map(d => [String(d.number),d])),[analysis]);
  const maxLap = Math.max(1, ...snapshots.map(s=>s.lap), ...(analysis?.stints || []).map(s=>s.lapEnd || s.lapStart || 1));
  const pits = analysis?.pitStops || [];

  return <div className="analysis-wrap">
    <AnalysisNotice title="免費歷史賽況 · 非官方回放">
      排名是依 OpenF1 歷史位置在每圈附近的時間點取樣，可能與官方逐圈名次不同；不包含即時轉播。輪胎與進站資料可能有缺漏。
    </AnalysisNotice>
    {state.status==='loading' && <div className="analysis-placeholder"><RefreshCw size={22} className="analysis-spin"/> 正在載入這站的歷史分析資料…</div>}
    {state.status==='missing' && <div className="analysis-placeholder"><Clock3 size={22}/> 這站尚未建立免費歷史分析。GitHub Actions 會逐批補齊已完賽的資料。</div>}
    {state.status==='error' && <div className="analysis-placeholder"><Info size={22}/> 這站分析檔案讀取失敗（{state.error}）。請重新整理或稍後查看。</div>}
    {state.status==='ready' && <>
      <div className="analysis-modes" role="group" aria-label="分析項目">
        <button type="button" className={view==='replay'?'chosen':''} onClick={()=>setView('replay')}><Activity size={16}/> 逐圈排名</button>
        <button type="button" className={view==='tyres'?'chosen':''} onClick={()=>setView('tyres')}><Gauge size={16}/> 輪胎策略</button>
        <button type="button" className={view==='pits'?'chosen':''} onClick={()=>setView('pits')}><Wrench size={16}/> 進站紀錄</button>
      </div>
      {view==='replay' && <div className="analysis-content">
        {snapshots.length ? <>
          <div className="replay-head"><div><span className="analysis-overline">LAP POSITION REPLAY</span><h3>第 {current.lap} 圈 <small>/ {maxLap} 圈（可用取樣）</small></h3></div><span className="analysis-muted">近似位置 · 非官方逐圈計時</span></div>
          <input aria-label="選擇回放圈數" className="lap-range" type="range" min="0" max={snapshots.length-1} value={safeIndex} onChange={e=>setIndex(Number(e.target.value))}/>
          <div className="replay-controls"><button type="button" disabled={safeIndex===0} onClick={()=>setIndex(i=>Math.max(0,i-1))}>上一圈</button><span>取樣 {safeIndex+1} / {snapshots.length}</span><button type="button" disabled={safeIndex===snapshots.length-1} onClick={()=>setIndex(i=>Math.min(snapshots.length-1,i+1))}>下一圈</button></div>
          <div className="replay-ranking">
            {current.positions.map(row=>{
              const d=drivers[String(row.number)];
              const prior=previous?.positions.find(p=>p.number===row.number);
              const movement=prior ? prior.position-row.position : 0;
              return <div className="replay-row" key={row.number}>
                <b className="replay-position">P{row.position}</b><DriverTag driver={d}/>
                <span className={'replay-movement '+(movement>0?'up':movement<0?'down':'')}>
                  {movement>0?<><ArrowUp size={13}/> {movement}</>:movement<0?<><ArrowDown size={13}/> {Math.abs(movement)}</>:'—'}
                </span>
              </div>;
            })}
          </div>
          <p className="analysis-caption">↑↓ 代表與上一個可用取樣的比較，不一定是該圈發生的真實超車；當資料不足時不推估名次。</p>
          <button className="analysis-link-button" onClick={()=>onShowEvents(current?.lap ?? null)}><Flag size={15}/> 查看這場比賽的事故與旗號事件</button>
        </>:<AnalysisNotice title="缺少逐圈排名資料">這場賽事沒有足夠的位置與圈數記錄，請查看輪胎或進站資料。</AnalysisNotice>}
      </div>}
      {view==='tyres' && <div className="analysis-content">
        <div className="replay-head"><div><span className="analysis-overline">TYRE STRATEGY</span><h3>輪胎使用區間</h3></div><span className="analysis-muted">每段色塊代表一個 stint</span></div>
        <div className="tyre-legend">{Object.entries(compoundNames).filter(([key])=>key!=='UNKNOWN').map(([key,name])=><span key={key}><i style={{background:compoundColors[key]}}/>{name}</span>)}</div>
        {analysis.stints.length ? <div className="tyre-grid">{Object.entries(drivers).filter(([number])=>analysis.stints.some(s=>String(s.number)===number)).map(([number,d])=>{
          const stints=analysis.stints.filter(s=>String(s.number)===number);
          const related=pits.filter(p=>String(p.number)===number);
          return <button type="button" className={'tyre-driver '+(driverFilter!==null && driverFilter!==number?'muted':'')} key={number} onClick={()=>setDriverFilter(v=>v===number?null:number)}>
            <div className="tyre-driver-header"><DriverTag driver={d}/><span>{stints.length} 段輪胎 · {related.length} 次進站</span></div>
            <div className="tyre-bar">
              {stints.map((s,i)=><div key={i} className="tyre-segment" title={(compoundNames[s.compound]||s.compound)+' · Lap '+s.lapStart+'–'+(s.lapEnd||'?')} style={{left:(Math.max(1,s.lapStart)-1)/maxLap*100+'%',width:(Math.max(1,(s.lapEnd||maxLap)-s.lapStart+1))/maxLap*100+'%',background:compoundColors[s.compound]||compoundColors.UNKNOWN}}/>)}
              {related.map((p,i)=><span key={'pit'+i} className="tyre-pit-mark" title={'Lap '+p.lap+' 進站'} style={{left:p.lap/maxLap*100+'%'}}/>)}
            </div>
            {driverFilter===number && <div className="tyre-breakdown">{stints.map((s,i)=><span key={i}>{compoundNames[s.compound]||s.compound}：第 {s.lapStart}–{s.lapEnd||'?'} 圈</span>)}</div>}
          </button>;
        })}</div>:<AnalysisNotice title="缺少輪胎紀錄">OpenF1 未提供本場的歷史輪胎 stint 資料。</AnalysisNotice>}
        <p className="analysis-caption">點擊車手可展開輪胎區間。色塊長度對應圈數，白色垂直線代表進站；沒有資料的區間保持空白。</p>
      </div>}
      {view==='pits' && <div className="analysis-content">
        <div className="replay-head"><div><span className="analysis-overline">PIT STOP ARCHIVE</span><h3>歷史進站紀錄</h3></div><span className="analysis-muted">{pits.length} 筆</span></div>
        {pits.length ? <div className="pit-table"><div className="pit-head"><span>圈數</span><span>車手</span><span>停車時間</span><span>維修區時間</span></div>
          {pits.map((p,i)=><div className="pit-row" key={i}><b>Lap {p.lap}</b><DriverTag driver={drivers[String(p.number)]}/><span>{fmt(p.stopDuration)}</span><span>{fmt(p.laneDuration)}</span></div>)}
        </div>:<AnalysisNotice title="尚無進站紀錄">資料來源未提供本場進站數據，或本場沒有可用的歷史紀錄。</AnalysisNotice>}
        <p className="analysis-caption">「停車時間」是車輛停下維修的秒數，並非整段進出 Pit Lane 的時間。資料未提供時顯示 —。</p>
      </div>}
      <div className="analysis-credit"><Timer size={13}/> 歷史來源：OpenF1 · session #{analysis.sessionKey} · 免費非即時資料</div>
    </>}
  </div>;
}
