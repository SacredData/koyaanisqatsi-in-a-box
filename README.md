# koyaanisqatsi-in-a-box

We've all been there before: you have a great piece of music and some cool video footage, and you'd like to figure out some way to cohesively make them fit together.

Until now, you've had to call up Philip Glass and suffer through his undeserved smugness in order to make a film, and worse yet, you had to give it a dumb name. But now there's **Koyaanisqatsi In A Box**.

## What it does

`kib` takes one video file and one music file of any lengths and writes one container in which the
video is retimed to the music so that **every picture cut lands on a beat**:

1. `ffprobe` reads both inputs.
2. In parallel, the music is decoded to PCM and beat-tracked (BeatRoot via `music-tempo`), and the video
   is scanned for shot cuts (`ffmpeg` scene detection on a 240p downscale).
3. Each source shot is mapped onto a span of whole beat intervals. Shot ends snap to the beat nearest
   their proportional position, so the global speed ratio is preserved and nothing drifts. A shot that
   cannot reach a new beat (shorter than a beat, flash frames, dissolve frames, or more shots than
   beats) is folded into the next shot; only those folded cuts are not beat-aligned.
4. Each segment is rendered by its own `ffmpeg` process (`-j` at a time): `setpts` + motion
   interpolation (`minterpolate`, 60 fps by default), your extra filters, then encode. Every segment
   is forced to an exact frame count, so cuts are accurate to half a frame. The segments are joined
   without re-encoding and muxed with the audio.

The audio is encoded losslessly (FLAC) and the output spans exactly the audio duration.

## Requirements

- Node.js >= 22.4
- `ffmpeg` and `ffprobe` >= 7 on `PATH` (NVIDIA builds with `cuda`/`h264_nvenc` for `--gpu`)

## Usage

```
npm install
node index.js -v footage.mp4 -a track.flac
```

```
Usage: kib -v <video> -a <audio> [options]

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
```

`kib` prints the plan (tempo, shots, and each shot's source span, target span, and speed factor)
before it starts the render, then one line per finished segment.

Tips: `--grid 4` cuts on every fourth beat (roughly the bar in 4/4). `--no-interpolate` is many times
faster and fine for footage that is sped up rather than slowed down. `minterpolate` is single-threaded
and needs roughly 0.6 GB per job at 1080p, so lower `-j` on small machines. NVIDIA consumer cards cap
concurrent NVENC sessions; lower `-j` if `--gpu` renders fail.

## Tests

```
npm test
```

The end-to-end test synthesizes a four-shot video and a 120 BPM click track with ffmpeg, runs `kib`,
and checks that the output spans the audio and that every cut lands within 30 ms of a beat.
