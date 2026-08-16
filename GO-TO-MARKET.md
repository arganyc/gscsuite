# GSCSuite go-to-market playbook

This builds on `SAAS-STRATEGY.md` (in the extension project) with something
more concrete: an actual first-30-days sequence and specific channels,
scoped to a solo/small launch rather than a funded one.

## Before anything else: get 5 real users

Selling strategies don't matter yet if nobody's used the product. Before
spending time on Product Hunt or ads, get the extension in front of 5–10
people you can talk to directly — your own SEO contacts, a local marketing
meetup, a freelancer Slack/Discord you're in. Watch them use it once. This
catches the obvious rough edges (a confusing button, a step that isn't
clear) for free, before a stranger hits them and just leaves. It also gets
you your first honest testimonial quotes for the site — right now the
homepage intentionally has no fake social proof; that changes once you
have real users willing to be quoted.

## Launch sequencing (first 30 days)

**Week 1 — soft launch, fix what breaks.** Ship to the 5–10 people above.
Fix bugs. Get 2–3 people to agree to a short quote or a screenshot of them
using it — add these to the homepage, replacing the current "why GSCSuite
exists" section with an actual review if it's strong enough, or adding a
small testimonial row beneath it.

**Week 2 — Chrome Web Store + technical content goes live.** Submit for
review (this can take a few days to a couple weeks, so get it in the queue
early even if the listing isn't perfect). Publish the three blog posts
already drafted, plus one more specifically comparing GSCSuite's
official-vs-unofficial split against named competitors — this is your most
differentiated content and worth getting right.

**Week 3 — community + Product Hunt.** Post in r/SEO, r/TechSEO, and
relevant Discord/Slack communities — not as an ad, as "I built a tool that
tells you which bulk-indexing features are real APIs vs. UI hacks, curious
what people think." Technical audiences respond to that framing much
better than launch-announcement copy. Schedule a Product Hunt launch for a
Tuesday–Thursday (higher traffic days), with the testimonial quotes and
blog posts already live to link to.

**Week 4 — measure, then decide on paid.** Look at signup source data
before spending anything on ads. If organic/community channels are
converting, more content and more communities is probably higher-leverage
than paid spend for a niche, technical, low-price-point product like this
one — SEO tool buyers are also unusually ad-blind. If you do test paid,
Google/Bing Search ads on very specific long-tail terms ("bulk url
inspection tool", "indexnow chrome extension") will outperform broad
social ads for this audience.

## Specific channels and what to actually post

- **r/SEO, r/TechSEO, r/bigseo** — technical write-ups, not product pitches.
  A post titled "Turns out Google's Indexing API only supports two content
  types — most 'bulk indexer' tools are automating the UI" will get more
  engagement (and more trust) than "I built an extension, check it out."
- **IndieHackers** — the "building in public" framing fits a solo/small
  launch well; post build updates and the Stripe/revenue numbers once you
  have them.
- **Search Engine Land / Search Engine Roundtable comment sections and
  their newsletters** — reach the exact target audience; worth a direct,
  low-key mention when genuinely relevant to a thread, not a drive-by link
  drop.
- **AppSumo or a similar lifetime-deal marketplace** — worth considering
  once the product is stable, as a way to get a batch of paying users and
  reviews fast in exchange for a steep lifetime-deal discount; weigh this
  against just selling the $59 lifetime tier directly, since marketplaces
  take a large revenue cut.
- **Chrome Web Store listing itself** — a meaningful share of installs for
  a utility extension like this come from people already searching the
  store. Spend real time on the listing screenshots and description with
  the actual keywords buyers search ("search console bulk", "gsc bulk
  indexing", "indexnow"), not just marketing copy.

## Pricing/promo levers once you have traffic

- A **launch discount** (e.g. yearly at $19 for the first 100 customers,
  clearly time- or quantity-limited) converts early visitors who are on
  the fence, and gives Product Hunt/Reddit posts a concrete reason to act
  now rather than bookmark it.
- The **Day Pass ($5)** is the easiest yes for a cold visitor — lead with
  it in any single-touch channel (a Reddit comment, a tweet) where you
  don't get a second chance to build trust before asking for money.
- Once you have paying customers, a **referral or affiliate arrangement**
  with SEO-focused newsletters/YouTubers (a cut of yearly/lifetime sales
  they refer) tends to work better for a niche technical tool than
  self-serve influencer ads, since the audience trusts a specific person's
  technical judgment more than a sponsored placement.

## What "success" looks like at each stage

Rough, adjustable benchmarks so you know whether to keep iterating on the
product or shift effort to marketing:

- 10 free installs with no bulk-feature usage → the free tier isn't
  demonstrating value; revisit what's unlocked for free.
- Free installs but no upgrades after a week → check whether the
  Day Pass is visible enough; it's the natural first purchase.
- Upgrades but high refund/support-ticket rate on the Google
  automation features → the honesty framing is working (people are
  buying it), but the automation itself needs more resilience —
  prioritize the maintenance-monitoring idea from `SAAS-STRATEGY.md`.
