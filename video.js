const ffmpeg = require('fluent-ffmpeg')
const path = require('path')

async function constructFFmpegCommand(ratios, files, fps, opts) {
    const ffmpegCmd = ffmpeg(files.video).inputOptions([ '-hwaccel', 'nvdec' ]).input(files.audio)
    ffmpegCmd.outputOptions([
        '-map 0:v:0',
        '-map 1:a:0',
        // `-r ${(fps * ratios.durRatio > 60 ? 60 : fps * ratios.durRatio)}`,
        '-c:a flac',
        '-c:v', `${opts.gpu ? 'h264_nvenc' : 'libx264'}`,
        '-b:v 4M',
        '-maxrate', '4M',
        '-bufsize', '8M',
        /*'-crf', '18',
        '-crf_max', '34',*/
        '-preset:v', `${opts.gpu ? 'fast' : 'ultrafast'}`,
        '-vsync -1',
        '-af aresample=async=1',
        //'-movflags', '+faststart+negative_cts_offsets',
        //'-tune:v', 'animation',
        //'-flags', '+global_header',
        '-strict', '-2',
        '-f', `${opts.container || 'matroska'}`
    ]).videoFilters([
        `setpts=${ratios.ptsRatio}*PTS,minterpolate=fps=60:mi_mode=mci:mc_mode=aobmc:vsbmc=1:scd=none`,
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
