# Dark Minimal UI Redesign

## Goal

Redesign `public/index.html` with a dark, minimal, compact aesthetic — no HTML structure changes, no new dependencies. Pure CSS overhaul.

## Design decisions

- **Style:** Dark mode, rounded soft interactive elements, two-step reveal layout
- **Approach:** Replace all inline `<style>` block CSS; keep existing HTML and JS untouched
- **Contrast target:** WCAG AA (≥4.5:1 for normal text)

---

## Color palette

| Role              | Hex       | Usage                                     |
|-------------------|-----------|--------------------------------------------|
| Page background   | `#0d1117` | `<body>`                                   |
| Card/surface      | `#161b22` | Upload card, metadata card, input bg       |
| Border            | `#30363d` | Input borders, card edges                  |
| Text primary      | `#e6edf3` | Headings, body text, status messages       |
| Text secondary    | `#c9d1d9` | Labels                                     |
| Text hint         | `#8b949e` | Placeholders, non-critical hints           |
| Accent            | `#58a6ff` | Focus rings, links                         |
| Primary button    | `#1f6feb` | Preview/action buttons (text `#ffffff`)    |
| Primary hover     | `#388bfd` | Button hover state                         |
| Primary active    | `#1158c7` | Button press state                         |
| Success button    | `#238636` | Download button (text `#ffffff`)           |
| Success hover     | `#2ea043` | Download hover                             |
| Success active    | `#196c2e` | Download press                             |
| Disabled button   | `#21262d` | Disabled bg (text `#666e79`)               |
| Error             | `#f85149` | Error messages, TK/S status                |
| Info              | `#d29922` | Info status messages                       |

## Typography

- Font stack: `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` (unchanged)
- Base size: 15px
- Line height: 1.4
- Headings: compact, off-white (`#e6edf3`)

---

## Layout — two-step flow

### Step 1: Upload card

- Single centered card (`max-width: 420px`), vertically centered via flexbox on body
- Title: "DigiHC Attendance → Timesheet"
- Two custom-styled file inputs (PDF + template) — full-width rounded containers
- Preview button: wide pill (`border-radius: 24px`), 48px height
- Status line: hidden by default, appears below button on message
- All other sections hidden

### Step 2: Editor view (revealed after preview)

- Upload card compresses to a slim bar (filenames only) at top
- Metadata card: 2-column grid (label + input), each input rounded with `#0d1117` bg
- Activity table: dark rows alternating `#161b22` / `#0d1117`, sticky header, compact padding
- Table shows: Tanggal, Check-in, Check-out, Status, Aktivitas (hiding extra cols on mobile, same as current)
- Status badges: Hadir (green `#3fb950`), Libur (gray `#8b949e`), TK/Sakit (red `#f85149`)
- Download button: full-width pill, green accent

---

## Interactive elements

### Buttons
- All: `border-radius: 24px`, `border: none`, `font-weight: 600`, `cursor: pointer`
- Height: 48px, padding: 0 24px
- Transitions: `150ms ease` on background-color and box-shadow
- Disabled: `opacity: 0.6`, `cursor: not-allowed`

### Text inputs
- Background: `#0d1117`, border: `1px solid #30363d`, `border-radius: 8px`
- Height: 40px, padding: 0 12px
- Focus: border `#58a6ff`, `box-shadow: 0 0 0 2px rgba(88,166,255,0.3)`
- Placeholder: `#8b949e`
- Labels above inputs (not inline) — no overlapping text

### File inputs (custom styled)
- Container: `#161b22` bg, `1px solid #30363d`, `border-radius: 8px`
- Full width, flex layout: label text left, filename right
- Clickable entire area
- Hover: border `#58a6ff`
- Native `<input type="file">` hidden, label drives click via `for` attribute

### Table inline inputs
- Background: `#161b22`, border: `#30363d`, `border-radius: 6px`
- Height: 36px, compact
- Focus: border `#58a6ff`

### Status messages
- Full brightness text (`#e6edf3`) for all critical messages
- Error tinted red (`#f85149`), info tinted amber (`#d29922`)
- No dimming on status text

---

## Responsive behavior

- Max-width body container: 720px
- Padding: 24px on desktop, 16px on mobile (`<600px`)
- Metadata grid: 2-column on desktop, single-column stacked on mobile
- Table: same column-hiding rules as current (hide Check-in, Check-out, Project Name, Project ID, Aplikasi Terdampak, AIP Fitur on narrow screens)
- Upload card: full-width on mobile (no fixed max)

---

## What does NOT change

- HTML structure (all elements keep same IDs and hierarchy)
- JavaScript code (no changes to `server.js` or inline `<script>`)
- Server endpoints and behavior
- File input `accept` attributes and form field names

## Scope boundary

This spec covers **only `public/index.html` inline CSS replacement**. No new files, no new dependencies, no server changes.
