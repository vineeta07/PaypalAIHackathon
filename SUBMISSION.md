# FairLoop: Devpost submission

## Tagline (≤ 200 chars)

Interest-free loans between people who trust each other, repaid automatically from each PayPal sale, with AI-drafted fair terms and hardship pauses.

## Inspiration

Millions of people with small, irregular incomes, like home bakers, tailors, tutors and delivery riders, can't get fair credit. They turn to moneylenders, or borrow from family, where awkward reminders and unclear terms quietly damage relationships. Fixed weekly payments don't fit their income: one slow week forces a default. We wanted the kindness of a family loan with the reliability of software.

## What it does

FairLoop lets a lender (a sister abroad, a friend, a community group) and a borrower agree on a 0% loan that is repaid as a share of what the borrower earns.

- The borrower describes the need in plain English. **Gemini** checks affordability against their real income history and drafts a clear agreement: sliding share tiers, a weekly minimum below which nothing is taken, a weekly cap, a pause rule and an end-of-term action.
- Both people approve. Any edit resets both approvals, and the agreed terms are hashed with SHA-256.
- The lender funds the loan with **PayPal Checkout (Orders v2)**, and FairLoop disburses it to the borrower with **PayPal Payouts**.
- Customers pay the borrower on a public page. After each capture, a deterministic engine splits the payment into one **Payouts** batch: the lender's share and the borrower's remainder, each with a written reason.
- Slow week? Nothing is taken. Sick? The borrower asks in their own words, the AI turns it into a structured hardship request, and the lender approves it. Terms can never get harsher automatically.
- A **PayPal Subscriptions** safeguard stays suspended unless FairLoop sales stop for 3 weeks, so the lender is protected without anyone sending reminders.
- An **AG Grid** ledger records every event in a verifiable hash chain.
- A **voice assistant**: tap the mic and speak Hindi, English, French or Spanish. It answers from live loan data in the language you spoke, reads the answer aloud, opens the right page and fills in forms (for example a hardship request), but it can never approve or move money. Built with Gemini function calling plus the browser's speech recognition and speech synthesis.
- FairLoop installs as an app (PWA) with home-screen shortcuts and an offline shell.
- A guided tour, a live demo-progress checklist and a "Next step" card mean judges and first-time users always know what to do next. The homepage has an interactive calculator that shows how a week's sales are split.
- The whole app works in **English, Hindi, French and Spanish**. Gemini drafts the agreement in the borrower's language, and every amount, hardship request and notification can be read in the viewer's own language.

## How we built it

Node 22 and Express 5 on the server, with React, Vite, TypeScript, Tailwind, Framer Motion and Recharts on the frontend, and AG Grid Community for the ledger. The repayment engine is pure JavaScript working in integer cents and covered by `node:test`. The PayPal client handles OAuth token caching, a `PayPal-Request-Id` on every POST, idempotent payout batches and readable errors, and it has a simulated twin with the same interface so judges can run everything with zero keys. Gemini is called over REST with function calling and `responseSchema` structured output, and every AI function has a deterministic offline fallback. It is deployed on Render with a Blueprint, and Playwright drives the entire demo end to end.

## Challenges we ran into

- Making repayment fair mid-week: when later sales push income over the minimum, deductions must start without retroactively charging earlier sales.
- Making sure AI can never move money or make terms harsher. We solved it by separation: the model proposes, humans approve, and the engine enforces bounds and an "is this harsher?" check.
- Designing the diversion safeguard so it never fires during an agreed hardship pause.

## Accomplishments that we're proud of

- A complete, working loop: request, AI agreement, two-party approval, PayPal funding, payout, sales splits, hardship, payoff.
- 23 automated tests plus a full browser click-through. It runs with one command and zero keys.
- It feels like a real fintech product: mobile-first, dark mode, accessible, and every number explained.

## What we learned

PayPal's building blocks (Orders, Payouts, Subscriptions, Webhooks) compose into something new when you treat them as rails rather than a checkout. We also learned that AI is most trustworthy when it is boxed in: drafting and explaining, never deciding.

## What's next for FairLoop

PayPal Multiparty so funds never touch the platform, real accounts and invitations, more languages (Tamil, Bengali, Swahili), lending circles, and licensed partners for commercial lending.

## Gallery and thumbnail

Use `docs/brand/social-card.png` (1280×640) as the Devpost thumbnail and the first gallery image, followed by the screenshots in `docs/screenshots/`. The FairLoop mark (a ring with one lifted mint segment) stands for a loop of trust where a fair share of each sale goes back.

## Built with

paypal-orders-v2 · paypal-payouts · paypal-subscriptions · paypal-js-sdk · paypal-webhooks · google-gemini · node.js · express · react · typescript · vite · tailwindcss · framer-motion · recharts · ag-grid · render · playwright · web-speech-api · pwa · i18n

---

## Demo video script (2:45)

| Time | Screen | Voice-over |
|---|---|---|
| 0:00–0:15 | Landing page | "Ravi bakes cakes from home. He needs a $300 oven. A bank won't help, and borrowing from his sister Maya could strain the relationship. This is FairLoop." |
| 0:15–0:35 | Ravi's dashboard: type the request, click **Draft my agreement** | "Ravi just says what he needs. Gemini checks it against his last eight weeks of sales and calls our affordability function." |
| 0:35–0:55 | Agreement card, payoff chart, hash | "It drafts plain-English terms: 15% of each sale, 20% in great weeks, nothing in weeks under $30, at most $20 a week. The chart shows payoff in about 25 weeks. The terms are hashed." |
| 0:55–1:05 | Approve as Ravi, switch to Maya, Approve | "Both must approve. Any edit resets both approvals." |
| 1:05–1:15 | Ravi: **Approve fallback with PayPal** | "Ravi approves a $5/week PayPal subscription that's suspended immediately. It's a safeguard that only wakes up if FairLoop sales stop for three weeks." |
| 1:15–1:30 | Maya: **Fund with PayPal** (sandbox popup), payout status | "Maya funds the loan with PayPal Checkout. FairLoop captures it and sends it to Ravi with PayPal Payouts." |
| 1:30–1:50 | `/pay/ravi`: pick the chocolate cake, pay | "A customer buys a $40 cake. After capture, one payout batch splits it: $6 to Maya, $34 to Ravi, with the reason written out." |
| 1:50–2:05 | **Simulate a slow week**, ledger shows "Skipped" | "In a slow week, under the minimum, nothing is taken. No reminders, no default." |
| 2:05–2:25 | "I'm having a hard week": the sick message; Maya approves | "Ravi was sick. He asks in his own words, the AI structures it as a two-week pause, and Maya approves. Terms can never get harsher automatically." |
| 2:25–2:38 | Simulate good weeks, "Loan repaid 🎉" | "When the balance hits zero, the last deduction is capped, deductions stop and the safeguard is cancelled." |
| 2:38–2:45 | Ledger: **Verify chain** | "Every event is hash-chained in an AG Grid ledger. FairLoop: credit built on trust, enforced by code, powered by PayPal." |
