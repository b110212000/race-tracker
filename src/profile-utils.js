/** Pure season-profile calculations. No inferred points or race outcomes. */
export const keyDriver = item => item?.Driver?.driverId || null;
export const keyTeam = item => item?.Constructor?.constructorId || null;
export const num = value => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};
export const classified = result => {
  const status = String(result?.status || '');
  return status === 'Finished' || /^\+\d+ Laps?$/i.test(status);
};
export const person = d => [d?.givenName, d?.familyName].filter(Boolean).join(' ') || d?.code || '未知車手';
export const sortedRounds = data => [...(data?.schedule || [])].sort((a,b) => Number(a.round)-Number(b.round));
export const driverRaceLog = (data, id) => sortedRounds(data).map(r => {
  const rnd = String(r.round);
  const result = (data.results?.[rnd] || []).find(x=>keyDriver(x)===id);
  const qualifying = (data.qualifyingResults?.[rnd] || []).find(x=>keyDriver(x)===id);
  const sprint = (data.sprintResults?.[rnd] || []).find(x=>keyDriver(x)===id);
  return {round:rnd,race:r,result,qualifying,sprint};
}).filter(x=>x.result || x.qualifying || x.sprint);
export const teamRaceLog = (data, id) => sortedRounds(data).map(r=>{
  const rnd=String(r.round);
  const results=(data.results?.[rnd]||[]).filter(x=>keyTeam(x)===id);
  const qualifying=(data.qualifyingResults?.[rnd]||[]).filter(x=>keyTeam(x)===id);
  const sprint=(data.sprintResults?.[rnd]||[]).filter(x=>keyTeam(x)===id);
  return {round:rnd,race:r,results,qualifying,sprint};
}).filter(x=>x.results.length || x.qualifying.length || x.sprint.length);
export function buildCatalog(data) {
  const drivers = new Map();
  const teams = new Map();
  const addTeam = (team) => {
    if (!team?.constructorId) return;
    teams.set(team.constructorId,{...teams.get(team.constructorId),...team});
  };
  const addDriver = (driver, team) => {
    if (!driver?.driverId) return;
    const old=drivers.get(driver.driverId);
    drivers.set(driver.driverId,{
      driver:{...old?.driver,...driver},
      team:team || old?.team || null
    });
    addTeam(team);
  };
  for (const race of sortedRounds(data)) {
    const rnd=String(race.round);
    for (const field of ["results","qualifyingResults","sprintResults"]) {
      for (const row of data[field]?.[rnd] || []) addDriver(row.Driver,row.Constructor);
    }
  }
  for (const row of data.driverStandings || []) {
    const cons=row.Constructors || [];
    addDriver(row.Driver, cons[cons.length-1] || null);
  }
  for (const row of data.constructorStandings || []) addTeam(row.Constructor);
  return {
    drivers:[...drivers.values()].sort((a,b)=>person(a.driver).localeCompare(person(b.driver))),
    teams:[...teams.values()].sort((a,b)=>String(a.name).localeCompare(String(b.name)))
  };
}
export function driverStats(log) {
  const races = log.filter(x=>x.result);
  const finishes = races.filter(x=>classified(x.result));
  return {
    starts:races.filter(x=>{
      const status=String(x.result?.status||'');
      return !/did not start|not started|withdrawn|did not qualify/i.test(status)
        && (classified(x.result) || num(x.result?.grid)>0 || /retired|accident|collision|engine|gearbox/i.test(status));
    }).length,
    entered:races.length,
    finishes:finishes.length,
    podiums:finishes.filter(x=>num(x.result.position)!=null && num(x.result.position)<=3).length,
    wins:finishes.filter(x=>num(x.result.position)===1).length,
    bestRace:finishes.length?Math.min(...finishes.map(x=>num(x.result.position)).filter(x=>x!=null)):null,
    bestQualifying:Math.min(...log.map(x=>num(x.qualifying?.position)).filter(x=>x!=null),Infinity),
    racePoints:races.reduce((sum,x)=>sum+(num(x.result?.points)||0),0),
    sprintPoints:log.reduce((sum,x)=>sum+(num(x.sprint?.points)||0),0)
  };
}
export function teamStats(log) {
  return {
    races:log.filter(x=>x.results.length).length,
    wins:log.flatMap(x=>x.results).filter(x=>classified(x)&&num(x.position)===1).length,
    podiums:log.flatMap(x=>x.results).filter(x=>classified(x)&&num(x.position)!=null&&num(x.position)<=3).length,
    scoreFromRaces:log.flatMap(x=>x.results).reduce((sum,x)=>sum+(num(x.points)||0),0)
  };
}
export function officialPointsSeries(data, type, ids) {
  const archive = data.standingsHistory?.[type] || {};
  // Include rounds with race results but missing standings as an explicit gap.
  const completed = Object.keys(data.results || {}).filter(r=>(data.results[r] || []).length);
  const rounds = [...new Set([...completed,...Object.keys(archive)])]
    .map(Number).filter(Number.isFinite).sort((a,b)=>a-b);
  return rounds.map(round=>{
    const rows=archive[String(round)] || [];
    return {round,...Object.fromEntries(ids.map(id=>[id,rows.find(x=>x.id===id)?.points ?? null]))};
  });
}
export function teammateStats(data, aId, bId) {
  let qualifyingA=0,qualifyingB=0,raceA=0,raceB=0;
  for(const race of sortedRounds(data)){
    const rnd=String(race.round);
    const qualifying=data.qualifyingResults?.[rnd] || [];
    const qa=qualifying.find(x=>keyDriver(x)===aId);
    const qb=qualifying.find(x=>keyDriver(x)===bId);
    if(qa && qb && keyTeam(qa)===keyTeam(qb) && num(qa.position)>0 && num(qb.position)>0){
      if(num(qa.position)<num(qb.position))qualifyingA++;
      if(num(qb.position)<num(qa.position))qualifyingB++;
    }
    const results=data.results?.[rnd] || [];
    const ra=results.find(x=>keyDriver(x)===aId);
    const rb=results.find(x=>keyDriver(x)===bId);
    if(ra && rb && keyTeam(ra)===keyTeam(rb) && classified(ra) && classified(rb)){
      if(num(ra.position)<num(rb.position))raceA++;
      if(num(rb.position)<num(ra.position))raceB++;
    }
  }
  return {qualifyingA,qualifyingB,raceA,raceB};
}
