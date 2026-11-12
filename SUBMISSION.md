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

## Demo video script (3:00)

The full, recording-ready script is in [`docs/PITCH.md`](docs/PITCH.md): the spoken pitch, a pre-recording checklist, timed narration with on-screen actions, and backup lines. The timeline:

| Time | Scene |
|---|---|
| 0:00–0:20 | Hook: Ravi, his irregular income, the oven he needs |
| 0:20–0:40 | Problem: no fair credit, awkward family loans, fixed repayments break in slow weeks |
| 0:40–0:55 | Solution: homepage calculator; a slow week takes nothing |
| 0:55–1:20 | Ravi asks by voice; Gemini drafts plain-language terms and a payoff chart |
| 1:20–1:40 | Both approve the hashed terms; Maya funds with PayPal Checkout, then a Payouts disbursement |
| 1:40–2:00 | A customer buys a $40 cake: one PayPal payment split $6 / $34 automatically |
| 2:00–2:25 | Slow week skipped; Ravi asks for a pause in Hindi by voice; Maya approves |
| 2:25–2:45 | Hash-chained ledger, Verify chain; how it's built (PayPal + Gemini + rules engine) |
| 2:45–3:00 | Impact and close |
