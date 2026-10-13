import { useMemo, useState } from 'react';
import { Activity, ArrowLeftRight, ChevronLeft, ChevronRight, Gauge, Info } from 'lucide-react';
import {driversWithTimes,normalizeComparison,driverLapResults,matchedDeltas,compareWins,stintStats} from './lap-utils.js';
import './lap-compare.css';

const teamColors={mclaren:'#ff8700',ferrari:'#f35159',mercedes:'#23dfc2',red_bull:'#558ef3',
  aston_martin:'#43bd94',alpine:'#ef99c6',williams:'#62c6ff',haas:'#d6d6df',
  rb:'#758ce5',racing_bulls:'#758ce5',sauber:'#64cb73',audi:'#f87d7d',cadillac:'#a4acc7'};
const tyreNames={SOFT:'軟胎',MEDIUM:'中性胎',HARD:'硬胎',INTERMEDIATE:'半雨胎',WET:'全雨胎',UNKNOWN:'未知'};
const color=(d,fallback)=>teamColors[d?.teamId]||fallback;
function fmt(value) {
  if(value===null||value===undefined||!Number.isFinite(Number(value)))return '—';
  const n=Number(value);
  return Math.floor(n/60)+':'+(n%60).toFixed(3).padStart(6,'0');
}
const deltaFormat=n=>!Number.isFinite(n)?'—':(n>0?'+':'')+n.toFixed(3)+'s';
const sformat=n=>n===null||n===undefined?'—':Number(n).toFixed(3)+'s';
const Legend=({name,stroke})=><span className="lapcmp-legend-item"><i style={{background:stroke}}/>{name}</span>;
function LinePaths({records,side,stroke,x,y}) {
  const paths=[];
  let part=[];
  records.forEach(rec=>{
    if(!rec[side]){
      if(part.length)paths.push(part);
      part=[];
    } else part.push(rec);
  });
  if(part.length)paths.push(part);
  return <g>
    {paths.map((rows,i)=><g key={i}>
      {rows.length>1&&<polyline points={rows.map(r=>x(r.lap)+','+y(r[side].time)).join(' ')}
        fill="none" stroke={stroke} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>}
      {rows.map(r=><circle key={r.lap} cx={x(r.lap)} cy={y(r[side].time)} r="2.5" fill={stroke}/>)}
    </g>)}
  </g>;
}
function Chart({rows,driverA,driverB}) {
  const values=rows.flatMap(r=>[r.a?.time,r.b?.time].filter(n=>Number.isFinite(n)));
  if(!values.length)return null;
  const width=750,height=300,left=62,right=28,top=27,bottom=246;
  const lapMin=Math.min(...rows.map(r=>r.lap)),lapMax=Math.max(...rows.map(r=>r.lap));
  const lo=Math.min(...values),hi=Math.max(...values);
  const padding=Math.max(0.5,(hi-lo)*0.07);
  const yMin=lo-padding,yMax=hi+padding;
  const x=lap=>left+(lap-lapMin)/Math.max(1,lapMax-lapMin)*(width-left-right);
  const y=n=>bottom-(n-yMin)/Math.max(1,yMax-yMin)*(bottom-top);
  const ticks=Array.from({length:5},(_,i)=>yMin+i*(yMax-yMin)/4);
  const xLabels=rows.filter((r,i)=>i===0||i===rows.length-1||i%Math.max(1,Math.ceil(rows.length/10))===0);
  return <div className="lapcmp-chart-scroller">
    <svg width="100%" viewBox={"0 0 "+width+" "+height} role="img" aria-label="雙車手每圈實際耗時曲線圖；縱軸是秒數，越低表示單圈越快">
      {ticks.map((t,i)=><g key={i}><line x1={left} x2={width-right} y1={y(t)} y2={y(t)} stroke="#39495c" strokeDasharray="4 6"/>
        <text x={left-9} y={y(t)+4} fontSize="12" textAnchor="end" fill="#a2b1c0">{t.toFixed(1)}s</text></g>)}
      <LinePaths records={rows} side="a" stroke={color(driverA,'#fa7479')} x={x} y={y}/>
      <LinePaths records={rows} side="b" stroke={color(driverB,'#6bafff')} x={x} y={y}/>
      {xLabels.map(r=><text key={r.lap} x={x(r.lap)} y={bottom+20} textAnchor="middle" fontSize="11" fill="#a3b0c1">{r.lap}</text>)}
      <text x={width-right} y={height-8} textAnchor="end" fontSize="11" fill="#9aabba">單圈 Lap</text>
    </svg>
  </div>;
}
function Stat({label,value,emphasis}){return <div className={'lapcmp-stat '+(emphasis?'emphasis':'')}><span>{label}</span><b>{value}</b></div>;}
function TyreCard({driver,stints,stroke}) {
  return <div className="lapcmp-tyre-card">
    <div className="lapcmp-tyre-title"><i style={{background:stroke}}/><strong>{driver?.code||'#'+driver?.number}</strong><span>換胎區間的有效圈速</span></div>
    {stints.length?<div className="lapcmp-tyre-list">{stints.map((s,i)=><div key={i}>
      <span>{tyreNames[s.compound]||s.compound}</span><span>Lap {s.lapStart}–{s.lapEnd||'?'}</span>
      <b>{s.stats.count?sformat(s.stats.average):'—'}</b><small>平均</small>
    </div>)}</div>:<p className="lapcmp-note">這場沒有完整輪胎 stint 資料。</p>}
  </div>;
}
export default function LapCompare({analysis}) {
  const list=useMemo(()=>driversWithTimes(analysis),[analysis]);
  const [pickA,setPickA]=useState('');
  const [pickB,setPickB]=useState('');
  const [excludePit,setExcludePit]=useState(true);
  const [selectedIndex,setSelectedIndex]=useState(0);
  const a=list.some(d=>String(d.number)===pickA)?pickA:String(list[0]?.number||'');
  const b=list.some(d=>String(d.number)===pickB && pickB!==a)?pickB:
    String(list.find(d=>String(d.number)!==a)?.number||'');
  const driverA=list.find(d=>String(d.number)===a);
  const driverB=list.find(d=>String(d.number)===b);
  const rows=useMemo(()=>a&&b?normalizeComparison(analysis,a,b,excludePit):[],[analysis,a,b,excludePit]);
  const deltas=useMemo(()=>matchedDeltas(rows),[rows]);
  const summaryA=useMemo(()=>driverLapResults(rows,'a'),[rows]);
  const summaryB=useMemo(()=>driverLapResults(rows,'b'),[rows]);
  const wins=useMemo(()=>compareWins(rows),[rows]);
  const stintsA=useMemo(()=>stintStats(analysis,a,excludePit),[analysis,a,excludePit]);
  const stintsB=useMemo(()=>stintStats(analysis,b,excludePit),[analysis,b,excludePit]);
  const safeIndex=Math.min(selectedIndex,Math.max(0,deltas.length-1));
  const selected=deltas[safeIndex];
  return <section className="lapcmp">
    <div className="lapcmp-heading"><div><div className="analysis-overline">HISTORICAL LAP TIME COMPARISON</div>
      <h3>雙車手圈速分析</h3></div><span>實際歷史圈速 · 非即時資料</span></div>
    <p className="lapcmp-explain">每圈秒數直接來自 OpenF1 的歷史 laps 紀錄，不用近似排名推算。越低表示該圈耗時越少；比較僅供賽後分析。</p>
    {list.length<2 ? <div className="lapcmp-empty"><Info size={23}/>
      <strong>這站暫時沒有足夠的雙車手圈速資料</strong>
      <p>舊場次由 GitHub Actions 分批補入 OpenF1 歷史 laps；若來源沒有提供完整資料，就不顯示推算結果。</p>
    </div>:<>
      <div className="lapcmp-selection">
        <label><span>車手 A</span><select aria-label="比較車手 A" value={a} onChange={e=>{setPickA(e.target.value);setPickB('');setSelectedIndex(0)}}>
          {list.map(d=><option key={d.number} value={d.number}>{d.code} · {d.name}</option>)}</select></label>
        <ArrowLeftRight className="lapcmp-switch-icon" size={20}/>
        <label><span>車手 B</span><select aria-label="比較車手 B" value={b} onChange={e=>{setPickB(e.target.value);setSelectedIndex(0)}}>
          {list.filter(d=>String(d.number)!==a).map(d=><option key={d.number} value={d.number}>{d.code} · {d.name}</option>)}</select></label>
      </div>
      <label className="lapcmp-option"><input type="checkbox" checked={excludePit} onChange={e=>{setExcludePit(e.target.checked);setSelectedIndex(0)}}/>
        排除已標記的出站圈與進站前後一圈 <small>（減少進站干擾，並非綠旗圈認定）</small></label>
      <div className="lapcmp-stats">
        <div><Legend name={driverA?.name} stroke={color(driverA,'#fa7479')}/>
          <div className="lapcmp-stat-row"><Stat label="有效圈數" value={summaryA.count}/><Stat label="最快圈" value={fmt(summaryA.best)}/><Stat label="中位數" value={fmt(summaryA.median)}/></div></div>
        <div><Legend name={driverB?.name} stroke={color(driverB,'#6bafff')}/>
          <div className="lapcmp-stat-row"><Stat label="有效圈數" value={summaryB.count}/><Stat label="最快圈" value={fmt(summaryB.best)}/><Stat label="中位數" value={fmt(summaryB.median)}/></div></div>
      </div>
      {rows.length?<div className="lapcmp-chart-panel">
        <div className="lapcmp-panel-title"><h4>單圈耗時曲線</h4><span>秒數越小，該圈越快</span></div>
        <Chart rows={rows} driverA={driverA} driverB={driverB}/>
        <div className="lapcmp-matchup"><b>{wins.a}</b><span>共同有紀錄的 {wins.total} 圈中，A 較快 / B 較快</span><b>{wins.b}</b></div>
        {deltas.length?<div className="lapcmp-delta">
          <div className="lapcmp-panel-title"><h4>同圈時間差</h4><span>只比較兩位車手都有紀錄的圈數</span></div>
          <input aria-label="選擇比較圈數" type="range" min="0" max={deltas.length-1} value={safeIndex} onChange={e=>setSelectedIndex(Number(e.target.value))}/>
          <div className="lapcmp-stepper"><button disabled={safeIndex===0} onClick={()=>setSelectedIndex(i=>Math.max(0,i-1))}><ChevronLeft size={15}/>上一圈</button>
            <strong>Lap {selected.lap} <small>({safeIndex+1}/{deltas.length})</small></strong>
            <button disabled={safeIndex===deltas.length-1} onClick={()=>setSelectedIndex(i=>Math.min(deltas.length-1,i+1))}>下一圈<ChevronRight size={15}/></button></div>
          <div className="lapcmp-delta-cards">
            <Stat label={(driverA?.code||'A')+' 單圈'} value={fmt(selected.a)}/>
            <Stat label="A − B（正值代表 B 較快）" value={deltaFormat(selected.delta)} emphasis/>
            <Stat label={(driverB?.code||'B')+' 單圈'} value={fmt(selected.b)}/>
          </div>
          <div className="lapcmp-sector-table">
            {[0,1,2].map((i)=><div key={i}><span>Sector {i+1}</span>
              <strong>{sformat(selected.sectorsA?.[i])}</strong>
              <strong>{sformat(selected.sectorsB?.[i])}</strong></div>)}
          </div>
        </div>:<div className="lapcmp-empty">兩位車手沒有共同可比較的圈數。</div>}
      </div>:<div className="lapcmp-empty">選擇的車手沒有符合條件的圈數，請取消排除進站附近圈數。</div>}
      <div className="lapcmp-tyres">
        <div className="lapcmp-panel-title"><h4>輪胎策略與圈速</h4><span>各段 Stint 的歷史圈速平均</span></div>
        <div className="lapcmp-tyres-grid"><TyreCard driver={driverA} stints={stintsA} stroke={color(driverA,'#fa7479')}/>
          <TyreCard driver={driverB} stints={stintsB} stroke={color(driverB,'#6bafff')}/></div>
      </div>
      <p className="lapcmp-note"><Info size={14}/> 圈速受胎齡、油量、交通、天氣、黃旗與安全車等因素影響；此頁不判定純競速表現。若資料來源缺圈或缺 Sector，保持空白。單圈差為 A 減 B，僅代表同圈耗時差異。</p>
    </>}
  </section>;
}
