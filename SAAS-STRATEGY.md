# Making SearchSuite a viable SaaS — strategy notes

## Positioning

GSCTool and its peers all compete on the same feature checklist: inspection,
indexing, removal, reporting. The one thing none of them advertise clearly
is which of those features rest on a real Google API and which rest on
automating a web page that Google could change without notice. That's a
real vulnerability for them — when Google tweaks the Search Console UI,
every "bulk indexer" extension built on brittle selectors breaks at once,
and their support inboxes fill up the same day.

Turning that into a differentiator is worth doing deliberately: a visible
"API status" indicator in the popup (green for official-API features,
amber for UI-automation features, with a one-line explanation of why) costs
almost nothing to build and does two things at once — it sets accurate
expectations so customers don't churn angrily when Google's UI shifts, and
it reads as more trustworthy than competitors who blur the line. "We tell
you exactly what's guaranteed and what isn't" is a genuinely defensible
position in a category full of tools that oversell reliability.

## Pricing

GSCTool's structure (free tier, $29/yr, $59 lifetime, $5 day-pass, 5-device
cap) is a reasonable template, but the day-pass is worth leaning into harder
than they do — it's the natural entry point for someone who just needs to
bulk-index 200 URLs once after a migration or a site relaunch, and a $5
low-commitment purchase converts far more easily than asking for a $29/yr
subscription up front. Consider making the day-pass the primary
call-to-action for new visitors, with the annual/lifetime plans positioned
as "upgrade once you're doing this weekly."

A usage-based add-on is also worth testing once you have paying customers:
agencies managing many client properties will hit the 5-device seat cap
quickly, and a "team" tier (more seats, maybe per-property API-key pooling)
captures that willingness to pay without restructuring the whole pricing
model.

## Feature ideas beyond feature-parity

A few features that extend past matching GSCTool, roughly in order of
build cost:

- **Scheduled re-inspection.** Use the `alarms` permission already in the
  manifest to re-run inspection on a saved URL list weekly and diff the
  results — "3 pages dropped out of the index this week" is a much more
  compelling reason to open the extension than a one-time bulk tool.
- **Core Web Vitals / rich-results trend tracking.** The URL Inspection API
  response already includes mobile-usability and rich-results data that
  most bulk-indexer tools throw away after showing a single verdict —
  storing it over time turns a one-shot utility into a monitoring product.
- **Multi-property rollup dashboard.** Agencies want one view across all
  client properties, not per-property switching — this is the single
  highest-value feature for the "team" pricing tier above.
- **Slack/email alerts** when scheduled re-inspection finds newly
  de-indexed pages, tying back into the scheduling feature above.
- **IndexNow auto-submit on sitemap change** — poll a site's sitemap on an
  interval and auto-submit new/changed URLs to IndexNow, turning the manual
  bulk-submit tool into a "set it and forget it" feature that justifies a
  recurring subscription rather than a one-time day-pass.

## Acquisition channels that fit this product specifically

SEO practitioners are an unusually well-defined, findable audience, which
makes a few channels disproportionately effective compared to a generic
SaaS: r/SEO, r/TechSEO, and the Search Engine Land / Search Engine
Roundtable comment sections and newsletters reach exactly this audience
directly, and posting genuinely useful GSC/IndexNow technical content there
(not thinly-veiled ads — actual "here's how the Search Console API's daily
quota actually works" posts) tends to outperform paid ads in this niche
because the audience is small, technical, and ad-fatigued. A comparison
page ("GSCTool vs SearchSuite vs [others]" or "what's actually an official
Google API vs. a UI hack, across every bulk-SEO extension") doubles as SEO
content for your own site and as the transparency positioning above.

Chrome Web Store's own search and "related extensions" surface is also
worth optimizing directly — accurate, keyword-complete listing copy and
screenshots matter more for extensions than for most SaaS categories, since
a meaningful share of installs come from users already searching the store
for "search console" or "bulk indexing."

## Risk management as a retention lever

Because the Google-side automation is inherently fragile, build the
maintenance loop into the product from day one rather than reacting to
support tickets: a lightweight scheduled check (even a manual weekly run
against a test property) that confirms the automation selectors still match
the live GSC UI, with a status page customers can check before assuming
their own account is the problem. This also gives you an honest answer
when a customer asks "why did this stop working" — "we caught it within a
day and shipped a fix" is a retention story; silence until refund requests
show up is a churn story.
