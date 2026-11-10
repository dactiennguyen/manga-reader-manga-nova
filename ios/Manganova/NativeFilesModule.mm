#import <LinkPresentation/LinkPresentation.h>
#import <ManganovaSpecs/ManganovaSpecs.h>
#import <React/RCTUtils.h>
#import <SSZipArchive/SSZipArchive.h>
#import <UIKit/UIKit.h>

/** A shared file with a title for the share sheet header, like the chooser title on Android. */
@interface NativeShareItem : NSObject <UIActivityItemSource>
@property (nonatomic, strong) NSURL *url;
@property (nonatomic, copy) NSString *title;
@end

@implementation NativeShareItem
- (id)activityViewControllerPlaceholderItem:(UIActivityViewController *)controller
{
  return self.url;
}
- (id)activityViewController:(UIActivityViewController *)controller itemForActivityType:(UIActivityType)type
{
  return self.url;
}
- (NSString *)activityViewController:(UIActivityViewController *)controller subjectForActivityType:(UIActivityType)type
{
  return self.title;
}
- (LPLinkMetadata *)activityViewControllerLinkMetadata:(UIActivityViewController *)controller
{
  LPLinkMetadata *metadata = [LPLinkMetadata new];
  metadata.title = self.title;
  metadata.originalURL = self.url;
  return metadata;
}
@end

/** Implements specs/NativeFiles.ts on iOS: zip/unzip, images to PDF, sharing and clipboard. */
@interface NativeFilesModule : NSObject <NativeFilesSpec>
@end

@implementation NativeFilesModule {
  dispatch_queue_t _queue;
}

RCT_EXPORT_MODULE(NativeFiles)

- (instancetype)init
{
  if (self = [super init]) {
    _queue = dispatch_queue_create("com.manganova.files", DISPATCH_QUEUE_SERIAL);
  }
  return self;
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeFilesSpecJSI>(params);
}

static NSString *plainPath(NSString *path)
{
  return [path hasPrefix:@"file://"] ? [NSURL URLWithString:path].path : path;
}

static void makeParent(NSString *path)
{
  [[NSFileManager defaultManager] createDirectoryAtPath:[path stringByDeletingLastPathComponent]
                            withIntermediateDirectories:YES
                                             attributes:nil
                                                  error:nil];
}

- (void)zip:(NSString *)sourceDir
    outPath:(NSString *)outPath
    resolve:(RCTPromiseResolveBlock)resolve
     reject:(RCTPromiseRejectBlock)reject
{
  dispatch_async(_queue, ^{
    NSString *root = plainPath(sourceDir);
    NSString *out = plainPath(outPath);
    makeParent(out);
    NSFileManager *fm = [NSFileManager defaultManager];
    [fm removeItemAtPath:out error:nil];
    // Entries go in name order, like on Android: comic readers page through a CBZ in archive order.
    NSMutableArray<NSString *> *names = [NSMutableArray array];
    for (NSString *name in [fm enumeratorAtPath:root]) {
      BOOL isDir = NO;
      if ([fm fileExistsAtPath:[root stringByAppendingPathComponent:name] isDirectory:&isDir] && !isDir) {
        [names addObject:name];
      }
    }
    [names sortUsingSelector:@selector(compare:)];
    SSZipArchive *zip = [[SSZipArchive alloc] initWithPath:out];
    BOOL ok = [zip open];
    for (NSString *name in names) {
      ok = ok && [zip writeFileAtPath:[root stringByAppendingPathComponent:name] withFileName:name withPassword:nil];
    }
    ok = [zip close] && ok;
    if (ok) {
      resolve(nil);
    } else {
      [fm removeItemAtPath:out error:nil];
      reject(@"E_ZIP", @"Could not create the zip file", nil);
    }
  });
}

// The share sheet takes the file type from its extension, so mimeType is only used on Android.
// SSZipArchive strips "../" from entry names, so no entry can land outside the destination (zip slip).
- (void)unzip:(NSString *)zipPath
      destDir:(NSString *)destDir
      resolve:(RCTPromiseResolveBlock)resolve
       reject:(RCTPromiseRejectBlock)reject
{
  dispatch_async(_queue, ^{
    NSString *dest = plainPath(destDir);
    [[NSFileManager defaultManager] createDirectoryAtPath:dest withIntermediateDirectories:YES attributes:nil error:nil];
    NSError *error = nil;
    BOOL ok = [SSZipArchive unzipFileAtPath:plainPath(zipPath)
                              toDestination:dest
                         preserveAttributes:NO
                                  overwrite:YES
                                   password:nil
                                      error:&error
                                   delegate:nil];
    if (ok) {
      resolve(nil);
    } else {
      reject(@"E_UNZIP", error.localizedDescription ?: @"Could not open the zip file", error);
    }
  });
}

