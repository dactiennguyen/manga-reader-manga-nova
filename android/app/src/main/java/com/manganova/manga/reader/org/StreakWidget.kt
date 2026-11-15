package com.manganova.manga.reader.org

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.util.SizeF
import android.view.View
import android.widget.RemoteViews
import androidx.core.content.ContextCompat
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale
import org.json.JSONObject

/**
 * The home screen widget: the drawing streak, today's strokes against the goal and today's prompt. The app
 * works out every text (src/core/widget/snapshot.ts) and saves it here through NativeWidgetModule, so the
 * widget only picks the right day and draws it. The snapshot holds the day it was made, the next day and any
 * later day, so the widget is right after midnight without the app.
 */
object StreakWidget {
  private const val PREFS = "widget"
  private const val KEY_SNAPSHOT = "snapshot"
  const val ACTION_MIDNIGHT = "com.manganova.manga.reader.org.WIDGET_MIDNIGHT"
  private const val HOME_LINK = "manganova://widget"
  private const val PROMPT_LINK = "manganova://widget/prompt"
  /** From this width (dp) the prompt card fits beside the streak. */
  private const val WIDE_MIN_DP = 220f
  private const val SMALL_MIN_DP = 100f

  fun save(context: Context, snapshot: String) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY_SNAPSHOT, snapshot).apply()
    updateAll(context)
  }

  fun updateAll(context: Context) {
    val manager = AppWidgetManager.getInstance(context)
    val ids = manager.getAppWidgetIds(ComponentName(context, StreakWidgetProvider::class.java))
    for (id in ids) {
      render(context, manager, id)
    }
    if (ids.isNotEmpty()) armMidnight(context)
  }

  fun render(context: Context, manager: AppWidgetManager, id: Int) {
    val snapshot = readSnapshot(context)
    val views =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
          // The launcher picks the biggest layout that fits, with no round trip through the app on resize.
          RemoteViews(
              mapOf(
                  SizeF(SMALL_MIN_DP, SMALL_MIN_DP) to build(context, snapshot, wide = false),
                  SizeF(WIDE_MIN_DP, SMALL_MIN_DP) to build(context, snapshot, wide = true),
              )
          )
        } else {
          val width = manager.getAppWidgetOptions(id).getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0)
          build(context, snapshot, wide = width == 0 || width >= WIDE_MIN_DP)
        }
    manager.updateAppWidget(id, views)
  }

  private fun readSnapshot(context: Context): JSONObject? =
      context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_SNAPSHOT, null)?.let {
        try {
          JSONObject(it)
        } catch (_: Exception) {
          null
        }
      }

  private fun dayKey(calendar: Calendar): String =
      SimpleDateFormat("yyyy-MM-dd", Locale.US).apply { timeZone = calendar.timeZone }.format(calendar.time)

  /** The snapshot's day, the next day or a later day, by today's local date. */
  private fun dayToShow(snapshot: JSONObject): JSONObject? {
    val day = snapshot.optString("day")
    val today = dayKey(Calendar.getInstance())
    if (today <= day) return snapshot.optJSONObject("today")
    val next =
        try {
          val parsed = SimpleDateFormat("yyyy-MM-dd", Locale.US).parse(day) ?: return snapshot.optJSONObject("later")
          dayKey(Calendar.getInstance().apply {
            time = parsed
            add(Calendar.DAY_OF_YEAR, 1)
          })
        } catch (_: Exception) {
          ""
        }
    return snapshot.optJSONObject(if (today == next) "tomorrow" else "later")
  }

  private class Palette(
      val bg: Int,
      val card: Int,
      val text: Int,
      val secondary: Int,
      val muted: Int,
      val accent: Int,
      val success: Int,
      val track: Int,
  )

  private fun palette(context: Context, dark: Boolean): Palette {
    fun c(light: Int, night: Int) = ContextCompat.getColor(context, if (dark) night else light)
    return Palette(
        bg = c(R.color.widget_light_bg, R.color.widget_dark_bg),
        card = c(R.color.widget_light_card, R.color.widget_dark_card),
        text = c(R.color.widget_light_text, R.color.widget_dark_text),
        secondary = c(R.color.widget_light_text_secondary, R.color.widget_dark_text_secondary),
        muted = c(R.color.widget_light_text_muted, R.color.widget_dark_text_muted),
        accent = c(R.color.widget_light_accent, R.color.widget_dark_accent),
        success = c(R.color.widget_light_success, R.color.widget_dark_success),
        track = c(R.color.widget_light_track, R.color.widget_dark_track),
    )
  }

  /**
   * Sets a colour on a view in the app's theme. With "system", Android 12 and later switch it with the phone's
   * dark mode; older versions use the mode at the time of drawing.
   */
  private class Painter(context: Context, theme: String) {
    private val light = palette(context, dark = false)
    private val dark = palette(context, dark = true)
    private val forced: Palette? =
        when (theme) {
          "light" -> light
          "dark" -> dark
          else -> null
        }
    private val nightNow =
        context.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK == Configuration.UI_MODE_NIGHT_YES

    fun paint(views: RemoteViews, id: Int, method: String, pick: (Palette) -> Int) {
      when {
        forced != null -> views.setInt(id, method, pick(forced))
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> views.setColorInt(id, method, pick(light), pick(dark))
        else -> views.setInt(id, method, pick(if (nightNow) dark else light))
      }
    }

    fun text(views: RemoteViews, id: Int, pick: (Palette) -> Int) = paint(views, id, "setTextColor", pick)

    fun tint(views: RemoteViews, id: Int, pick: (Palette) -> Int) = paint(views, id, "setColorFilter", pick)
  }

  private fun link(context: Context, url: String, requestCode: Int): PendingIntent =
      PendingIntent.getActivity(
          context,
          requestCode,
          Intent(Intent.ACTION_VIEW, Uri.parse(url), context, MainActivity::class.java)
              .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )

  private fun build(context: Context, snapshot: JSONObject?, wide: Boolean): RemoteViews {
    val views =
        RemoteViews(context.packageName, if (wide) R.layout.widget_streak_wide else R.layout.widget_streak_small)
    val painter = Painter(context, snapshot?.optString("theme") ?: "system")
    val day = snapshot?.let { dayToShow(it) }

    views.setOnClickPendingIntent(R.id.widget_root, link(context, HOME_LINK, 0))
    painter.tint(views, R.id.widget_bg) { it.bg }
    painter.text(views, R.id.widget_streak) { it.text }
    painter.text(views, R.id.widget_caption) { it.muted }
    painter.tint(views, R.id.widget_track) { it.track }

    val drawn = day?.optInt("drawn") ?: 0
    val goal = day?.optInt("goal") ?: 0
    val goalMet = day?.optBoolean("goalMet") ?: false
    views.setImageViewResource(R.id.widget_flame, if (drawn > 0) R.drawable.ic_widget_flame else R.drawable.ic_widget_flame_outline)
    painter.tint(views, R.id.widget_flame) { if (drawn > 0) it.accent else it.muted }

    if (snapshot == null || day == null) {
      // Before the app has sent anything: ask for one visit.
      views.setTextViewText(R.id.widget_streak, "0")
      views.setTextViewText(
          R.id.widget_caption,
          context.getString(if (wide) R.string.widget_name else R.string.widget_empty),
      )
      views.setViewVisibility(R.id.widget_bar, View.GONE)
      views.setViewVisibility(R.id.widget_progress, View.GONE)
    } else {
      val nudge = day.optString("nudge")
      views.setTextViewText(R.id.widget_streak, day.optString("streakText"))
      views.setTextViewText(R.id.widget_caption, nudge.ifEmpty { snapshot.optString("streakTitle") })
      views.setViewVisibility(R.id.widget_bar, if (goal > 0) View.VISIBLE else View.GONE)
      views.setInt(R.id.widget_fill, "setImageLevel", (day.optDouble("progress", 0.0).coerceIn(0.0, 1.0) * 10000).toInt())
      painter.tint(views, R.id.widget_fill) { if (goalMet) it.success else it.accent }
      views.setViewVisibility(R.id.widget_progress, View.VISIBLE)
      views.setTextViewText(R.id.widget_progress, day.optString("progressText"))
      painter.text(views, R.id.widget_progress) { if (goalMet) it.success else it.secondary }
    }

    if (wide) {
      views.setOnClickPendingIntent(R.id.widget_prompt, link(context, PROMPT_LINK, 1))
      painter.tint(views, R.id.widget_card) { it.card }
      painter.text(views, R.id.widget_prompt_title) { it.text }
      painter.text(views, R.id.widget_prompt_text) { it.secondary }
      painter.text(views, R.id.widget_prompt_status) { it.success }
      if (snapshot == null || day == null) {
        views.setTextViewText(R.id.widget_prompt_title, context.getString(R.string.widget_prompt_title))
        views.setTextViewText(R.id.widget_prompt_text, context.getString(R.string.widget_empty))
        views.setViewVisibility(R.id.widget_prompt_status, View.GONE)
      } else {
        val done = day.optString("promptDone")
        views.setTextViewText(R.id.widget_prompt_title, snapshot.optString("promptTitle"))
        views.setTextViewText(R.id.widget_prompt_text, day.optString("prompt").ifEmpty { snapshot.optString("promptMissing") })
        views.setTextViewText(R.id.widget_prompt_status, done)
        views.setViewVisibility(R.id.widget_prompt_status, if (done.isEmpty()) View.GONE else View.VISIBLE)
      }
    }
    return views
  }

  private fun midnightIntent(context: Context): PendingIntent =
      PendingIntent.getBroadcast(
          context,
          0,
          Intent(context, StreakWidgetProvider::class.java).setAction(ACTION_MIDNIGHT),
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )

  /**
   * Redraws just after local midnight, when the day rolls over. Not a wake-up alarm: if the phone sleeps through
   * midnight, it runs when the screen comes on, which is when the widget can be seen.
   */
  fun armMidnight(context: Context) {
    val next =
        Calendar.getInstance().apply {
          add(Calendar.DAY_OF_YEAR, 1)
          set(Calendar.HOUR_OF_DAY, 0)
          set(Calendar.MINUTE, 0)
          set(Calendar.SECOND, 5)
          set(Calendar.MILLISECOND, 0)
        }
    (context.getSystemService(Context.ALARM_SERVICE) as AlarmManager).set(
        AlarmManager.RTC,
        next.timeInMillis,
        midnightIntent(context),
    )
  }

  fun cancelMidnight(context: Context) {
    (context.getSystemService(Context.ALARM_SERVICE) as AlarmManager).cancel(midnightIntent(context))
  }
}

class StreakWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    for (id in ids) {
      StreakWidget.render(context, manager, id)
    }
    StreakWidget.armMidnight(context)
  }

  override fun onAppWidgetOptionsChanged(context: Context, manager: AppWidgetManager, id: Int, options: Bundle) {
    StreakWidget.render(context, manager, id)
  }

  override fun onEnabled(context: Context) {
    StreakWidget.armMidnight(context)
  }

  override fun onDisabled(context: Context) {
    StreakWidget.cancelMidnight(context)
  }

  override fun onReceive(context: Context, intent: Intent) {
    super.onReceive(context, intent)
    when (intent.action) {
      StreakWidget.ACTION_MIDNIGHT,
      Intent.ACTION_TIME_CHANGED,
      Intent.ACTION_TIMEZONE_CHANGED -> StreakWidget.updateAll(context)
    }
  }
}
