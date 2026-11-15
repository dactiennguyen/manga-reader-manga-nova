package com.manganova.manga.reader.org

import com.facebook.react.bridge.ReactApplicationContext

/** Implements specs/NativeWidget.ts: hands the home screen widget its data. */
class NativeWidgetModule(reactContext: ReactApplicationContext) : NativeWidgetSpec(reactContext) {

  override fun getName() = NAME

  override fun update(snapshot: String) {
    StreakWidget.save(reactApplicationContext, snapshot)
  }

  companion object {
    const val NAME = "NativeWidget"
  }
}
