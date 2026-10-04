# DivaCrew: UI Design System

## Visual Reference
The target UI is warm, editorial, and Gen-Z — feels like a premium zine crossed with a community app. Think Glossier meets Discord.

## Colour Palette

### Light Mode (default)
- **Background**: `#F5EFE8` — warm off-white/cream
- **Surface (cards)**: `#FFFFFF` or `#FAF5F0` — slightly warmer white
- **Surface dark (hero cards)**: `#1A1A1A` — near-black charcoal
- **Surface blush (secondary cards)**: `#F9E8E3` — soft blush pink
- **Accent / Primary**: `#B94A3C` — muted terracotta / brick red
- **Accent light**: `#E8A090` — lighter terracotta for icons and chips
- **Active / Success**: `#2D5A45` — deep forest green (used for "I'm good" status, selected nav)
- **Text primary**: `#1A1A1A` — near-black
- **Text secondary**: `#6B5F58` — warm mid-grey
- **Text on dark**: `#F5EFE8` — cream on dark cards
- **Border / Divider**: `#E8DDD6` — warm light grey
- **Red / SOS**: `#B94A3C` — same as accent, used for SOS card and danger states

### Dark Mode
- Invert: background becomes `#1A1A1A`, surfaces become `#252220`, text becomes `#F5EFE8`
- Accent and green remain the same
- Cards use `#2A2522` for surface

## Typography

### Fonts
- **Headlines**: Bold serif font — Playfair Display Bold or DM Serif Display. Large, impactful. Used for screen titles and hero text.
- **Labels / Categories**: Small caps, letter-spaced, uppercase — e.g. `font-size: 11px, letter-spacing: 0.12em, font-weight: 600`. Used for section labels like "SAFETY FIRST, ALWAYS" or "YOUR STATUS". Colour: accent terracotta.
- **Body**: Clean sans-serif — Inter or DM Sans. Regular weight for descriptions, medium for sub-headings.
- **Buttons**: DM Sans Medium or Inter SemiBold

### Type Scale
- Hero headline: 32–40px, bold serif
- Section heading: 24–28px, bold serif
- Card title: 18–20px, bold serif or sans-serif semibold
- Body: 14–16px, regular
- Caption / Label: 11–13px, uppercase, letter-spaced

## Component Styles

### Cards
- Border radius: `20px` to `24px` (heavily rounded)
- Padding: `20px` inside
- Dark hero cards: `background: #1A1A1A`, white text, accent elements
- Light cards: `background: #FFFFFF` or `#FAF5F0`, dark text
- Blush cards: `background: #F9E8E3`, dark text
- No heavy drop shadows — use subtle `box-shadow: 0 2px 8px rgba(0,0,0,0.06)` or none

### Buttons
- **Primary (pill)**: Full-width, `border-radius: 50px`, `background: #2D5A45` (green) or `#B94A3C` (terracotta), white text, height `52px`
- **Secondary (outline pill)**: Full-width, `border-radius: 50px`, `border: 1.5px solid #1A1A1A`, white/cream background, dark text
- **Icon button**: Circular, `width/height: 44px`, icon centred
- **Active state**: Use the forest green `#2D5A45` with white checkmark for confirmed/selected states (e.g. "I'm good ✓")

### Bottom Navigation
- Background: `#FFFFFF` or cream, with a soft top border
- Tab items: icon + label below
- Active tab: terracotta `#B94A3C` icon colour + a soft blush pill `#F9E8E3` behind the icon
- Inactive tab: warm grey icon and label
- Tab labels: 10–11px, Inter Medium

### Section Headers
- Pattern: small uppercase terracotta label + large bold serif heading on the next line
- Example:
  ```
  YOUR STATUS          (small, uppercase, terracotta, letter-spaced)
  Let the crew know    (large, bold serif, dark)
  ```

### Avatar Row
- Circular avatars, `width/height: 44px`, `border-radius: 50%`
- Initials shown when no photo: coloured background from a warm palette (blush, sage, terracotta)
- Overlapping avatar stack: offset by `-8px`, bordered with `2px solid #F5EFE8`

### Status Options (Check-in)
- Displayed as pill rows with icon on left
- Selected: filled with `#2D5A45` green, white text, checkmark icon
- Unselected: white card, dark text, outline icon
- Full width, `border-radius: 16px`, `padding: 16px`

### Search Bar
- `border-radius: 50px`, `background: #FFFFFF`, `border: 1px solid #E8DDD6`
- Search icon on left, placeholder in warm grey
- Height: `48px`

### Crew / Group Cards
- Horizontal list item style: icon on left (circular, terracotta background), title + member count + description on right, action button far right
- Member count in terracotta/accent
- Action button: small pill outline "Join" or filled "Joined"

### Civic / Tea Cards ("The Tea")
- Numbered in top right (01, 02, 03)
- Category label in uppercase terracotta
- Bold serif headline
- Body description in warm grey
- "Explain it like I'm 17" as a terracotta text link with `?` icon

### SOS Card
- Full-width, `border-radius: 20px`, `background: #B94A3C` (solid terracotta/red)
- White icon circle on left with `!` symbol
- Large white "SOS" headline
- Subtext in white, slightly transparent
- Chevron `>` on right

### Privacy Badge
- Small pill, `background: rgba(255,255,255,0.15)`, green lock icon, "private by design" label
- Positioned top-right of relevant cards

## Screen-Level Patterns

### Home ("The Crew")
- Greeting: "Good morning, diva." in large bold serif, with day/time above in small terracotta label
- Hero dark card below greeting
- Horizontal avatar/crew strip below hero
- Bottom nav always visible

### Safety Screen
- Small terracotta label "SAFETY FIRST, ALWAYS"
- Large bold serif heading "Need backup?"
- SOS card (terracotta) at top
- Status section below with pill options

### Crews Screen
- Small label + large heading pattern
- Search bar
- Featured/algorithm card in blush
- "Recommended for you" section with crew list cards

### The Tea (Civic)
- Dark hero card with bold headline about parliament/policy
- Category filter chips below (pill shaped, first one filled terracotta)
- Numbered content cards in blush/light

## Spacing
- Screen horizontal padding: `20px`
- Card gap: `12px`
- Section gap: `28px`
- Element gap within card: `8–12px`

## Icons
- Style: rounded, outlined — consistent with the warm friendly tone
- Use Lucide or Phosphor icons (rounded variants)
- Size: `20px` for nav, `24px` for cards, `32px` for SOS/hero

## Tone in UI
- Never clinical or corporate
- Bold serif headlines feel editorial and confident
- Warm cream background feels cosy, not cold
- Gen-Z copy style throughout (short, punchy, occasionally cheeky)
