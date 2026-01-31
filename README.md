# Daylight Tracker

A static web application that visualizes daylight duration throughout the year for any latitude. Built with Svelte, Vite, and Tailwind CSS.

## Features

- **Location Selection**: Choose your latitude manually, from presets, or use geolocation
- **Date Selection**: Pick any date to see daylight information
- **Circular Year Graph**: Visual representation of the entire year's daylight
  - Winter solstice at top, summer solstice at bottom
  - Color gradient showing daylight duration
  - Clock hand pointing to selected date
  - Horizontal line connecting to "opposite date" (same daylight, other half of year)
- **Today's Sun Stats**: Sunrise, sunset, solar noon, and max sun elevation
- **Daylight Statistics Tables**:
  - Future daylight (1 week, 2 weeks, 1 month ahead)
  - When you gain 1-4 hours of daylight
  - When specific daylight durations occur (8h, 10h, 12h, etc.)

## Tech Stack

- **Svelte 5** - Reactive UI framework
- **Vite** - Fast build tool
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

The app builds to static files in the `dist/` directory. Deploy to any static hosting:

- Netlify
- Vercel
- GitHub Pages
- Cloudflare Pages
- Any web server

```bash
npm run build
# Upload contents of dist/ to your host
```

## Solar Calculations

All calculations are performed client-side using the [SunCalc](https://github.com/mourner/suncalc) library, which implements:

- NOAA solar position algorithms
- Atmospheric refraction correction (0.833°)
- Accurate sunrise/sunset times

Note: Times displayed use longitude 0° (GMT timezone). Actual clock times depend on your local timezone.

## Polar Regions

The app handles extreme latitudes correctly:
- **Polar Day (Midnight Sun)**: When the sun doesn't set
- **Polar Night**: When the sun doesn't rise

These conditions are detected and displayed with appropriate messaging.

## License

MIT
