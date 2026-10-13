import test from 'node:test';
import assert from 'node:assert/strict';
import {
  driversWithTimes,normalizeComparison,lapStats,matchedDeltas,
  compareWins,stintStats
} from './lap-utils.js';

const analysis={
  drivers:[
    {number:44,code:'HAM',name:'Driver A',teamId:'ferrari'},
    {number:16,code:'LEC',name:'Driver B',teamId:'ferrari'}
  ],
  lapTimes:[
    {number:44,lap:1,time:94,sectors:[30,35,29],pitOut:false},
    {number:16,lap:1,time:93,sectors:[29,35,29],pitOut:false},
    {number:44,lap:2,time:91,sectors:[29,34,28],pitOut:false},
    {number:16,lap:2,time:92,sectors:[29,35,28],pitOut:false},
    {number:44,lap:3,time:120,sectors:[40,44,36],pitOut:true},
    {number:16,lap:3,time:91.2,sectors:[28.9,34,28.3],pitOut:false},
    {number:44,lap:4,time:93,sectors:[30,34,29],pitOut:false},
    {number:16,lap:5,time:91.5,sectors:[29,34,28.5],pitOut:false},
  ],
  pitStops:[{number:44,lap:3}],
  stints:[
    {number:44,lapStart:1,lapEnd:3,compound:'SOFT'},
    {number:44,lapStart:4,lapEnd:6,compound:'MEDIUM'}
  ]
};
test('driversWithout recorded laps not selectable',()=>{
  const data={...analysis,drivers:[...analysis.drivers,{number:1,code:'ONE'}]};
  assert.deepEqual(driversWithTimes(data).map(x=>x.code),['HAM','LEC']);
});
test('aligned laps omit missing pair not invented',()=>{
  const rows=normalizeComparison(analysis,44,16,false);
  assert.equal(rows.length,5);
  assert.equal(rows.find(r=>r.lap===4).b,null);
  assert.equal(rows.find(r=>r.lap===5).a,null);
  assert.equal(matchedDeltas(rows).length,3);
});
test('signed delta A minus B and lap count',()=>{
  const rows=normalizeComparison(analysis,44,16,false);
  const d=matchedDeltas(rows);
  assert.equal(d[0].delta,1);
  assert.equal(d[1].delta,-1);
  assert.equal(compareWins(rows).a,1);
  assert.equal(compareWins(rows).b,2);
});
test('pit-out and pit-near laps excluded only when toggled',()=>{
  const rows=normalizeComparison(analysis,44,16,true);
  assert.equal(rows.find(x=>x.lap===2).a,null);
  assert.equal(rows.find(x=>x.lap===3).a,null);
  assert.equal(rows.find(x=>x.lap===4).a,null);
  assert.equal(rows.find(x=>x.lap===2).b.time,92);
  assert.equal(matchedDeltas(rows).length,1);
});
test('statistic includes median and average only from observed durations',()=>{
  const stats=lapStats([{time:80},{time:90},{time:100}]);
  assert.equal(stats.best,80);
  assert.equal(stats.average,90);
  assert.equal(stats.median,90);
  assert.equal(stats.count,3);
  assert.equal(lapStats([]).best,null);
});
test('stint averages exclude pit-related samples but retain tyre metadata',()=>{
  const value=stintStats(analysis,44,true);
  assert.equal(value.length,2);
  assert.equal(value[0].compound,'SOFT');
  assert.equal(value[0].stats.count,1);
  assert.equal(value[0].stats.average,94);
  assert.equal(value[1].stats.count,0);
});
