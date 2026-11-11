#import <AVFoundation/AVFoundation.h>
#import <ManganovaSpecs/ManganovaSpecs.h>
#import <React/RCTInvalidating.h>

/**
 * Implements specs/NativeSpeech.ts on iOS with AVSpeechSynthesizer: the voices installed on the device, no
 * network. One line is read at a time; a new line or stop() settles the line before it with NO.
 */
@interface NativeSpeechModule : NSObject <NativeSpeechSpec, AVSpeechSynthesizerDelegate, RCTInvalidating>
@end

@implementation NativeSpeechModule {
  AVSpeechSynthesizer *_synth;
  AVSpeechUtterance *_current;
  RCTPromiseResolveBlock _resolve;
}

RCT_EXPORT_MODULE(NativeSpeech)

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

/** The synthesizer and its delegate live on the main queue, so every call is serialised there. */
- (dispatch_queue_t)methodQueue
{
  return dispatch_get_main_queue();
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:(const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeSpeechSpecJSI>(params);
}

- (AVSpeechSynthesizer *)synth
{
  if (!_synth) {
    _synth = [AVSpeechSynthesizer new];
    _synth.delegate = self;
  }
  return _synth;
}

static BOOL usable(AVSpeechSynthesisVoice *voice)
{
  if (@available(iOS 17.0, *)) {
    // Novelty voices (bells, whispers) and the person's own cloned voice are not for reading a story.
    if (voice.voiceTraits & (AVSpeechSynthesisVoiceTraitIsNoveltyVoice | AVSpeechSynthesisVoiceTraitIsPersonalVoice)) {
      return NO;
    }
  }
  return YES;
}

static NSArray<AVSpeechSynthesisVoice *> *voicesFor(NSString *language)
{
  NSString *wanted = [[language componentsSeparatedByString:@"-"].firstObject lowercaseString];
  NSMutableArray<AVSpeechSynthesisVoice *> *list = [NSMutableArray new];
  for (AVSpeechSynthesisVoice *voice in [AVSpeechSynthesisVoice speechVoices]) {
    NSString *code = [[voice.language componentsSeparatedByString:@"-"].firstObject lowercaseString];
    if ([code isEqualToString:wanted] && usable(voice)) {
      [list addObject:voice];
    }
  }
  [list sortUsingComparator:^NSComparisonResult(AVSpeechSynthesisVoice *a, AVSpeechSynthesisVoice *b) {
    return a.quality == b.quality ? NSOrderedSame : (a.quality > b.quality ? NSOrderedAscending : NSOrderedDescending);
  }];
  return list;
}

/** The same scale as Android: 300 normal, 400 enhanced, 500 premium. */
static NSInteger qualityScore(AVSpeechSynthesisVoiceQuality quality)
{
  if (quality == AVSpeechSynthesisVoiceQualityEnhanced) {
    return 400;
  }
  if (@available(iOS 16.0, *)) {
    if (quality == AVSpeechSynthesisVoiceQualityPremium) {
      return 500;
    }
  }
  return 300;
}

static NSString *genderName(AVSpeechSynthesisVoice *voice)
{
  switch (voice.gender) {
    case AVSpeechSynthesisVoiceGenderMale:
      return @"male";
    case AVSpeechSynthesisVoiceGenderFemale:
      return @"female";
    default:
      return @"";
  }
}

- (void)isAvailable:(NSString *)language resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  resolve(@(voicesFor(language).count > 0));
}

- (void)voices:(NSString *)language resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  NSMutableArray *result = [NSMutableArray new];
  for (AVSpeechSynthesisVoice *voice in voicesFor(language)) {
    [result addObject:@{
      @"id" : voice.identifier,
      @"name" : voice.name,
      @"language" : voice.language,
      @"quality" : @(qualityScore(voice.quality)),
      @"gender" : genderName(voice),
    }];
  }
  resolve(result);
}

/** Settles the line being read, if any. Its delegate call that comes later finds nothing to settle. */
- (void)settle:(BOOL)finished
{
  RCTPromiseResolveBlock resolve = _resolve;
  _current = nil;
  _resolve = nil;
  if (resolve) {
    resolve(@(finished));
  }
}

- (void)speak:(NSString *)utteranceId
         text:(NSString *)text
     language:(NSString *)language
        pitch:(double)pitch
         rate:(double)rate
      voiceId:(NSString *)voiceId
      resolve:(RCTPromiseResolveBlock)resolve
       reject:(RCTPromiseRejectBlock)reject
{
  AVSpeechSynthesisVoice *voice = voiceId ? [AVSpeechSynthesisVoice voiceWithIdentifier:voiceId] : nil;
  if (!voice) {
    voice = [AVSpeechSynthesisVoice voiceWithLanguage:language] ?: voicesFor(language).firstObject;
  }
  if (!voice) {
    reject(@"E_NO_VOICE", [NSString stringWithFormat:@"No voice for %@ on this device.", language], nil);
    return;
  }
  [self settle:NO];
  if (self.synth.isSpeaking) {
    [self.synth stopSpeakingAtBoundary:AVSpeechBoundaryImmediate];
  }

  // Playback is heard with the silent switch on, like any audiobook.
  AVAudioSession *session = [AVAudioSession sharedInstance];
  [session setCategory:AVAudioSessionCategoryPlayback mode:AVAudioSessionModeSpokenAudio options:0 error:nil];
  [session setActive:YES error:nil];

  AVSpeechUtterance *utterance = [AVSpeechUtterance speechUtteranceWithString:text];
  utterance.voice = voice;
  utterance.pitchMultiplier = (float)MAX(0.5, MIN(2.0, pitch));
  float speed = AVSpeechUtteranceDefaultSpeechRate * (float)rate;
  utterance.rate = MAX(AVSpeechUtteranceMinimumSpeechRate, MIN(AVSpeechUtteranceMaximumSpeechRate, speed));
  _current = utterance;
  _resolve = resolve;
  [self.synth speakUtterance:utterance];
}

- (void)stop
{
  [self settle:NO];
  if (_synth.isSpeaking) {
    [_synth stopSpeakingAtBoundary:AVSpeechBoundaryImmediate];
  }
  [[AVAudioSession sharedInstance] setActive:NO
                                 withOptions:AVAudioSessionSetActiveOptionNotifyOthersOnDeactivation
                                       error:nil];
}

- (void)speechSynthesizer:(AVSpeechSynthesizer *)synthesizer didFinishSpeechUtterance:(AVSpeechUtterance *)utterance
{
  if (utterance == _current) {
    [self settle:YES];
  }
}

- (void)speechSynthesizer:(AVSpeechSynthesizer *)synthesizer didCancelSpeechUtterance:(AVSpeechUtterance *)utterance
{
  if (utterance == _current) {
    [self settle:NO];
  }
}

- (void)invalidate
{
  dispatch_async(dispatch_get_main_queue(), ^{
    [self stop];
    self->_synth.delegate = nil;
    self->_synth = nil;
  });
}

@end
