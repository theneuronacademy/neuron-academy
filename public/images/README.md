# Real Photos & Logo — How To Add

Drop files into this folder (`public/images/`). No code change needed — the website auto-uses them when present.

## Logo (important)
- `logo.png` — your academy logo (transparent PNG ~400px wide works best).
  The navbar, footer and admin sidebar pick it up automatically with a
  circular crop + white ring. Until you add it, a text emblem shows.
  Your badge is circular, so it crops perfectly with `rounded-full`.

## Expected photo filenames (exact, lowercase)

### Hero + About
- `hero.jpg` — Hero visual, landscape 1600×1000+ (students / campus / classroom)
- `about-campus.jpg` — About section, 1200×900+

### Courses
- `course-jee.jpg` — JEE Main + Advanced
- `course-neet.jpg` — NEET-UG
- `course-amu.jpg` — AMU Entrance
- `course-jamia.jpg` — Jamia (JMI) Entrance
- `course-foundation.jpg` — Foundation IX–X

### Faculty (per faculty id)
- `faculty-f1.jpg` … `faculty-f4.jpg` (square/portrait)

### Gallery (per gallery id)
- `gallery-g1.jpg` … `gallery-g8.jpg`

## Rules
1. `.jpg` preferred (or `.png` / `.webp` — update `lib/websiteData.ts` paths if you use another extension).
2. Keep each file under ~500KB (compress with TinyPNG / Squoosh).
3. Landscape for hero/courses/gallery, portrait or square for faculty.
4. Just replace the file and refresh — no rebuild needed in `npm run dev`.
5. If a file is missing, a premium gradient shows automatically — nothing breaks.

Admin banner uploads (`/admin/advertisements/new`) are separate — stored in the browser demo store and shown in the top running banner instantly.
