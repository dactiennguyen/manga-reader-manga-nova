package com.manganova.manga.reader.org

import android.os.Bundle
import android.os.SystemClock
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import java.util.Locale
import java.util.concurrent.ConcurrentHashMap

/**
 * Implements specs/NativeSpeech.ts with the device's TextToSpeech engine. The engine starts on first use,
 * because binding to it takes a moment and most sessions never listen to a chapter.
 */
class NativeSpeechModule(reactContext: ReactApplicationContext) : NativeSpeechSpec(reactContext) {

  private enum class State { IDLE, STARTING, READY, FAILED }

  private var tts: TextToSpeech? = null
  private var state = State.IDLE
  /** When the engine last failed to start, so checks do not bind a new engine on every call. */
  private var failedAt = 0L
  private val waiting = mutableListOf<(TextToSpeech?) -> Unit>()
  /** Lines being read, by utterance id. Removing an entry is what settles its promise, so it settles once. */
  private val pending = ConcurrentHashMap<String, Promise>()

  override fun getName() = NAME

  private val listener =
      object : UtteranceProgressListener() {
        override fun onStart(utteranceId: String) {}

        override fun onDone(utteranceId: String) {
          pending.remove(utteranceId)?.resolve(true)
        }

        override fun onStop(utteranceId: String, interrupted: Boolean) {
          pending.remove(utteranceId)?.resolve(false)
        }

        @Deprecated("Deprecated in Java")
        override fun onError(utteranceId: String) {
          pending.remove(utteranceId)?.reject("E_SPEECH", "The speech engine could not read this line.")
        }

        override fun onError(utteranceId: String, errorCode: Int) {
          pending.remove(utteranceId)?.reject("E_SPEECH", "The speech engine failed ($errorCode).")
        }
      }

  /**
   * Runs `use` with the engine once it is ready, or with null when the device has none. After a failed
   * start, the engine is tried again only once RETRY_MS have passed or when `retry` is set (an explicit
   * play), since a speech engine can be installed while the app runs.
   */
  private fun withEngine(retry: Boolean = false, use: (TextToSpeech?) -> Unit) {
    val ready: TextToSpeech?
    synchronized(this) {
      val again = state == State.FAILED && (retry || SystemClock.elapsedRealtime() - failedAt >= RETRY_MS)
      when {
        state == State.READY -> ready = tts
        state == State.FAILED && !again -> ready = null
        state == State.STARTING -> {
          waiting.add(use)
          return
        }
        else -> {
          waiting.add(use)
          state = State.STARTING
          try {
            tts = TextToSpeech(reactApplicationContext) { status -> onInit(status) }
          } catch (e: Exception) {
            onInit(TextToSpeech.ERROR)
          }
          return
        }
      }
    }
    use(ready)
  }

  private fun onInit(status: Int) {
    val callbacks: List<(TextToSpeech?) -> Unit>
    val engine: TextToSpeech?
    synchronized(this) {
      if (status == TextToSpeech.SUCCESS && tts != null) {
        tts?.setOnUtteranceProgressListener(listener)
        state = State.READY
      } else {
        tts?.shutdown()
        tts = null
        state = State.FAILED
        failedAt = SystemClock.elapsedRealtime()
      }
      engine = tts
      callbacks = waiting.toList()
      waiting.clear()
    }
    callbacks.forEach { it(engine) }
  }

  private fun localeOf(language: String): Locale = Locale.forLanguageTag(language)

  private fun supports(engine: TextToSpeech, locale: Locale): Boolean =
      try {
        engine.isLanguageAvailable(locale) >= TextToSpeech.LANG_AVAILABLE
      } catch (e: Exception) {
        false
      }

  override fun isAvailable(language: String, promise: Promise) {
    withEngine { engine -> promise.resolve(engine != null && supports(engine, localeOf(language))) }
  }

  override fun voices(language: String, promise: Promise) {
    withEngine { engine ->
      val list = Arguments.createArray()
      val wanted = localeOf(language).language
      try {
        engine
            ?.voices
            .orEmpty()
            .filter { voice ->
              voice.locale.language == wanted &&
                  !voice.isNetworkConnectionRequired &&
                  !voice.features.contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED)
            }
            .sortedByDescending { it.quality }
            .forEach { voice ->
              val item = Arguments.createMap()
              item.putString("id", voice.name)
              item.putString("name", voice.name)
              item.putString("language", voice.locale.toLanguageTag())
              item.putInt("quality", voice.quality)
              item.putString("gender", "")
              list.pushMap(item)
            }
      } catch (e: Exception) {
        // Some engines throw while listing voices. The system voice still works.
      }
      promise.resolve(list)
    }
  }

  override fun speak(
      utteranceId: String,
      text: String,
      language: String,
      pitch: Double,
      rate: Double,
      voiceId: String?,
      promise: Promise,
  ) {
    withEngine(retry = true) { engine ->
      if (engine == null) {
        promise.reject("E_NO_ENGINE", "This device has no speech engine.")
        return@withEngine
      }
      val locale = localeOf(language)
      if (!supports(engine, locale)) {
        promise.reject("E_NO_VOICE", "No voice for $language on this device.")
        return@withEngine
      }
      // A new line replaces the one being read.
      settleAll()
      try {
        val voice = voiceId?.let { name -> engine.voices?.firstOrNull { it.name == name } }
        if (voice != null) {
          engine.voice = voice
        } else {
          engine.language = locale
        }
        engine.setPitch(pitch.toFloat().coerceIn(0.5f, 2f))
        engine.setSpeechRate(rate.toFloat().coerceIn(0.5f, 2f))
        val line = text.take(TextToSpeech.getMaxSpeechInputLength())
        pending[utteranceId] = promise
        val result = engine.speak(line, TextToSpeech.QUEUE_FLUSH, Bundle(), utteranceId)
        if (result != TextToSpeech.SUCCESS) {
          pending.remove(utteranceId)?.reject("E_SPEECH", "The speech engine refused the line.")
        }
      } catch (e: Exception) {
        pending.remove(utteranceId)?.reject("E_SPEECH", e.message, e)
      }
    }
  }

  private fun settleAll() {
    pending.keys.toList().forEach { key -> pending.remove(key)?.resolve(false) }
  }

  override fun stop() {
    synchronized(this) { tts }?.stop()
    settleAll()
  }

  override fun invalidate() {
    settleAll()
    synchronized(this) {
      tts?.stop()
      tts?.shutdown()
      tts = null
      state = State.IDLE
      waiting.clear()
    }
    super.invalidate()
  }

  companion object {
    const val NAME = "NativeSpeech"
    private const val RETRY_MS = 30_000L
  }
}
