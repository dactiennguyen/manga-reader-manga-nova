package com.manganova.manga.reader.org

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray

/** Implements specs/NativeReminder.ts: the daily drawing reminder and the one-off ones. */
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

  override fun replaceOnce(reminders: ReadableArray, promise: Promise) {
    try {
      val list =
          (0 until reminders.size()).mapNotNull { index ->
            val item = reminders.getMap(index) ?: return@mapNotNull null
            val id = item.getString("id") ?: return@mapNotNull null
            Reminder.Once(id, item.getDouble("at").toLong(), item.getString("title") ?: "", item.getString("body") ?: "")
          }
      Reminder.replaceOnce(reactApplicationContext, list)
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("E_REMINDER", e.message, e)
    }
  }

  companion object {
    const val NAME = "NativeReminder"
  }
}
