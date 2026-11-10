#import <ManganovaSpecs/ManganovaSpecs.h>
#import <UserNotifications/UserNotifications.h>

static NSString *const kReminderId = @"daily-drawing-reminder";

/** Implements specs/NativeReminder.ts on iOS: one local notification that repeats every day. */
@interface NativeReminderModule : NSObject <NativeReminderSpec>
@end

@implementation NativeReminderModule

RCT_EXPORT_MODULE(NativeReminder)

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:(const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeReminderSpecJSI>(params);
}

- (void)schedule:(double)hour
          minute:(double)minute
           title:(NSString *)title
            body:(NSString *)body
         resolve:(RCTPromiseResolveBlock)resolve
          reject:(RCTPromiseRejectBlock)reject
{
  UNUserNotificationCenter *center = [UNUserNotificationCenter currentNotificationCenter];
  [center requestAuthorizationWithOptions:(UNAuthorizationOptionAlert | UNAuthorizationOptionSound)
                        completionHandler:^(BOOL granted, NSError *error) {
                          if (!granted) {
                            resolve(@NO);
                            return;
                          }
                          UNMutableNotificationContent *content = [UNMutableNotificationContent new];
                          content.title = title;
                          content.body = body;
                          content.sound = [UNNotificationSound defaultSound];
                          NSDateComponents *time = [NSDateComponents new];
                          time.hour = (NSInteger)MAX(0, MIN(23, hour));
                          time.minute = (NSInteger)MAX(0, MIN(59, minute));
                          UNCalendarNotificationTrigger *trigger =
                              [UNCalendarNotificationTrigger triggerWithDateMatchingComponents:time repeats:YES];
                          // The same identifier replaces the earlier request.
                          UNNotificationRequest *request = [UNNotificationRequest requestWithIdentifier:kReminderId
                                                                                                content:content
                                                                                                trigger:trigger];
                          [center addNotificationRequest:request
                                   withCompletionHandler:^(NSError *addError) {
                                     if (addError) {
                                       reject(@"E_REMINDER", addError.localizedDescription, addError);
                                     } else {
                                       resolve(@YES);
                                     }
                                   }];
                        }];
}

- (void)cancel
{
  UNUserNotificationCenter *center = [UNUserNotificationCenter currentNotificationCenter];
  [center removePendingNotificationRequestsWithIdentifiers:@[ kReminderId ]];
  [center removeDeliveredNotificationsWithIdentifiers:@[ kReminderId ]];
}

@end
