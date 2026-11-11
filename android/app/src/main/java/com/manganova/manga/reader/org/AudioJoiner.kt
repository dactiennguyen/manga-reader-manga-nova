package com.manganova.manga.reader.org

import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMuxer
import java.io.File
import java.nio.ByteBuffer

/**
 * Joins voice clips and puts audio under a video by copying compressed samples with MediaExtractor and
 * MediaMuxer: no decoding, so it is fast and loses nothing. MediaMuxer takes one format per track, so a
 * clip whose AAC format differs from the first one is left out instead of breaking the file.
 */
object AudioJoiner {
  private const val BUFFER = 256 * 1024

  private fun selectTrack(extractor: MediaExtractor, prefix: String): Int {
    for (i in 0 until extractor.trackCount) {
      if (extractor.getTrackFormat(i).getString(MediaFormat.KEY_MIME)?.startsWith(prefix) == true) {
        extractor.selectTrack(i)
        return i
      }
    }
    return -1
  }

  private fun sameAudio(a: MediaFormat, b: MediaFormat): Boolean =
      a.getString(MediaFormat.KEY_MIME) == b.getString(MediaFormat.KEY_MIME) &&
          a.getInteger(MediaFormat.KEY_SAMPLE_RATE) == b.getInteger(MediaFormat.KEY_SAMPLE_RATE) &&
          a.getInteger(MediaFormat.KEY_CHANNEL_COUNT) == b.getInteger(MediaFormat.KEY_CHANNEL_COUNT)

  /** What a copy has written so far, kept up to date sample by sample so a copy that fails halfway still says. */
  private class Copied(var endUs: Long, var samples: Int = 0)

  /** Copies samples of the selected track; returns the end time in µs (last sample plus one frame). */
  private fun copySamples(
      extractor: MediaExtractor,
      muxer: MediaMuxer,
      track: Int,
      offsetUs: Long,
      untilUs: Long = Long.MAX_VALUE,
      copied: Copied = Copied(offsetUs),
  ): Long {
    val buffer = ByteBuffer.allocate(BUFFER)
    val info = MediaCodec.BufferInfo()
    var last = -1L
    var step = 0L
    while (true) {
      val size = extractor.readSampleData(buffer, 0)
      if (size < 0) break
      val time = extractor.sampleTime
      if (time > untilUs) break
      if (last >= 0) step = time - last
      last = time
      info.set(0, size, offsetUs + time, if (extractor.sampleFlags and MediaExtractor.SAMPLE_FLAG_SYNC != 0) MediaCodec.BUFFER_FLAG_KEY_FRAME else 0)
      muxer.writeSampleData(track, buffer, info)
      copied.samples += 1
      copied.endUs = offsetUs + last + step
      extractor.advance()
    }
    return if (last < 0) offsetUs else offsetUs + last + step
  }

  fun concat(paths: List<String>, outPath: String, gapMs: Long): Int {
    val out = File(outPath)
    out.parentFile?.mkdirs()
    out.delete()
    var muxer: MediaMuxer? = null
    var format: MediaFormat? = null
    var track = -1
    var cursor = 0L
    var used = 0
    var stopError: Exception? = null
    try {
      for (path in paths) {
        val start = if (used > 0) cursor + gapMs * 1000 else cursor
        val copied = Copied(start)
        val extractor = MediaExtractor()
        try {
          extractor.setDataSource(path)
          val index = selectTrack(extractor, "audio/")
          if (index < 0) continue
          val clipFormat = extractor.getTrackFormat(index)
          if (format == null) {
            format = clipFormat
            muxer = MediaMuxer(outPath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
            track = muxer.addTrack(clipFormat)
            muxer.start()
          } else if (!sameAudio(format, clipFormat)) {
            continue
          }
          copySamples(extractor, muxer!!, track, start, copied = copied)
        } catch (e: Exception) {
          // An unreadable clip is skipped; the rest still make a file.
        } finally {
          extractor.release()
        }
        // Samples a clip wrote before failing stay in the file, so the next clip starts after them, not on top.
        if (copied.samples > 0) {
          cursor = copied.endUs
          used += 1
        }
      }
    } finally {
      // stop() throws on a muxer that never got a sample, so it only runs when one went in, and a failing
      // stop or release must not skip the cleanup and the clear error below.
      try {
        if (used > 0) muxer?.stop()
      } catch (e: Exception) {
        stopError = e
      }
      try {
        muxer?.release()
      } catch (_: Exception) {}
    }
    if (used == 0) {
      out.delete()
      throw IllegalStateException("No clip could be read.")
    }
    stopError?.let {
      out.delete()
      throw IllegalStateException("The joined voices couldn't be saved.", it)
    }
    return used
  }

  fun addAudio(videoPath: String, audioPath: String, outPath: String) {
    val out = File(outPath)
    out.parentFile?.mkdirs()
    out.delete()
    val video = MediaExtractor()
    val audio = MediaExtractor()
    var muxer: MediaMuxer? = null
    try {
      video.setDataSource(videoPath)
      audio.setDataSource(audioPath)
      val videoIndex = selectTrack(video, "video/")
      val audioIndex = selectTrack(audio, "audio/")
      require(videoIndex >= 0 && audioIndex >= 0) { "The video or the audio can't be read." }
      val videoFormat = video.getTrackFormat(videoIndex)
      val length = if (videoFormat.containsKey(MediaFormat.KEY_DURATION)) videoFormat.getLong(MediaFormat.KEY_DURATION) else Long.MAX_VALUE
      muxer = MediaMuxer(outPath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
      val videoTrack = muxer.addTrack(videoFormat)
      val audioTrack = muxer.addTrack(audio.getTrackFormat(audioIndex))
      muxer.start()
      copySamples(video, muxer, videoTrack, 0)
      copySamples(audio, muxer, audioTrack, 0, length)
      muxer.stop()
    } catch (e: Exception) {
      out.delete()
      throw e
    } finally {
      muxer?.release()
      video.release()
      audio.release()
    }
  }
}
