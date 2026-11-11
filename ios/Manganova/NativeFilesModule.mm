#import <AVFoundation/AVFoundation.h>
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

/** Implements specs/NativeFiles.ts on iOS: zip/unzip, images to PDF or video, sharing and clipboard. */
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

- (void)framesToVideo:(NSArray *)framePaths
              outPath:(NSString *)outPath
                  fps:(double)fps
              resolve:(RCTPromiseResolveBlock)resolve
               reject:(RCTPromiseRejectBlock)reject
{
  NSArray<NSString *> *paths = [framePaths copy];
  int32_t rate = (int32_t)MAX(1, MIN(60, fps));
  dispatch_async(_queue, ^{
    UIImage *first = [UIImage imageWithContentsOfFile:paths.firstObject];
    // H.264 needs even sides.
    size_t width = first ? CGImageGetWidth(first.CGImage) & ~(size_t)1 : 0;
    size_t height = first ? CGImageGetHeight(first.CGImage) & ~(size_t)1 : 0;
    if (width == 0 || height == 0) {
      reject(@"E_VIDEO", @"The first frame can't be read.", nil);
      return;
    }
    NSFileManager *files = [NSFileManager defaultManager];
    [files createDirectoryAtPath:[outPath stringByDeletingLastPathComponent]
        withIntermediateDirectories:YES
                         attributes:nil
                              error:nil];
    [files removeItemAtPath:outPath error:nil];

    NSError *error = nil;
    AVAssetWriter *writer = [AVAssetWriter assetWriterWithURL:[NSURL fileURLWithPath:outPath]
                                                     fileType:AVFileTypeMPEG4
                                                        error:&error];
    if (!writer) {
      reject(@"E_VIDEO", error.localizedDescription, error);
      return;
    }
    AVAssetWriterInput *input =
        [AVAssetWriterInput assetWriterInputWithMediaType:AVMediaTypeVideo
                                           outputSettings:@{
                                             AVVideoCodecKey : AVVideoCodecTypeH264,
                                             AVVideoWidthKey : @(width),
                                             AVVideoHeightKey : @(height),
                                           }];
    input.expectsMediaDataInRealTime = NO;
    AVAssetWriterInputPixelBufferAdaptor *adaptor = [AVAssetWriterInputPixelBufferAdaptor
        assetWriterInputPixelBufferAdaptorWithAssetWriterInput:input
                                   sourcePixelBufferAttributes:@{
                                     (id)kCVPixelBufferPixelFormatTypeKey : @(kCVPixelFormatType_32BGRA),
                                     (id)kCVPixelBufferWidthKey : @(width),
                                     (id)kCVPixelBufferHeightKey : @(height),
                                     (id)kCVPixelBufferCGBitmapContextCompatibilityKey : @YES,
                                   }];
    [writer addInput:input];
    if (![writer startWriting]) {
      reject(@"E_VIDEO", writer.error.localizedDescription, writer.error);
      return;
    }
    [writer startSessionAtSourceTime:kCMTimeZero];

    CGColorSpaceRef space = CGColorSpaceCreateDeviceRGB();
    NSString *lastPath = nil;
    UIImage *image = nil;
    BOOL failed = NO;
    for (NSUInteger i = 0; i < paths.count && !failed; i++) {
      @autoreleasepool {
        if (![paths[i] isEqualToString:lastPath]) {
          image = [UIImage imageWithContentsOfFile:paths[i]];
          lastPath = paths[i];
        }
        while (!input.readyForMoreMediaData && writer.status == AVAssetWriterStatusWriting) {
          [NSThread sleepForTimeInterval:0.005];
        }
        CVPixelBufferRef buffer = NULL;
        if (!image || writer.status != AVAssetWriterStatusWriting ||
            CVPixelBufferPoolCreatePixelBuffer(NULL, adaptor.pixelBufferPool, &buffer) != kCVReturnSuccess) {
          failed = YES;
        } else {
          CVPixelBufferLockBaseAddress(buffer, 0);
          CGContextRef context = CGBitmapContextCreate(
              CVPixelBufferGetBaseAddress(buffer), width, height, 8, CVPixelBufferGetBytesPerRow(buffer), space,
              (CGBitmapInfo)kCGImageAlphaNoneSkipFirst | kCGBitmapByteOrder32Little);
          CGContextDrawImage(context, CGRectMake(0, 0, width, height), image.CGImage);
          CGContextRelease(context);
          CVPixelBufferUnlockBaseAddress(buffer, 0);
          failed = ![adaptor appendPixelBuffer:buffer withPresentationTime:CMTimeMake((int64_t)i, rate)];
        }
        CVPixelBufferRelease(buffer);
      }
    }
    CGColorSpaceRelease(space);

    if (failed) {
      [writer cancelWriting];
      [files removeItemAtPath:outPath error:nil];
      reject(@"E_VIDEO", writer.error.localizedDescription ?: @"A frame can't be read.", writer.error);
      return;
    }
    [input markAsFinished];
    // Gives the last frame its full length.
    [writer endSessionAtSourceTime:CMTimeMake((int64_t)paths.count, rate)];
    dispatch_semaphore_t done = dispatch_semaphore_create(0);
    [writer finishWritingWithCompletionHandler:^{
      dispatch_semaphore_signal(done);
    }];
    dispatch_semaphore_wait(done, DISPATCH_TIME_FOREVER);
    if (writer.status == AVAssetWriterStatusCompleted) {
      resolve(nil);
    } else {
      [files removeItemAtPath:outPath error:nil];
      reject(@"E_VIDEO", writer.error.localizedDescription, writer.error);
    }
  });
}

