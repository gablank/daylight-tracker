# Daylight Tracker (100% "vibe coded")

A static web application that visualizes daylight duration throughout the year for any location. Built with Svelte 5, Vite, and Tailwind CSS.

**Live Demo**: [https://gablank.github.io/daylight-tracker/](https://gablank.github.io/daylight-tracker/)

## Features

### Location & Time Settings
- **Location Selection**: Choose latitude/longitude manually, from presets (Oslo, Longyearbyen, Tokyo, Sydney, etc.), or use geolocation
- **Timezone Selection**: Display times in any timezone
- **Date Selection**: Pick any date to explore daylight information
- **Settings Persistence**: Location and timezone are remembered between visits

### Interactive Year Graph
- Circular visualization of the entire year's daylight
- Winter solstice at top, summer solstice at bottom
- Color gradient showing daylight duration (darker = less daylight)
- **Click anywhere on the ring to jump to that date**
- Current date and mirror date markers
- Month labels and astronomical event markers (equinoxes/solstices)
- Toggle between clockwise and counter-clockwise direction
- Hemisphere-appropriate season names (e.g., "Summer Solstice" in December for Southern Hemisphere)

### Today's Sun Stats
- Sunrise and sunset times
- Solar noon
- Maximum sun elevation angle
- Special handling for polar day/night conditions

### Daylight Statistics
- **Mirror Date**: The date with the same daylight on the opposite side of winter solstice
- **Future Daylight**: Daylight amounts 1-10 weeks ahead with change indicators
- **Daylight Changes**: When you'll gain or lose specific amounts (+/-1 minute, +/-1 to 4 hours)

### Interesting Upcoming Dates
A unified table showing:
- **Astronomical Events**: Equinoxes and solstices
- **Daylight Milestones**: When daylight crosses hour thresholds (e.g., "More than 12h of daylight")
- **Sunrise/Sunset Milestones**: When sunrise/sunset times cross hour boundaries
- **DST Changes**: Daylight saving time transitions with exact sun times
- **Polar Events**: Midnight sun begins/ends, polar night begins/ends

## Tech Stack

- **Svelte 5** - Reactive UI framework with runes
- **Vite 7** - Fast build tool
- **Tailwind CSS v4** - Utility-first styling
- **SunCalc** - Solar position calculations (includes atmospheric refraction)

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Deployment

The app is configured for GitHub Pages with automatic deployment:

1. Push to `master` branch
2. GitHub Actions builds and deploys automatically
3. Enable GitHub Pages in repo Settings → Pages → Source: "GitHub Actions"

For other hosts, build and upload the `dist/` directory:

```bash
npm run build
# Upload contents of dist/ to your host
```

Works with: Netlify, Vercel, Cloudflare Pages, or any static web server.

## Solar Calculations

All calculations are performed client-side using the [SunCalc](https://github.com/mourner/suncalc) library:

- NOAA solar position algorithms
- Atmospheric refraction correction
- Accurate sunrise/sunset times accounting for longitude

## Polar Regions

The app handles extreme latitudes (above Arctic/Antarctic circles) with special features:

- **Midnight Sun**: 24-hour daylight detection and event tracking
- **Polar Night**: 0-hour daylight detection and event tracking
- Suppressed intermediate milestones during rapid transitions
- Paired events shown together (e.g., "Midnight sun ends" followed by "Polar night begins")

## Third-Party Licenses

This project uses [SunCalc](https://github.com/mourner/suncalc) for solar calculations. SunCalc is used under the BSD 2-Clause License. The full copyright notice and disclaimer are in [public/THIRD-PARTY-LICENSES.md](public/THIRD-PARTY-LICENSES.md). The same file is included in the built site when deployed (e.g. on GitHub Pages).

## License

MIT
