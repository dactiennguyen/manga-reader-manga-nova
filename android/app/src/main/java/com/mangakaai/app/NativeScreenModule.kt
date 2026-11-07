package com.mangakaai.app

import android.content.pm.ActivityInfo
import android.view.WindowManager
import androidx.core.view.WindowCompat
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.UiThreadUtil

/** Implements specs/NativeScreen.ts: orientation lock, FLAG_SECURE and keep-awake for the current Activity. */
class NativeScreenModule(reactContext: ReactApplicationContext) : NativeScreenSpec(reactContext) {

  override fun getName() = NAME

  override fun setOrientation(mode: String) {
    val orientation =
        when (mode) {
          "portrait" -> ActivityInfo.SCREEN_ORIENTATION_SENSOR_PORTRAIT
          "landscape" -> ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
          else -> ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
        }
    UiThreadUtil.runOnUiThread {
      reactApplicationContext.currentActivity?.requestedOrientation = orientation
    }
  }

  override fun setSecure(enabled: Boolean) {
    UiThreadUtil.runOnUiThread {
      val window = reactApplicationContext.currentActivity?.window ?: return@runOnUiThread
      if (enabled) {
        window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
      } else {
        window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
      }
    }
  }

  override fun setKeepAwake(enabled: Boolean) {
    UiThreadUtil.runOnUiThread {
      val window = reactApplicationContext.currentActivity?.window ?: return@runOnUiThread
      if (enabled) {
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
      } else {
        window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
      }
    }
  }

  /** Dark icons for a light screen, on the status bar and the navigation buttons alike. */
  override fun setSystemBarsDarkIcons(dark: Boolean) {
    UiThreadUtil.runOnUiThread {
      val window = reactApplicationContext.currentActivity?.window ?: return@runOnUiThread
      WindowCompat.getInsetsController(window, window.decorView).apply {
        isAppearanceLightStatusBars = dark
        isAppearanceLightNavigationBars = dark
      }
    }
  }

  companion object {
    const val NAME = "NativeScreen"
  }
}
