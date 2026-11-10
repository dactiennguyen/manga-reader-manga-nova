#import <UIKit/UIKit.h>

/** The orientations the app allows right now. AppDelegate asks for this on every rotation. */
@interface NativeScreenOrientation : NSObject
+ (UIInterfaceOrientationMask)mask;
@end
