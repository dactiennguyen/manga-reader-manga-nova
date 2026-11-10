package com.manganova.manga.reader.org

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext

/** Implements specs/NativeReminder.ts: the daily drawing reminder. */
class NativeReminderModule(reactContext: ReactApplicationContext) : NativeReminderSpec(reactContext) {

  override fun getName() = NAME

  override fun schedule(hour: Double, minute: Double, title: String, body: String, promise: Promise) {
    try {
      Reminder.schedule(
          reactApplicationContext,
          hour.toInt().coerceIn(0, 23),
          minute.toInt().coerceIn(0, 59),
          title,
          body,
      )
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("E_REMINDER", e.message, e)
    }
  }

  override fun cancel() {
    Reminder.cancel(reactApplicationContext)
  }

  companion object {
    const val NAME = "NativeReminder"
  }
}