/** Runs an export to the end on the calling (background) queue. */
static NSError *runExport(AVAssetExportSession *session)
{
  dispatch_semaphore_t done = dispatch_semaphore_create(0);
  [session exportAsynchronouslyWithCompletionHandler:^{
    dispatch_semaphore_signal(done);
  }];
  dispatch_semaphore_wait(done, DISPATCH_TIME_FOREVER);
  if (session.status == AVAssetExportSessionStatusCompleted) {
    return nil;
  }
  return session.error ?: [NSError errorWithDomain:@"NativeFiles"
                                              code:1
                                          userInfo:@{NSLocalizedDescriptionKey : @"The export did not finish."}];
}

- (void)concatAudio:(NSArray *)paths
            outPath:(NSString *)outPath
              gapMs:(double)gapMs
            resolve:(RCTPromiseResolveBlock)resolve
             reject:(RCTPromiseRejectBlock)reject
{
  NSArray<NSString *> *clips = [paths copy];
  dispatch_async(_queue, ^{
    AVMutableComposition *composition = [AVMutableComposition composition];
    AVMutableCompositionTrack *track = [composition addMutableTrackWithMediaType:AVMediaTypeAudio
                                                                preferredTrackID:kCMPersistentTrackID_Invalid];
    CMTime cursor = kCMTimeZero;
    CMTime gap = CMTimeMakeWithSeconds(MAX(0, gapMs) / 1000.0, 44100);
    NSInteger used = 0;
    for (NSString *path in clips) {
      AVURLAsset *asset = [AVURLAsset URLAssetWithURL:[NSURL fileURLWithPath:plainPath(path)] options:nil];
      AVAssetTrack *source = [asset tracksWithMediaType:AVMediaTypeAudio].firstObject;
      if (!source) {
        continue;
      }
      if (used > 0 && CMTimeCompare(gap, kCMTimeZero) > 0) {
        [track insertEmptyTimeRange:CMTimeRangeMake(cursor, gap)];
        cursor = CMTimeAdd(cursor, gap);
      }
      CMTimeRange range = CMTimeRangeMake(kCMTimeZero, asset.duration);
      if ([track insertTimeRange:range ofTrack:source atTime:cursor error:nil]) {
        cursor = CMTimeAdd(cursor, asset.duration);
        used += 1;
      }
    }
    if (used == 0) {
      reject(@"E_AUDIO", @"No clip could be read.", nil);
      return;
    }
    makeParent(outPath);
    [[NSFileManager defaultManager] removeItemAtPath:outPath error:nil];
    AVAssetExportSession *session = [AVAssetExportSession exportSessionWithAsset:composition
                                                                      presetName:AVAssetExportPresetAppleM4A];
    session.outputURL = [NSURL fileURLWithPath:outPath];
    session.outputFileType = AVFileTypeAppleM4A;
    NSError *error = runExport(session);
    if (error) {
      [[NSFileManager defaultManager] removeItemAtPath:outPath error:nil];
      reject(@"E_AUDIO", error.localizedDescription, error);
    } else {
      resolve(@(used));
    }
  });
}

