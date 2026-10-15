<!-- Generated: 2026-10-09 | Updated: 2026-10-09 -->

# koyaanisqatsi-in-a-box

## Purpose
A Node.js command-line tool (`kib`) that retimes a video file to a music file so that every picture
cut lands on a musical beat, and writes one container that spans exactly the audio duration.
Flat repository: three ESM source files, two test files, no build step.

## Key Files

| File | Description |
|------|-------------|
| `index.js` | Entry point (`#!/usr/bin/env node`). Parses options with `node:util` `parseArgs`, runs the four analyses in parallel, prints the plan, renders segments with a pool of `-j` ffmpeg processes into a temp dir, then joins them with the concat demuxer (`-c:v copy`) plus the audio. |
| `analyze.js` | `exec(bin, args)` (spawn + collect, rejects with stderr tail), `probe(file)` (ffprobe JSON -> `{duration, fps}`), `detectShots(video, threshold, gpu)` (scene-cut times via `select`/`showinfo`), `detectBeats(audio)` (PCM decode -> `music-tempo` -> `{tempo, beats}`). |
| `plan.js` | Pure functions, no I/O: `shotsFromCuts`, `beatGrid`, `planSegments`, `segmentFilter`, `concatList`. |
| `plan.test.js` | Unit tests for `plan.js` (`node --test`). |
| `e2e.test.js` | Synthesizes a four-shot video and a 120 BPM click track with ffmpeg, runs `index.js`, and checks output duration and cut positions. |
| `package.json` | ESM, `bin: kib`, `engines: node >=22.4`, one dependency (`music-tempo`), `npm test` = `node --test`. |
| `README.md` | What the tool does, requirements, usage, tips. |
| `LICENSE` | MIT, SACRED DATA, 2019. |
| `.gitignore` | Ignores media files, `node_modules/`, lock files, logs, `outputs`. |

## Subdirectories
None.

## Data Flow
1. `probe(video)`, `probe(audio)`, `detectShots`, `detectBeats` run in parallel.
2. `shotsFromCuts` turns cut times into `[{start, end}]` shots covering `[0, videoDuration]`.
3. `beatGrid` builds `[0, ...every nth beat, audioDuration]`.
4. `planSegments` maps each shot to `[grid[a], grid[b]]`: `b` is the grid index nearest `shot.end * audio/video`. A shot whose `b` does not advance (or hits the last grid point early) is folded into the next shot. The last segment ends at the audio end.
5. `segmentFilter` emits, per segment (decoded with `-ss start`): `trim=end,setpts*k,minterpolate|fps,tpad(clone),trim=end_frame=n,settb,setpts=N`, then user `-f` filters. `n = round(dstEnd*fps) - round(dstStart*fps)`, so boundaries are exact to half a frame (minterpolate alone stops a few frames early).
6. `index.js` encodes each segment to an mp4 in a temp dir (libx264 crf 18 or h264_nvenc cq 19), `jobs` processes at a time, then one `ffmpeg -f concat ... -c:v copy -c:a flac` muxes the output. One `minterpolate` per process keeps memory at about 0.6 GB per job at 1080p.

## For AI Agents

### Working In This Directory
- Keep changes minimal. The owner wants no additions beyond what a task needs. Do not commit or push without explicit permission.
- Style: ESM, no semicolons, 2-space indent, single quotes. No linter is configured; `node --check <file>` for syntax.
- Keep `plan.js` pure so it stays unit-testable. Put process spawning in `analyze.js` or `index.js`.
- `music-tempo` assumes 44.1 kHz mono; `detectBeats` decodes to that. Its `tempo` is a string; it is converted with `Number`.
- FFmpeg scene detection is luma-only. Test fixtures must use colours with different luma (CSS `green` and `red` share luma 81; use `lime`).
- `-hwaccel cuda` is added only with `--gpu`. The GPU path is not covered by tests on machines without NVIDIA hardware.

### Testing Requirements
- `npm test` runs both files. The e2e test needs `ffmpeg`/`ffprobe` on PATH and takes a few seconds.
- After touching `segmentFilter`, also run a manual render and check cut times with
  `ffmpeg -i out -vf "select='gt(scene,0.3)',showinfo" -f null -` against the printed plan.

### Common Patterns
- Shell out with `exec` from `analyze.js`; never add a wrapper library for ffmpeg.
- Options with numeric values are parsed as strings by `parseArgs`, converted with `Number`, and validated once before any work starts.

## Dependencies

### Internal
- `index.js` -> `analyze.js`, `plan.js`

### External
- `music-tempo` 1.x - BeatRoot beat tracker (pure JS, CommonJS default export).
- `ffmpeg` / `ffprobe` >= 7 binaries at runtime.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
