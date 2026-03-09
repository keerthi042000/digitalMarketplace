'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Box, Typography, Button, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, IconButton, Pagination, TextField, InputAdornment, FormControl, InputLabel, Select, MenuItem, Checkbox, ListItemText } from '@mui/material'
import { ExpandMore, ExpandLess, Search, TrendingUp, TrendingDown, OpenInNew } from '@mui/icons-material'
import { useTheme } from '@mui/material/styles'
import InvestmentLookupIllustration from './InvestmentLookupIllustration'
import styles from './InvestmentsSection.module.css'
import type { TradingHolding, TradingOrder } from './CashBalance'
import secondaryTradingAssets from '@/data/secondaryTradingAssets.json'

interface Investment {
  id: string
  asset_id: string
  asset_type: string
  asset_title: string
  amount: number
  currency: string
  payment_method_type: string
  payment_status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED'
  created_at: string
}

interface InvestmentsSectionProps {
  isPositionsExpanded?: boolean
  onTogglePositions?: () => void
  tradingHoldings?: TradingHolding[]
  tradingOrders?: TradingOrder[]
  initialExpandedSection?: 'holdings' | 'orders' | null
  onExpandedSectionApplied?: () => void
}

export default function InvestmentsSection({
  isPositionsExpanded = false,
  onTogglePositions,
  tradingHoldings = [],
  tradingOrders = [],
  initialExpandedSection = null,
  onExpandedSectionApplied,
}: InvestmentsSectionProps) {
  const router = useRouter()
  const theme = useTheme()
  const ordersSectionRef = useRef<HTMLDivElement>(null)
  const [investments, setInvestments] = useState<Investment[]>([])
  const [loading, setLoading] = useState(true)
  const [holdingsPage, setHoldingsPage] = useState(1)
  const [ordersPage, setOrdersPage] = useState(1)
  const [primaryPage, setPrimaryPage] = useState(1)
  const [holdingsExpanded, setHoldingsExpanded] = useState(false)
  const [ordersExpanded, setOrdersExpanded] = useState(false)
  const [primaryExpanded, setPrimaryExpanded] = useState(true)
  const [holdingsSearch, setHoldingsSearch] = useState('')
  const [ordersSearch, setOrdersSearch] = useState('')
  const [ordersSideFilter, setOrdersSideFilter] = useState<string[]>([])
  const [ordersStatusFilter, setOrdersStatusFilter] = useState<string[]>([])
  const [holdingsSort, setHoldingsSort] = useState<'valueDesc' | 'valueAsc' | 'pnlDesc' | 'pnlAsc' | 'symbol'>('valueDesc')

  useEffect(() => {
    fetchInvestments()
  }, [])

  const fetchInvestments = async () => {
    try {
      const response = await fetch('/api/investments')
      if (response.ok) {
        const data = await response.json()
        setInvestments(data.investments || [])
      }
    } catch (error) {
      console.error('Error fetching investments:', error)
    } finally {
      setLoading(false)
    }
  }


  // Group investments by asset type (marketplace / secondary trading only)
  const secondaryTradingInvestments = investments.filter(
    (inv) => inv.asset_type === 'SECONDARY_TRADING'
  )

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return dateString
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount)
  }

  const getPaymentMethodLabel = (type: string) => {
    switch (type) {
      case 'TZERO_BALANCE':
        return 'tZERO Balance'
      case 'ACH':
        return 'Bank Account'
      case 'CREDIT_CARD':
        return 'Credit Card'
      default:
        return type
    }
  }

  const hasPositions =
    secondaryTradingInvestments.length > 0 ||
    tradingHoldings.length > 0 ||
    tradingOrders.length > 0

  const hasHoldings = tradingHoldings.length > 0
  const hasOrders = tradingOrders.length > 0
  const hasPrimary = secondaryTradingInvestments.length > 0

  const assetsList = (secondaryTradingAssets as { investments?: { id: string; symbol: string }[] }).investments ?? []
  const getAssetIdBySymbol = (symbol: string) => assetsList.find((a) => a.symbol === symbol)?.id

  // When parent asks to focus a section (e.g. Orders from All History): expand and scroll into view
  useEffect(() => {
    if (initialExpandedSection === 'orders') {
      setOrdersExpanded(true)
      setHoldingsExpanded(false)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          ordersSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          onExpandedSectionApplied?.()
        })
      })
    } else if (initialExpandedSection === 'holdings') {
      setHoldingsExpanded(true)
      onExpandedSectionApplied?.()
    }
  }, [initialExpandedSection, onExpandedSectionApplied])

  const sortedTradingOrders = [...tradingOrders].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )

  const searchLower = (s: string) => s.trim().toLowerCase()
  const holdingsSearchLower = searchLower(holdingsSearch)
  const filteredHoldings = tradingHoldings
    .filter((h) => {
      if (!holdingsSearchLower) return true
      const title = (h.assetTitle ?? '').toLowerCase()
      const sym = h.symbol.toLowerCase()
      return title.includes(holdingsSearchLower) || sym.includes(holdingsSearchLower)
    })
    .sort((a, b) => {
      const valA = (a.currentPrice ?? a.avgCost) * a.shares
      const valB = (b.currentPrice ?? b.avgCost) * b.shares
      const pnlA = ((a.currentPrice ?? a.avgCost) - a.avgCost) * a.shares
      const pnlB = ((b.currentPrice ?? b.avgCost) - b.avgCost) * b.shares
      switch (holdingsSort) {
        case 'valueDesc': return valB - valA
        case 'valueAsc': return valA - valB
        case 'pnlDesc': return pnlB - pnlA
        case 'pnlAsc': return pnlA - pnlB
        case 'symbol': return (a.symbol ?? '').localeCompare(b.symbol ?? '')
        default: return valB - valA
      }
    })

  const ordersSearchLower = searchLower(ordersSearch)
  const filteredOrders = sortedTradingOrders.filter((o) => {
    if (ordersSideFilter.length > 0 && !ordersSideFilter.includes(o.side.toLowerCase())) return false
    if (ordersStatusFilter.length > 0 && !ordersStatusFilter.includes(o.status)) return false
    if (ordersSearchLower && !o.symbol.toLowerCase().includes(ordersSearchLower)) return false
    return true
  })

  const PAGE_SIZE = 5
  const holdingsPaged = filteredHoldings.slice((holdingsPage - 1) * PAGE_SIZE, holdingsPage * PAGE_SIZE)
  const ordersPaged = filteredOrders.slice((ordersPage - 1) * PAGE_SIZE, ordersPage * PAGE_SIZE)
  const holdingsPages = Math.max(1, Math.ceil(filteredHoldings.length / PAGE_SIZE))
  const ordersPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE))
  const primaryPaged = secondaryTradingInvestments.slice((primaryPage - 1) * PAGE_SIZE, primaryPage * PAGE_SIZE)
  const primaryPages = Math.max(1, Math.ceil(secondaryTradingInvestments.length / PAGE_SIZE))

  useEffect(() => {
    if (holdingsPage > holdingsPages && holdingsPages >= 1) setHoldingsPage(holdingsPages)
  }, [holdingsPages, holdingsPage])
  useEffect(() => {
    if (ordersPage > ordersPages && ordersPages >= 1) setOrdersPage(ordersPages)
  }, [ordersPages, ordersPage])
  useEffect(() => {
    if (primaryPage > primaryPages && primaryPages >= 1) setPrimaryPage(primaryPages)
  }, [primaryPages, primaryPage])
  useEffect(() => { setHoldingsPage(1) }, [holdingsSearch, holdingsSort])
  useEffect(() => { setOrdersPage(1) }, [ordersSearch, JSON.stringify(ordersSideFilter), JSON.stringify(ordersStatusFilter)])

  if (loading) {
    return (
      <Box className={styles.investmentsSection}>
        <Typography variant="h6" className={styles.sectionTitle}>
          MY POSITIONS
        </Typography>
        <Paper className={styles.investmentsCard}>
          <Typography variant="body2" sx={{ color: '#888888', textAlign: 'center', py: 4 }}>
            Loading investments...
          </Typography>
        </Paper>
      </Box>
    )
  }

  if (!hasPositions) {
    return (
      <Box className={styles.investmentsSection}>
        <Typography variant="h6" className={styles.sectionTitle}>
          MY POSITIONS
        </Typography>
        <Paper className={styles.investmentsCard}>
          <Box className={styles.illustrationContainer}>
            <InvestmentLookupIllustration />
          </Box>
          <Typography variant="h6" className={styles.investmentsTitle}>
            Let&apos;s find your first investment!
          </Typography>
          <Button
            variant="contained"
            className={styles.exploreButton}
            onClick={() => router.push('/investing/secondary-trading')}
          >
            Explore Opportunities
          </Button>
        </Paper>
      </Box>
    )
  }

  return (
    <Box className={styles.investmentsSection}>
      <Typography variant="h6" className={styles.sectionTitle}>
        MY POSITIONS
      </Typography>

      {/* Section 1: Holdings */}
      <Paper className={styles.collapsibleSection}>
        <Box
          className={styles.sectionHeader}
          onClick={() => setHoldingsExpanded((prev) => !prev)}
          sx={{ cursor: 'pointer' }}
        >
          <Typography variant="h6" className={styles.categoryTitle}>
            Holdings {hasHoldings ? `(${tradingHoldings.length})` : ''}
          </Typography>
          <IconButton size="small" sx={{ color: '#ffffff' }}>
            {holdingsExpanded ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        </Box>
        {holdingsExpanded && (
          <Box className={styles.sectionContent}>
            <Box className={styles.filterBar}>
              <TextField
                size="small"
                placeholder="Search by symbol"
                value={holdingsSearch}
                onChange={(e) => setHoldingsSearch(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 20 }} />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  minWidth: 220,
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    borderRadius: 2,
                    bgcolor: 'rgba(255,255,255,0.06)',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' },
                    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                  },
                }}
              />
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel sx={{ color: 'rgba(255,255,255,0.7)' }}>Sort by</InputLabel>
                <Select
                  value={holdingsSort}
                  label="Sort by"
                  onChange={(e) => setHoldingsSort(e.target.value as typeof holdingsSort)}
                  sx={{
                    color: '#fff',
                    borderRadius: 2,
                    bgcolor: 'rgba(255,255,255,0.06)',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.12)' },
                  }}
                >
                  <MenuItem value="valueDesc">Value (high → low)</MenuItem>
                  <MenuItem value="valueAsc">Value (low → high)</MenuItem>
                  <MenuItem value="pnlDesc">P/L (gain → loss)</MenuItem>
                  <MenuItem value="pnlAsc">P/L (loss → gain)</MenuItem>
                  <MenuItem value="symbol">Symbol A–Z</MenuItem>
                </Select>
              </FormControl>
              {(holdingsSearch || holdingsSort !== 'valueDesc') && (
                <Button
                  size="small"
                  onClick={() => { setHoldingsSearch(''); setHoldingsSort('valueDesc') }}
                  sx={{ textTransform: 'none', color: 'rgba(255,255,255,0.6)', fontSize: 12 }}
                >
                  Clear filters
                </Button>
              )}
            </Box>
            {/* <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', mb: 2, fontSize: 12 }}>
              {filteredHoldings.length} position{filteredHoldings.length !== 1 ? 's' : ''}
              {holdingsSearch ? ' matching search' : ''} · page {holdingsPage} of {holdingsPages}
            </Typography> */}
            <Box className={styles.cardsGrid}>
              {filteredHoldings.length === 0 ? (
                <Box sx={{ gridColumn: '1 / -1', textAlign: 'center', py: 4, color: 'rgba(255,255,255,0.5)' }}>
                  {holdingsSearch ? 'No holdings match your search.' : 'No holdings.'}
                </Box>
              ) : (
                holdingsPaged.map((h) => {
                  const currentPrice = h.currentPrice ?? h.avgCost
                  const currentVal = h.shares * currentPrice
                  const pnl = (currentPrice - h.avgCost) * h.shares
                  const pnlColor = pnl > 0 ? theme.palette.primary.main : pnl < 0 ? '#ff6b6b' : 'rgba(255,255,255,0.5)'
                  const assetId = getAssetIdBySymbol(h.symbol)
                  return (
                    <Paper key={h.symbol} className={styles.holdingCard} elevation={0}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#fff' }}>
                          {h.assetTitle ?? h.symbol}
                        </Typography>
                        <Chip label={h.symbol} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 11 }} />
                      </Box>
                      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 1, color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>
                        <span>{h.shares} shares</span>
                        <span>Avg {formatCurrency(h.avgCost)}</span>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1.5, pt: 1.5, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                        <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600 }}>
                          {formatCurrency(currentVal)}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          {pnl !== 0 && (pnl > 0 ? <TrendingUp sx={{ fontSize: 16, color: pnlColor }} /> : <TrendingDown sx={{ fontSize: 16, color: pnlColor }} />)}
                          <Typography variant="body2" sx={{ color: pnlColor, fontWeight: 600 }}>
                            {formatCurrency(pnl)}
                          </Typography>
                        </Box>
                      </Box>
                      {assetId && (
                        <Button
                          variant="text"
                          size="small"
                          endIcon={<OpenInNew sx={{ fontSize: 12 }} />}
                          onClick={(e) => { e.stopPropagation(); router.push(`/investing/secondary-trading/${assetId}`) }}
                          sx={{
                            mt: 1,
                            minWidth: 'auto',
                            px: 0.75,
                            py: 0.25,
                            textTransform: 'none',
                            fontSize: 11,
                            fontWeight: 500,
                            color: 'rgba(255,255,255,0.65)',
                            '&:hover': {
                              bgcolor: 'rgba(255,255,255,0.06)',
                              color: 'rgba(255,255,255,0.85)',
                            },
                          }}
                        >
                          View asset page
                        </Button>
                      )}
                    </Paper>
                  )
                })
              )}
            </Box>
            {filteredHoldings.length > 0 && holdingsPages > 1 && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                <Pagination
                  count={holdingsPages}
                  page={holdingsPage}
                  onChange={(_, p) => setHoldingsPage(p)}
                  color="primary"
                  size="small"
                  sx={{ '& .MuiPaginationItem-root': { color: '#fff' } }}
                />
              </Box>
            )}
          </Box>
        )}
      </Paper>

      {/* Section 2: Orders */}
      <Paper ref={ordersSectionRef} className={styles.collapsibleSection}>
        <Box
          className={styles.sectionHeader}
          onClick={() => setOrdersExpanded((prev) => !prev)}
          sx={{ cursor: 'pointer' }}
        >
          <Typography variant="h6" className={styles.categoryTitle} sx={{ fontSize: 20 }}>
            Orders {hasOrders ? `(${tradingOrders.length})` : ''}
          </Typography>
          <IconButton size="small" sx={{ color: '#ffffff' }}>
            {ordersExpanded ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        </Box>
        {ordersExpanded && (
          <Box className={styles.sectionContent}>
            <Box className={styles.filterBar}>
              <TextField
                size="small"
                placeholder="Search by symbol..."
                value={ordersSearch}
                onChange={(e) => setOrdersSearch(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 20 }} />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  minWidth: 200,
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    borderRadius: 2,
                    bgcolor: 'rgba(255,255,255,0.06)',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' },
                    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                  },
                }}
              />
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel sx={{ color: 'rgba(255,255,255,0.7)' }}>Side</InputLabel>
                <Select
                  multiple
                  value={ordersSideFilter}
                  label="Side"
                  onChange={(e) => setOrdersSideFilter(typeof e.target.value === 'string' ? [] : e.target.value)}
                  renderValue={(selected) => (selected.length === 0 ? 'All' : selected.map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(', '))}
                  sx={{
                    color: '#fff',
                    borderRadius: 2,
                    bgcolor: 'rgba(255,255,255,0.06)',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.12)' },
                  }}
                >
                  <MenuItem value="buy">
                    <Checkbox checked={ordersSideFilter.includes('buy')} size="small" sx={{ color: 'rgba(255,255,255,0.7)' }} />
                    <ListItemText primary="Buy" />
                  </MenuItem>
                  <MenuItem value="sell">
                    <Checkbox checked={ordersSideFilter.includes('sell')} size="small" sx={{ color: 'rgba(255,255,255,0.7)' }} />
                    <ListItemText primary="Sell" />
                  </MenuItem>
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel sx={{ color: 'rgba(255,255,255,0.7)' }}>Status</InputLabel>
                <Select
                  multiple
                  value={ordersStatusFilter}
                  label="Status"
                  onChange={(e) => setOrdersStatusFilter(typeof e.target.value === 'string' ? [] : e.target.value)}
                  renderValue={(selected) => (selected.length === 0 ? 'All' : selected.join(', '))}
                  sx={{
                    color: '#fff',
                    borderRadius: 2,
                    bgcolor: 'rgba(255,255,255,0.06)',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.12)' },
                  }}
                >
                  {[...new Set(tradingOrders.map((o) => o.status))].sort().map((s) => (
                    <MenuItem key={s} value={s}>
                      <Checkbox checked={ordersStatusFilter.includes(s)} size="small" sx={{ color: 'rgba(255,255,255,0.7)' }} />
                      <ListItemText primary={s} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              {(ordersSearch || ordersSideFilter.length > 0 || ordersStatusFilter.length > 0) && (
                <Button
                  size="small"
                  onClick={() => { setOrdersSearch(''); setOrdersSideFilter([]); setOrdersStatusFilter([]) }}
                  sx={{ textTransform: 'none', color: 'rgba(255,255,255,0.6)', fontSize: 12 }}
                >
                  Clear filters
                </Button>
              )}
            </Box>
            {(ordersSearch || ordersSideFilter.length > 0 || ordersStatusFilter.length > 0) && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.75, mb: 1.5 }}>
                <Typography component="span" sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, mr: 0.5 }}>
                  Active:
                </Typography>
                {ordersSearch && (
                  <Chip size="small" label={`Symbol: "${ordersSearch}"`} sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.85)', fontSize: 11 }} />
                )}
                {ordersSideFilter.length > 0 && (
                  <Chip size="small" label={`Side: ${ordersSideFilter.map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(', ')}`} sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.85)', fontSize: 11 }} />
                )}
                {ordersStatusFilter.length > 0 && (
                  <Chip size="small" label={`Status: ${ordersStatusFilter.join(', ')}`} sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.85)', fontSize: 11 }} />
                )}
              </Box>
            )}
            {/* <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', mb: 1.5, fontSize: 12 }}>
              {filteredOrders.length} order{filteredOrders.length !== 1 ? 's' : ''}
              {(ordersSearch || ordersSideFilter.length > 0 || ordersStatusFilter.length > 0) ? ' matching filters' : ''} · page {ordersPage} of {ordersPages}
            </Typography> */}
            <Box className={styles.ordersTableWrap}>
              {filteredOrders.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4, color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>
                  {(ordersSearch || ordersSideFilter.length > 0 || ordersStatusFilter.length > 0) ? 'No orders match your filters.' : 'No orders.'}
                </Box>
              ) : (
                <TableContainer sx={{ borderRadius: 1, overflow: 'hidden' }}>
                  <Table size="small" sx={{ borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'rgba(255,255,255,0.05)' }}>
                        <TableCell sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600, py: 1.5, fontSize: 17, border: 'none', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>Symbol</TableCell>
                        <TableCell sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600, py: 1.5, fontSize: 17, border: 'none', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>Side</TableCell>
                        <TableCell sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600, py: 1.5, fontSize: 17, border: 'none', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>Qty</TableCell>
                        <TableCell sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600, py: 1.5, fontSize: 17, border: 'none', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>Price</TableCell>
                        <TableCell sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600, py: 1.5, fontSize: 17, border: 'none', borderBottom: '1px solid rgba(255,255,255,0.08)', whiteSpace: 'nowrap' }}>Status</TableCell>
                        <TableCell sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600, py: 1.5, fontSize: 17, border: 'none', borderBottom: '1px solid rgba(255,255,255,0.08)', whiteSpace: 'nowrap' }}>Date</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {ordersPaged.map((o) => (
                        <TableRow key={o.id} sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' } }}>
                          <TableCell sx={{ color: '#fff', py: 1.5, fontSize: 15, border: 'none', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{o.symbol}</TableCell>
                          <TableCell sx={{ color: o.side === 'buy' ? theme.palette.primary.main : '#ff6b6b', py: 1.5, fontSize: 15, textTransform: 'capitalize', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{o.side}</TableCell>
                          <TableCell sx={{ color: '#fff', py: 1.5, fontSize: 15, border: 'none', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{o.quantity}</TableCell>
                          <TableCell sx={{ color: 'rgba(255,255,255,0.8)', py: 1.5, fontSize: 15, border: 'none', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{formatCurrency(o.price)}</TableCell>
                          <TableCell sx={{ py: 1.5, border: 'none', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                            <Chip label={o.status} size="small" sx={{ bgcolor: o.status === 'Completed' ? 'rgba(0,255,136,0.18)' : 'rgba(255,255,255,0.08)', color: o.status === 'Completed' ? theme.palette.primary.main : 'rgba(255,255,255,0.7)', fontSize: 12, height: 24 }} />
                          </TableCell>
                          <TableCell sx={{ color: 'rgba(255,255,255,0.7)', py: 1.5, fontSize: 15, border: 'none', borderBottom: '1px solid rgba(255,255,255,0.06)', whiteSpace: 'nowrap' }}>{formatDate(o.createdAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
            {filteredOrders.length > 0 && ordersPages > 1 && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                <Pagination
                  count={ordersPages}
                  page={ordersPage}
                  onChange={(_, p) => setOrdersPage(p)}
                  color="primary"
                  size="small"
                  sx={{ '& .MuiPaginationItem-root': { color: '#fff' } }}
                />
              </Box>
            )}
          </Box>
        )}
      </Paper>

      {/* Section 3: Primary (optional) */}
      {hasPrimary && (
        <Paper className={styles.collapsibleSection}>
          <Box
            className={styles.sectionHeader}
            onClick={() => setPrimaryExpanded((prev) => !prev)}
            sx={{ cursor: 'pointer' }}
          >
            <Typography variant="h6" className={styles.categoryTitle}>
              Primary ({secondaryTradingInvestments.length})
            </Typography>
            <IconButton size="small" sx={{ color: '#ffffff' }}>
              {primaryExpanded ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
          </Box>
          {primaryExpanded && (
            <Box className={styles.tableContainer}>
                  <>
                    <Typography
                      sx={{
                        color: 'rgba(255,255,255,0.5)',
                        fontSize: 11,
                        mb: 1,
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                      }}
                    >
                      {secondaryTradingInvestments.length} record
                      {secondaryTradingInvestments.length !== 1 ? 's' : ''} · page {primaryPage} of {primaryPages}
                    </Typography>
                    <TableContainer sx={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 1 }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow sx={{ bgcolor: 'rgba(255,255,255,0.04)' }}>
                            <TableCell
                              sx={{
                                color: '#888888',
                                fontWeight: 600,
                                borderColor: 'rgba(255,255,255,0.08)',
                                py: 0.75,
                                fontSize: 11,
                              }}
                            >
                              Asset
                            </TableCell>
                            <TableCell
                              sx={{
                                color: '#888888',
                                fontWeight: 600,
                                borderColor: 'rgba(255,255,255,0.08)',
                                py: 0.75,
                                fontSize: 11,
                              }}
                            >
                              Amount
                            </TableCell>
                            <TableCell
                              sx={{
                                color: '#888888',
                                fontWeight: 600,
                                borderColor: 'rgba(255,255,255,0.08)',
                                py: 0.75,
                                fontSize: 11,
                              }}
                            >
                              Payment
                            </TableCell>
                            <TableCell
                              sx={{
                                color: '#888888',
                                fontWeight: 600,
                                borderColor: 'rgba(255,255,255,0.08)',
                                py: 0.75,
                                fontSize: 11,
                              }}
                            >
                              Date
                            </TableCell>
                            <TableCell
                              sx={{
                                color: '#888888',
                                fontWeight: 600,
                                borderColor: 'rgba(255,255,255,0.08)',
                                py: 0.75,
                                fontSize: 11,
                              }}
                            >
                              Status
                            </TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {hasPrimary
                            ? primaryPaged.map((investment) => (
                                <TableRow
                                  key={investment.id}
                                  sx={{ '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.03)' } }}
                                >
                                  <TableCell
                                    sx={{
                                      color: '#fff',
                                      borderColor: 'rgba(255,255,255,0.08)',
                                      py: 0.75,
                                      fontSize: 13,
                                    }}
                                  >
                                    {investment.asset_title}
                                  </TableCell>
                                  <TableCell
                                    sx={{
                                      color: '#fff',
                                      borderColor: 'rgba(255,255,255,0.08)',
                                      py: 0.75,
                                      fontSize: 13,
                                    }}
                                  >
                                    {formatCurrency(investment.amount)}
                                  </TableCell>
                                  <TableCell
                                    sx={{
                                      color: '#888',
                                      borderColor: 'rgba(255,255,255,0.08)',
                                      py: 0.75,
                                      fontSize: 13,
                                    }}
                                  >
                                    {getPaymentMethodLabel(investment.payment_method_type)}
                                  </TableCell>
                                  <TableCell
                                    sx={{
                                      color: '#888',
                                      borderColor: 'rgba(255,255,255,0.08)',
                                      py: 0.75,
                                      fontSize: 13,
                                    }}
                                  >
                                    {formatDate(investment.created_at)}
                                  </TableCell>
                                  <TableCell
                                    sx={{
                                      borderColor: 'rgba(255,255,255,0.08)',
                                      py: 0.75,
                                    }}
                                  >
                                    <Chip
                                      label={investment.payment_status}
                                      size="small"
                                      sx={{
                                        backgroundColor:
                                          investment.payment_status === 'COMPLETED'
                                            ? 'rgba(0, 255, 136, 0.2)'
                                            : investment.payment_status === 'PENDING'
                                            ? 'rgba(255, 193, 7, 0.2)'
                                            : 'rgba(255, 77, 77, 0.2)',
                                        color:
                                          investment.payment_status === 'COMPLETED'
                                            ? theme.palette.primary.main
                                            : investment.payment_status === 'PENDING'
                                            ? '#ffc107'
                                            : '#ff4d4d',
                                        fontSize: 10,
                                        height: 20,
                                      }}
                                    />
                                  </TableCell>
                                </TableRow>
                              ))
                            : (
                              <TableRow>
                                <TableCell
                                  colSpan={5}
                                  sx={{
                                    color: 'rgba(255,255,255,0.5)',
                                    py: 2,
                                    textAlign: 'center',
                                    borderColor: 'rgba(255,255,255,0.08)',
                                  }}
                                >
                                  No primary investments
                                </TableCell>
                              </TableRow>
                              )}
                        </TableBody>
                      </Table>
                    </TableContainer>
                    {hasPrimary && primaryPages > 1 && (
                      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1.5 }}>
                        <Pagination
                          count={primaryPages}
                          page={primaryPage}
                          onChange={(_, p) => setPrimaryPage(p)}
                          color="primary"
                          size="small"
                          sx={{ '& .MuiPaginationItem-root': { color: '#fff' } }}
                        />
                      </Box>
                    )}
                  </>
            </Box>
          )}
        </Paper>
      )}
    </Box>
  )
}
