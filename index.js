#!/usr/bin/env node
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { availableParallelism, tmpdir } from 'node:os'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { exec, probe, detectShots, detectBeats } from './analyze.js'
import { shotsFromCuts, beatGrid, planSegments, segmentFilter, concatList } from './plan.js'

const USAGE = `Usage: kib -v <video> -a <audio> [options]

Retime the video to the audio so every picture cut lands on a beat.

  -v, --video <path>        video file (required)
  -a, --audio <path>        audio file (required)
  -f, --filter <filters>    extra ffmpeg video filters, run on each segment after its frame-count
                            trim (comma-separated; per-frame filters only, not fps= or fade=)
  -g, --gpu                 NVIDIA decode (cuda) and encode (h264_nvenc)
  -c, --container <name>    ffmpeg output format (default: matroska)
  -o, --output <path>       output file (default: <video>_noGlass.<ext>)
  -t, --threshold <0..1>    scene-cut sensitivity, lower finds more cuts (default: 0.3)
  -j, --jobs <n>            segments rendered in parallel (default: CPU count, 4 with --gpu)
      --grid <n>            snap cuts to every nth beat (default: 1)
      --fps <n>             output frame rate (default: 60)
      --no-interpolate      plain frame rate conversion instead of motion interpolation
  -h, --help
`

const { values: opts } = parseArgs({
  allowNegative: true,
  options: {
    video: { type: 'string', short: 'v' },
    audio: { type: 'string', short: 'a' },
    filter: { type: 'string', short: 'f' },
    gpu: { type: 'boolean', short: 'g', default: false },
    container: { type: 'string', short: 'c', default: 'matroska' },
    output: { type: 'string', short: 'o' },
    threshold: { type: 'string', short: 't', default: '0.3' },
    jobs: { type: 'string', short: 'j' },
    grid: { type: 'string', default: '1' },
    fps: { type: 'string', default: '60' },
    interpolate: { type: 'boolean', default: true },
    help: { type: 'boolean', short: 'h', default: false },
  },
})

const threshold = Number(opts.threshold)
const grid = Number(opts.grid)
const fps = Number(opts.fps)
const jobs = opts.jobs === undefined ? (opts.gpu ? 4 : availableParallelism()) : Number(opts.jobs)
const valid = threshold > 0 && threshold <= 1 && Number.isInteger(grid) && grid > 0
  && Number.isFinite(fps) && fps > 0 && Number.isInteger(jobs) && jobs > 0
if (opts.help || !opts.video || !opts.audio || !valid) {
  process.stderr.write(USAGE)
  process.exit(opts.help ? 0 : 1)
}

const video = path.resolve(opts.video)
const audio = path.resolve(opts.audio)
const ext = opts.container === 'matroska' ? 'mkv' : opts.container
const output = opts.output
  ? path.resolve(opts.output)
  : path.join(path.dirname(video), `${path.parse(video).name}_noGlass.${ext}`)
if (output === video || output === audio) {
  console.error('output must differ from the inputs')
  process.exit(1)
}

const [v, a, cuts, { tempo, beats }] = await Promise.all([
  probe(video),
  probe(audio),
  detectShots(video, threshold, opts.gpu),
  detectBeats(audio),
])

if (v.fps === null) {
  console.error(`no video stream in ${video}`)
  process.exit(1)
}
const shots = shotsFromCuts(cuts, v.duration)
const beatTimes = beatGrid(beats, a.duration, grid)
const segments = planSegments(shots, beatTimes, v.duration)

console.log(`video  ${v.duration.toFixed(2)}s @ ${v.fps.toFixed(3)} fps, ${shots.length} shots`)
console.log(`audio  ${a.duration.toFixed(2)}s, ${tempo.toFixed(1)} BPM, ${beatTimes.length - 1} beat intervals`)
console.log(`plan   ${segments.length} segments, ratio ${(a.duration / v.duration).toFixed(3)}, ${jobs} jobs`)
for (const s of segments) {
  const k = (s.dstEnd - s.dstStart) / (s.end - s.start)
  console.log(`  ${s.start.toFixed(2)}-${s.end.toFixed(2)} -> ${s.dstStart.toFixed(2)}-${s.dstEnd.toFixed(2)}  x${k.toFixed(3)}`)
}

const encode = [
  '-c:v', opts.gpu ? 'h264_nvenc' : 'libx264',
  ...(opts.gpu ? ['-preset', 'p5', '-cq', '19'] : ['-preset', 'medium', '-crf', '18']),
  '-pix_fmt', 'yuv420p',
]
const work = await mkdtemp(path.join(tmpdir(), 'kib-'))
const parts = segments.map((_, i) => path.join(work, `${i}.mp4`))

// One ffmpeg per segment, `jobs` at a time: one minterpolate's memory per process, all cores busy.
async function render(i) {
  const s = segments[i]
  await exec('ffmpeg', [
    '-hide_banner', '-y', ...(opts.gpu ? ['-hwaccel', 'cuda'] : []),
    '-ss', String(s.start), '-i', video, '-an',
    '-vf', segmentFilter(s, { filters: opts.filter, fps, interpolate: opts.interpolate }),
    ...encode, parts[i],
  ])
  console.log(`segment ${i + 1}/${segments.length} done`)
}

try {
  let next = 0
  let failed = false
  const workers = Array.from({ length: Math.min(jobs, segments.length) }, async () => {
    while (next < segments.length && !failed) {
      try { await render(next++) } catch (e) { failed = true; throw e }
    }
  })
  const bad = (await Promise.allSettled(workers)).find((r) => r.status === 'rejected')
  if (bad) throw bad.reason
  const list = path.join(work, 'list.txt')
  await writeFile(list, concatList(parts))
  await exec('ffmpeg', [
    '-hide_banner', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-i', audio,
    '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'flac', '-strict', '-2',
    '-f', opts.container, output,
  ])
} finally {
  await rm(work, { recursive: true, force: true })
}
console.log(`wrote ${output}`)
