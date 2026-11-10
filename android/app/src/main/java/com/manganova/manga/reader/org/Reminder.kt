package com.manganova.manga.reader.org

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import java.util.Calendar

/** The daily drawing reminder: an alarm that posts one local notification and sets itself for the next day. */
object Reminder {
  private const val PREFS = "reminder"
  private const val CHANNEL = "reminder"
  private const val NOTIFICATION_ID = 1
  private const val WINDOW_MS = 30 * 60 * 1000L
  const val ACTION_SHOW = "com.manganova.manga.reader.org.REMINDER"

  private fun alarmIntent(context: Context): PendingIntent =
      PendingIntent.getBroadcast(
          context,
          0,
          Intent(context, ReminderReceiver::class.java).setAction(ACTION_SHOW),
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )

  fun schedule(context: Context, hour: Int, minute: Int, title: String, body: String) {
    context
        .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
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
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    if (prefs.getBoolean("on", false)) {
      arm(context, prefs.getInt("hour", 20), prefs.getInt("minute", 0))
    }
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
    (context.getSystemService(Context.ALARM_SERVICE) as AlarmManager).setWindow(
        AlarmManager.RTC_WAKEUP,
        first.timeInMillis,
        WINDOW_MS,
        alarmIntent(context),
    )
  }

  fun cancel(context: Context) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean("on", false).apply()
    (context.getSystemService(Context.ALARM_SERVICE) as AlarmManager).cancel(alarmIntent(context))
    NotificationManagerCompat.from(context).cancel(NOTIFICATION_ID)
  }

  fun show(context: Context) {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    if (!prefs.getBoolean("on", false)) return
    arm(context, prefs.getInt("hour", 20), prefs.getInt("minute", 0))
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
            .setContentTitle(prefs.getString("title", ""))
            .setContentText(prefs.getString("body", ""))
            .setContentIntent(open)
            .setAutoCancel(true)
            .build()
    try {
      manager.notify(NOTIFICATION_ID, notification)
    } catch (_: SecurityException) {
      // The permission was taken away between the check and the post.
    }
  }
}

class ReminderReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    when (intent.action) {
      Reminder.ACTION_SHOW -> Reminder.show(context)
      Intent.ACTION_BOOT_COMPLETED -> Reminder.restore(context)
    }
  }
}
