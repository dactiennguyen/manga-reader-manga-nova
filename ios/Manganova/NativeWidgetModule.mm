#import <ManganovaSpecs/ManganovaSpecs.h>

#import "WidgetReloader.h"

/** Shared with the widget extension (ManganovaWidget/WidgetSnapshot.swift). Both targets have this App Group. */
static NSString *const kAppGroup = @"group.com.manganova.manga.reader.org";
static NSString *const kSnapshotKey = @"widget.snapshot";

/**
 * Implements specs/NativeWidget.ts on iOS: keeps the widget's data in the App Group, where the extension
 * reads it, and asks WidgetKit to draw the widget again.
 */
@interface NativeWidgetModule : NSObject <NativeWidgetSpec>
@end

@implementation NativeWidgetModule

RCT_EXPORT_MODULE(NativeWidget)

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:(const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeWidgetSpecJSI>(params);
}

- (void)update:(NSString *)snapshot
{
  NSUserDefaults *shared = [[NSUserDefaults alloc] initWithSuiteName:kAppGroup];
  if (!shared || [[shared stringForKey:kSnapshotKey] isEqualToString:snapshot]) {
    return;
  }
  [shared setObject:snapshot forKey:kSnapshotKey];
  [ManganovaWidgetReloader reloadAll];
}

@end
