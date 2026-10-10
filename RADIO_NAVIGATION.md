# Continuous Radio RRR navigation

The frontend uses a persistent shared-header shell and one same-origin content
frame. `radio-navigation.js` enters the shell on a direct page visit before the
visitor starts playback. The shell replaces the address with the requested public
URL. Internal link clicks and Back/Forward use the History API; content-frame
navigations use `location.replace` to avoid duplicate browser history entries.
Refresh and direct URLs still load the original public page entry points.

Only the shell owns an audio element. Framed pages hide their duplicate header and
remove its unloaded audio element before initializing radio controls. Existing
page scripts initialize normally in independent documents. Leaving a page destroys
its timers, observers and listeners. The active page supplies saved Top 10 evidence
to the persistent header, without an additional shell polling loop. The header
has its own shared asset dialog; page asset dialogs remain in their own documents.

No playback preference is stored, no stream is recreated during page transitions,
and no framework, popup, separate tab or backend change is involved. Navigation
failure shows a retry control while the radio remains in the shell.

## Verification

`node radio-navigation.test.cjs` uses Playwright/Edge and real decoded 180-second
WAV media served at the radio URL. It checks advancing playback time, identity of
the retained audio element, one media request, no navigation pause/play events,
the home/Schedule/Bots/dashboard/Tools/home sequence, pause/resume, Back/Forward,
departed-page timer disposal, header dialogs, Schedule controls, direct URLs,
refresh and 320/375/768/1440 layouts. Screenshots are ignored under `.runtime`.
`RRR_RADIO_BASE_URL` runs these checks against the published frontend with live
API responses and controlled test audio. This proves frontend media continuity,
not uninterrupted availability of the external radio provider.

Existing standalone-page regression suites are checked with shell entry disabled
in test routing; integration coverage is provided by the separate radio suite.
Top 10, Schedule, Tools and short technical-card suites pass. The asset modal suite
fails at its existing line 129 assertion (`10 !== 7`) on both changed source and
untouched HEAD. No unrelated fixture was rewritten.

Published implementation `02a5bf6` reached origin/main and its matching Pages
workflow `38075456512` completed successfully on 11 October 2026 Brisbane.
Live integration checks passed with live API responses and controlled audio at
all four widths. A separate actual Radio RRR stream check observed one stream
request, advancing playback time through home/Schedule/Bots/Tools/home, an
unpaused final player and no JavaScript errors. These are verification-time
observations, not guarantees of future upstream stream availability.

## Browser limits

The first Play requires a user gesture. Full refresh, closing the tab or leaving
the website ends playback. Mobile operating systems can suspend background tabs;
network outages and provider buffering can interrupt audio. On small screens,
the content scrolls within the frame; the shared header remains above it, and
short viewports allow the outer shell to scroll. Physical iOS/Safari devices have
not been tested by the automated Edge checks.
