// Helpers for OpenF1 historical lap durations. Never infer missing values.
export const numeric = value => value === null || value === undefined || value === '' ? null : Number.isFinite(Number(value)) ? Number(value) : null;
export function driversWithTimes(analysis) {
  const numbers = new Set((analysis?.lapTimes || []).map(x=>String(x.number)));
  return (analysis?.drivers || []).filter(d=>numbers.has(String(d.number)));
}
export function normalizeComparison(analysis, a, b, excludePit = true) {
  const all = analysis?.lapTimes || [];
  const pits = analysis?.pitStops || [];
  const aroundPit = new Set();
  for (const stop of pits) {
    if(String(stop.number)!==String(a) && String(stop.number)!==String(b)) continue;
    const lap=numeric(stop.lap);
    if (lap!==null) for(const n of [lap-1,lap,lap+1])aroundPit.add(String(stop.number)+':'+n);
  }
  const grouped = new Map();
  for (const rec of all) {
    if(String(rec.number)!==String(a) && String(rec.number)!==String(b))continue;
    const lap=numeric(rec.lap),duration=numeric(rec.time);
    if(lap===null||lap<1||duration===null||duration<30||duration>600)continue;
    if(excludePit && (rec.pitOut === true || aroundPit.has(String(rec.number)+':'+lap)))continue;
    const slot=grouped.get(lap)||{lap, a:null, b:null};
    slot[String(rec.number)===String(a)?'a':'b']={...rec,time:duration};
    grouped.set(lap,slot);
  }
  return [...grouped.values()].sort((x,y)=>x.lap-y.lap);
}
export function lapStats(records) {
  const times=records.map(x=>numeric(x?.time)).filter(t=>t!==null);
  if(!times.length)return {count:0,best:null,average:null,median:null};
  const sorted=[...times].sort((a,b)=>a-b);
  return {
    count:times.length,
    best:sorted[0],
    average:times.reduce((sum,x)=>sum+x,0)/times.length,
    median:sorted.length%2 ? sorted[Math.floor(sorted.length/2)]:
      (sorted[sorted.length/2-1]+sorted[sorted.length/2])/2,
  };
}
export function driverLapResults(rows,side) {
  return lapStats(rows.map(r=>r[side]).filter(Boolean));
}
export function matchedDeltas(rows) {
  return rows.filter(x=>x.a && x.b).map(x=>({
    lap:x.lap,
    // Positive delta means A took MORE time; B is faster.
    delta:x.a.time-x.b.time,
    a:x.a.time,b:x.b.time,
    sectorsA:x.a.sectors, sectorsB:x.b.sectors
  }));
}
export function compareWins(rows) {
  let a=0,b=0,tied=0;
  for(const x of matchedDeltas(rows)) {
    if (Math.abs(x.delta)<0.0005)tied++;
    else if(x.delta<0)a++;
    else b++;
  }
  return {a,b,tied,total:a+b+tied};
}
export function stintStats(analysis, number, excludePit=true) {
  const rows = (analysis?.lapTimes || []).filter(r=>String(r.number)===String(number));
  const grouped=normalizeComparison(analysis,number,number,excludePit);
  const byLap=new Map(grouped.map(x=>[x.lap,x.a]));
  return (analysis?.stints || []).filter(s=>String(s.number)===String(number)).map(s=>{
    const recs=rows.filter(x=>x.lap>=s.lapStart && x.lap<=s.lapEnd && byLap.has(x.lap));
    return {
      ...s,
      stats:lapStats(recs),
    };
  });
}
