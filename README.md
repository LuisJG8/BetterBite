# Better Bite

Better Bite is a React + Tauri app for scanning or entering food barcodes, scoring ingredient quality, and suggesting a healthier alternative that still matches the original craving.

## Requirements

- Node.js 22.13 or newer (CI uses Node.js 24)
- pnpm 11.0.6
- Rust, if you want to run the Tauri desktop app

If pnpm is not installed, enable it through Corepack:

```sh
corepack enable
corepack prepare pnpm@11.0.6 --activate
```

For the desktop app, install Rust from https://rustup.rs/. On macOS, also install Apple command line tools:

```sh
xcode-select --install
```

## Run in the Browser

This is the quickest way to try the app.

```sh
pnpm install
pnpm dev
```

Then open:

```text
http://127.0.0.1:1420
```

## Run as a Desktop App

Install dependencies first:

```sh
pnpm install
```

Then start the Tauri app:

```sh
pnpm tauri dev
```

The first run can take a few minutes because Rust dependencies need to compile.

## Run on Android

The Android app uses the same React and Rust code as the browser, iOS, and desktop versions. Its Android Studio project is tracked in `src-tauri/gen/android`.

Install Android Studio with Android SDK Platform 36, Platform-Tools, Build-Tools, and the side-by-side NDK. Also install the Android Rust targets:

```sh
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
```

Start an emulator or connect a device, then run:

```sh
pnpm tauri android dev
```

To run from Android Studio, use `pnpm tauri android dev --open` and keep the command running while working in the IDE.

Build a debug APK for direct device testing or a release AAB for Google Play:

```sh
pnpm tauri android build --debug --apk
pnpm tauri android build --aab
```

The release AAB must be signed before it can be uploaded to Google Play.

## Useful Commands

Run `pnpm typecheck` to check both the app and the Vite configuration.

```sh
pnpm dev
```

Start the Vite browser dev server.

```sh
pnpm tauri dev
```

Start the Tauri desktop app.

```sh
pnpm test
```

Run the unit tests.

```sh
pnpm build
```

Type-check and build the web app into `dist/`.

```sh
pnpm tauri android build --debug --apk --ci
```

Build a debug Android APK for local verification.

## Trying Food Search

Start the local catalog with `docker compose up -d`, then load the sample foods with `pnpm typesense:seed`. For native Android development, run `adb reverse tcp:8108 tcp:8108` on the connected device so the app can reach the catalog on your computer.

For a deployed catalog, set `VITE_TYPESENSE_HOST`, `VITE_TYPESENSE_PORT`, `VITE_TYPESENSE_PROTOCOL=https` and a search-only `VITE_TYPESENSE_SEARCH_KEY` before building. Allow the exact HTTPS catalog origin in the native app’s `connect-src` policy. Keep the Typesense admin key on the server.

## Trying a Product Lookup

Product lookup uses Open Food Facts, so use a real packaged-food barcode when trying the app. Internet access is required for barcode lookups.

If a barcode is not available in Open Food Facts, the app will show a product-not-found message.

## Trying Food Recognition

For local development or `pnpm preview`, set `HF_TOKEN` in a local `.env` file or the server environment, then restart the server. The token needs Hugging Face Inference Providers access. The recognition proxy accepts loopback connections. Android development can use a USB or emulator connection with port forwarding to the local server.

Choose **Scan Food**, then **Start food recognition** to share frames from the camera with Hugging Face. **Stop food recognition** ends sharing. Barcode detection runs on the device.

For Android and iOS distribution, set `VITE_FOOD_RECOGNITION_ENDPOINT` at build time to the absolute HTTPS URL of your own recognition service. Keep the Hugging Face token on that service. The URL ships with the app and must contain no credentials or secret query parameters. Add the service’s exact origin to `connect-src` in both `app.security.csp` and `app.security.devCsp` in `src-tauri/tauri.conf.json`.

The relay must accept a raw JPEG, PNG, or WebP body by POST and return a JSON array such as `[{"label":"banana","score":0.98,"model":"nateraw/food"}]` within 64 KiB. The client omits credentials and rejects redirects. For cross-origin calls, allow the specific origins of the deployed WebViews or website and answer CORS preflight for `POST` with the `Content-Type` header.

With the relay unset, desktop Tauri releases use the provider token in their process environment. Static web hosting can serve a same-origin backend at `/api/food-recognition`.

## Troubleshooting

If `pnpm` is not found, run:

```sh
corepack enable
corepack prepare pnpm@11.0.6 --activate
```

If `pnpm tauri dev` fails because Rust is missing, install Rust from https://rustup.rs/ and restart your terminal.

If the desktop app opens but product lookup fails, try the browser version with `pnpm dev` and make sure your internet connection allows requests to Open Food Facts.
