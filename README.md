# PhotoProof

**Offline photo documentation for inspections, move-ins/move-outs and damage surveys.**

PhotoProof is a mobile app for capturing timestamped, GPS-tagged photos, organizing them into reports, annotating each one, and exporting a polished PDF report — all on-device, with no account and no internet connection required.

Built with **Expo SDK 57**, **React Native 0.86**, **React 19** and **TypeScript**.

---

## Features

### 📷 Fast field capture
- Full-screen camera with flash (off / on / auto), front/back switching and pinch-to-zoom plus a draggable zoom slider
- Rapid-fire shooting: the shutter unlocks as soon as the photo is taken while saving continues in the background
- Haptic and visual capture feedback, live photo counter and last-photo thumbnail
- Photos are automatically numbered in shutter order (`#001`, `#002`, …)

### 📍 Automatic metadata
- Capture timestamp on every photo
- GPS coordinates and a reverse-geocoded street address when location permission is granted
- Location is only tracked while the camera is open, to save battery

### 🗂️ Reports & annotation
- Create reports from quick templates (Move-Out, Move-In, Inspection, Damage) or with a custom title and location
- Tag each photo with a category (Exterior, Kitchen, Bathroom, Damage, …) and add notes — edits are auto-saved however you leave the screen
- Multi-select to delete photos or exported PDFs

### ✂️ Non-destructive crop & rotate
- Crop with Free, Original, 1:1, 4:3 and 16:9 aspect locks, and rotate in 90° steps
- **Original photos are never modified** — edits are stored as metadata and applied only to the PDF
- The editor, in-app PDF preview and exported PDF share the same crop geometry, so what you see is exactly what you get

### 📄 PDF export
- Professional A4 report with a summary cover page (date, photo count, prepared-by) and one evidence card per photo with its number, category, timestamp, location and notes
- Preview the report in-app before exporting
- Exported PDFs are kept per report and can be re-shared or deleted at any time via the native share sheet

### 🎨 Polished experience
- Light, Dark and System appearance
- First-run onboarding with an optional inspector / company profile used as the report's "Prepared By"
- Image caching and downsampling for smooth scrolling through large photo grids

---

## Tech stack

| Area | Library |
| --- | --- |
| Framework | Expo SDK 57, React Native 0.86, React 19, TypeScript |
| Navigation | React Navigation 7 (native stack) |
| Camera | `expo-camera` |
| Location | `expo-location` |
| Images | `expo-image` |
| Storage | `expo-file-system` (photos & PDFs), `@react-native-async-storage/async-storage` (report data) |
| PDF | `expo-print` (HTML → PDF), `expo-sharing` |
| Feedback | `expo-haptics` |
| Graphics | `react-native-svg` (custom icon set) |

---

## Getting started

### Prerequisites
- [Node.js](https://nodejs.org/) 20 or newer
- An iOS or Android device with [Expo Go](https://expo.dev/go), or an emulator/simulator

### Run locally
```bash
git clone https://github.com/Sahaj1207/PhotoProof.git
cd PhotoProof
npm install
npx expo start
```
Scan the QR code with Expo Go (Android) or the Camera app (iOS), or press `a` / `i` to open an emulator.

### Build an installable app
Builds are configured with [EAS Build](https://docs.expo.dev/build/introduction/) in `eas.json`:
```bash
npx eas-cli build --profile preview --platform android
```

### Type-check
```bash
npx tsc --noEmit
```

---

## Project structure

```
src/
├── components/     Reusable UI (buttons, cards, headers, cropped image, photo tiles, icons)
├── context/        ReportsContext – report state with a serialized persistence queue
├── models/         Report and Photo types
├── navigation/     Root stack navigator and route types
├── screens/        Onboarding, Home, New Report, Capture, Report Details,
│                   Photo Details, Photo Edit, PDF Preview, Settings
├── services/
│   ├── location/   GPS watcher and cached reverse geocoding
│   ├── pdf/        HTML report template and PDF generation
│   ├── sharing/    Native share sheet
│   └── storage/    File storage, report persistence, settings and profile
├── theme/          Colors, typography, spacing, shadows, light/dark themes
└── utils/          Dates, IDs, formatting and shared crop geometry
```

---

## How it works

- **Offline-first storage.** Each photo is copied into the app's private document directory (`reports/<reportId>/photos/`); report and photo metadata are stored as JSON in AsyncStorage. Writes go through a single ordered queue so a newer save can never be overwritten by an older one.
- **Evidence integrity.** Captured images are saved byte-for-byte as the camera produced them. Crops, rotation, notes and categories live in metadata and are applied only when rendering the PDF.
- **PDF rendering.** Photos are embedded into an HTML template in small batches to limit memory use, rendered to an A4 PDF with `expo-print`, and saved to `reports/<reportId>/exports/`.
- **Privacy.** Nothing leaves the device unless you choose to share a PDF. Location is used only to tag photos.

---

## Permissions

| Permission | Why |
| --- | --- |
| Camera | Capture inspection photos |
| Location (while in use) | Optionally tag photos with GPS coordinates and an address |

Microphone access is explicitly not requested.
