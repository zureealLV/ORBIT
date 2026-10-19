import test from 'node:test';
import assert from 'node:assert/strict';
import {searchId,groupSearchRows,type SearchRow} from '../src/search';
test('automatic lookup accepts difficulty and set IDs or official links only',()=>{
  for(const value of ['738063','https://osu.ppy.sh/beatmapsets/320118#osu/738063','https://osu.ppy.sh/b/738063'])assert.equal(searchId(value),'738063');
  assert.equal(searchId('https://osu.ppy.sh/beatmapsets/320118'),'320118');
  for(const value of ['0','01','1e4','https://evil.test/b/42','<img src=x>','123456789'])assert.equal(searchId(value),null);
});
const row=(id:number,setId:number,stars:number,exact=false):SearchRow=>({id,setId,stars,exact,title:'Song',artist:'Artist',creator:'Mapper',version:`Difficulty ${id}`,length:90,bpm:180,ar:9,cs:4,od:8,video:false,storyboard:false,cover:'cover.jpg'});
test('search cards group difficulties by set without repeating covers',()=>{
  const rows=[row(1,20,2),row(2,20,6),row(3,30,4),row(2,20,6)];const grouped=groupSearchRows(rows);
  assert.equal(grouped.length,2);assert.deepEqual(grouped.map(r=>r.setId),[20,30]);assert.equal(grouped[0].difficultyCount,2);assert.equal(grouped[0].id,2);assert.equal(grouped[0].minStars,2);assert.equal(grouped[0].maxStars,6);assert.equal(rows.length,4);
});
test('exact difficulty stays the representative even when another difficulty is harder',()=>{
  const grouped=groupSearchRows([row(1,20,9),row(2,30,7),row(3,30,2,true)]);
  assert.equal(grouped[0].setId,30);assert.equal(grouped[0].id,3);assert.equal(grouped[0].difficultyCount,2);assert.equal(groupSearchRows([]).length,0);
});
