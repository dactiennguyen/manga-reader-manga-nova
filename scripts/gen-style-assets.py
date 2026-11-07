#!/usr/bin/env python3
"""Draws the palette and icon sheets in docs/style from global.css and src/ui/icons.ts."""
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'docs/style')
DEFS = os.path.join(ROOT, 'node_modules/phosphor-react-native/src/defs')
FONT = "font-family='Inter, Helvetica, Arial, sans-serif'"

GROUPS = [
    ('Điều hướng', ['HomeIcon', 'LibraryIcon', 'AiIcon', 'UserIcon', 'PlusIcon', 'BackIcon', 'MoreIcon', 'SearchIcon']),
    ('Công cụ vẽ', ['GPenIcon', 'PencilToolIcon', 'BrushIcon', 'EraserIcon', 'ShapesIcon', 'FillIcon', 'MoveIcon', 'EyedropperIcon']),
    ('Trang và khung', ['PanelsIcon', 'TemplatesIcon', 'CutIcon', 'MergeIcon', 'LayersIcon', 'PanelFrameIcon', 'GridIcon', 'FitIcon']),
    ('Lời thoại', ['BubbleIcon', 'NoteIcon', 'SfxIcon', 'EffectIcon', 'TranslateIcon', 'BoldIcon', 'OrderIcon', 'VoiceIcon']),
    ('Thao tác', ['UndoIcon', 'RedoIcon', 'PreviewIcon', 'ExportIcon', 'ShareIcon', 'DeleteIcon', 'DoneIcon', 'FlagIcon']),
]


def palette():
    css = open(os.path.join(ROOT, 'global.css')).read()
    out = {}
    for variant in ('dark', 'light'):
        block = re.search(r'@variant %s \{([^}]*)\}' % variant, css).group(1)
        out[variant] = dict(re.findall(r'--color-([a-z-]+):\s*(#[0-9a-f]{6})', block))
    return out


def registry():
    text = open(os.path.join(ROOT, 'src/ui/icons.ts')).read()
    return {name: glyph for glyph, name in re.findall(r"export \{ (\w+)Icon as (\w+) \}", text)}


def glyph(name, weight):
    text = open(os.path.join(DEFS, name + '.tsx')).read()
    match = re.search(r"'%s',\s*(?:\([^)]*\)\s*=>\s*\(\s*)?<>(.*?)</>" % weight, text, re.S)
    paths = []
    for tag in re.findall(r'<Path\b(.*?)/>', match.group(1), re.S):
        d = re.search(r'd="([^"]+)"', tag).group(1)
        paths.append((d, 'opacity' in tag))
    return paths


def icon(name, weight, x, y, size, color):
    body = ''.join(
        "<path d='%s'%s/>" % (d, " opacity='.2'" if faint else '') for d, faint in glyph(name, weight)
    )
    return "<g transform='translate(%g %g) scale(%g)' fill='%s'>%s</g>" % (x, y, size / 256, color, body)


def text(x, y, value, size, color, weight=400, anchor='start'):
    return "<text x='%g' y='%g' %s font-size='%g' font-weight='%d' fill='%s' text-anchor='%s'>%s</text>" % (
        x, y, FONT, size, weight, color, anchor, value)


def save(name, width, height, bg, body):
    svg = (
        "<svg xmlns='http://www.w3.org/2000/svg' width='%d' height='%d' viewBox='0 0 %d %d'>"
        "<rect width='%d' height='%d' rx='20' fill='%s'/>%s</svg>\n" % (width, height, width, height, width, height, bg, body)
    )
    open(os.path.join(OUT, name), 'w').write(svg)


def luminance(color):
    channels = [int(color[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    r, g, b = [c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4 for c in channels]
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def swatch(x, y, w, h, name, color):
    ink = '#1C1712' if luminance(color) > 0.3 else '#F6EFE3'
    return (
        "<rect x='%g' y='%g' width='%g' height='%g' rx='12' fill='%s' stroke='#7A7E88' stroke-opacity='.35'/>" % (x, y, w, h, color)
        + text(x + 14, y + h - 32, name, 14, ink, 600)
        + text(x + 14, y + h - 13, color.upper(), 12, ink)
    )


def palette_sheet(colors, variant, title, bg, ink):
    c = colors[variant]
    rows = [
        ('Tầng bề mặt, thấp lên cao', ['bg', 'surface', 'raised', 'overlay']),
        ('Chữ', ['text', 'text-secondary', 'text-muted', 'control-border']),
        ('Màu nhấn và trạng thái', ['accent', 'ai', 'success', 'warning', 'danger']),
    ]
    width, pad, gap, h = 960, 32, 12, 104
    body = text(pad, 46, title, 22, ink, 700)
    y = 72
    for label, names in rows:
        body += text(pad, y + 14, label, 13, ink, 500)
        y += 26
        w = (width - pad * 2 - gap * (len(names) - 1)) / len(names)
        for i, name in enumerate(names):
            body += swatch(pad + i * (w + gap), y, w, h, name, c[name])
        y += h + 22
    save('palette-%s.svg' % variant, width, y + 10, bg, body)


def icon_sheet(colors, names):
    c = colors['dark']
    width, pad, cell = 960, 32, 112
    body = text(pad, 46, 'Bộ icon: Phosphor regular', 22, c['text'], 700)
    y = 76
    for label, group in GROUPS:
        body += text(pad, y + 12, label, 13, c['text-muted'], 500)
        y += 26
        for i, name in enumerate(group):
            x = pad + i * cell
            body += "<rect x='%g' y='%g' width='%g' height='88' rx='12' fill='%s'/>" % (x, y, cell - 10, c['raised'])
            body += icon(names[name], 'regular', x + (cell - 10) / 2 - 15, y + 13, 30, c['text'])
            body += text(x + (cell - 10) / 2, y + 70, name[:-4], 11, c['text-secondary'], 500, 'middle')
        y += 88 + 24
    save('icons.svg', width, y + 6, c['surface'], body)


def weight_sheet(colors, names):
    c = colors['dark']
    width, pad = 960, 32
    rows = [
        ('regular', 'Mặc định', c['text-secondary'], c['raised']),
        ('fill', 'Đang chọn', c['accent'], c['overlay']),
        ('duotone', 'Minh họa lớn', c['accent'], c['raised']),
    ]
    sample = ['GPenIcon', 'HomeIcon', 'BubbleIcon', 'LayersIcon', 'FlagIcon', 'DeleteIcon']
    body = text(pad, 46, 'Độ đậm nói lên trạng thái', 22, c['text'], 700)
    y = 70
    for weight, label, color, tile in rows:
        body += text(pad, y + 34, weight, 15, c['text'], 600) + text(pad, y + 54, label, 12, c['text-muted'])
        for i, name in enumerate(sample):
            x = 212 + i * 118
            body += "<rect x='%g' y='%g' width='104' height='72' rx='14' fill='%s'/>" % (x, y, tile)
            body += icon(names[name], weight, x + 36, y + 20, 32, color)
        y += 84
    save('icon-weights.svg', width, y + 16, c['surface'], body)


def main():
    os.makedirs(OUT, exist_ok=True)
    colors = palette()
    names = registry()
    palette_sheet(colors, 'dark', 'Nền mực, giao diện mặc định', colors['dark']['surface'], colors['dark']['text'])
    palette_sheet(colors, 'light', 'Nền giấy', colors['light']['surface'], colors['light']['text'])
    icon_sheet(colors, names)
    weight_sheet(colors, names)


if __name__ == '__main__':
    main()
