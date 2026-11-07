package com.manganova.manga.reader.org

import android.content.pm.ApplicationInfo
import android.os.Build
import android.os.Bundle
import android.os.SystemClock
import android.view.WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS
import android.view.WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
import android.view.WindowManager
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.core.view.WindowCompat
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  // react-native-screens cannot restore fragments, so saved state is dropped on purpose.
  override fun onCreate(savedInstanceState: Bundle?) {
    // Set here, not from JS: this also covers the first frames and an Activity recreated by the system.
    if (SECURE_SCREEN && applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE == 0) {
      window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
    }
    val shownAt = SystemClock.uptimeMillis()
    val splash = installSplashScreen()
    splash.setKeepOnScreenCondition { !appReady && SystemClock.uptimeMillis() - shownAt < SPLASH_LIMIT_MS }
    splash.setOnExitAnimationListener { provider ->
      provider.view
          .animate()
          .alpha(0f)
          .setDuration(SPLASH_FADE_MS)
          .withEndAction {
            provider.remove()
            applySystemBarIcons()
          }
          .start()
    }
    super.onCreate(null)
  }

  /** Removing the splash resets the bars, so this also runs after it leaves. */
  fun applySystemBarIcons() {
    WindowCompat.getInsetsController(window, window.decorView).apply {
      isAppearanceLightStatusBars = darkBarIcons
      isAppearanceLightNavigationBars = darkBarIcons
    }
    // Once the splash has run, the compat calls above only reach the old flags, which API 30+ ignores.
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      val lightBars = APPEARANCE_LIGHT_STATUS_BARS or APPEARANCE_LIGHT_NAVIGATION_BARS
      window.insetsController?.setSystemBarsAppearance(if (darkBarIcons) lightBars else 0, lightBars)
    }
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "Manganova"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  companion object {
    /** Set from JS once the first screen is ready. */
    @Volatile var appReady = false

    /** Dark icons suit the paper theme, the default. JS updates this with the theme. */
    @Volatile var darkBarIcons = true

    /** Blocks screenshots in release builds. Set to false to allow them. */
    private const val SECURE_SCREEN = true

    /** A start that fails before reaching JS must not leave the splash up for good. */
    private const val SPLASH_LIMIT_MS = 8_000L
    private const val SPLASH_FADE_MS = 220L
  }
}
