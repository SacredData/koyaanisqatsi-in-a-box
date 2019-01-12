# transmogrifun

You have a video, you have an audio, you have an MKV container. transmogrifun is a fun way to mess with that video's PTS and frame rate to make that audio track feel more comfortable in Mr. Matroska's home.

## OK What Do?

Just download the release. Don't bother with `npm` and all that nonsense.

Do a `transmogrifun --help` to figure out the CLI if you want, but it's easy. Just do `transmogrifun -v VIDEO -a AUDIO` and you're off.

## BUT WHAT DOES IT DO

Sorry, it's not hard to describe what is happening with this program, but it *is* hard to explain why I did it.

Say you make non-traditional music and want to demonstrate its viability as the soundtrack to a film. OK, you find your footage and you match it with an audio track, but the video isn't the same length as the audio and that sucks! To solve that problem, most choose to enter some lame video editor program and futz with the non-linear time trimming tools, for which Premiere and Final Cut have become most well-known.

Well, fuck that shizz! The Society of Motion Picture & Television Engineers didn't invent their timecode for nothing! Let's do it a different way, this time with some chuztpah!

transmogrifun's approach is different. We obliterate that comfy 29.97fps NTSC frame rate your video used to have, and divide the video's PTS by a considerable degree, making your video play back much faster in the process. Better yet, the video will run the same length as the audio after we're done processing! And it [looks](https://grathwohl.me/sessions/drunkendystopia.mp4) [totally](https://grathwohl.me/sessions/cmyk-tyler-inverted.mp4)
[cool](https://grathwohl.me/sessions/ascensiontostellarriver.mp4) when you watch it back.
