const {test}=require('node:test');
const assert=require('node:assert/strict');
const T=require('../influencer-tools.js');
test('Moving either handle keeps selection inside source and below 30 seconds',()=>{
  for(const edge of ['start','end'])for(const value of [-50,0,5,29.9,70,100,200]){
    const {start,end}=T.moveBoundary(10,20,value,edge,100);
    assert.ok(start>=0);assert.ok(end<=100);assert.ok(end>start);assert.ok(end-start<=29.900001);
  }
  assert.deepEqual(T.moveBoundary(10,20,80,'end',100),{start:50.1,end:80});
});
test('Selection works for short clips and handles cannot cross',()=>{
  for(const edge of ['start','end'])for(const value of [-1,0,.5,1,2]){
    const p=T.moveBoundary(0,1,value,edge,1);
    assert.ok(p.start>=0&&p.end<=1&&p.end>p.start);
  }
});
test('Waveform includes peaks from both stereo channels and silence',()=>{
  const buffer={numberOfChannels:2,getChannelData:c=>Float32Array.from(c?[0,-.9,0,0]:[.2,0,0,.5])};
  const peaks=T.waveformPeaks(buffer,2);
  assert.ok(Math.abs(peaks[0]-.9)<1e-6);assert.equal(peaks[1],.5);
  assert.deepEqual([...T.waveformPeaks({numberOfChannels:1,getChannelData:()=>new Float32Array(100)},4)],[0,0,0,0]);
});
test('Compass directions use short full Swedish words',()=>{
  assert.equal(T.compassWords(0),'norr');assert.equal(T.compassWords(90),'öster');
  assert.equal(T.compassWords(135),'sydost');assert.equal(T.compassWords(225),'sydväst');
  assert.equal(T.compassWords(359),'norr');
});
