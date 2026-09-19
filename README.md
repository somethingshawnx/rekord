# Recordly Go

A responsive, installable web MVP for the Recordly screen-recording idea. It now uses a desktop-editor interface with a tool rail, background inspector, captions workspace, preview canvas, transport controls, and multi-layer timeline. It works in modern desktop browsers and Android Chrome, and it is ready to be wrapped with Capacitor for Android.

## Run the web app

```powershell
npm install
npm run dev
```

Open the localhost address printed by the command. Use HTTPS (or localhost) for camera and screen-sharing permissions.

## What works now

- Browser screen capture with browser-provided audio
- Android-ready Capacitor configuration for the native camera and screen-capture layer
- Video upload, preview, playback scrubber, timeline scrubber, and WebM download
- Background, frame, cursor, webcam, captions, project, and extension inspector panels
- Responsive UI, PWA manifest, and offline app shell
- Editor styling controls that update the preview canvas

## Package it for Android

```powershell
npm install
npx cap add android
npm run android:sync
npm run android:open
```

Android Studio opens the native project. The next implementation phase should add a Capacitor plugin using Android MediaProjection for device-screen recording and MediaCodec/FFmpeg for styled MP4/GIF rendering; browser Web APIs cannot provide those production-grade capabilities on every Android device.

The browser library saves the project name and timeline metadata locally. For privacy and browser-storage limits, the actual source video remains available in the current editing session; a production release should use IndexedDB or authenticated cloud storage for durable source-media projects.
