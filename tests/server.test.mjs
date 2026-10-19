import test from 'node:test';
import assert from 'node:assert/strict';
import { metadata, validId, isZip } from '../server/resources.mjs';
test('server only accepts bounded numeric IDs',()=>{assert.ok(validId(738063));for(const v of ['../1',0,-1,'1e3','01','123456789','https://example.com'])assert.equal(validId(v),false);});
test('metadata rejects wrong maps and HTML error pages',()=>{
  assert.deepEqual(metadata('osu file format v14\nBeatmapID:738063\nBeatmapSetID:320118',738063),{id:738063,setId:320118});
  assert.throws(()=>metadata('<html>error</html>',738063));assert.throws(()=>metadata('osu file format v14\nBeatmapID:12\nBeatmapSetID:42',738063));
});
test('archive signature refuses mirror HTML responses',()=>{assert.ok(isZip(Buffer.from([80,75,3,4,0])));assert.equal(isZip(Buffer.from('<html>')),false);});
