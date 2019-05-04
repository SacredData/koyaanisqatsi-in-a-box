# koyaanisqatsi-in-a-box

You have a video, you have an audio, you have an MKV container. **koyaanisqatsi-in-a-box** is a fun way to mess with that video's PTS and frame rate to make that audio track feel more comfortable in Mr. Matroska's home.

## OK What Do?

Just download the release. Don't bother with `npm` and all that nonsense.

Do a `kib --help` to figure out the CLI if you want, but it's easy. Just do `kib -v VIDEO -a AUDIO` and you're off.

## BUT WHAT DOES IT DO

It processes your *video* to work better with your audio, and not the other way around. It [looks](https://grathwohl.me/sessions/dd.mov) [totally](https://grathwohl.me/sessions/cmyk-tyler-inverted.mp4) [cool](https://grathwohl.me/sessions/atsr.mov) when you watch it back.

Sorry, it's not hard to describe what is happening with this program, but it *is* hard to explain why I did it.

`koyaanisqatsi-in-a-box`'s approach is to modify PTS of a video so that the frame rate is sync'd to the rhythmic properties of your music track. To do this, we obliterate that comfy 29.97fps NTSC frame rate your video used to have (all frame rates work, so you Europeans can rest easy - you have enough on your plates these days anyhow), and divide the video's PTS by a considerable degree, making your video play back much faster in the process. Better yet, the video will run the same length as the audio after we're done processing!
