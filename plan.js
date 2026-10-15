// Pure planning: map source shots onto a beat grid and build per-segment ffmpeg filters.

export function shotsFromCuts(cuts, duration) {
  const bounds = [0, ...cuts.filter((t) => t > 0 && t < duration), duration]
  const shots = []
  for (let i = 1; i < bounds.length; i++) {
    if (bounds[i] > bounds[i - 1]) shots.push({ start: bounds[i - 1], end: bounds[i] })
  }
  return shots
}

// Beat grid: [0, every Nth beat at least 0.1 s from either edge, duration].
export function beatGrid(beats, duration, every) {
  const inner = beats.filter((b, i) => i % every === 0 && b > 0.1 && b < duration - 0.1)
  return [0, ...inner, duration]
}

// ponytail: linear scan; grid is sorted, binary search if thousands of shots ever matter.
function nearestIndex(grid, t) {
  let j = 0
  for (let k = 1; k < grid.length; k++) {
    if (Math.abs(grid[k] - t) < Math.abs(grid[j] - t)) j = k
  }
  return j
}

// Each shot ends on the grid point nearest to its proportional position (shot.end * audio/video),
// so the global speed ratio holds and nothing drifts. A shot that cannot reach a new grid point
// (shorter than a beat, flashes, dissolve frames) is folded into the next shot. The last segment
// always ends at the end of the audio.
export function planSegments(shots, grid, videoDuration) {
  const ratio = grid[grid.length - 1] / videoDuration
  const segments = []
  let cursor = 0
  let start = shots[0].start
  shots.forEach((shot, i) => {
    let j = grid.length - 1
    if (i < shots.length - 1) {
      j = nearestIndex(grid, shot.end * ratio)
      if (j <= cursor || j === grid.length - 1) return
    }
    segments.push({ start, end: shot.end, dstStart: grid[cursor], dstEnd: grid[j] })
    cursor = j
    start = shot.end
  })
  return segments
}

// Video filter for one segment decoded with `-ss start`. The segment is forced to exactly
// round(dstEnd*fps) - round(dstStart*fps) frames (clone-padded, then trimmed), so cuts never
// drift by more than half a frame. minterpolate alone stops a few frames early.
export function segmentFilter(s, { filters, fps, interpolate }) {
  const rate = interpolate
    ? `minterpolate=fps=${fps}:mi_mode=mci:mc_mode=aobmc:vsbmc=1:scd=none`
    : `fps=${fps}`
  const factor = (s.dstEnd - s.dstStart) / (s.end - s.start)
  const frames = Math.round(s.dstEnd * fps) - Math.round(s.dstStart * fps)
  return [
    `trim=end=${s.end - s.start}`,
    `setpts=(PTS-STARTPTS)*${factor.toFixed(6)}`,
    rate,
    `tpad=stop_mode=clone:stop=${frames}`,
    `trim=end_frame=${frames}`,
    `settb=1/${fps}`,
    'setpts=N',
    ...(filters ? [filters] : []),
  ].join(',')
}

// Concat demuxer list; single quotes in paths are escaped as '\''.
export function concatList(files) {
  return files.map((f) => `file '${f.replaceAll("'", "'\\''")}'`).join('\n') + '\n'
}
