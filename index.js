const path = require('path')
const program = require('commander')
const time = require('./time')
const video = require('./video')

function parseCmd() {
    program
      .description('Make the audio and video kinda fit together for fun and amusement')
      .version('0.0.1')
      .usage('[options]')
      .option('-v, --video <video_path>', 'Specify video file', null)
      .option('-a, --audio <audio_path>', 'Specify audio file', null)
      .option('-f, --filter <filters>', 'Specify video filters. May be a single filter or a comma-separated list. (man ffmpeg for filters)', null)
      .action(async () => {
          const [ videoDuration, audioDuration ] = await Promise.all([
              time(program.video),
              time(program.audio)
          ])

          const fps = await video.getFPS(program.video)

          const videoFps = calcFps(...fps.split('/'))

          const [ durRatio, ptsRatio ] = calcRatio(videoDuration, audioDuration)

          const ffmpegCmd = await video.constructFFmpegCommand(
              { durRatio, ptsRatio },
              { video: path.resolve(program.video), audio: path.resolve(program.audio) },
              videoFps,
              program.filters
          )

          console.log(ffmpegCmd)

          function calcFps(num, den) {
              return Number(num) / Number(den)
          }

          function calcRatio(video, audio) {
              return [
                  (video/audio).toFixed(1),
                  (audio/video).toFixed(3)
              ]
          }

      })

      if (process.argv.length < 3) {
          return program.help()
      }

    program
      .parse(process.argv)
}

  void (async function main() {
      try {
          await parseCmd()

      } catch (execError) {
          console.error('Failed to execute!', execError)
          process.exit(1)
      }
  }())
