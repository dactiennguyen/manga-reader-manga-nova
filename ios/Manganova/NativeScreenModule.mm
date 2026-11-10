#import "NativeScreenModule.h"

#import <ManganovaSpecs/ManganovaSpecs.h>
#import <React/RCTUtils.h>

/** Implements specs/NativeScreen.ts on iOS. */
@interface NativeScreenModule : NSObject <NativeScreenSpec>
@end

/** What "auto" means: the iPhone never turns upside down, the iPad turns every way, as in Info.plist. */
static UIInterfaceOrientationMask autoMask(void)
{
  return UIDevice.currentDevice.userInterfaceIdiom == UIUserInterfaceIdiomPad ? UIInterfaceOrientationMaskAll
                                                                              : UIInterfaceOrientationMaskAllButUpsideDown;
}

static UIInterfaceOrientationMask allowedMask = 0;

@implementation NativeScreenOrientation
+ (UIInterfaceOrientationMask)mask
{
  return allowedMask ?: autoMask();
}
@end

@implementation NativeScreenModule

RCT_EXPORT_MODULE(NativeScreen)

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeScreenSpecJSI>(params);
}

// iPadOS ignores the lock while the app can share the screen with other apps (multitasking).
- (void)setOrientation:(NSString *)mode
{
  UIInterfaceOrientationMask mask = 0;
  if ([mode isEqualToString:@"portrait"]) {
    mask = UIInterfaceOrientationMaskPortrait;
  } else if ([mode isEqualToString:@"landscape"]) {
    mask = UIInterfaceOrientationMaskLandscape;
  }
  dispatch_async(dispatch_get_main_queue(), ^{
    allowedMask = mask;
    UIWindow *window = RCTKeyWindow();
    [window.rootViewController setNeedsUpdateOfSupportedInterfaceOrientations];
    UIWindowSceneGeometryPreferencesIOS *preferences =
        [[UIWindowSceneGeometryPreferencesIOS alloc] initWithInterfaceOrientations:[NativeScreenOrientation mask]];
    [window.windowScene requestGeometryUpdateWithPreferences:preferences errorHandler:nil];
  });
}

// iOS cannot block screenshots the way Android's FLAG_SECURE does.
- (void)setSecure:(BOOL)enabled
{
}

- (void)setKeepAwake:(BOOL)enabled
{
  dispatch_async(dispatch_get_main_queue(), ^{
    [UIApplication sharedApplication].idleTimerDisabled = enabled;
  });
}

// The status bar follows the StatusBar component on iOS, and there is no navigation bar.
- (void)setSystemBarsDarkIcons:(BOOL)dark
{
}

// The launch screen leaves on its own once the first frame is drawn.
- (void)hideSplash
{
}

@end
