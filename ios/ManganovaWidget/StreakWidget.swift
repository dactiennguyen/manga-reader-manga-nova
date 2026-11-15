import SwiftUI
import WidgetKit

/// The home screen and lock screen widget: the drawing streak, today's strokes against the goal and today's
/// prompt. The app works out every text (src/core/widget/snapshot.ts) and saves it in the App Group; this only
/// picks the right day and draws it.
@main
struct ManganovaWidgets: WidgetBundle {
  var body: some Widget {
    StreakWidget()
  }
}

struct StreakWidget: Widget {
  /// Also in Manganova/WidgetReloader.swift, which asks for a redraw.
  let kind = "StreakWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: StreakProvider()) { entry in
      StreakWidgetView(entry: entry)
    }
    .configurationDisplayName("Drawing streak")
    .description("Your drawing streak, today's strokes and today's prompt.")
    .supportedFamilies([.systemSmall, .systemMedium, .accessoryCircular, .accessoryRectangular])
  }
}

struct StreakEntry: TimelineEntry {
  let date: Date
  /// Nil before the app has sent anything.
  let snapshot: WidgetSnapshot?
}

struct StreakProvider: TimelineProvider {
  func placeholder(in context: Context) -> StreakEntry {
    StreakEntry(date: Date(), snapshot: WidgetStore.sample)
  }

  func getSnapshot(in context: Context, completion: @escaping (StreakEntry) -> Void) {
    let saved = WidgetStore.load()
    completion(StreakEntry(date: Date(), snapshot: saved ?? (context.isPreview ? WidgetStore.sample : nil)))
  }

  /// Now, then the next two midnights: the snapshot already holds what those days show, so the widget rolls
  /// over without the app. After the second midnight every later day looks the same until the app sends more.
  func getTimeline(in context: Context, completion: @escaping (Timeline<StreakEntry>) -> Void) {
    let now = Date()
    let saved = WidgetStore.load()
    let calendar = WidgetSnapshot.calendar
    let midnight = calendar.startOfDay(for: now)
    var entries = [StreakEntry(date: now, snapshot: saved)]
    for offset in 1...2 {
      if let date = calendar.date(byAdding: .day, value: offset, to: midnight) {
        entries.append(StreakEntry(date: date, snapshot: saved))
      }
    }
    completion(Timeline(entries: entries, policy: .atEnd))
  }
}

// MARK: - Colours

/// The Studio tokens from global.css (light and dark). Keep in step with them and with
/// android/app/src/main/res/values/widget_colors.xml.
struct WidgetPalette {
  let bg: Color
  let card: Color
  let text: Color
  let secondary: Color
  let muted: Color
  let accent: Color
  let success: Color
  let track: Color

  static let light = WidgetPalette(
    bg: Color(hex: 0xF6EFE3), card: Color(hex: 0xFFFAF0), text: Color(hex: 0x1C1712),
    secondary: Color(hex: 0x4B4338), muted: Color(hex: 0x645A4C), accent: Color(hex: 0xBF3419),
    success: Color(hex: 0x1D6A40), track: Color(hex: 0xDDD1BD))

  static let dark = WidgetPalette(
    bg: Color(hex: 0x15120E), card: Color(hex: 0x1F1B16), text: Color(hex: 0xF6EFE3),
    secondary: Color(hex: 0xCFC5B4), muted: Color(hex: 0xACA190), accent: Color(hex: 0xFF7A5C),
    success: Color(hex: 0x86D29A), track: Color(hex: 0x40392F))

  /// The app's theme choice wins; "system" follows the phone.
  static func of(theme: String?, scheme: ColorScheme) -> WidgetPalette {
    switch theme {
    case "light": return light
    case "dark": return dark
    default: return scheme == .dark ? dark : light
    }
  }
}

extension Color {
  init(hex: UInt32) {
    self.init(
      .sRGB,
      red: Double((hex >> 16) & 0xFF) / 255,
      green: Double((hex >> 8) & 0xFF) / 255,
      blue: Double(hex & 0xFF) / 255,
      opacity: 1)
  }
}

// MARK: - Views

private let homeURL = URL(string: "manganova://widget")!
private let promptURL = URL(string: "manganova://widget/prompt")!

struct StreakWidgetView: View {
  @Environment(\.widgetFamily) private var family
  @Environment(\.colorScheme) private var scheme
  let entry: StreakEntry

  var body: some View {
    let palette = WidgetPalette.of(theme: entry.snapshot?.theme, scheme: scheme)
    let day = entry.snapshot?.day(on: entry.date)
    Group {
      switch family {
      case .accessoryCircular:
        CircularView(day: day)
      case .accessoryRectangular:
        RectangularView(snapshot: entry.snapshot, day: day)
      case .systemMedium:
        HStack(spacing: 12) {
          StreakColumn(snapshot: entry.snapshot, day: day, palette: palette, wide: true)
            .frame(width: 112)
          Link(destination: promptURL) {
            PromptCard(snapshot: entry.snapshot, day: day, palette: palette)
          }
        }
      default:
        StreakColumn(snapshot: entry.snapshot, day: day, palette: palette, wide: false)
      }
    }
    .widgetURL(homeURL)
    .widgetBackground(isAccessory ? nil : palette.bg)
  }

  private var isAccessory: Bool {
    family == .accessoryCircular || family == .accessoryRectangular
  }
}

/// The flame, the streak, a caption (or a nudge to draw), the goal bar and today's strokes.
struct StreakColumn: View {
  let snapshot: WidgetSnapshot?
  let day: WidgetDay?
  let palette: WidgetPalette
  let wide: Bool

