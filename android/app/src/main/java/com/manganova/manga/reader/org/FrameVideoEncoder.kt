package com.manganova.manga.reader.org

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Rect
import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaFormat
import android.media.MediaMuxer
import java.io.File

/** Turns a list of same-sized image files into an H.264 MP4, one image per frame. */
object FrameVideoEncoder {
  private const val DRAIN_TIMEOUT_US = 10_000L
  private const val FINISH_TIMEOUT_MS = 15_000L

  fun encode(paths: List<String>, outPath: String, fps: Int) {
    require(paths.isNotEmpty()) { "No frames to encode." }
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeFile(paths[0], bounds)
    // H.264 needs even sides.
    val width = bounds.outWidth and 1.inv()
    val height = bounds.outHeight and 1.inv()
    require(width > 0 && height > 0) { "The first frame can't be read." }

    val format =
        MediaFormat.createVideoFormat(MediaFormat.MIMETYPE_VIDEO_AVC, width, height).apply {
          setInteger(MediaFormat.KEY_COLOR_FORMAT, MediaCodecInfo.CodecCapabilities.COLOR_FormatSurface)
          setInteger(MediaFormat.KEY_BIT_RATE, (width * height * 4).coerceIn(1_000_000, 8_000_000))
          setInteger(MediaFormat.KEY_FRAME_RATE, fps)
          setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 1)
        }
    File(outPath).apply {
      parentFile?.mkdirs()
      delete()
    }
    val codec = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_VIDEO_AVC)
    var muxer: MediaMuxer? = null
    var muxing = false
    try {
      codec.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
      val surface = codec.createInputSurface()
      codec.start()
      muxer = MediaMuxer(outPath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
      val info = MediaCodec.BufferInfo()
      val frameUs = 1_000_000L / fps
      var track = -1
      var written = 0L
      var ended = false

      // A canvas drawn on the input surface is stamped with the wall clock, so each sample gets its time here.
      // The encoder emits frames in order, because it is not asked for B-frames.
      fun drain(finishing: Boolean) {
        val deadline = System.currentTimeMillis() + FINISH_TIMEOUT_MS
        while (!ended) {
          val index = codec.dequeueOutputBuffer(info, if (finishing) DRAIN_TIMEOUT_US else 0)
          if (index == MediaCodec.INFO_TRY_AGAIN_LATER) {
            if (!finishing) return
            check(System.currentTimeMillis() < deadline) { "The video encoder stopped answering." }
          } else if (index == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
            track = muxer.addTrack(codec.outputFormat)
            muxer.start()
            muxing = true
          } else if (index >= 0) {
            val buffer = codec.getOutputBuffer(index)
            val config = info.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG != 0
            if (buffer != null && info.size > 0 && !config && muxing) {
              info.presentationTimeUs = written * frameUs
              muxer.writeSampleData(track, buffer, info)
              written++
            }
            ended = info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0
            codec.releaseOutputBuffer(index, false)
          }
        }
      }

      val target = Rect(0, 0, width, height)
      var lastPath: String? = null
      var bitmap: Bitmap? = null
      for (path in paths) {
        if (path != lastPath) {
          bitmap?.recycle()
          bitmap = BitmapFactory.decodeFile(path) ?: throw IllegalStateException("A frame can't be read.")
          lastPath = path
        }
        val canvas = surface.lockHardwareCanvas()
        try {
          canvas.drawBitmap(bitmap!!, null, target, null)
        } finally {
          surface.unlockCanvasAndPost(canvas)
        }
        drain(false)
      }
      bitmap?.recycle()
      codec.signalEndOfInputStream()
      drain(true)
      surface.release()
      check(written > 0) { "The video encoder wrote no frames." }
    } finally {
      try {
        codec.stop()
      } catch (_: Exception) {}
      codec.release()
      try {
        if (muxing) muxer?.stop()
      } catch (_: Exception) {}
      muxer?.release()
    }
  }
}
