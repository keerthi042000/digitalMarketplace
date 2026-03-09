## Solution Overview

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

## Key technical decisions and trade-offs

### 1. UI layout and component structure

- **Decision**: Keep the original layout spirit but refine it instead of rewriting from scratch.  
  - The asset detail page keeps `md=8/4` columns and uses `Paper` + `Grid` + `Box` to control vertical spacing and equal heights for paired sections.
  - Section titles use a shared `sectionTitleSx` / `sectionTitleTextSx` styling pattern for a consistent, “catchy” look.
- **Trade-off**:  
  - This keeps the code relatively flat and easy to navigate in a single file, but some components (especially `[id]/page.tsx` and `InvestmentsSection.tsx`) are large. With more time, I’d extract subcomponents to reduce file size and make reuse easier.

### 2. Filters and multi-select UX

- **Decision**: Use **MUI `Select` with `multiple` + `Checkbox` + `ListItemText`** for:
  - Orders Side/Status filters (both in portfolio and asset detail).
  - Secondary marketplace Category and Performance filters.
- **Trade-offs**:
  - Pros: Very compact, discoverable UI; consistent with MUI patterns; easy to extend with more options later.
  - Cons: Code is somewhat verbose (repeating the same pattern in a couple of places). I favored duplication and explicitness for clarity within this assignment over premature abstraction.

### 3. Combined orders view (asset detail & portfolio)

- **Decision**:
  - Asset detail: present **a single orders table** per asset with filters, rather than separate Buy/Sell tables.
  - Portfolio: present all trading orders for the user with similar filters and a single table.
- **Trade-offs**:
  - Improves scan-ability and reduces visual noise: one place to see orders, consistent columns.
  - Requires careful date formatting and alignment to avoid crowded columns; I chose a relatively compact but readable layout and slightly increased font size.

### 4. Date formatting consistency

- **Decision**: Introduce a single helper `formatDateTime` in `lib/dateUtils.ts` and use it wherever an order or investment timestamp is shown.
- **Trade-off**:
  - Single point of change (good for future localization or stylistic changes) at the cost of one more small shared module.

### 5. Performance optimizations (memoization & compute placement)

- **Decision**: Add `useMemo` for:
  - `filteredAssets` and `sortedAssets` in the marketplace.
  - `filteredOrders` in the asset detail page.
  - `secondaryTradingInvestments`, `sortedTradingOrders`, and the date formatting for portfolio tables.
  - This prevents re-running filter/sort logic on every render when inputs haven’t changed.
- **Trade-offs**:
  - For small data sets (like this assignment), the performance gain is minor, but:
    - It documents *where* heavy computation lives.
    - It scales better if you later plug in real data or larger tables.

### 6. Empty states and conditional rendering

- **Decision**:
  - Hide entire sections when there is no meaningful data:
    - Orders section in portfolio is hidden when `tradingOrders.length === 0`.
    - Holdings filters are hidden when there are no holdings.
    - Marketplace filters are hidden when there are no assets (only a “No assets available” card is shown).
  - Use different copy depending on whether filters are active or not.
- **Trade-offs**:
  - Slightly more conditionals in JSX, but a cleaner experience:
    - Users aren’t presented with filters that can’t produce any result.
    - The cause of “no results” is clearer (no assets vs. filters too strict).


## What I’d improve with more time

- Currently the marketplace uses static JSON and the trading pages call a simple API client; with more time I’d Wrap all server interactions in a well-typed data layer and Consider using React Query / SWR for caching, retry, background refetch, and better loading states.
- Add unit tests and coverage for Matching rules in `matchingEngine.ts` (edge cases: partial fills, multiple matches, cancelling orders), Portfolio calculations (P&L, allocation percentages) and Filters (ensuring Side/Status/Performance combinations correctly include/exclude items).
- Add debouncing for text search: Prevent re-filtering on every key stroke by using a small debounce window (e.g. 200–300 ms).
- Use row virtualization for large lists: If this were deployed with hundreds or thousands of orders/holdings, plugging in `react-window` or `react-virtualized` would keep scrolling smooth.
- Introduce shared TypeScript types/enums for: Order sides, Order statuses, Payment statuses, asset categories, etc to reduce magic strings and make it easier to refactor statuses or add new ones.


## Conclusion

Overall, the current implementation focuses on clarity, a clean layout, and a realistic trading workflow while keeping the codebase approachable. The improvements above would mainly help with scalability, maintainability, and polish if this were to evolve into a production system.

