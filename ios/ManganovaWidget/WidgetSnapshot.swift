import Foundation

/// One day as the widget shows it. Mirrors `WidgetDay` in src/core/widget/snapshot.ts.
struct WidgetDay: Codable {
  let streak: Int
  let streakText: String
  let drawn: Int
  let goal: Int
  let progress: Double
  let goalMet: Bool
  let progressText: String
  let nudge: String
  let prompt: String
  let promptDone: String
}

/// What the app last sent: every text is already in the app's language. Mirrors `WidgetSnapshot` in
/// src/core/widget/snapshot.ts.
struct WidgetSnapshot: Codable {
  let version: Int
  let day: String
  let theme: String
  let streakTitle: String
  let promptTitle: String
  let promptMissing: String
  let today: WidgetDay
  let tomorrow: WidgetDay
  let later: WidgetDay

  /// The app's day keys are Gregorian dates in local time, whatever calendar the phone uses.
  static var calendar: Calendar {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = .current
    return calendar
  }

  static func dayKey(_ date: Date) -> String {
    let parts = calendar.dateComponents([.year, .month, .day], from: date)
    return String(format: "%04d-%02d-%02d", parts.year ?? 0, parts.month ?? 0, parts.day ?? 0)
  }

  /// The snapshot's day, the next day or any later day, as `widgetDayFor` does in the app.
  func day(on date: Date) -> WidgetDay {
    let now = Self.dayKey(date)
    if now <= day {
      return today
    }
    let parts = day.split(separator: "-").compactMap { Int($0) }
    guard parts.count == 3,
      let start = Self.calendar.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2], hour: 12)),
      let next = Self.calendar.date(byAdding: .day, value: 1, to: start)
    else {
      return later
    }
    return Self.dayKey(next) == now ? tomorrow : later
  }
}

enum WidgetStore {
  /// Shared with the app (NativeWidgetModule.mm). Both targets have this App Group.
  static let appGroup = "group.com.manganova.manga.reader.org"
  static let snapshotKey = "widget.snapshot"

  static func load() -> WidgetSnapshot? {
    guard let text = UserDefaults(suiteName: appGroup)?.string(forKey: snapshotKey),
      let data = text.data(using: .utf8)
    else {
      return nil
    }
    return try? JSONDecoder().decode(WidgetSnapshot.self, from: data)
  }

  /// For the widget gallery before the app has sent anything, in the phone's language.
  static var sample: WidgetSnapshot {
    let day = WidgetDay(
      streak: 7,
      streakText: String(localized: "7 days"),
      drawn: 40,
      goal: 100,
      progress: 0.4,
      goalMet: false,
      progressText: String(localized: "40/100 today"),
      nudge: "",
      prompt: String(localized: "Draw a cat that thinks it is the main character."),
      promptDone: ""
    )
    return WidgetSnapshot(
      version: 1,
      day: WidgetSnapshot.dayKey(Date()),
      theme: "system",
      streakTitle: String(localized: "Drawing streak"),
      promptTitle: String(localized: "Today's prompt"),
      promptMissing: String(localized: "Open Manganova to start your drawing streak."),
      today: day,
      tomorrow: day,
      later: day
    )
  }
}
