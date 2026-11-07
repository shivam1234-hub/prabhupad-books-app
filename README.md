# Vedabase Mobile App

A full-featured mobile app for Srila Prabhupada's complete library from [vedabase.io](https://vedabase.io), built with React Native + Expo.

## Features

### 📚 Complete Library
All books from the Vedabase library:
- **Bhagavad-gītā As It Is** (18 chapters, 700 verses)
- **Śrīmad-Bhāgavatam** (12 Cantos, 18,000+ verses)
- **Śrī Caitanya-caritāmṛta** (Ādi, Madhya, Antya-līlā)
- **Nectar of Instruction**, **Nectar of Devotion**
- **Śrī Īśopaniṣad**, **Kṛṣṇa Book**
- **Brahma-saṁhitā**, **Nārada Bhakti Sūtra**
- 23 books total — no book left out

### 🔤 Full Verse Display (Toggleable Sections)
- Sanskrit text (Devanāgarī)
- Roman transliteration
- Word-for-word synonyms
- Translation
- Purport (full commentary)
- Audio playback (where available)

### 📥 Offline Mode
- Download entire books for offline reading
- SQLite FTS5 full-text search on downloaded content
- Content cached from vedabase.io API

### 🔍 Global Search
- Instant full-text search across 21,000+ pages
- Searches translations, purports, synonyms, devanagari
- 300ms debounce for smooth UX
- Popular search suggestions

### 🪷 Sloka of the Day
- Daily verse automatically selected each morning
- Displayed on Home screen with full translation
- **Lock screen / notification** — appears on device lock screen at your chosen time
- Configure notification time (6 AM, 8 AM, noon, 6 PM, 9 PM)
- Choose source book (all books or specific book)

### ❤️ Favorites & Tags
- Save any verse to favorites with one tap
- Create colour-coded tags (unlimited)
- Assign multiple tags to any verse
- Filter favorites by tag
- Personal notes on any verse

### 📖 Reading Progress
- Automatically tracks reading position per book
- Mark chapters as complete
- Resume reading from where you left off

### ⚙️ Fully Customisable
- Light / Dark / System theme
- 4 text size options (Small → Extra Large)
- Toggle each section independently (hide Sanskrit if not needed)
- 12 language options (English, Hindi, Bengali, Gujarati, Telugu, Marathi, Tamil, German, French, Spanish, Portuguese, Russian)
- Auto-play audio setting

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React Native + Expo SDK 56 |
| Navigation | Expo Router v3 (file-based) |
| Database | expo-sqlite (SQLite FTS5) |
| State | Zustand |
| Data Fetching | TanStack Query + Axios |
| Notifications | expo-notifications + expo-background-fetch |
| Audio | expo-av |
| Storage | expo-secure-store |
| Animations | react-native-reanimated |
| Lists | @shopify/flash-list |

## Project Structure

```
app/
├── (tabs)/
│   ├── index.tsx        # Home — Sloka of the Day
│   ├── library.tsx      # Full library browser
│   ├── search.tsx       # Global full-text search
│   ├── favorites.tsx    # Favorites & Tags
│   └── settings.tsx     # All settings + download manager
├── book/[slug].tsx      # Book overview + chapter list
├── chapter.tsx          # Chapter verse list
└── verse.tsx            # Full verse detail view

src/
├── constants/
│   ├── books.ts         # All 23 book metadata
│   └── colors.ts        # Light/dark colour tokens
├── database/
│   ├── db.ts            # SQLite setup + FTS5 schema
│   └── queries.ts       # All DB operations
├── services/
│   ├── vedabaseApi.ts   # Fetch + cache from vedabase.io
│   └── notifications.ts # Daily sloka + lock screen
├── store/
│   ├── settingsStore.ts # App settings (Zustand + SecureStore)
│   └── favoritesStore.ts # Favorites, tags, notes
├── hooks/
│   ├── useTheme.ts
│   ├── useVerse.ts
│   └── useSearch.ts
└── components/
    ├── BookCard.tsx
    ├── VerseContent.tsx  # Full verse with toggleable sections
    ├── AudioPlayer.tsx
    ├── SearchBar.tsx
    └── TagChip.tsx
```

## Setup & Run

```bash
# Install dependencies
npm install

# Start development server
npm start

# Run on iOS
npm run ios

# Run on Android
npm run android
```

### Building for Production

```bash
# Install EAS CLI
npm install -g eas-cli

# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android
```

## Desktop App (Windows / macOS / Linux)

The same app runs as a native desktop application via Electron. It is **not** a
rewrite — the desktop build renders the exact same Expo web bundle (same screens,
navigation, theming and settings), and adds the three things a browser can't do:

| Concern | Mobile | Desktop |
|---|---|---|
| Offline storage | `expo-sqlite` | SQLite (FTS5) in `desktop/db.js`, same schema |
| Fetching vedabase.io | native HTTP | Electron main process (no CORS, no local proxy) |
| Daily sloka | `expo-notifications` | OS notification on a timer in the main process |

Downloaded books, favourites, tags, notes and reading progress live in a real
SQLite database, so the **entire library is available with no internet** — the
same download-then-read model as the phone.

### Running it

```bash
npm install

# Build the web bundle and launch the desktop app
npm run desktop

# Live-reload development (Metro dev server + Electron)
npm run desktop:dev
```

### Building installers

```bash
npm run desktop:win     # Windows: NSIS installer + portable .exe
npm run desktop:mac     # macOS:   .dmg
npm run desktop:linux   # Linux:   AppImage
```

Output lands in `release/`:

- `Vedabase Setup <version>.exe` — normal installer (desktop + Start Menu shortcuts,
  user-selectable install directory, no admin rights needed)
- `Vedabase-<version>-portable.exe` — single self-contained executable, runs from a
  USB stick with nothing installed

Windows builds **cross-compile from macOS and Linux**, because the app ships no
native modules (SQLite is a WASM build). `.github/workflows/desktop-windows.yml`
also builds the installer on a Windows runner and attaches it to tagged releases.

> Requires Node 20.20.2 — the Expo SDK 56 export step fails on Node 18.

### Where the offline library is stored

| OS | Path |
|---|---|
| Windows | `%APPDATA%\Vedabase\vedabase.db` |
| macOS | `~/Library/Application Support/Vedabase/vedabase.db` |
| Linux | `~/.config/Vedabase/vedabase.db` |

Uninstalling does **not** delete it, so a reinstall keeps every downloaded book.
**File → Open Library Folder** reveals it.

## Content Source

All content is fetched live from [vedabase.io](https://vedabase.io) (official BBT digital library) and cached locally in SQLite for offline use. Content is copyright © Bhaktivedanta Book Trust.

## Lock Screen Setup

1. Go to **Settings** tab
2. Enable **Daily Notification**
3. Choose your preferred time
4. Enable **Lock Screen Verse**
5. Allow notification permissions when prompted

The daily verse will appear as a notification on your lock screen every day at the configured time.

---

*Hare Kṛṣṇa* 🙏
