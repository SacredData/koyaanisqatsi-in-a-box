const ffmpeg = require('fluent-ffmpeg')
const path = require('path')

async function constructFFmpegCommand(ratios, files, fps, opts) {
    const ffmpegCmd = ffmpeg(files.video).input(files.audio)
    ffmpegCmd.outputOptions([
        '-map 0:v:0',
        '-map 1:a:0',
        `-r ${(fps * ratios.durRatio > 60 ? 60 : fps * ratios.durRatio)}`,
        '-c:a flac',
        '-c:v', `${opts.gpu ? 'h264_nvenc' : 'libx264'}`,
        '-b:v 20M',
        '-maxrate', '40M',
        '-bufsize', '80M',
        '-crf', '18',
        '-crf_max', '34',
        '-preset:v', `${opts.gpu ? 'fast' : 'ultrafast'}`,
        '-vsync -1',
        '-af aresample=async=1',
        '-threads 8',
        '-movflags', '+faststart+negative_cts_offsets',
        '-tune:v', 'animation',
        '-flags', '+global_header',
        '-strict', '-2',
        '-f', `${opts.container || 'matroska'}`
    ]).videoFilters([
        `setpts=${ratios.ptsRatio}*PTS`//,minterpolate=fps=50`,
    ])
    .output(`${files.video}_noGlass.mkv`)
    .on('start', (cmd) => console.log(cmd))
    .on('progress', (prog) => console.log(prog))
    .run()
}

async function getFPS(file) {
  try {
      return new Promise((resolve, reject) => {
          ffmpeg.ffprobe(file, (err, metadata) => {
              if (err) { reject(err) }
              resolve(metadata.streams[0].r_frame_rate)
          })
      })
  } catch (err) {
    throw err
  }
}

module.exports = { constructFFmpegCommand, getFPS }
