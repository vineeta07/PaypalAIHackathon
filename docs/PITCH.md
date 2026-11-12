# FairLoop: pitch and 3-minute video script

## The pitch (read this aloud: about 60 seconds)

> Ravi bakes cakes from home. Some weeks he earns $120. Some weeks, $40. He needs $300 for a new oven, and no bank will lend to him.
>
> His sister Maya would help. But anyone who has lent money to family knows how that goes: no clear terms, awkward reminders, a missed payment, and suddenly it's not about the money any more.
>
> And every normal loan has the same flaw for people like Ravi: a fixed payment. One slow week, and a fair loan becomes a default.
>
> **FairLoop fixes both.** Ravi and Maya agree on an interest-free loan that's repaid from what Ravi actually earns. His customers pay him through PayPal, and every time they do, a small agreed share goes back to Maya automatically. In a good week it repays faster. In a slow week, nothing is taken. If he's sick, he asks for a pause in his own words, in his own language, and Maya decides.
>
> AI writes the agreement in plain language, checks it's affordable against his real income, and answers questions by voice in English, Hindi, French or Spanish. But the AI never touches the money. PayPal moves it, tested code enforces the rules, and both people approve every change.
>
> **No interest. No reminders. No defaults from a bad week. Just a loan that keeps the relationship intact.**

### One-line versions

- **Tagline:** Interest-free loans between people who trust each other, repaid automatically from what the borrower earns, through PayPal.
- **Ten seconds:** "FairLoop turns a family loan into a fair agreement that repays itself: a small share of every PayPal sale goes back to the lender, and nothing is taken in a slow week."

---

## Before you record (5-minute checklist)

1. **Use Chrome** on a laptop (the microphone works there). Set browser zoom to 110% and hide the bookmarks bar.
2. **Use the real PayPal sandbox if you can**: add the keys to `.env` and restart, so the real PayPal popup appears. If not, simulated mode is fine; the badge says so honestly.
3. Open http://localhost:3000. In the sidebar, click **Reset demo**. Choose **English** and **Light** theme.
4. Close the "New here?" tour prompt (**Not now**).
5. Test the mic once: open **Ask FairLoop**, allow microphone access, say "How much is left?", then click **Reset demo** again.
6. Keep two tabs ready if you like: the app, and the GitHub repo (for the last 5 seconds).
7. Record at 1080p. Speak a little slower than feels natural (about 150 words a minute). The script below is about 420 words.

---

## The 3-minute video script

Each section gives the **time**, what to **show** on screen, and what to **say**. Bold phrases in the narration are worth landing with emphasis.

### 0:00–0:20 · Hook

**Show:** the FairLoop homepage (logo, headline, payment preview card).

**Say:**
> "This is Ravi. He bakes cakes from home and earns between forty and a hundred and twenty dollars a week. He needs three hundred dollars for a new oven. A bank won't lend to him, and borrowing from his sister could cost him something worth more than money."

### 0:20–0:40 · The problem

**Show:** scroll slowly through "The problem" cards, then stop on the calculator.

**Say:**
> "Millions of small earners face this. Fair credit is out of reach, family loans get awkward, and **fixed repayments break the moment you have a slow week**. The problem isn't that people won't repay. It's that repayment doesn't match how they earn."

### 0:40–0:55 · The solution

**Show:** drag the calculator slider from $85 down to $20 (Maya gets $0.00), then up to $150.

**Say:**
> "FairLoop is an **interest-free loan that repays from what you earn**. Every PayPal sale sends a small agreed share back to the lender. Slow week? **Nothing is taken.** Good week? It repays faster."

### 0:55–1:20 · Ravi asks, by voice

**Show:** click **Ravi · Borrower** in the sidebar. Click **Ask FairLoop**, tap the **mic**, and say the line below. The assistant fills in the form. Click **Draft my agreement**; the agreement card and payoff chart appear.

**Say into the mic:**
> "I need three hundred dollars for a new oven. I earn about forty to a hundred and twenty dollars a week."

**Then say:**
> "Ravi just talks. **Gemini** checks his last eight weeks of real sales, and drafts the terms in plain language: fifteen percent of each sale, nothing in weeks under thirty dollars, never more than twenty a week, and a payoff chart. The AI proposes. It can't approve anything."

