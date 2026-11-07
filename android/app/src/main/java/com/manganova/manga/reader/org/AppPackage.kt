package com.manganova.manga.reader.org

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

/** The app's TurboModules (specs live in the specs folder). */
class AppPackage : BaseReactPackage() {

  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
      when (name) {
        NativeScreenModule.NAME -> NativeScreenModule(reactContext)
        NativeFilesModule.NAME -> NativeFilesModule(reactContext)
        else -> null
      }

  override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
    listOf(NativeScreenModule.NAME, NativeFilesModule.NAME).associateWith { name ->
      ReactModuleInfo(
          name = name,
          className = name,
          canOverrideExistingModule = false,
          needsEagerInit = false,
          isCxxModule = false,
          isTurboModule = true,
      )
    }
  }
}
