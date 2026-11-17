# Influencer changes

Run the dependency-free automated checks with Node:

```sh
node --test tests/influencer.test.cjs tests/waveform.test.cjs
```

## Verified automatically

- Morning/evening solar altitude boundaries, midpoint compass bearings, low winter sun split at solar noon, and polar cases.
- Countdown before/at the 30-minute threshold, at start, just before end and at end.
- Local day boundaries, both Stockholm DST transitions, and distant timezones.
- ISO week number with local calendar year at New Year (the small year is the calendar year, not the ISO week-year).
- PCM trimming, stereo preservation, linear fade-in/out, overlapping fades and invalid input.
- WAV header, duration, sample format and channel interleaving.
- JavaScript parsing of all external and inline scripts and dependency load order.

## Verification limits in this implementation session

No successful browser or physical iPhone test. The local HTTP preview timed out; local file navigation was blocked by browser policy. Native video decoding, playback, download/share, visual layout, keyboard focus, service-worker installation and the GarageBand flow remain to be tested in a real browser/device. Existing weather endpoints were not validated. The astronomical tests check algorithm invariants, not an independent ephemeris.

## Manual acceptance checks

1. In Influencer, activate the egg in the protein panel. Check keyboard activation, heading focus, close/Escape, and return focus. Change weight and open it again.
2. Import an MP4/MOV with AAC audio (including an iPhone screen recording), then a WAV. Choose start/end and fades, listen, export and download. Check that the exported audio matches preview and lasts at most 30 seconds. Check silent/unsupported/corrupt files, files over 50 MB, rapid file replacement and invalid/empty fields. Inputs over 10 minutes are rejected after decoding; browser codec support and available memory limit import compatibility.
3. On iPhone Safari, save/share the WAV to Files and import it into GarageBand. Export as Ringtone. The page exports a real PCM WAV, not a renamed M4R, and does not install a ringtone itself. Apple instructions: https://support.apple.com/sv-se/120692
4. Check the golden panel in Stockholm, another timezone, northern winter and polar summer. Before the 30-minute window it shows times; during countdown and the period it shows remaining minutes with the time range underneath. Calculations use geometric solar altitude -4 to +6 degrees, selected city coordinates and local date. Cloud cover is not predicted. Direction is at the period midpoint. At high latitudes, continuous light may be split at solar noon or the local day boundary.
5. Check year below week, including Jan 1, and automatic local-date rollover. Switch city and mode and return after backgrounding.
6. Check mobile widths, Expert and Netscape modes, weather cards, clothing advice, protein calculation, external links and offline reload after the updated service worker has activated.

## Waveform and simplified influencer follow-up

15 Node tests pass, including handle bounds, short clips, stereo waveform peaks and full Swedish compass directions. The UI now caps clips at 29.9 seconds, supports touch/pointer handles and keyboard arrows (Shift for 1-second steps), and shows fades. Screen recording help links directly to Apple; GarageBand is an alternative link. The golden panel shows duration and full directions with no solar degrees, and the protein footnote is removed. Export remains PCM WAV.

Not verified on a physical iPhone: touch dragging, layout, video import, playback, Files ringtone installation or sharing. The earlier browser verification limits still apply. Manually check the two handles, numeric inputs, fades, changing source files and short/long sources before treating the phone workflow as verified.
