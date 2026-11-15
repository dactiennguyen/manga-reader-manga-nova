#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/**
 * Implemented in Swift (WidgetReloader.swift), because WidgetCenter has no Objective-C API. Declared here so
 * NativeWidgetModule.mm does not need the generated Manganova-Swift.h. Keep it out of the bridging header.
 */
@interface ManganovaWidgetReloader : NSObject

+ (void)reloadAll;

@end

NS_ASSUME_NONNULL_END
