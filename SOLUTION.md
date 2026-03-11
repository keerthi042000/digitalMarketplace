## Solution Overview

## Demo video

- Demo walkthrough: **https://drive.google.com/file/d/1Q6lxG1NlpIcIODlFc1zGRXM_o_D0Ye5y/view?usp=sharing**

I implemented a small secondary-trading experience on top of the provided tZERO-style assignment codebase. It consists of:

- **Secondary Marketplace (`app/investing/secondary-trading/page.tsx`)**  
  - Lists all secondary-trading assets from `secondaryTradingAssets.json`.  
  - Users can:
    - Search by asset name/symbol/description.
    - Filter by Category (multi-select) and by Performance (Gainers/Losers, multi-select) or Sort by price (low→high / high→low) or by % change (top gainers).  
  - A card layout shows key data per asset (price, daily performance, 52-week range, tags like “Top gainer”) and navigates to the asset detail page on click.  
  - Empty states:
    - If there are no assets at all, filters are hidden and a simple “No assets available right now” message is shown.
    - If filters hide everything, the page explains “No assets match your filters” and offers a Clear filters button.

- **Asset Detail / Secondary Trading Page (`app/investing/secondary-trading/[id]/page.tsx`)**  
  - Fetches the asset details and shows:
    - About and Company details.
    - Price History chart with a “Chart range” summary, date range inputs (timeline filter), and legend for OHLC series.
    - Order Book with best bid/ask, spread, and a sorted depth view (by “Best prices”, “Price ↑”, or “Largest first”).
    - A Place Order panel (buy/sell) integrated with backend logic.
    - Your Orders & Positions for the current user: Position table (shares, avg cost, est. value, P&L) and Combined orders table (both buy and sell) with columns Side, Qty, Price, Status, Date, and Cancel action and Multi-select filters for Side and Status along with Pagination.
  - Order matching is handled by matchingEngine by inserting the new order into `trading_orders` and finds opposing orders that cross the price constraints and creates trades in `trading_trades`, updates remaining quantities/status and adjusts holdings and trading balances using `upsertHolding` and direct `UPDATE`s.

- **Portfolio Page**  
  - PortfolioSummaryCard in account portfolio page shows total portfolio value, allocation bar (primary invested, trading positions, trading cash, bank cash) with percentages, and quick stats cards.  
  - InvestmentsSection shows:
    - Holdings section: Collapsible card listing trading holdings with search by symbol/title and sort modes (value, P/L, symbol) and per-holding detail (shares, avg cost, current value, P/L, and link to asset detail page) and filters are hidden when there are no holdings, leaving just a clean “No holdings” message.
    - Orders section: Collapsible card showing all trading orders across assets for the user and multi-select filters for Side and Status, search by symbol, and Clear filters and a table with Symbol, Side, Qty, Price, Status, Date along with pagination for long lists. The entire section is hidden when there are no orders at all.
  - Empty state for portfolio: When there are no holdings or orders, the “MY POSITIONS” area shows an illustration and “Let’s find your first investment!” with an **Explore Opportunities** button linking to the secondary marketplace.

## Technical decisions and trade-offs

- **Layout**: I kept the original 8/4 two‑column layout and refined spacing and section headers, instead of rebuilding the pages from scratch.
- **Filters and tables**: I used MUI multi‑selects with checkboxes for all filters (category, performance, side, status) and showed buy/sell orders together in a single table to make them easier to read.
- **Data formatting**: I added a small `formatDateTime` helper so all dates (orders and investments) look the same across the app.
- **Performance**: I wrapped the heavier filter/sort logic (assets, orders, holdings) in `useMemo`, and I only render sections/filters when there is data, to avoid unnecessary work and keep the UI clean.
- **Empty states and conditional rendering**: I hided entire sections when there is no meaningful data for a cleaner experience to avoid presenting the users with filters that can’t produce any result.


## What I’d improve with more time

- Currently the marketplace uses static JSON and the trading pages call a simple API client; with more time I’d Wrap all server interactions in a well-typed data layer and Consider using React Query / SWR for caching, retry, background refetch, and better loading states.
- Add unit tests and coverage for Matching rules in `matchingEngine.ts` (edge cases: partial fills, multiple matches, cancelling orders), Portfolio calculations (P&L, allocation percentages) and Filters (ensuring Side/Status/Performance combinations correctly include/exclude items).
- Add debouncing for text search: Prevent re-filtering on every key stroke by using a small debounce window (e.g. 200–300 ms).
- Use row virtualization for large lists: If this were deployed with hundreds or thousands of orders/holdings, plugging in `react-window` or `react-virtualized` would keep scrolling smooth.
- Introduce shared TypeScript types/enums for: Order sides, Order statuses, Payment statuses, asset categories, etc to reduce magic strings and make it easier to refactor statuses or add new ones.
 - Add automatic logout after inactivity: Implement an idle-timeout mechanism that signs users out after a period of inactivity instead of keeping accounts logged in indefinitely, to improve security.


## Conclusion

Overall, the current implementation focuses on clarity, a clean layout, and a realistic trading workflow while keeping the codebase approachable. The improvements above would mainly help with scalability, maintainability, and polish if this were to evolve into a production system.

