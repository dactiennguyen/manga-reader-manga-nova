package com.mangakaai.app

import android.content.pm.ApplicationInfo
import android.os.Bundle
import android.view.WindowManager
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
    super.onCreate(null)
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "MangakaAI"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  private companion object {
    /** Blocks screenshots in release builds. Set to false to allow them. */
    const val SECURE_SCREEN = true
  }
}