  var body: some View {
    let drawn = day?.drawn ?? 0
    VStack(alignment: .leading, spacing: 4) {
      Image(drawn > 0 ? "Flame" : "FlameOutline")
        .renderingMode(.template)
        .resizable()
        .frame(width: 24, height: 24)
        .foregroundColor(drawn > 0 ? palette.accent : palette.muted)
        .accessibilityHidden(true)
      if let snapshot, let day {
        Text(verbatim: day.streakText)
          .font(.system(size: 20, weight: .semibold))
          .monospacedDigit()
          .foregroundColor(palette.text)
          .lineLimit(1)
          .minimumScaleFactor(0.7)
        Text(verbatim: day.nudge.isEmpty ? snapshot.streakTitle : day.nudge)
          .font(.system(size: 12))
          .foregroundColor(palette.muted)
          .lineLimit(3)
        Spacer(minLength: 0)
        if day.goal > 0 {
          GoalBar(progress: day.progress, color: day.goalMet ? palette.success : palette.accent, track: palette.track)
        }
        Text(verbatim: day.progressText)
          .font(.system(size: 12, weight: .medium))
          .foregroundColor(day.goalMet ? palette.success : palette.secondary)
          .lineLimit(1)
          .minimumScaleFactor(0.8)
      } else {
        Text(verbatim: "0")
          .font(.system(size: 20, weight: .semibold))
          .foregroundColor(palette.text)
        Text(wide ? "Drawing streak" : "Open Manganova to start your drawing streak.")
          .font(.system(size: 12))
          .foregroundColor(palette.muted)
          .lineLimit(3)
        Spacer(minLength: 0)
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
  }
}

struct GoalBar: View {
  let progress: Double
  let color: Color
  let track: Color

  var body: some View {
    GeometryReader { geometry in
      ZStack(alignment: .leading) {
        Capsule().fill(track)
        Capsule().fill(color).frame(width: geometry.size.width * min(1, max(0, progress)))
      }
    }
    .frame(height: 4)
    .padding(.vertical, 2)
    .accessibilityHidden(true)
  }
}

/// Today's prompt on a card. A tap here starts it in the app.
struct PromptCard: View {
  let snapshot: WidgetSnapshot?
  let day: WidgetDay?
  let palette: WidgetPalette

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      if let snapshot, let day {
        Text(verbatim: snapshot.promptTitle)
          .font(.system(size: 14, weight: .semibold))
          .foregroundColor(palette.text)
          .lineLimit(1)
        Text(verbatim: day.prompt.isEmpty ? snapshot.promptMissing : day.prompt)
          .font(.system(size: 14))
          .foregroundColor(palette.secondary)
          .lineLimit(4)
        Spacer(minLength: 0)
        if !day.promptDone.isEmpty {
          Text(verbatim: day.promptDone)
            .font(.system(size: 12, weight: .medium))
            .foregroundColor(palette.success)
            .lineLimit(1)
        }
      } else {
        Text("Today's prompt")
          .font(.system(size: 14, weight: .semibold))
          .foregroundColor(palette.text)
          .lineLimit(1)
        Text("Open Manganova to start your drawing streak.")
          .font(.system(size: 14))
          .foregroundColor(palette.secondary)
          .lineLimit(4)
        Spacer(minLength: 0)
      }
    }
    .padding(12)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(palette.card))
  }
}

/// Lock screen, round: the streak in the middle of a ring that fills toward the daily goal.
struct CircularView: View {
  let day: WidgetDay?

  var body: some View {
    let streak = day?.streak ?? 0
    if let day, day.goal > 0 {
      Gauge(value: min(1, max(0, day.progress))) {
        Image("Flame").renderingMode(.template)
      } currentValueLabel: {
        Text(verbatim: "\(streak)").monospacedDigit()
      }
      .gaugeStyle(.accessoryCircularCapacity)
      .widgetAccentable()
    } else {
      ZStack {
        AccessoryWidgetBackground()
        VStack(spacing: 0) {
          Image("Flame")
            .renderingMode(.template)
            .resizable()
            .frame(width: 14, height: 14)
            .widgetAccentable()
          Text(verbatim: "\(streak)")
            .font(.system(size: 20, weight: .semibold))
            .monospacedDigit()
        }
      }
    }
  }
}

/// Lock screen, wide: the streak, today's strokes, and the caption or nudge.
struct RectangularView: View {
  let snapshot: WidgetSnapshot?
  let day: WidgetDay?

  var body: some View {
    VStack(alignment: .leading, spacing: 1) {
      HStack(spacing: 4) {
        Image("Flame")
          .renderingMode(.template)
          .resizable()
          .frame(width: 14, height: 14)
        if let day {
          Text(verbatim: day.streakText).monospacedDigit()
        } else {
          Text(verbatim: "0")
        }
      }
      .font(.headline)
      .widgetAccentable()
      if let snapshot, let day {
        Text(verbatim: day.progressText)
          .font(.caption)
          .lineLimit(1)
        Text(verbatim: day.nudge.isEmpty ? snapshot.streakTitle : day.nudge)
          .font(.caption2)
          .foregroundStyle(.secondary)
          .lineLimit(1)
      } else {
        Text("Open Manganova to start your drawing streak.")
          .font(.caption)
          .lineLimit(2)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

extension View {
  /// iOS 17 draws the widget background itself and adds the margins; iOS 16 needs both done here.
  @ViewBuilder
  func widgetBackground(_ color: Color?) -> some View {
    if #available(iOSApplicationExtension 17.0, *) {
      containerBackground(for: .widget) { color ?? Color.clear }
    } else if let color {
      padding().background(color)
    } else {
      self
    }
  }
}
