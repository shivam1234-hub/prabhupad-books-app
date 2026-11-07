// Natural earth-tone palette. One accent (saffron amber). Everything else: warm neutrals.
// Light: warm cream parchment. Dark: deep warm brown-black. No blues, no greens, no purples.

const AMBER = '#A0540C';        // light mode: deep saffron amber
const GOLD  = '#D4882A';        // dark mode:  warm turmeric gold

// vedabase.io light theme (`.theme-light` --color-vb-* custom properties)
const VB_BODY          = '#F3D4A5';
const VB_CONTRAST      = '#FFEDD2';
const VB_HEADER_TOP    = '#DA9D5B';
const VB_HEADER_BOTTOM = '#EEBD89';
const VB_DARK          = '#A16207';
const VB_LINK          = '#B91C1C';
const VB_TEXT          = '#000000';
const VB_ACTION        = '#0F766E';

export const Colors = {
  light: {
    primary:        AMBER,
    primaryDark:    '#7A3E08',
    primaryLight:   '#F5DEB8',
    background:     '#F7F3EC',   // warm cream parchment
    surface:        '#FDFAF4',
    surfaceElevated:'#F0E6D0',   // slightly deeper cream
    card:           '#FDFAF4',
    border:         '#DCCBA4',   // warm tan border
    borderLight:    '#EAE0C8',

    text:           '#2A1F12',   // dark warm brown — main reading text
    textSecondary:  '#5A4A34',   // medium warm brown
    textMuted:      '#9A8A74',   // light warm brown

    textInverse:    '#FDFAF4',

    // All verse sections use the SAME warm tones — no colour variety
    devanagari:     AMBER,       // saffron accent for Sanskrit
    transliteration:'#5A4A34',   // same as textSecondary
    synonyms:       '#5A4A34',
    translation:    '#2A1F12',   // same as text — most important
    purport:        '#5A4A34',

    saffron:        AMBER,
    saffronLight:   '#F5DEB8',
    lotus:          AMBER,
    gold:           AMBER,
    success:        '#4A7A4A',
    warning:        AMBER,
    error:          '#A03020',

    tabBar:             '#FDFAF4',
    tabBarBorder:       '#DCCBA4',
    tabIconDefault:     '#9A8A74',
    tabIconSelected:    AMBER,
    headerBackground:   '#FDFAF4',
    headerText:         '#2A1F12',
    searchBackground:   '#F0E6D0',

    // aliases
    secondary: AMBER,
    accent:    AMBER,

    tagColors: ['#A0540C', '#7A6A54', '#4A7A4A', '#9A6A30', '#7A5A4A', '#6A7A5A', '#5A6A7A', '#8A5A30'],
  },

  dark: {
    primary:        GOLD,
    primaryDark:    '#B87020',
    primaryLight:   '#3A2408',
    background:     '#100D08',   // deep warm brown-black
    surface:        '#1C1610',   // dark warm brown
    surfaceElevated:'#261E14',   // slightly lighter
    card:           '#1C1610',
    border:         '#342C1C',   // dark warm border
    borderLight:    '#2A221A',

    text:           '#EEE4D0',   // warm cream white
    textSecondary:  '#BEA882',   // warm tan
    textMuted:      '#7A6A54',   // muted warm brown

    textInverse:    '#100D08',

    // All sections: warm tones only
    devanagari:     GOLD,        // gold accent for Sanskrit
    transliteration:'#BEA882',   // same as textSecondary
    synonyms:       '#BEA882',
    translation:    '#EEE4D0',   // same as text
    purport:        '#BEA882',

    saffron:        GOLD,
    saffronLight:   '#3A2408',
    lotus:          GOLD,
    gold:           GOLD,
    success:        '#6AAA6A',
    warning:        GOLD,
    error:          '#D07060',

    tabBar:             '#1C1610',
    tabBarBorder:       '#342C1C',
    tabIconDefault:     '#7A6A54',
    tabIconSelected:    GOLD,
    headerBackground:   '#1C1610',
    headerText:         '#EEE4D0',
    searchBackground:   '#261E14',

    // aliases
    secondary: GOLD,
    accent:    GOLD,

    tagColors: ['#D4882A', '#8A9A7A', '#6AAA6A', '#C4906A', '#8A7A6A', '#9AAA7A', '#7A8A9A', '#AA8A5A'],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // "Vedabase" — the exact light palette from vedabase.io's `.theme-light`
  // CSS custom properties (--color-vb-*), read off their stylesheet:
  //   body #F3D4A5 · contrast #FFEDD2 · header-top #DA9D5B · header-bottom
  //   #EEBD89 · dark #A16207 · link #B91C1C · normal-text #000 · input #FFF /
  //   border #162715 · action bg #0F766E / border #0D4844 / text #FFF
  // On vedabase.io every verse section (devanagari, synonyms, translation,
  // purport) simply inherits --color-vb-normal-text, so they are all black
  // here too — no per-section colouring. Muted greys are black composited
  // over the body sand at 70% / 50%, matching their text-vb-normal-text/70
  // and /50 utilities.
  // ─────────────────────────────────────────────────────────────────────────
  vedabase: {
    primary:        VB_LINK,
    primaryDark:    '#8F1515',
    primaryLight:   VB_HEADER_BOTTOM,
    background:     VB_BODY,
    surface:        VB_CONTRAST,
    surfaceElevated:VB_HEADER_BOTTOM,
    card:           VB_CONTRAST,
    border:         VB_HEADER_TOP,
    borderLight:    VB_HEADER_BOTTOM,

    text:           VB_TEXT,
    textSecondary:  '#494032',   // normal-text @ 70% over body
    textMuted:      '#7A6A53',   // normal-text @ 50% over body

    textInverse:    '#FFFFFF',   // --color-vb-action-text

    // vedabase.io gives no section its own colour — all inherit normal-text
    devanagari:     VB_TEXT,
    transliteration:VB_TEXT,
    synonyms:       VB_TEXT,
    translation:    VB_TEXT,
    purport:        VB_TEXT,

    saffron:        VB_DARK,
    saffronLight:   VB_HEADER_BOTTOM,
    lotus:          VB_LINK,
    gold:           VB_DARK,
    success:        VB_ACTION,    // their teal action button
    warning:        VB_DARK,
    error:          VB_LINK,

    tabBar:             VB_HEADER_BOTTOM,
    tabBarBorder:       VB_HEADER_TOP,
    tabIconDefault:     '#604500',  // --color-vb-header-bottom-text
    tabIconSelected:    VB_LINK,
    headerBackground:   VB_HEADER_TOP,
    headerText:         '#000000',  // --color-vb-header-top-text
    searchBackground:   '#FFFFFF',  // --color-vb-input

    // aliases
    secondary: VB_DARK,
    accent:    VB_LINK,

    tagColors: ['#B91C1C', '#A16207', '#0F766E', '#604500', '#005F5A', '#82181A', '#364153', '#8F1515'],
  },
};

export type ColorScheme = typeof Colors.light;
