# 0031. The home-screen app, and notifications inside it

- Status: Accepted
- Date: 2026-10-19

## Context
Most people open the app on a phone, often from a link someone texted them.
A browser tab gets lost among the others; an icon on the home screen is one
tap away and opens full screen, like any other app. What's new reaches
people inside the app only: there are no emails or push notifications
(0016), so being told in the app has to work well.

## Decision
- **It installs as a web app.** A manifest (`frontend/public/manifest.webmanifest`)
  with icons, `display: standalone`, and the iOS meta tags. No service
  worker: nothing is cached offline, so a deploy is never hidden behind a
  stale copy. Chrome installs it without one.
- **Home asks once, on a phone that hasn't added it** (`features/install-app`).
  iPhone gets the three Safari steps (Share, Add to Home Screen, Add), with
  "open it in Safari first" when the link was opened inside another app;
  Android and desktop Chrome get the browser's own one-tap prompt. Closed,
  it stays closed on that device. The circle menu keeps the how-to for later.
- **What's new shows as a toast while you're in the app.** The bell still
  checks every minute, but only while the app is on screen, and checks at
  once when you come back to it. Anything new since the last check shows as
  one line at the bottom ("bob commented"), with View to open the bell.
  The wording is one function (`notificationText.ts`), shared by the panel
  and the toast.
- **One toast system** (`shared/toast`): one line, at most one action,
  queued. Used where a quiet confirmation helps (a picture saved), not for
  every tap.
- **The icon shows the unread count** where the phone allows it (the Badging
  API: installed apps on Android and desktop). iPhone only shows badges for
  apps allowed to send notifications, so it shows none here.

## Consequences
- On iPhone the home-screen app keeps its own sign-in, apart from Safari's,
  so people sign in once more after adding it; the steps say so.
- Nothing arrives while the app is closed. That is the choice in 0016:
  coming back is never a chore, and what's new is waiting on Home.