- (void)imagesToPdf:(NSArray *)imagePaths
            outPath:(NSString *)outPath
             spread:(BOOL)spread
                rtl:(BOOL)rtl
        pageWidthPt:(double)pageWidthPt
            resolve:(RCTPromiseResolveBlock)resolve
             reject:(RCTPromiseRejectBlock)reject
{
  NSArray<NSString *> *paths = [imagePaths copy];
  dispatch_async(_queue, ^{
    // Spreads: the first page stands alone (cover), the rest are paired.
    NSMutableArray<NSArray<NSString *> *> *sheets = [NSMutableArray array];
    for (NSUInteger i = 0; i < paths.count;) {
      NSUInteger take = (spread && i > 0) ? MIN(2, paths.count - i) : 1;
      [sheets addObject:[paths subarrayWithRange:NSMakeRange(i, take)]];
      i += take;
    }
    NSString *out = plainPath(outPath);
    makeParent(out);
    CGFloat width = round(pageWidthPt);
    if (!UIGraphicsBeginPDFContextToFile(out, CGRectZero, nil)) {
      reject(@"E_PDF", @"Could not create the PDF", nil);
      return;
    }
    NSString *failure = nil;
    for (NSUInteger index = 0; index < sheets.count && !failure; index++) {
      @autoreleasepool {
        NSArray<NSString *> *sheet = sheets[index];
        NSMutableArray<UIImage *> *images = [NSMutableArray array];
        for (NSString *path in sheet) {
          UIImage *image = [UIImage imageWithContentsOfFile:plainPath(path)];
          if (!image) {
            failure = [NSString stringWithFormat:@"Cannot decode image: %@", path];
            break;
          }
          [images addObject:image];
        }
        if (failure) {
          break;
        }
        // Pixel sizes, ignoring EXIF orientation, so the PDF matches the one Android makes.
        CGImageRef first = images[0].CGImage;
        CGFloat ratio = (CGFloat)CGImageGetHeight(first) / MAX(1.0, (CGFloat)CGImageGetWidth(first));
        NSUInteger slots = (spread && index > 0) ? 2 : 1;
        CGFloat height = round(width * ratio);
        UIGraphicsBeginPDFPageWithInfo(CGRectMake(0, 0, width * slots, height), nil);
        [images enumerateObjectsUsingBlock:^(UIImage *image, NSUInteger i, BOOL *stop) {
          NSUInteger slot = (slots == 2 && rtl) ? 1 - i : i;
          [[UIImage imageWithCGImage:image.CGImage] drawInRect:CGRectMake(slot * width, 0, width, height)];
        }];
      }
    }
    UIGraphicsEndPDFContext();
    if (failure) {
      [[NSFileManager defaultManager] removeItemAtPath:out error:nil];
      reject(@"E_PDF", failure, nil);
    } else {
      resolve(nil);
    }
  });
}

- (void)shareFile:(NSString *)path
         mimeType:(NSString *)mimeType
            title:(NSString *)title
          resolve:(RCTPromiseResolveBlock)resolve
           reject:(RCTPromiseRejectBlock)reject
{
  NativeShareItem *item = [NativeShareItem new];
  item.url = [NSURL fileURLWithPath:plainPath(path)];
  item.title = title;
  dispatch_async(dispatch_get_main_queue(), ^{
    UIViewController *presenter = RCTPresentedViewController();
    if (!presenter || presenter.isBeingDismissed || presenter.presentedViewController) {
      reject(@"E_SHARE", @"Another screen is still on top", nil);
      return;
    }
    UIActivityViewController *sheet = [[UIActivityViewController alloc] initWithActivityItems:@[ item ]
                                                                        applicationActivities:nil];
    // iPad shows the sheet as a popover, which needs an anchor.
    UIPopoverPresentationController *popover = sheet.popoverPresentationController;
    if (popover) {
      popover.sourceView = presenter.view;
      popover.sourceRect = CGRectMake(CGRectGetMidX(presenter.view.bounds), CGRectGetMidY(presenter.view.bounds), 0, 0);
      popover.permittedArrowDirections = 0;
    }
    [presenter presentViewController:sheet
                            animated:YES
                          completion:^{
                            resolve(nil);
                          }];
  });
}

- (void)copyText:(NSString *)text
{
  dispatch_async(dispatch_get_main_queue(), ^{
    [UIPasteboard generalPasteboard].string = text;
  });
}

@end
