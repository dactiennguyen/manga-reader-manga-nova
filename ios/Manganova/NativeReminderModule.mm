#import <ManganovaSpecs/ManganovaSpecs.h>
#import <UserNotifications/UserNotifications.h>

static NSString *const kReminderId = @"daily-drawing-reminder";
/** Every one-off notification's identifier starts with this, so replacing them never touches the daily one. */
static NSString *const kOncePrefix = @"once-reminder:";

/**
 * Implements specs/NativeReminder.ts on iOS: one local notification that repeats every day, plus one-off
 * notifications (a deadline tomorrow) that are replaced as a set.
 */
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

- (void)replaceOnce:(NSArray *)reminders
            resolve:(RCTPromiseResolveBlock)resolve
             reject:(RCTPromiseRejectBlock)reject
{
  UNUserNotificationCenter *center = [UNUserNotificationCenter currentNotificationCenter];
  NSDate *now = [NSDate date];
  NSCalendar *calendar = [NSCalendar currentCalendar];
  NSCalendarUnit units =
      NSCalendarUnitYear | NSCalendarUnitMonth | NSCalendarUnitDay | NSCalendarUnitHour | NSCalendarUnitMinute;
  NSMutableArray<UNNotificationRequest *> *requests = [NSMutableArray new];
  for (id item in reminders) {
    if (![item isKindOfClass:[NSDictionary class]]) {
      continue;
    }
    NSDictionary *reminder = item;
    NSString *identifier = reminder[@"id"];
    NSNumber *at = reminder[@"at"];
    if (![identifier isKindOfClass:[NSString class]] || ![at isKindOfClass:[NSNumber class]]) {
      continue;
    }
    NSDate *date = [NSDate dateWithTimeIntervalSince1970:at.doubleValue / 1000.0];
    if ([date compare:now] != NSOrderedDescending) {
      continue;
    }
    UNMutableNotificationContent *content = [UNMutableNotificationContent new];
    content.title = [reminder[@"title"] isKindOfClass:[NSString class]] ? reminder[@"title"] : @"";
    content.body = [reminder[@"body"] isKindOfClass:[NSString class]] ? reminder[@"body"] : @"";
    content.sound = [UNNotificationSound defaultSound];
    // Calendar components rather than an interval, so the notice keeps its local time if the clock changes.
    UNCalendarNotificationTrigger *trigger =
        [UNCalendarNotificationTrigger triggerWithDateMatchingComponents:[calendar components:units fromDate:date]
                                                                 repeats:NO];
    [requests addObject:[UNNotificationRequest requestWithIdentifier:[kOncePrefix stringByAppendingString:identifier]
                                                             content:content
                                                             trigger:trigger]];
  }

  [center getPendingNotificationRequestsWithCompletionHandler:^(NSArray<UNNotificationRequest *> *pending) {
    NSMutableArray<NSString *> *old = [NSMutableArray new];
    for (UNNotificationRequest *request in pending) {
      if ([request.identifier hasPrefix:kOncePrefix]) {
        [old addObject:request.identifier];
      }
    }
    [center removePendingNotificationRequestsWithIdentifiers:old];
    if (requests.count == 0) {
      resolve(@YES);
      return;
    }
    // Never asks: the daily reminder asks when it is turned on, and this only follows it.
    [center getNotificationSettingsWithCompletionHandler:^(UNNotificationSettings *settings) {
      if (settings.authorizationStatus != UNAuthorizationStatusAuthorized &&
          settings.authorizationStatus != UNAuthorizationStatusProvisional) {
        resolve(@NO);
        return;
      }
      dispatch_group_t group = dispatch_group_create();
      NSMutableArray<NSError *> *errors = [NSMutableArray new];
      for (UNNotificationRequest *request in requests) {
        dispatch_group_enter(group);
        [center addNotificationRequest:request
                 withCompletionHandler:^(NSError *addError) {
                   if (addError) {
                     @synchronized(errors) {
                       [errors addObject:addError];
                     }
                   }
                   dispatch_group_leave(group);
                 }];
      }
      dispatch_group_notify(group, dispatch_get_global_queue(QOS_CLASS_UTILITY, 0), ^{
        NSError *error = errors.firstObject;
        if (error) {
          reject(@"E_REMINDER", error.localizedDescription, error);
        } else {
          resolve(@YES);
        }
      });
    }];
  }];
}

@end
