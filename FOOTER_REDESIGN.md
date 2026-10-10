# Compact public footer — 10 October 2026

Frontend-only redesign across the homepage, About, Schedule, Tools, Bots overview,
three bot dashboards, three report archives and the retained website/demo page.
Shared styling is in site-footer.css; static markup keeps legal content available
without JavaScript or API feeds. Native details/summary reveals the four original
legal paragraphs verbatim and changes its visible label when expanded. The short
risk warning always remains visible. A restrained gradient top rule and single
branding divider replace the previous arrangement. The bottom bar has three desktop
columns and a centered mobile stack; TradeRouter has understated brighter text.

Copyright 2026 and Build 20261002.2 preserve the existing manually maintained
values; there was no dynamic public build/year mechanism. How RRR.Trading Works
already lives independently above the homepage footer and remains unchanged.
About's Radio RRR and Back to top links are retained above its footer.

Validation: footer-redesign.test.cjs passes all 12 pages at 320/375/768/1440,
comparing complete legal text with pre-redesign commit f3a318e, checking native
Enter/Space toggles, labels, permanent warning, bottom bar and footer bounds with
API outage fixtures. navigation-phase1.test.cjs passes its existing navigation,
asset dialog, radio, sessions, feed-state and responsive checks. Screenshots were
reviewed locally under ignored .runtime. Homepage collapsed footer measures 400px
versus 839px before at 375px (52% reduction), and 284px versus 409px at 1440px
(30% reduction); the readable warning limits the desktop reduction. No backend,
API contract, bot logic, configuration, trading or data changes.

Publication requires normal origin/main push, matching successful Pages workflow
and live footer checks; local test results alone do not establish deployment.

## Width and alignment repair

The footer now follows the existing shell/wrap widths and responsive breakpoints,
including Schedule’s 1200px and archive reports’ 950px maximums. Horizontal
padding aligns its disclaimer, inset gradient and branding divider with page
content. Only footer CSS, stylesheet cache versions, tests and this note changed.
Footer tests now compare both outer edges with the main container and verify
padding, readable width and aligned internal sections at all four widths. All
12 pages pass; navigation regressions pass. Desktop/mobile adjacent-content
screenshots were reviewed locally. The corrected homepage footer measures 446px
at 375px and 284px at 1440px; earlier measurements above describe the first design.
