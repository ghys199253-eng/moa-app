import test from 'node:test';
import assert from 'node:assert/strict';
import {nextAfterRemoving} from '../lib/reader-navigation.ts';

const items=[
 {id:'a',title:'가',category:'AI'},
 {id:'b',title:'나',category:'AI'},
 {id:'c',title:'다',category:'AI'}
];

test('deleting the first article selects the next visible article',()=>{
 assert.equal(nextAfterRemoving(items,'a')?.id,'b');
});
test('deleting a middle article selects the following article',()=>{
 assert.equal(nextAfterRemoving(items,'b')?.id,'c');
});
test('deleting the last article selects the previous article',()=>{
 assert.equal(nextAfterRemoving(items,'c')?.id,'b');
});
test('deleting the only item closes the reader',()=>{
 assert.equal(nextAfterRemoving([items[0]],'a'),null);
 assert.equal(nextAfterRemoving([],'a'),null);
});
test('the selection never jumps outside the caller-supplied filtered order',()=>{
 const visible=[items[2],items[0]];
 assert.equal(nextAfterRemoving(visible,'c')?.id,'a');
 assert.equal(nextAfterRemoving(visible,'a')?.id,'c');
 assert.deepEqual(visible.map(x=>x.id),['c','a']);
});
test('stale or absent selected record returns null rather than opening an unrelated record',()=>{
 assert.equal(nextAfterRemoving(items,'deleted'),null);
});
