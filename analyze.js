import { spawn } from 'node:child_process'
import MusicTempo from 'music-tempo'

// Run a binary, collect stdout/stderr, reject with the stderr tail on non-zero exit.
export function exec(bin, args) {
  return new Promise((resolve, reject) => {
    const out = []
    const err = []
    const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    child.stdout.on('data', (d) => out.push(d))
    child.stderr.on('data', (d) => err.push(d))
    child.on('error', reject)
    child.on('close', (code) => {
      const stderr = Buffer.concat(err).toString()
      if (code !== 0) {
        reject(new Error(`${bin} ${args.join(' ')}\nexit ${code}\n${stderr.slice(-2000)}`))
      } else {
        resolve({ stdout: Buffer.concat(out), stderr })
      }
    })
  })
}

export async function probe(file) {
  const { stdout } = await exec('ffprobe', [
    '-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file,
  ])
  const info = JSON.parse(stdout.toString())
  const video = info.streams.find((s) => s.codec_type === 'video')
  const fps = video ? video.r_frame_rate.split('/').reduce((n, d) => n / d) : null
  const duration = Number(info.format.duration)
  if (!(duration > 0)) throw new Error(`no duration in ${file}`)
  return { duration, fps }
}

// Cut times (seconds) where ffmpeg's scene score exceeds `threshold`.
export async function detectShots(video, threshold, gpu) {
  const { stderr } = await exec('ffmpeg', [
    '-hide_banner', '-nostats', ...(gpu ? ['-hwaccel', 'cuda'] : []),
    '-i', video, '-an',
    '-vf', `scale=-2:240,select='gt(scene,${threshold})',showinfo`,
    '-f', 'null', '-',
  ])
  return [...stderr.matchAll(/pts_time:\s*([\d.]+)/g)].map((m) => Number(m[1]))
}

// Beat times (seconds) and tempo (BPM) via the BeatRoot tracker. Expects 44.1 kHz mono.
export async function detectBeats(audio) {
  const { stdout } = await exec('ffmpeg', [
    '-v', 'error', '-i', audio, '-vn', '-ac', '1', '-ar', '44100', '-f', 'f32le', '-',
  ])
  const pcm = new Float32Array(stdout.buffer, stdout.byteOffset, stdout.byteLength / 4)
  let mt
  try {
    mt = new MusicTempo(pcm)
  } catch (e) {
    throw new Error(`no beats found in ${audio}: ${e}`)
  }
  return { tempo: Number(mt.tempo), beats: mt.beats }
}
