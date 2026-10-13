import { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowRight, ChartNoAxesCombined, ChevronDown, ExternalLink, Flag, Search, Trophy, Users } from 'lucide-react';
import {
  buildCatalog, classified, driverRaceLog, driverStats, keyDriver, keyTeam,
  num, officialPointsSeries, person, sortedRounds, teamRaceLog, teamStats,
  teammateStats
} from './profile-utils.js';
import './profiles.css';

const COLORS = {
  mclaren:'#ff8700', ferrari:'#e80020', mercedes:'#27f4d2', red_bull:'#3671c6',
  aston_martin:'#229971', alpine:'#ff87bc', williams:'#64c4ff',
  haas:'#b4b4b4', rb:'#6692ff', racing_bulls:'#6692ff',
  sauber:'#50ff50', audi:'#ea3345', cadillac:'#a8abb1'
};
const tint = team => COLORS[team?.constructorId] || '#8faed4';
const prettyPoints = x => num(x)!=null ? Number(x).toLocaleString('en-US',{maximumFractionDigits:1}) : '—';
const ranking = x => num(x)>0 ? 'P'+num(x) : '—';
const finishLabel = row => {
  if (!row) return '—';
  if(classified(row))return ranking(row.position);
  const t=String(row.positionText||'').toUpperCase();
  if(t==='D')return 'DSQ';
  if(t==='W')return 'DNS';
  return row.status?'DNF':'—';
};
const externalLink = url => typeof url==='string' && /^https:\/\/[^\s]+$/i.test(url) ? url : null;

