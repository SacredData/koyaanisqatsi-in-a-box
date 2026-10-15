import test from 'node:test'
import assert from 'node:assert/strict'
import { shotsFromCuts, beatGrid, planSegments, segmentFilter, concatList } from './plan.js'

const grid = beatGrid([0.01, 0.51, 1.01, 1.51, 2.01, 2.51, 3.01, 3.51, 4.01, 4.51, 5.01, 5.51, 5.95], 6, 1)

test('beatGrid starts at 0, ends at duration, drops beats within 0.1 s of the edges', () => {
  assert.equal(grid[0], 0)
  assert.equal(grid.at(-1), 6)
  assert.equal(grid.length, 13)
  assert.deepEqual(beatGrid([0.5, 1, 1.5, 2, 2.5], 3, 2), [0, 0.5, 1.5, 2.5, 3])
})

test('planSegments keeps every cut on a grid point and covers both timelines', () => {
  const shots = shotsFromCuts([1, 2, 3], 4)
  const segs = planSegments(shots, grid, 4)
  assert.equal(segs.length, 4)
  assert.equal(segs[0].start, 0)
  assert.equal(segs.at(-1).end, 4)
  assert.equal(segs[0].dstStart, 0)
  assert.equal(segs.at(-1).dstEnd, 6)
  for (let i = 1; i < segs.length; i++) {
    assert.equal(segs[i].start, segs[i - 1].end)
    assert.equal(segs[i].dstStart, segs[i - 1].dstEnd)
    assert.ok(grid.includes(segs[i].dstStart))
  }
  // ratio 1.5: shot ends 1,2,3 -> ideal 1.5,3,4.5 -> nearest grid 1.51,3.01,4.51
  assert.deepEqual(segs.map((s) => s.dstEnd), [1.51, 3.01, 4.51, 6])
})

test('planSegments folds shots together when there are more shots than beat intervals', () => {
  const segs = planSegments(shotsFromCuts([1, 2, 3, 4, 5, 6, 7], 8), [0, 2, 4, 6], 8)
  assert.equal(segs[0].start, 0)
  assert.equal(segs.at(-1).end, 8)
  assert.deepEqual(segs.map((s) => s.dstEnd), [2, 4, 6])
})

test('planSegments folds flash frames into the next shot instead of freezing them', () => {
  const beats = Array.from({ length: 23 }, (_, i) => 0.5 * (i + 1))
  const g = beatGrid(beats, 12, 1)
  const segs = planSegments(shotsFromCuts([2, 2.033, 2.067, 2.1, 2.133, 10], 12), g, 12)
  assert.deepEqual(segs.map((s) => [s.start, s.end]), [[0, 2], [2, 10], [10, 12]])
  for (const s of segs) assert.ok((s.dstEnd - s.dstStart) / (s.end - s.start) < 2)
})

test('segmentFilter forces the exact frame count and appends user filters', () => {
  const segs = planSegments(shotsFromCuts([2], 4), grid, 4)
  // dst spans [0,3.01] and [3.01,6] at 60 fps -> 181 + 179 frames
  assert.equal(
    segmentFilter(segs[0], { filters: 'hflip', fps: 60, interpolate: false }),
    'trim=end=2,setpts=(PTS-STARTPTS)*1.505000,fps=60,tpad=stop_mode=clone:stop=181,trim=end_frame=181,settb=1/60,setpts=N,hflip',
  )
  assert.match(segmentFilter(segs[1], { fps: 60, interpolate: true }), /minterpolate=fps=60.*stop=179,trim=end_frame=179/)
})

test('concatList escapes single quotes', () => {
  assert.equal(concatList(['/a/0.mp4', "/b'c/1.mp4"]), "file '/a/0.mp4'\nfile '/b'\\''c/1.mp4'\n")
})
