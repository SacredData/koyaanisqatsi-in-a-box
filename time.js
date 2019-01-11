const ffmpeg = require('fluent-ffmpeg')
const path = require('path')

async function getSeconds(file) {
  try {
      return new Promise((resolve, reject) => {
          ffmpeg.ffprobe(file, (err, metadata) => {
              if (err) { reject(err) }
              resolve(metadata.format.duration)
          })
      })
  } catch (err) {
    throw err
  }
}

async function main(file) {
  const secs = await getSeconds(path.resolve(file))
  return secs.toFixed(2)
}

module.exports = main
