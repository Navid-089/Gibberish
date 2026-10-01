# Khoroch

A daily expense tracker built as an installable web app (PWA). Plain HTML, CSS and JavaScript, no build step, no backend. Everything is stored on the device in IndexedDB.

## What it does

- **Home**: what is left to spend this month, a daily spend chart, category breakdown, recent transactions.
- **Budget model**: expected income minus fixed outflows (driver, DPS) minus variable spending. Income and fixed amounts can be adjusted for a single month by tapping the tiles.
- **Accounts**: Cash, Bank, bKash, Card, plus anything you add. Each has an opening balance and moves with every transaction. Savings like DPS can be an account; log the deposit as a transfer.
- **Transaction types**: expense, income, transfer, lend, repayment, borrow, pay back. Lends build an "owed to me" list per person; borrows build an "I owe" list. Net worth adds the first and subtracts the second.
- **History**: a calendar heatmap of the month (tap a day to see just that day, step through days, add on a past day), search, filter by category or type.
- **Daily routine**: things you spend on most days. One-tap items appear on Home as buttons; automatic ones are logged every matching day (every day or Sun to Thu) when the app opens, up to a week back.
- **Lends** can be marked "unlikely to get back"; they stay in the owed list but out of net worth.
- **Data**: export and import as JSON. Nothing leaves the phone unless you export.

## Personal numbers

Salaries, fixed outflows, account opening balances and any first-launch entries live in `js/personal.js`, which is gitignored. Copy `js/personal.example.js` to `js/personal.js` and edit it. Categories and everything else are public code.

## Run locally

```bash
python3 -m http.server 8765
```

Open http://localhost:8765. The service worker only registers on `localhost` or HTTPS.

## Deploy to Vercel

```bash
npm i -g vercel
vercel
```

Or push this folder to GitHub and import the repo at vercel.com; there is no build step, so the defaults work. `vercel.json` only sets cache headers so a new service worker is picked up on the next launch.

## Install on iPhone

Open the deployed URL in Safari, tap **Share**, then **Add to Home Screen**. It then runs full screen, works offline, and keeps its data (Home Screen web apps are exempt from Safari's 7-day storage purge).

## Shortcuts

- `#add` in the URL opens the new-expense sheet on launch (handy for an iOS Shortcut).
- `#history`, `#accounts`, `#settings` open those tabs.
- On a keyboard, `n` opens the add sheet, `Esc` closes it.
- Amounts accept arithmetic: typing `120+80` saves 200.

## Updating

Bump `VERSION` in `sw.js` when you change files, so installed phones fetch the new version.