### 1:20–1:40 · Both approve, Maya funds with PayPal

**Show:** click **Approve as Ravi**. Use the **Next step** card to open Maya's view and click **Approve as Maya**. Back as Ravi, click **Approve fallback with PayPal**. As Maya, click **Fund with PayPal** (complete the sandbox popup if you're using real keys).

**Say:**
> "The loan only starts when **both** approve the exact same terms, which are hashed, so any change resets both approvals. Maya funds it with **PayPal Checkout**, and FairLoop sends it straight to Ravi with **PayPal Payouts**."

### 1:40–2:00 · A customer buys a cake

**Show:** click **Customer pay page**, pick the **Chocolate celebration cake**, then pay. The thank-you screen shows the share going to Maya. Then open **Ravi · Borrower** to show the split under **Recent payments**.

**Say:**
> "Now a customer buys a forty-dollar cake. One PayPal payment, **split automatically**: six dollars back to Maya, thirty-four to Ravi, with the reason written out. No reminders. No awkward messages."

### 2:00–2:25 · A hard week, in his own language

**Show:** click **Slow week ($21)** under Simulate a week; the timeline shows *Skipped: below weekly minimum*. Then open **Ask FairLoop**, set **Voice language** to **हिन्दी**, tap the mic and say the Hindi line. The hardship form opens, filled in. Press **Send**. Switch to **Maya** and click **Approve**.

**Say into the mic (Hindi):**
> "मैं इस हफ़्ते बीमार था, क्या मैं दो हफ़्ते के लिए किस्तें रोक सकता हूँ?"
> *(I was sick this week; can I pause for two weeks?)*

**Then say:**
> "In a slow week, nothing is taken. And when Ravi gets sick, he asks **in Hindi**. The assistant understands, answers in Hindi, and fills in the request. **Maya** decides. Terms can only get gentler, never harsher."

### 2:25–2:45 · Trust: how it's built

**Show:** click **Ledger**, then click **Verify chain** ("✓ chain intact").

**Say:**
> "Every event is in a **hash-chained ledger** anyone can verify. Under the hood: PayPal Orders, Payouts and Subscriptions as the money rails, Gemini function calling for the AI, and a tested rules engine that decides every cent. **AI helps, people decide, code enforces.**"

### 2:45–3:00 · Impact and close

**Show:** back to the homepage logo, or the social card (`docs/brand/social-card.png`).

**Say:**
> "FairLoop turns the most common loan in the world, help from someone who trusts you, into something **fair, automatic, and kind**. No interest. No reminders. No default from one bad week. **FairLoop: lend to people you trust, and get repaid from what they earn.**"

---

## Backup lines (if something goes wrong while recording)

- **Mic doesn't pick you up:** type the same sentence into the assistant and say, *"You can also type. It works the same way."*
- **The transcript shows "three hundred" in words and the form doesn't fill:** type "$300" in the box. The assistant needs digits for the amount.
- **The PayPal popup is slow:** *"This is the PayPal sandbox. In simulated mode the same flow runs instantly."*
- **Short on time:** skip the 0:20 problem section and go straight from the hook to the solution.

## Why it's impactful (for Q&A or the Devpost text)

- **Repayment that fits how people earn.** A share of income, not a fixed amount. A slow week can't cause a default, because nothing is taken below the minimum.
- **It keeps relationships intact.** The software does the reminding, splitting and record-keeping, so family members don't have to.
- **Zero interest, by design.** It's built for family, friends, community groups and seller platforms, not for profit from the borrower.
- **It works in people's own language,** by voice, which matters most to the people least served by banks.
- **Responsible AI.** The AI drafts, explains and listens, but money only moves through PayPal under rules in tested code, after humans approve.
- **Real rails, ready to grow.** It's built on PayPal Orders, Payouts and Subscriptions today. In production it would use PayPal Multiparty, so FairLoop never holds the money.

> Tip: if you want to quote a global figure in the video (for example, how many adults lack access to formal credit, or how many borrow from family and friends), take it from the latest **World Bank Global Findex** report and name the source on screen. The script above deliberately avoids numbers that haven't been checked.
