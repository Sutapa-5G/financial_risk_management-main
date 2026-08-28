# Risk Navigator

Build a Financial Risk Modelling Dashboard — a professional, data-dense web app for visualizing credit default risk predictions and portfolio risk analytics.



DESIGN DIRECTION

- Dark theme, fintech/quant aesthetic (think Bloomberg Terminal meets modern SaaS — not generic dashboard templates)

- Deep navy/charcoal background (#0B0F19 or similar), high-contrast white text, one accent color for risk signals (amber/red for high risk, green for low risk, blue for neutral data)

- Monospace font for numbers/metrics (e.g. "JetBrains Mono" or "IBM Plex Mono"), clean sans-serif for labels (Inter or similar)

- Tight, data-dense layout with clear visual hierarchy — this is a tool for analysts, not a marketing site

- Subtle card shadows/borders, no heavy gradients or playful illustrations



PAGES / LAYOUT



1. Overview Dashboard (main landing)

   - Top row: 4 KPI cards — Total Portfolio Value, Overall Default Rate, Expected Loss, Average Risk Score

   - A large line/area chart showing default rate trend over time (last 12 months, mock data)

   - A donut/pie chart showing portfolio breakdown by risk tier (Low / Medium / High / Critical)

   - A recent activity table — list of most recent loan applications scored, with columns: Applicant ID, Loan Amount, Risk Score (0-100), Predicted PD (%), Risk Tier (colored badge), Status



2. Risk Scoring Page

   - A form/panel on the left to input borrower features: income, loan amount, credit utilization %, debt-to-income ratio, credit history length, number of open accounts, employment length

   - On submit, show a result panel on the right: Predicted Probability of Default (large %, color-coded gauge chart), Risk Tier badge, Expected Loss ($), and a horizontal bar chart of top contributing features (SHAP-style feature importance, red bars pushing risk up, green bars pushing risk down)



3. Portfolio Analytics Page

   - Filterable/sortable data table of all loans (mock ~50 rows) with columns: ID, Loan Amount, Interest Rate, Term, Risk Score, PD %, LGD %, Expected Loss, Status

   - Filters: risk tier, loan amount range, status

   - A stacked bar chart showing Expected Loss by risk tier

   - A stress-test panel: sliders for "Unemployment Rate Shock (%)" and "Interest Rate Shock (%)" that dynamically recalculate and show updated portfolio default rate and expected loss (mock calculation logic, doesn't need to be a real model)



4. Model Performance Page

   - Cards showing model metrics: AUC-ROC, Precision, Recall, F1, KS Statistic

   - ROC curve chart

   - Confusion matrix (styled as a 2x2 grid with color intensity by value)

   - Calibration plot (predicted vs actual default rate by decile)



NAVIGATION

- Left sidebar with icons + labels: Overview, Risk Scoring, Portfolio Analytics, Model Performance, Settings

- Collapsible sidebar, active page highlighted with accent color



DATA

- Use realistic mock/dummy data throughout (generate believable loan/borrower data, risk scores, PD percentages) — no backend required yet, all data can be hardcoded JSON/mock arrays that I can later wire up to a real API

- Structure mock data cleanly in separate files/constants so it's easy to swap for real API calls later



COMPONENTS

- Use charts (line, bar, donut, gauge) — Recharts is fine

- Data tables should be sortable and support pagination

- Risk tier badges: Low = green, Medium = yellow/amber, High = orange, Critical = red

- Responsive design, but optimize primarily for desktop/laptop screens (this is an analyst tool)



Make it feel like a real, polished internal tool used by a bank's risk team — precise, trustworthy, and information-rich, not flashy.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/03d8b9fa-81c9-4e24-afa8-bd93901973d2).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