function Stat({label,value}) {
  return <div className="profile-stat"><span>{label}</span><strong>{value}</strong></div>;
}
function Notice({children}) {
  return <p className="profile-notice"><Activity size={14}/>{children}</p>;
}
function Sequence({points,label,stroke}) {
  const segments=[];
  let active=[];
  points.forEach(p=>{
    if(p===null){if(active.length)segments.push(active);active=[];}
    else active.push(p);
  });
  if(active.length)segments.push(active);
  return <g aria-label={label}>
    {segments.map((seg,i)=> <g key={i}>
      {seg.length>1 && <polyline points={seg.map(([x,y])=>x+','+y).join(' ')} fill="none" stroke={stroke} strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round"/>}
      {seg.map(([x,y],n)=><circle key={n} cx={x} cy={y} r="3.5" fill={stroke} stroke="#101721" strokeWidth="1.5"/>)}
    </g>)}
  </g>;
}
function PointsChart({data,kind,ids,labels,colors}) {
  const history = useMemo(()=>officialPointsSeries(data,kind,ids),[data,kind,ids.join('|')]);
  const valid=history.flatMap(r=>ids.map(id=>num(r[id])).filter(x=>x!==null));
  if(!valid.length) return <div className="profile-chart-empty">官方逐站積分暫未取得；不會用單站賽果推算或填入假數值。</div>;
  const width=680,left=45,right=19,top=21,bottom=217;
  const max=Math.max(1,...valid);
  const x=i=>left+(history.length===1?0.5:i/(history.length-1))*(width-left-right);
  const y=val=>bottom-(val/max)*(bottom-top);
  const series=ids.map((id,index)=>history.map((r,i)=>num(r[id])===null?null:[x(i),y(num(r[id]))]));
  const ticks=[0,0.25,0.5,0.75,1];
  return <div className="profile-chart">
    <div className="profile-chart-title"><div><span className="profile-eyebrow">OFFICIAL CHAMPIONSHIP HISTORY</span><h3>逐站累計積分走勢</h3></div><span>已公布回合</span></div>
    <div className="profile-chart-legend">{ids.map((id,i)=><span key={id}><i style={{background:colors[i]}}/>{labels[i]}</span>)}</div>
    <svg viewBox="0 0 700 254" role="img" aria-label={labels.join(' 與 ')+'逐站官方累計積分折線圖'} preserveAspectRatio="xMidYMid meet">
      {ticks.map((t,i)=><g key={i}><line x1={left} x2={width-right} y1={y(max*t)} y2={y(max*t)} stroke="#344151" strokeDasharray="4 5"/><text x={left-9} y={y(max*t)+4} fill="#99a7b8" fontSize="12" textAnchor="end">{Math.round(max*t)}</text></g>)}
      {series.map((pts,i)=><Sequence key={ids[i]} points={pts} label={labels[i]} stroke={colors[i]}/>)}
      {history.map((r,i)=><text key={r.round} x={x(i)} y="241" fill="#91a0b1" fontSize="10" textAnchor="middle">{history.length>14 && i%2===1?'':'R'+r.round}</text>)}
    </svg>
    <div className="profile-trend-records">
      {history.slice(-6).map(r=><div key={r.round}><span>R{r.round}</span>{ids.map(id=><b key={id}>{prettyPoints(r[id])}</b>)}</div>)}
    </div>
    <p className="profile-fineprint">積分來自 Jolpica 各站結束後的車手／車隊官方積分榜，不自行計算。缺少的回合會保留斷點，未公布的分數顯示 —。</p>
  </div>;
}
function ProfileHeader({subtitle,title,accent,detail,url}) {
  return <header className="profile-head" style={{'--profile-accent':accent}}>
    <div className="profile-flag-line"/><div><div className="profile-eyebrow">{subtitle}</div><h2>{title}</h2><p>{detail}</p></div>
    {externalLink(url) && <a href={url} target="_blank" rel="noreferrer">人物／車隊介紹 <ExternalLink size={13}/></a>}
  </header>;
}
function RaceHistory({items,onRace,teamMode=false}) {
  return <div className="profile-races"><div className="profile-section-title"><h3>整季分站紀錄</h3><span>已發布成績與賽程</span></div>
    {items.length ? <div className="profile-races-list">
      {items.map(item=>{
        const entry=teamMode ? item.results : [item.result].filter(Boolean);
        const q=teamMode ? item.qualifying : [item.qualifying].filter(Boolean);
        const sprint=teamMode ? item.sprint : [item.sprint].filter(Boolean);
        return <button className="profile-race" type="button" key={item.round} onClick={()=>onRace(item.round)}>
          <span className="profile-race-round">R{String(item.round).padStart(2,'0')}</span>
          <span className="profile-race-title"><strong>{item.race.raceName}</strong><small>{item.race.date}</small></span>
          <span className="profile-race-result">
            <strong>{entry.length?entry.map(finishLabel).join(' / '):'—'}</strong>
            <small>正賽 · {q.length?'排位 '+q.map(x=>ranking(x.position)).join(' / '):'尚無排位'}{sprint.length?' · Sprint '+sprint.map(x=>ranking(x.position)).join(' / '):''}</small>
          </span>
          <ArrowRight size={16}/>
        </button>;
      })}
    </div>:<div className="profile-no-data">尚無這個賽季的分站紀錄。</div>}
  </div>;
}
function FaceOff({data,ids,driversById}) {
  const [a,b]=ids;
  const stats=teammateStats(data,a,b);
  if(!a||!b) return <div className="profile-no-data">目前不足兩位有紀錄的隊友可比較。</div>;
  const nameA=person(driversById.get(a)?.driver);
  const nameB=person(driversById.get(b)?.driver);
  return <section className="profile-matchup">
    <h3>同隊交手紀錄</h3>
    <div className="profile-matchup-grid">
      <span>{nameA}</span><strong>項目</strong><span>{nameB}</span>
      <b>{stats.qualifyingA}</b><strong>排位賽領先</strong><b>{stats.qualifyingB}</b>
      <b>{stats.raceA}</b><strong>正賽雙方完賽時領先</strong><b>{stats.raceB}</b>
    </div>
    <p className="profile-fineprint">只比較同隊、同場且雙方均有有效排名的排位賽；正賽只比較雙方都有列為完賽的場次。不同車隊時的成績、退賽不算勝負。</p>
  </section>;
}
export default function Profiles({data,request,onRace}) {
  const [kind,setKind]=useState('driver');
  const [driverId,setDriverId]=useState('');
  const [teamId,setTeamId]=useState('');
  const [search,setSearch]=useState('');
  const catalog=useMemo(()=>buildCatalog(data),[data]);
  const driverMap=useMemo(()=>new Map(catalog.drivers.map(x=>[x.driver.driverId,x])),[catalog]);
  const teamMap=useMemo(()=>new Map(catalog.teams.map(x=>[x.constructorId,x])),[catalog]);
  const standingsDriver=new Map((data.driverStandings||[]).map(x=>[x.Driver.driverId,x]));
  const standingsTeam=new Map((data.constructorStandings||[]).map(x=>[x.Constructor.constructorId,x]));
  const pickedDriver=driverMap.has(driverId)?driverId:(data.driverStandings?.[0]?.Driver.driverId || catalog.drivers[0]?.driver.driverId);
  const pickedTeam=teamMap.has(teamId)?teamId:(data.constructorStandings?.[0]?.Constructor.constructorId || catalog.teams[0]?.constructorId);
  useEffect(()=>{
    if(request?.type==='driver' && driverMap.has(request.id)){
      setKind('driver');setDriverId(request.id);
    } else if(request?.type==='constructor' && teamMap.has(request.id)){
      setKind('constructor');setTeamId(request.id);
    }
  },[request,driverMap,teamMap]);
  const chosen=kind==='driver'?driverMap.get(pickedDriver):teamMap.get(pickedTeam);
  const filtered=kind==='driver'?
    catalog.drivers.filter(x=>person(x.driver).toLowerCase().includes(search.toLowerCase()) || String(x.driver.code||'').toLowerCase().includes(search.toLowerCase())):
    catalog.teams.filter(x=>String(x.name).toLowerCase().includes(search.toLowerCase()));
  const driver=kind==='driver'?chosen?.driver:null;
  const team=kind==='driver'?chosen?.team:chosen;
  const driverLog=useMemo(()=>pickedDriver?driverRaceLog(data,pickedDriver):[],[data,pickedDriver]);
  const teamLog=useMemo(()=>pickedTeam?teamRaceLog(data,pickedTeam):[],[data,pickedTeam]);
  const driverSummary=useMemo(()=>driverStats(driverLog),[driverLog]);
  const teamSummary=useMemo(()=>teamStats(teamLog),[teamLog]);
  const entry=kind==='driver'?standingsDriver.get(pickedDriver):standingsTeam.get(pickedTeam);
  const teamDriverIds=useMemo(()=>{
    const ids=new Set();
    for(const record of teamLog)for(const row of [...record.results,...record.qualifying,...record.sprint])if(keyDriver(row))ids.add(keyDriver(row));
    return [...ids].filter(id=>driverMap.has(id)).sort((a,b)=>{
      const lastA=teamLog.findLastIndex(x=>x.results.some(r=>keyDriver(r)===a));
      const lastB=teamLog.findLastIndex(x=>x.results.some(r=>keyDriver(r)===b));
      return lastB-lastA;
    });
  },[teamLog,driverMap]);
  const compareIds=teamDriverIds.slice(0,2);
  const graphIds=kind==='driver'?[pickedDriver]:[pickedTeam];
  const lastTeam=team;
  return <div className="view profile-view">
    <div className="profile-page-title"><div><span className="profile-eyebrow">PADDOCK DATABASE · {data.season}</span><h1>車手與車隊中心</h1></div><span className="profile-source">Jolpica · 免費歷史資料</span></div>
    <div className="profile-layout">
      <aside className="profile-sidebar">
        <div className="profile-switch" role="group" aria-label="查看車手或車隊">
          <button className={kind==='driver'?'selected':''} onClick={()=>{setKind('driver');setSearch('')}}><Users size={15}/> 車手</button>
          <button className={kind==='constructor'?'selected':''} onClick={()=>{setKind('constructor');setSearch('')}}><Trophy size={15}/> 車隊</button>
        </div>
        <label className="profile-search"><Search size={15}/><input aria-label="搜尋車手或車隊" placeholder="搜尋車手、車隊…" value={search} onChange={e=>setSearch(e.target.value)}/></label>
        <div className="profile-picker" role="list" aria-label="選擇查看對象">
          {filtered.map(record=>{
            const id=kind==='driver'?record.driver.driverId:record.constructorId;
            const name=kind==='driver'?person(record.driver):record.name;
            const ct=kind==='driver'?record.team:record;
            return <button role="listitem" type="button" key={id} className={(kind==='driver'?pickedDriver:pickedTeam)===id?'active':''} onClick={()=>kind==='driver'?setDriverId(id):setTeamId(id)}>
              <span className="profile-team-dot" style={{background:tint(ct)}}/><span>{name}</span><ChevronDown size={12}/>
            </button>;
          })}
          {!filtered.length&&<p className="profile-nomatch">找不到符合的資料</p>}
        </div>
      </aside>
      <div className="profile-main">
        {chosen ? <>
          <ProfileHeader
            subtitle={kind==='driver'?'DRIVER PROFILE':'CONSTRUCTOR PROFILE'}
            title={kind==='driver'?person(driver):team.name}
            accent={tint(lastTeam)}
            detail={kind==='driver'?[driver?.nationality,driver?.permanentNumber?'#'+driver.permanentNumber:null,team?.name].filter(Boolean).join(' · '):[team?.nationality,'F1 車隊'].filter(Boolean).join(' · ')}
            url={kind==='driver'?driver?.url:team?.url}
          />
          <div className="profile-stats-grid">
            <Stat label="年度排名" value={num(entry?.position)>0?'P'+entry.position:'—'}/>
            <Stat label="正式年度積分" value={prettyPoints(entry?.points)}/>
            <Stat label="正賽勝場" value={kind==='driver'?driverSummary.wins:teamSummary.wins}/>
            <Stat label="領獎台名次" value={kind==='driver'?driverSummary.podiums:teamSummary.podiums}/>
          </div>
          {kind==='driver' ? <>
            <div className="profile-stats-grid compact">
              <Stat label="正賽出賽紀錄" value={driverSummary.entered}/>
              <Stat label="完賽紀錄" value={driverSummary.finishes}/>
              <Stat label="最佳完賽名次" value={ranking(driverSummary.bestRace)}/>
              <Stat label="最佳排位名次" value={Number.isFinite(driverSummary.bestQualifying)?ranking(driverSummary.bestQualifying):'—'}/>
            </div>
            <PointsChart data={data} kind="driver" ids={graphIds} labels={[person(driver)]} colors={[tint(team)]}/>
            <RaceHistory items={driverLog} onRace={onRace}/>
          </> : <>
            <div className="profile-stats-grid compact">
              <Stat label="已公布正賽場數" value={teamSummary.races}/>
              <Stat label="本季有紀錄的車手" value={teamDriverIds.length}/>
              <Stat label="正賽得分合計" value={prettyPoints(teamSummary.scoreFromRaces)}/>
              <Stat label="計分依據" value="官方榜單"/>
            </div>
            <PointsChart data={data} kind="constructor" ids={graphIds} labels={[team.name]} colors={[tint(team)]}/>
            <section className="profile-roster"><div className="profile-section-title"><h3>本季車手陣容</h3><span>包含有紀錄的替補車手</span></div>
              <div className="profile-roster-grid">{teamDriverIds.map(id=><button key={id} type="button" onClick={()=>{setDriverId(id);setKind('driver');setSearch('')}}>
                <span className="profile-team-dot" style={{background:tint(team)}}/><strong>{person(driverMap.get(id)?.driver)}</strong><ArrowRight size={15}/>
              </button>)}</div>
            </section>
            <FaceOff data={data} ids={compareIds} driversById={driverMap}/>
            <RaceHistory items={teamLog} onRace={onRace} teamMode/>
          </>}
          <Notice>正式積分可能包含 Sprint 與賽後判罰修正，因此「單場正賽積分合計」不一定等於年度官方總積分。若有人員轉隊，個人資料中的車隊僅代表最近紀錄。</Notice>
        </>:<div className="profile-no-data">尚未有可用車手或車隊資料。請確認 GitHub Actions 資料更新是否成功。</div>}
      </div>
    </div>
  </div>;
}
