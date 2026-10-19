import test from 'node:test';
import assert from 'node:assert/strict';
import {sliderProfile,sliderRange,sliceSlider} from '../src/engine/slider.ts';
import {buildPath} from '../src/engine/geometry.ts';
test('legacy slider profile has a lighter translucent centre, opaque border and soft outside',()=>{
  const centre=sliderProfile(0,'rgb(10,10,10)','rgb(150,150,150)');
  const edge=sliderProfile(.75,'rgb(10,10,10)','rgb(150,150,150)');
  assert.ok(centre[0]>edge[0]+40);assert.equal(centre[3],.7);
  assert.deepEqual(sliderProfile(.9,'rgb(10,10,10)','rgb(150,150,150)'),[150,150,150,1]);
  assert.equal(sliderProfile(1.1,'#000','#fff')[3],0);
});
test('snaking reveals the path before the head, retracts only on the last span',()=>{
  assert.deepEqual(sliderRange(800,1000,2000,2,600,true,true),[0,1]);
  assert.ok(sliderRange(450,1000,2000,2,600,true,true)[1]<1);
  assert.deepEqual(sliderRange(1250,1000,2000,2,600,true,true),[0,1]);
  assert.deepEqual(sliderRange(1750,1000,2000,2,600,true,true),[0,.5]);
});
test('path slicing retains exact endpoints and handles degenerate intervals',()=>{
  const path=buildPath('L',[{x:0,y:0},{x:100,y:0}],100);
  assert.deepEqual(sliceSlider(path,.25,.75),[{x:25,y:0},{x:75,y:0}]);
  assert.equal(sliceSlider(path,.5,.5).length,2);
});
