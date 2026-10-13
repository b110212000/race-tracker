import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCatalog, classified, driverRaceLog, driverStats, officialPointsSeries,
  teamRaceLog, teamStats, teammateStats
} from './profile-utils.js';

const a={driverId:'a',givenName:'Alex',familyName:'One'};
const b={driverId:'b',givenName:'Blair',familyName:'Two'};
const c={driverId:'c',givenName:'Casey',familyName:'Three'};
const red={constructorId:'red',name:'Red Racing'};
const blue={constructorId:'blue',name:'Blue Racing'};
const result=(Driver,Constructor,position,status='Finished',grid='1')=>({Driver,Constructor,position:String(position),grid,status,points:'8'});
const quali=(Driver,Constructor,position)=>({Driver,Constructor,position:String(position)});
const sample={
  schedule:[{round:'1',raceName:'A',date:'2026-01-01'},{round:'2',raceName:'B',date:'2026-01-08'}],
  driverStandings:[{Driver:a,Constructors:[red],points:'36',position:'1'}],
  constructorStandings:[{Constructor:red,points:'44',position:'1'}],
  results:{
    '1':[result(a,red,2),result(b,red,3),result(c,blue,1)],
    '2':[result(a,red,1),result(b,red,20,'Did not start'),result(c,blue,2)]
  },
  qualifyingResults:{'1':[quali(a,red,3),quali(b,red,4),quali(c,blue,1)],
                      '2':[quali(a,red,2),quali(b,red,1),quali(c,blue,3)]},
  sprintResults:{'2':[{Driver:a,Constructor:red,position:'2',points:'7'}]},
  standingsHistory:{
    driver:{'1':[{id:'a',points:18,position:1}], '2':[{id:'a',points:36,position:1}]},
    constructor:{'1':[{id:'red',points:24,position:1}], '2':[{id:'red',points:44,position:1}]}
  }
};

test('catalog uses real driver and team identities',()=>{
  const list=buildCatalog(sample);
  assert.equal(list.drivers.length,3);
  assert.equal(list.teams.length,2);
  assert.equal(list.drivers.find(x=>x.driver.driverId==='a').team.name,'Red Racing');
});
test('driver stats count classifications and do not mark DNS as starter',()=>{
  const stats=driverStats(driverRaceLog(sample,'b'));
  assert.equal(stats.entered,2);
  assert.equal(stats.starts,1);
  assert.equal(stats.finishes,1);
  assert.equal(stats.podiums,1);
});
test('team season stats count wins and podiums from race result only',()=>{
  const stats=teamStats(teamRaceLog(sample,'red'));
  assert.equal(stats.races,2);
  assert.equal(stats.wins,1);
  assert.equal(stats.podiums,3);
});
test('head-to-head ignores a race if either driver was DNS',()=>{
  const stats=teammateStats(sample,'a','b');
  assert.equal(stats.qualifyingA,1);
  assert.equal(stats.qualifyingB,1);
  assert.equal(stats.raceA,1);
  assert.equal(stats.raceB,0);
});
test('official standings trend maintains missing rounds as gaps',()=>{
  const broken={...sample,standingsHistory:{driver:{'1':[{id:'a',points:10,position:1}]}}};
  const series=officialPointsSeries(broken,'driver',['a']);
  assert.equal(series.length,2);
  assert.equal(series[0].a,10);
  assert.equal(series[1].a,null);
});
test('no synthetic points if all standings history unavailable',()=>{
  const series=officialPointsSeries({...sample,standingsHistory:{}},'constructor',['red']);
  assert.equal(series.length,2);
  assert.ok(series.every(x=>x.red===null));
});
test('race classification only accepts finished and lapped cars',()=>{
  assert.equal(classified({status:'Finished'}),true);
  assert.equal(classified({status:'+2 Laps'}),true);
  assert.equal(classified({status:'Collision'}),false);
});
