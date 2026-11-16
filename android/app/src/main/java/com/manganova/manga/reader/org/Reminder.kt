package com.manganova.manga.reader.org

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import java.util.Calendar
import org.json.JSONArray
import org.json.JSONObject

/**
 * The drawing reminders. The daily one is an alarm that posts one local notification and sets itself for
 * the next day. One-off ones (a deadline tomorrow) are saved as a set, each with its own alarm, and are
 * always replaced together.
 */
object Reminder {
  private const val PREFS = "reminder"
  private const val CHANNEL = "reminder"
  private const val NOTIFICATION_ID = 1
  private const val WINDOW_MS = 30 * 60 * 1000L
  private const val ONCE_KEY = "once"
  const val ACTION_SHOW = "com.manganova.manga.reader.org.REMINDER"
  const val ACTION_ONCE = "com.manganova.manga.reader.org.REMINDER_ONCE"

  /** A one-off notification at `at`, in milliseconds since 1970. */
  data class Once(val id: String, val at: Long, val title: String, val body: String)

  private fun alarms(context: Context) = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

  private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  private fun alarmIntent(context: Context): PendingIntent =
      PendingIntent.getBroadcast(
          context,
          0,
          Intent(context, ReminderReceiver::class.java).setAction(ACTION_SHOW),
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )

  /** The data URI keeps each one-off's alarm apart from the others and from the daily one. */
  private fun onceIntent(context: Context, id: String): PendingIntent =
      PendingIntent.getBroadcast(
          context,
          0,
          Intent(context, ReminderReceiver::class.java)
              .setAction(ACTION_ONCE)
              .setData(Uri.Builder().scheme("manganova-reminder").authority("once").appendPath(id).build()),
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )

  /** One-offs get their own notification ids, clear of the daily one's. */
  private fun onceNotificationId(id: String) = 1000 + (id.hashCode() and 0x3fffffff)

  fun schedule(context: Context, hour: Int, minute: Int, title: String, body: String) {
    prefs(context)
        .edit()
        .putBoolean("on", true)
        .putInt("hour", hour)
        .putInt("minute", minute)
        .putString("title", title)
        .putString("body", body)
        .apply()
    arm(context, hour, minute)
  }

  /** Alarms do not survive a restart, so the boot receiver calls this with what was saved. */
  fun restore(context: Context) {
    val prefs = prefs(context)
    if (prefs.getBoolean("on", false)) {
      arm(context, prefs.getInt("hour", 20), prefs.getInt("minute", 0))
    }
    // A one-off whose time went by while the phone was off is dropped: "due tomorrow" may no longer be true.
    val now = System.currentTimeMillis()
    val saved = loadOnce(context)
    val future = saved.filter { it.at > now }
    if (future.size != saved.size) saveOnce(context, future)
    future.forEach { armOnce(context, it) }
  }

  private fun arm(context: Context, hour: Int, minute: Int) {
    val first =
        Calendar.getInstance().apply {
          set(Calendar.HOUR_OF_DAY, hour)
          set(Calendar.MINUTE, minute)
          set(Calendar.SECOND, 0)
          set(Calendar.MILLISECOND, 0)
          if (timeInMillis <= System.currentTimeMillis()) add(Calendar.DAY_OF_YEAR, 1)
        }
    // A window, not an exact time: a reminder up to half an hour late needs no exact-alarm permission.
    // A repeating inexact alarm may drift by most of a day, so each alarm sets the next one.
    alarms(context).setWindow(AlarmManager.RTC_WAKEUP, first.timeInMillis, WINDOW_MS, alarmIntent(context))
  }

  /** The same half-hour window as the daily reminder, so no exact-alarm permission either. */
  private fun armOnce(context: Context, once: Once) {
    alarms(context).setWindow(AlarmManager.RTC_WAKEUP, once.at, WINDOW_MS, onceIntent(context, once.id))
  }

  /** Stops the daily reminder. One-offs are left to replaceOnce. */
  fun cancel(context: Context) {
    prefs(context).edit().putBoolean("on", false).apply()
    alarms(context).cancel(alarmIntent(context))
    NotificationManagerCompat.from(context).cancel(NOTIFICATION_ID)
  }

  /** Cancels every saved one-off, then saves and arms the new set. Times already past are left out. */
  fun replaceOnce(context: Context, list: List<Once>) {
    loadOnce(context).forEach { alarms(context).cancel(onceIntent(context, it.id)) }
    val now = System.currentTimeMillis()
    val future = list.filter { it.at > now && it.id.isNotEmpty() }.distinctBy { it.id }
    saveOnce(context, future)
    future.forEach { armOnce(context, it) }
  }

  private fun loadOnce(context: Context): List<Once> =
      try {
        val array = JSONArray(prefs(context).getString(ONCE_KEY, null) ?: "[]")
        (0 until array.length()).map { index ->
          val item = array.getJSONObject(index)
          Once(item.getString("id"), item.getLong("at"), item.optString("title"), item.optString("body"))
        }
      } catch (_: Exception) {
        emptyList()
      }

  private fun saveOnce(context: Context, list: List<Once>) {
    val array = JSONArray()
    list.forEach { array.put(JSONObject().put("id", it.id).put("at", it.at).put("title", it.title).put("body", it.body)) }
    prefs(context).edit().putString(ONCE_KEY, array.toString()).apply()
  }

  fun show(context: Context) {
    val prefs = prefs(context)
    if (!prefs.getBoolean("on", false)) return
    arm(context, prefs.getInt("hour", 20), prefs.getInt("minute", 0))
    post(context, NOTIFICATION_ID, prefs.getString("title", "") ?: "", prefs.getString("body", "") ?: "")
  }

  /** Posts a one-off once and forgets it. One that was replaced in the meantime is not found and stays quiet. */
  fun showOnce(context: Context, id: String) {
    val saved = loadOnce(context)
    val once = saved.find { it.id == id } ?: return
    saveOnce(context, saved.filter { it.id != id })
    post(context, onceNotificationId(id), once.title, once.body)
  }

  private fun post(context: Context, notificationId: Int, title: String, body: String) {
    val manager = NotificationManagerCompat.from(context)
    if (!manager.areNotificationsEnabled()) return
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      manager.createNotificationChannel(
          NotificationChannel(CHANNEL, context.getString(R.string.reminder_channel), NotificationManager.IMPORTANCE_DEFAULT)
      )
    }
    val open =
        PendingIntent.getActivity(
            context,
            0,
            context.packageManager.getLaunchIntentForPackage(context.packageName),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    val notification =
        NotificationCompat.Builder(context, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_reminder)
            .setContentTitle(title)
            .setContentText(body)
            .setContentIntent(open)
            .setAutoCancel(true)
            .build()
    try {
      manager.notify(notificationId, notification)
    } catch (_: SecurityException) {
      // The permission was taken away between the check and the post.
    }
  }
}

class ReminderReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    when (intent.action) {
      Reminder.ACTION_SHOW -> Reminder.show(context)
      Reminder.ACTION_ONCE -> intent.data?.lastPathSegment?.let { Reminder.showOnce(context, it) }
      Intent.ACTION_BOOT_COMPLETED -> Reminder.restore(context)
    }
  }
}
