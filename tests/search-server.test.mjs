import test from 'node:test';
import assert from 'node:assert/strict';
import {createSearch,searchRows} from '../server/search.mjs';
const data={status:0,data:{sid:12,title:'Song',artist:'Artist',creator:'Mapper',bid_data:[{bid:42,mode:0,version:'Hard',star:5,AR:9},{bid:43,mode:3}]}};
test('search normalizes public metadata and excludes other modes / invalid IDs',()=>{const rows=searchRows(data,'42');assert.equal(rows.length,1);assert.equal(rows[0].exact,true);assert.equal(rows[0].cover,'https://assets.ppy.sh/beatmaps/12/covers/cover.jpg');assert.equal(searchRows({status:-1},42).length,0);});
test('search only requests metadata, deduplicates concurrent IDs and caches results',async()=>{
  const calls=[];const search=createSearch(async url=>{calls.push(url);return new Response(JSON.stringify(url.endsWith('T=1')?data:{status:-1}));});
  const [a,b]=await Promise.all([search('42'),search('42')]);assert.equal(calls.length,2);assert.deepEqual(a,b);assert.ok(calls.every(url=>url.startsWith('https://api.sayobot.cn/v2/beatmapinfo?')));
  await search('42');assert.equal(calls.length,2);await assert.rejects(search('../42'));assert.equal(calls.length,2);
});
test('upstream network errors are not reported or cached as no matches',async()=>{
  let count=0;const search=createSearch(async()=>{count++;throw new Error('offline');});await assert.rejects(search('42'),/无法连接/);await assert.rejects(search('42'));assert.equal(count,4);
});
test('unrelated upstream IDs are not shown as matches',async()=>{const search=createSearch(async()=>new Response(JSON.stringify(data)));assert.deepEqual(await search('999'),[]);});
