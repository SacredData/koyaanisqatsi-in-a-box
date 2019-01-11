const ffmpeg = require('fluent-ffmpeg')
const path = require('path')

async function constructFFmpegCommand(ratios, files, fps) {
    const ffmpegCmd = ffmpeg(files.video).input(files.audio)
    ffmpegCmd.outputOptions([
        '-map 0:v:0',
        '-map 1:a:0',
        `-r ${(fps * ratios.durRatio > 60 ? 60 : fps * ratios.durRatio)}`,
        '-c:v libx264',
        '-b:v 15M',
        '-tune:v film',
        '-preset:v veryfast',
        '-vsync -1',
        '-threads 2'
    ]).videoFilters([
        `setpts=${ratios.ptsRatio}*PTS`,
    ])
    .output('test.mkv')
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
