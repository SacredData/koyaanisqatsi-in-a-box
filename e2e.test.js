import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { exec, probe, detectShots, detectBeats } from './analyze.js'

// 8 s video with hard cuts at 2, 4, 6 s; 12 s click track at 120 BPM (beat every 0.5 s).
const dir = await mkdtemp(path.join(tmpdir(), 'kib-test-'))
const video = path.join(dir, 'in.mp4')
const audio = path.join(dir, 'in.wav')
const out = path.join(dir, 'out.mkv')
const colors = ['red', 'lime', 'blue', 'yellow']
await exec('ffmpeg', [
  '-v', 'error', '-y',
  ...colors.flatMap((c) => ['-f', 'lavfi', '-i', `color=c=${c}:s=160x120:r=30:d=2`]),
  '-filter_complex', `${colors.map((_, i) => `[${i}:v]`).join('')}concat=n=4:v=1:a=0`,
  '-pix_fmt', 'yuv420p', video,
])
await exec('ffmpeg', [
  '-v', 'error', '-y', '-f', 'lavfi',
  '-i', 'aevalsrc=sin(2*PI*880*t)*lt(mod(t\\,0.5)\\,0.05)*(1-mod(t\\,0.5)/0.05):s=44100:d=12',
  audio,
])

test('analysis finds the cuts and the beats', async () => {
  const cuts = await detectShots(video, 0.3, false)
  assert.deepEqual(cuts.map((t) => Math.round(t * 10) / 10), [2, 4, 6])
  const { tempo, beats } = await detectBeats(audio)
  assert.equal(Math.round(tempo), 120)
  assert.ok(beats.length >= 22)
})

test('kib output (motion-interpolated) spans the audio and every cut lands on a beat', async () => {
  await exec('node', [
    path.join(import.meta.dirname, 'index.js'),
    '-v', video, '-a', audio, '-o', out, '-f', 'hflip',
  ])
  const info = await probe(out)
  assert.ok(Math.abs(info.duration - 12) < 0.1, `duration ${info.duration}`)
  assert.equal(info.fps, 60)
  const cuts = await detectShots(out, 0.3, false)
  assert.equal(cuts.length, 3)
  // ratio 1.5: source cuts 2,4,6 -> 3,6,9 (beat times are ~x.01)
  for (const [i, t] of cuts.entries()) {
    assert.ok(Math.abs(t - (i + 1) * 3) < 0.03, `cut at ${t}`)
  }
})

test('--no-interpolate --grid 2 renders and spans the audio', async () => {
  await exec('node', [
    path.join(import.meta.dirname, 'index.js'),
    '-v', video, '-a', audio, '-o', out, '--no-interpolate', '--grid', '2',
  ])
  const info = await probe(out)
  assert.ok(Math.abs(info.duration - 12) < 0.1, `duration ${info.duration}`)
})

test('a missing input fails with ffprobe output', async () => {
  await assert.rejects(
    exec('node', [path.join(import.meta.dirname, 'index.js'), '-v', video, '-a', path.join(dir, 'nope.wav')]),
    /nope\.wav/,
  )
})

test.after(() => rm(dir, { recursive: true, force: true }))
