import Foundation
import WidgetKit

/// Asks WidgetKit to redraw the streak widget after the app saved new data. Called from NativeWidgetModule.mm,
/// which declares this class in WidgetReloader.h.
@objc(ManganovaWidgetReloader)
final class WidgetReloader: NSObject {
  /// The `kind` of the widget in ManganovaWidget/StreakWidget.swift.
  private static let kind = "StreakWidget"

  @objc static func reloadAll() {
    WidgetCenter.shared.reloadTimelines(ofKind: kind)
  }
}