- (void)addAudioToVideo:(NSString *)videoPath
              audioPath:(NSString *)audioPath
                outPath:(NSString *)outPath
                resolve:(RCTPromiseResolveBlock)resolve
                 reject:(RCTPromiseRejectBlock)reject
{
  dispatch_async(_queue, ^{
    AVURLAsset *video = [AVURLAsset URLAssetWithURL:[NSURL fileURLWithPath:plainPath(videoPath)] options:nil];
    AVURLAsset *audio = [AVURLAsset URLAssetWithURL:[NSURL fileURLWithPath:plainPath(audioPath)] options:nil];
    AVAssetTrack *videoSource = [video tracksWithMediaType:AVMediaTypeVideo].firstObject;
    AVAssetTrack *audioSource = [audio tracksWithMediaType:AVMediaTypeAudio].firstObject;
    if (!videoSource || !audioSource) {
      reject(@"E_VIDEO", @"The video or the audio can't be read.", nil);
      return;
    }
    AVMutableComposition *composition = [AVMutableComposition composition];
    AVMutableCompositionTrack *videoTrack =
        [composition addMutableTrackWithMediaType:AVMediaTypeVideo preferredTrackID:kCMPersistentTrackID_Invalid];
    AVMutableCompositionTrack *audioTrack =
        [composition addMutableTrackWithMediaType:AVMediaTypeAudio preferredTrackID:kCMPersistentTrackID_Invalid];
    CMTime length = video.duration;
    NSError *error = nil;
    [videoTrack insertTimeRange:CMTimeRangeMake(kCMTimeZero, length) ofTrack:videoSource atTime:kCMTimeZero error:&error];
    CMTime heard = CMTimeMinimum(length, audio.duration);
    if (!error) {
      [audioTrack insertTimeRange:CMTimeRangeMake(kCMTimeZero, heard) ofTrack:audioSource atTime:kCMTimeZero error:&error];
    }
    if (error) {
      reject(@"E_VIDEO", error.localizedDescription, error);
      return;
    }
    videoTrack.preferredTransform = videoSource.preferredTransform;
    makeParent(outPath);
    [[NSFileManager defaultManager] removeItemAtPath:outPath error:nil];
    AVAssetExportSession *session = [AVAssetExportSession exportSessionWithAsset:composition
                                                                      presetName:AVAssetExportPresetPassthrough];
    session.outputURL = [NSURL fileURLWithPath:outPath];
    session.outputFileType = AVFileTypeMPEG4;
    error = runExport(session);
    if (error) {
      [[NSFileManager defaultManager] removeItemAtPath:outPath error:nil];
      reject(@"E_VIDEO", error.localizedDescription, error);
    } else {
      resolve(nil);
    }
  });
}

- (void)copyText:(NSString *)text
{
  dispatch_async(dispatch_get_main_queue(), ^{
    [UIPasteboard generalPasteboard].string = text;
  });
}

@end
