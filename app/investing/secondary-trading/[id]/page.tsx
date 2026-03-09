'use client'

/**
 * ASSET DETAIL PAGE - Secondary Trading
 *
 * Build this page to show asset details and allow order placement.
 * You'll also need to build the trading API routes that this page calls.
 *
 * Available: lib/matchingEngine.ts — order matching engine (matchOrder, upsertHolding)
 * Data: import secondaryTradingAssets from '@/data/secondaryTradingAssets.json'
 *   - Each asset has dailyHistory (30 OHLCV candles) and company info
 *   - Order book: templates.orderBook.asks/bids — multiply priceMultiplier × asset.basePrice
 */

import { useParams, useRouter } from 'next/navigation'
import Header from '@/components/Header'
import {
  Box,
  Container,
  Typography,
  Button,
  Paper,
  Grid,
  TextField,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Snackbar,
  Alert,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Pagination,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  Checkbox,
  ListItemText,
} from '@mui/material'
import { useState, useEffect, useMemo } from 'react'
import { useTheme } from '@mui/material/styles'
import { ArrowBack } from '@mui/icons-material'
import { useAuth } from '@/contexts/AuthContext'
import { formatCurrency, getSecondaryTradingSymbol, slugify, getSeededColor } from '@/lib/investmentUtils'
import secondaryTradingAssets from '@/data/secondaryTradingAssets.json'
import api from '@/lib/api'
import { formatDateTime } from '@/lib/dateUtils'


export default function SecondaryTradingDetailPage() {
  const params = useParams()
  const router = useRouter()
  const theme = useTheme()
  const { user, isAuthenticated } = useAuth()

  const investmentSlug = Array.isArray(params.id) ? params.id[0] : params.id
  const decodedSlug = investmentSlug ? decodeURIComponent(investmentSlug) : ''
  const allAssets = secondaryTradingAssets.investments as any[]
  const asset = allAssets.find((a) => a.id === decodedSlug || slugify(a.title) === decodedSlug)

  if (!asset) {
    return (
      <Box sx={{ minHeight: '100vh' }}>
        <Header />
        <Container maxWidth="lg" sx={{ pt: '120px', textAlign: 'center' }}>
          <Typography variant="h5" sx={{ color: '#ffffff' }}>Asset not found</Typography>
          <Button onClick={() => router.push('/investing/secondary-trading')} sx={{ mt: 2, color: theme.palette.primary.main }}>
            Back to Marketplace
          </Button>
        </Container>
      </Box>
    )
  }
  const [orderType, setOrderType] = useState<'buy' | 'sell'>('buy')
  const [quantity, setQuantity] = useState(1)
  const [price, setPrice] = useState(asset.currentValue)
  const [loading, setLoading] = useState(false)
  const [assetOrders, setAssetOrders] = useState<Array<{ id: string; side: string; quantity: number; remainingQuantity: number; price: number; status: string; createdAt: string }>>([])
  const [assetHolding, setAssetHolding] = useState<{ shares: number; avgCost: number } | null>(null)
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({ open: false, message: '', severity: 'info' })
  const [confirmPlaceOpen, setConfirmPlaceOpen] = useState(false)
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false)
  const [orderIdToCancel, setOrderIdToCancel] = useState<string | null>(null)
  const [seedLoading, setSeedLoading] = useState(false)
  const [ordersPage, setOrdersPage] = useState(1)
  const [ordersSideFilter, setOrdersSideFilter] = useState<string[]>([])
  const [ordersStatusFilter, setOrdersStatusFilter] = useState<string[]>([])
  const [orderBookSortBy, setOrderBookSortBy] = useState<'best' | 'priceLow' | 'size'>('best')
  const [chartDateFrom, setChartDateFrom] = useState<string>('')
  const [chartDateTo, setChartDateTo] = useState<string>('')
  const [chartHighlightLine, setChartHighlightLine] = useState<'open' | 'high' | 'low' | 'close' | null>(null)

  const symbol = getSecondaryTradingSymbol(asset.title, asset.symbol)
  const maxSellShares = assetHolding?.shares ?? 0
  const ORDERS_PAGE_SIZE = 5
  const filteredOrders = useMemo(
    () =>
      assetOrders
        .filter((o) => {
          if (ordersSideFilter.length > 0 && !ordersSideFilter.includes(o.side.toLowerCase()))
            return false
          if (ordersStatusFilter.length > 0 && !ordersStatusFilter.includes(o.status)) return false
          return true
        })
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [assetOrders, ordersSideFilter, ordersStatusFilter],
  )
  const ordersPaged = filteredOrders.slice(
    (ordersPage - 1) * ORDERS_PAGE_SIZE,
    ordersPage * ORDERS_PAGE_SIZE,
  )
  const ordersPages = Math.max(1, Math.ceil(filteredOrders.length / ORDERS_PAGE_SIZE))

  const quantityValid = Number.isInteger(quantity) && quantity >= 1
  const priceValid = typeof price === 'number' && price > 0 && Number.isFinite(price)
  const sellQtyValid = orderType !== 'sell' || quantity <= maxSellShares
  const formValid = quantityValid && priceValid && sellQtyValid
  const quantityError = orderType === 'sell' && quantity > maxSellShares
    ? `Max ${maxSellShares} shares`
    : !quantityValid && quantity !== 0
    ? 'Must be a positive integer'
    : ''
  const priceError = !priceValid && price !== 0 ? 'Must be a positive number' : ''

  const sectionTitleSx = {
    borderLeft: `3px solid ${theme.palette.primary.main}`,
    pl: 1.5,
    py: 0.35,
    mb: 2,
  }
  const sectionTitleTextSx = {
    color: '#fff',
    fontSize: 15,
    fontWeight: 800,
    letterSpacing: 0.6,
    textTransform: 'uppercase' as const,
  }

  const fetchOrdersAndHolding = async () => {
    if (!isAuthenticated || !symbol) return
    setOrdersLoading(true)
    try {
      const [ordersRes, holdingsRes] = await Promise.all([
        api.get(`/trading/orders?symbol=${encodeURIComponent(symbol)}`),
        api.get(`/trading/holdings?symbol=${encodeURIComponent(symbol)}`),
      ])
      setAssetOrders(ordersRes.data?.orders ?? [])
      const holdings = holdingsRes.data?.holdings ?? []
      const h = holdings.find((x: { symbol: string }) => x.symbol === symbol)
      setAssetHolding(h ? { shares: h.shares, avgCost: h.avgCost } : null)
    } catch {
      setAssetOrders([])
      setAssetHolding(null)
    } finally {
      setOrdersLoading(false)
    }
  }

  useEffect(() => {
    fetchOrdersAndHolding()
  }, [isAuthenticated, symbol])

  useEffect(() => {
    setOrdersPage(1)
  }, [JSON.stringify(ordersSideFilter), JSON.stringify(ordersStatusFilter), assetOrders.length])

  const placeOrder = async () => {
    if (!isAuthenticated) {
      router.push('/login')
      return
    }
    if (!formValid) return
    setConfirmPlaceOpen(false)
    try {
      setLoading(true)

      await api.post('/trading/order', {
        assetId: asset.id,
        side: orderType,
        quantity,
        price,
      })
      await fetchOrdersAndHolding()
      setQuantity(1)
      setPrice(asset.currentValue)
      setSnackbar({ open: true, message: 'Order placed successfully', severity: 'success' })
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err && typeof (err as { response?: { data?: { error?: string } } }).response?.data?.error === 'string'
        ? (err as { response: { data: { error: string } } }).response.data.error
        : 'Order failed'
      setSnackbar({ open: true, message: msg, severity: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const cancelOrder = async (orderId: string) => {
    setConfirmCancelOpen(false)
    setOrderIdToCancel(null)
    try {
      setCancellingId(orderId)
      await api.post('/trading/order/cancel', { orderId })
      await fetchOrdersAndHolding()
      setSnackbar({ open: true, message: 'Order cancelled', severity: 'success' })
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err && typeof (err as { response?: { data?: { error?: string } } }).response?.data?.error === 'string'
        ? (err as { response: { data: { error: string } } }).response.data.error
        : 'Cancel failed'
      setSnackbar({ open: true, message: msg, severity: 'error' })
    } finally {
      setCancellingId(null)
    }
  }

  const openCancelConfirm = (id: string) => {
    setOrderIdToCancel(id)
    setConfirmCancelOpen(true)
  }
  const orderBook =
    asset?.templates?.orderBook ||
    (secondaryTradingAssets as { templates?: { orderBook?: { asks: unknown[]; bids: unknown[] } } }).templates?.orderBook ||
    { asks: [], bids: [] }


  return (
    <Box sx={{ minHeight: '100vh' }}>
      <Header />

      <Container maxWidth="lg" sx={{ pt: { xs: '100px', sm: '120px' }, pb: 5 }}>
        <Paper
          sx={{
            p: 3,
            mb: 3,
            borderRadius: 3,
            border: '1px solid rgba(255,255,255,0.08)',
            bgcolor: 'rgba(255,255,255,0.03)',
            backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, transparent 60%)',
          }}
        >
          <Button
            startIcon={<ArrowBack />}
            onClick={() => router.push('/investing/secondary-trading')}
            sx={{ color: 'rgba(255,255,255,0.7)', mb: 2, textTransform: 'none', '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.06)' } }}
          >
            Back to Marketplace
          </Button>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Box sx={{
              width: 56,
              height: 56,
              borderRadius: 2,
              backgroundColor: getSeededColor(symbol),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            }}>
              <Typography sx={{ color: '#ffffff', fontWeight: 700, fontSize: '20px' }}>
                {symbol.slice(0, 2)}
              </Typography>
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="h4" sx={{ fontWeight: 700, color: '#ffffff', lineHeight: 1.2, letterSpacing: '-0.02em' }}>
                {asset.title}
              </Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, mt: 0.25 }}>
                {symbol} · {asset.category ? asset.category.charAt(0).toUpperCase() + asset.category.slice(1) : ''}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 2, flexWrap: 'wrap' }}>
              <Typography variant="h4" sx={{ fontWeight: 700, color: '#ffffff', letterSpacing: '-0.02em' }}>
                {formatCurrency(asset.currentValue)}
              </Typography>
              <Typography
                sx={{
                  color: asset.isPositive ? theme.palette.primary.main : '#ef5350',
                  fontWeight: 600,
                  fontSize: '1rem',
                }}
              >
                {asset.isPositive ? '+' : ''}{asset.performancePercent.toFixed(2)}%
              </Typography>
            </Box>
          </Box>

          <Box sx={{ mt: 2.5, pt: 2, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <Grid container spacing={2} sx={{ rowGap: 1 }}>
              {[
                { label: 'Open', value: asset.openPrice != null ? formatCurrency(asset.openPrice) : '—' },
                { label: 'High', value: asset.high != null ? formatCurrency(asset.high) : '—' },
                { label: 'Low', value: asset.low != null ? formatCurrency(asset.low) : '—' },
                { label: 'Bid', value: asset.bid != null ? formatCurrency(asset.bid) : '—', color: theme.palette.primary.main },
                { label: 'Ask', value: asset.ask != null ? formatCurrency(asset.ask) : '—', color: '#ef5350' },
                { label: 'Volume', value: asset.volume ?? '—' },
                { label: 'Market cap', value: (asset as any).marketCap ?? '—' },
                { label: 'Avg vol', value: (asset as any).avgVolume ?? '—' },
              ].map(({ label, value, color }) => (
                <Grid item xs={6} sm={4} md={3} key={label}>
                  <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8 }}>{label}</Typography>
                  <Typography sx={{ color: color || '#fff', fontWeight: 600, fontSize: 13 }}>{value}</Typography>
                </Grid>
              ))}
            </Grid>
          </Box>
        </Paper>

        <Grid container spacing={3}>
          {/* Left Column: About + Price History + Your Orders */}
          <Grid item xs={12} md={8}>
            {/* About / Company details — above Price History */}
            <Paper sx={{ p: 3, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2.5, mb: 3, bgcolor: 'rgba(255,255,255,0.02)' }}>
              <Box sx={sectionTitleSx}>
                <Typography sx={sectionTitleTextSx}>About</Typography>
              </Box>
              <Typography sx={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, lineHeight: 1.7, mb: 2 }}>
                {(asset as any).companyDescription || 'No description available.'}
              </Typography>
              <Grid container spacing={2}>
                {[
                  { label: 'Price range', value: (asset as any).priceRange },
                  { label: '52w high', value: (asset as any).yearHigh != null ? formatCurrency((asset as any).yearHigh) : '—' },
                  { label: '52w low', value: (asset as any).yearLow != null ? formatCurrency((asset as any).yearLow) : '—' },
                  { label: 'P/E ratio', value: (asset as any).peRatio != null ? (asset as any).peRatio : '—' },
                  { label: 'Dividend yield', value: (asset as any).dividendYield != null ? `${(asset as any).dividendYield}%` : '—' },
                  { label: 'Revenue', value: (asset as any).revenue },
                  { label: 'Revenue growth', value: (asset as any).revenueGrowth != null ? `${(asset as any).revenueGrowth}%` : '—' },
                  { label: 'Net income', value: (asset as any).netIncome },
                  { label: 'Employees', value: (asset as any).employees },
                  { label: 'Founded', value: (asset as any).founded },
                ].filter(({ value }) => value != null && value !== '—' && value !== '').map(({ label, value }) => (
                  <Grid item xs={6} sm={4} key={label}>
                    <Box sx={{ py: 0.5 }}>
                      <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, textTransform: 'uppercase' }}>{label}</Typography>
                      <Typography sx={{ color: '#fff', fontSize: 13, fontWeight: 500 }}>{value}</Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Paper>

            <Paper sx={{ p: 3, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2.5, mb: 3, bgcolor: 'rgba(255,255,255,0.02)' }}>
              {(() => {
                const fullHistory = asset.dailyHistory ?? []
                if (!fullHistory.length) {
                  return (
                    <>
                      <Box sx={sectionTitleSx}>
                        <Typography sx={sectionTitleTextSx}>Price History</Typography>
                      </Box>
                      <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>
                        No price history available.
                      </Typography>
                    </>
                  )
                }
                const formatLabel = (d: string) => {
                  try {
                    const [y, m, day] = d.split('-').map(Number)
                    if (y != null && m != null && day != null) {
                      return new Date(y, m - 1, day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                    }
                    return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                  } catch {
                    return d
                  }
                }
                type OHLCPoint = { open: number; high: number; low: number; close: number; date: string }
                const basePoints: OHLCPoint[] = fullHistory.map((c: any, i: number) => {
                  const closeVal = c.close ?? asset.basePrice * (c.closeMultiplier ?? 1)
                  const prevClose = i > 0 ? (fullHistory[i - 1].close ?? asset.basePrice * (fullHistory[i - 1].closeMultiplier ?? 1)) : closeVal
                  const openVal = c.open ?? prevClose
                  const highVal = c.high ?? Math.max(openVal, closeVal) * (c.high != null ? 1 : 1.002)
                  const lowVal = c.low ?? Math.min(openVal, closeVal) * (c.low != null ? 1 : 0.998)
                  return {
                    open: openVal,
                    high: highVal,
                    low: lowVal,
                    close: closeVal,
                    date: c.date,
                  }
                })
                let points = basePoints
                if (chartDateFrom || chartDateTo) {
                  points = points.filter((p) => {
                    const d = p.date
                    if (chartDateFrom && d < chartDateFrom) return false
                    if (chartDateTo && d > chartDateTo) return false
                    return true
                  })
                }
                const dates = fullHistory.map((c: any) => c.date).filter(Boolean)
                const minDate = dates.length ? dates[0] : ''
                const maxDate = dates.length ? dates[dates.length - 1] : ''
                const dateInputSx = {
                  width: '100%',
                  minWidth: 140,
                  '& .MuiOutlinedInput-root': { color: '#fff', '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' }, '& .MuiInputBase-input': { fontSize: 14 } },
                  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
                }
                const chartRangeBoxCommon = {
                  width: 'fit-content',
                  py: 0.75,
                  px: 1.5,
                  borderRadius: 1.5,
                  border: '1px solid rgba(255,255,255,0.12)',
                  bgcolor: 'rgba(255,255,255,0.03)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 0,
                } as const
                const titleCommon = { color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 0.4, mb: 1 }
                const timeRangeFilterBox = (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5, width: 'auto' }}>
                    <TextField size="small" type="date" label="From" value={chartDateFrom} onChange={(e) => setChartDateFrom(e.target.value)} inputProps={{ min: minDate, max: chartDateTo || maxDate }} sx={{ ...dateInputSx, width: 140, minWidth: 140, '& .MuiInputBase-root': { fontSize: 13 } }} InputLabelProps={{ shrink: true }} />
                    <TextField size="small" type="date" label="To" value={chartDateTo} onChange={(e) => setChartDateTo(e.target.value)} inputProps={{ min: chartDateFrom || minDate, max: maxDate }} sx={{ ...dateInputSx, width: 140, minWidth: 140, '& .MuiInputBase-root': { fontSize: 13 } }} InputLabelProps={{ shrink: true }} />
                    {(chartDateFrom || chartDateTo) && (
                      <Button size="small" onClick={() => { setChartDateFrom(''); setChartDateTo('') }} sx={{ textTransform: 'none', color: 'rgba(255,255,255,0.6)', fontSize: 12, py: 0.5 }}>Clear</Button>
                    )}
                  </Box>
                )
                const priceHistoryHeaderRow = (
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, mb: 2 }}>
                    <Box sx={{ ...sectionTitleSx, mb: 0 }}>
                      <Typography sx={sectionTitleTextSx}>Price History</Typography>
                    </Box>
                    {timeRangeFilterBox}
                  </Box>
                )
                const lineColorsForLegend = {
                  open: 'rgba(255,255,255,0.65)',
                  high: '#81d4fa',
                  low: '#ef9a9a',
                  close: theme.palette.primary.main,
                }
                if (!points.length) {
                  return (
                    <>
                      {priceHistoryHeaderRow}
                      <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'stretch', gap: 2, mb: 2, width: '100%', minWidth: 0 }}>
                        <Box sx={chartRangeBoxCommon}>
                          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, width: 'fit-content' }}>
                            <Box sx={{ textAlign: 'center' }}>
                              <Typography sx={{ ...titleCommon, fontSize: 9, mb: 0.25 }}>Date range</Typography>
                              <Typography sx={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: 500 }}>—</Typography>
                            </Box>
                            <Box sx={{ textAlign: 'center' }}>
                              <Typography sx={{ ...titleCommon, fontSize: 9, mb: 0.25 }}>Price range</Typography>
                              <Typography sx={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: 500 }}>—</Typography>
                            </Box>
                          </Box>
                        </Box>
                        <Box sx={{ ...chartRangeBoxCommon, flex: 1, minWidth: 0, justifyContent: 'center' }}>
                          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 1.25, width: '100%' }}>
                            {(['close', 'open', 'high', 'low'] as const).map((key) => {
                              const active = chartHighlightLine === key
                              return (
                                <Box
                                  key={key}
                                  onClick={() => setChartHighlightLine(active ? null : key)}
                                  sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 1,
                                    cursor: 'pointer',
                                    width: '100%',
                                    maxWidth: '100%',
                                    boxSizing: 'border-box',
                                    px: 1.5,
                                    py: 0.75,
                                    borderRadius: 1.25,
                                    bgcolor: active ? 'rgba(255,255,255,0.12)' : 'transparent',
                                    border: '1px solid',
                                    borderColor: active ? 'rgba(255,255,255,0.25)' : 'transparent',
                                    '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' },
                                  }}
                                >
                                  <Box sx={{ width: 20, height: 4, borderRadius: 0.5, bgcolor: lineColorsForLegend[key], flexShrink: 0 }} />
                                  <Typography sx={{ color: active ? '#fff' : 'rgba(255,255,255,0.8)', fontSize: 14, textTransform: 'capitalize', fontWeight: active ? 600 : 500, overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
                                    {key}
                                  </Typography>
                                </Box>
                              )
                            })}
                          </Box>
                        </Box>
                      </Box>
                      <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>
                        No data in selected date range. Adjust time range or clear to show all.
                      </Typography>
                    </>
                  )
                }
                const minPrice = Math.min(...points.map((p) => p.low))
                const maxPrice = Math.max(...points.map((p) => p.high))
                const range = maxPrice - minPrice || 0.01
                const chartWidth = 640
                const chartHeight = 200
                const padding = { top: 12, right: 12, bottom: 32, left: 58 }
                const plotWidth = chartWidth - padding.left - padding.right
                const plotHeight = chartHeight - padding.top - padding.bottom
                const x = (i: number) => padding.left + (i / Math.max(1, points.length - 1)) * plotWidth
                const y = (p: number) => padding.top + plotHeight - ((p - minPrice) / range) * plotHeight
                const pathFor = (key: 'open' | 'high' | 'low' | 'close') =>
                  points.length ? `M ${points.map((p, i) => `${x(i)},${y(p[key])}`).join(' L ')}` : ''

                const yTicks = [minPrice, minPrice + range * 0.33, minPrice + range * 0.67, maxPrice]
                const xTickIndices = points.length <= 1 ? [0] : [0, Math.floor(points.length * 0.25), Math.floor(points.length * 0.5), Math.floor(points.length * 0.75), points.length - 1].filter((_, i, a) => a.indexOf(_) === i)

                const lineColors = {
                  open: 'rgba(255,255,255,0.65)',
                  high: '#81d4fa',
                  low: '#ef9a9a',
                  close: theme.palette.primary.main,
                }
                const startLabel = formatLabel(points[0].date)
                const endLabel = formatLabel(points[points.length - 1].date)

                const dateRangeLabel = points.length ? `${formatLabel(points[0].date)} – ${formatLabel(points[points.length - 1].date)}` : '—'
                return (
                  <>
                    {priceHistoryHeaderRow}
                    <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'stretch', gap: 2, mb: 2, width: '100%', minWidth: 0 }}>
                      <Box sx={chartRangeBoxCommon}>
                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, width: 'fit-content' }}>
                          <Box sx={{ textAlign: 'center' }}>
                            <Typography sx={{ ...titleCommon, fontSize: 9, mb: 0.25 }}>Date range</Typography>
                            <Typography sx={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: 500 }}>{dateRangeLabel}</Typography>
                          </Box>
                          <Box sx={{ textAlign: 'center' }}>
                            <Typography sx={{ ...titleCommon, fontSize: 9, mb: 0.25 }}>Price range</Typography>
                            <Typography sx={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: 500 }}>{formatCurrency(minPrice)} – {formatCurrency(maxPrice)}</Typography>
                          </Box>
                        </Box>
                      </Box>
                      <Box sx={{ ...chartRangeBoxCommon, flex: 1, minWidth: 0, justifyContent: 'center' }}>
                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 1.25, width: '100%' }}>
                          {(['close', 'open', 'high', 'low'] as const).map((key) => {
                            const active = chartHighlightLine === key
                            return (
                              <Box
                                key={key}
                                onClick={() => setChartHighlightLine(active ? null : key)}
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: 1,
                                  cursor: 'pointer',
                                  width: '100%',
                                  maxWidth: '100%',
                                  boxSizing: 'border-box',
                                  px: 1.5,
                                  py: 0.75,
                                  borderRadius: 1.25,
                                  bgcolor: active ? 'rgba(255,255,255,0.12)' : 'transparent',
                                  border: '1px solid',
                                  borderColor: active ? 'rgba(255,255,255,0.25)' : 'transparent',
                                  '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' },
                                }}
                              >
                                <Box sx={{ width: 20, height: 4, borderRadius: 0.5, bgcolor: lineColors[key], flexShrink: 0 }} />
                                <Typography sx={{ color: active ? '#fff' : 'rgba(255,255,255,0.8)', fontSize: 14, textTransform: 'capitalize', fontWeight: active ? 600 : 500, overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
                                  {key}
                                </Typography>
                              </Box>
                            )
                          })}
                        </Box>
                      </Box>
                    </Box>
                    <Box sx={{ width: '100%' }}>
                      <Box sx={{ width: chartWidth, height: chartHeight, mt: 0.5, position: 'relative', flexShrink: 0 }}>
                        <svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="xMidYMid meet" style={{ overflow: 'visible' }}>
                        {/* Y-axis line */}
                        <line x1={padding.left} y1={padding.top} x2={padding.left} y2={padding.top + plotHeight} stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
                        {/* X-axis line */}
                        <line x1={padding.left} y1={padding.top + plotHeight} x2={padding.left + plotWidth} y2={padding.top + plotHeight} stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
                        {/* Y-axis grid lines and labels */}
                        {yTicks.map((tickVal, idx) => (
                          <g key={idx}>
                            <line x1={padding.left} y1={y(tickVal)} x2={padding.left + plotWidth} y2={y(tickVal)} stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="2 2" />
                            <text x={padding.left - 8} y={y(tickVal)} textAnchor="end" dominantBaseline="middle" fill="rgba(255,255,255,0.6)" fontSize={11} fontFamily="inherit">
                              {formatCurrency(tickVal)}
                            </text>
                          </g>
                        ))}
                        {/* X-axis labels */}
                        {xTickIndices.map((idx) => (
                          <text key={idx} x={x(idx)} y={padding.top + plotHeight + 18} textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize={11} fontFamily="inherit">
                            {formatLabel(points[idx].date)}
                          </text>
                        ))}
                        {(['open', 'high', 'low', 'close'] as const).map((key) => {
                          const highlighted = chartHighlightLine === key
                          const dimmed = chartHighlightLine != null && !highlighted
                          return (
                            <path
                              key={key}
                              d={pathFor(key)}
                              fill="none"
                              stroke={lineColors[key]}
                              strokeWidth={highlighted ? 2.5 : key === 'close' ? 2 : 1.5}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeDasharray={key === 'open' ? '4 3' : 'none'}
                              opacity={dimmed ? 0.2 : 1}
                            />
                          )
                        })}
                        {points.map((p, i) => (
                          <Tooltip
                            key={i}
                            title={
                              <Box component="span" sx={{ display: 'block', whiteSpace: 'nowrap' }}>
                                {formatLabel(p.date)}
                                <br />O {formatCurrency(p.open)} · H {formatCurrency(p.high)} · L {formatCurrency(p.low)} · C {formatCurrency(p.close)}
                              </Box>
                            }
                            arrow
                          >
                            <g style={{ cursor: 'pointer' }}>
                              <circle cx={x(i)} cy={y(p.close)} r={4} fill={theme.palette.primary.main} />
                            </g>
                          </Tooltip>
                        ))}
                      </svg>
                      </Box>
                    </Box>
                  </>
                )
              })()}
            </Paper>

            <Paper sx={{ p: 3, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2.5, bgcolor: 'rgba(255,255,255,0.02)' }}>
              <Box sx={sectionTitleSx}>
                <Typography sx={sectionTitleTextSx}>Your Orders & Positions</Typography>
              </Box>

              {!isAuthenticated ? (
                <Typography sx={{ color: 'rgba(255,255,255,0.6)' }}>
                  Sign in to view your positions and orders.
                </Typography>
              ) : ordersLoading ? (
                <Box sx={{ py: 2, color: 'rgba(255,255,255,0.5)' }}>Loading...</Box>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {/* Your position subsection */}
                  <Box>
                    <Typography sx={{ color: theme.palette.primary.main, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, mb: 1 }}>
                      Your position
                    </Typography>
                    {assetHolding && assetHolding.shares > 0 ? (
                      <TableContainer sx={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 1, overflow: 'hidden' }}>
                        <Table size="small">
                          <TableHead>
                            <TableRow sx={{ bgcolor: 'rgba(255,255,255,0.04)' }}>
                              <TableCell sx={{ color: 'rgba(255,255,255,0.6)', fontWeight: 600, fontSize: 11, py: 1, borderColor: 'rgba(255,255,255,0.08)' }}>Shares</TableCell>
                              <TableCell sx={{ color: 'rgba(255,255,255,0.6)', fontWeight: 600, fontSize: 11, py: 1, borderColor: 'rgba(255,255,255,0.08)' }}>Avg cost</TableCell>
                              <TableCell sx={{ color: 'rgba(255,255,255,0.6)', fontWeight: 600, fontSize: 11, py: 1, borderColor: 'rgba(255,255,255,0.08)' }}>Est. value</TableCell>
                              <TableCell sx={{ color: 'rgba(255,255,255,0.6)', fontWeight: 600, fontSize: 11, py: 1, borderColor: 'rgba(255,255,255,0.08)' }}>P&L</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            <TableRow sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' } }}>
                              <TableCell sx={{ color: '#fff', fontSize: 13, py: 1.5, borderColor: 'rgba(255,255,255,0.08)' }}>{assetHolding.shares}</TableCell>
                              <TableCell sx={{ color: '#fff', fontSize: 13, py: 1.5, borderColor: 'rgba(255,255,255,0.08)' }}>{formatCurrency(assetHolding.avgCost)}</TableCell>
                              <TableCell sx={{ color: '#fff', fontSize: 13, py: 1.5, borderColor: 'rgba(255,255,255,0.08)' }}>{formatCurrency(asset.basePrice * assetHolding.shares)}</TableCell>
                              <TableCell sx={{ borderColor: 'rgba(255,255,255,0.08)', py: 1.5 }}>
                                {(() => {
                                  const costBasis = assetHolding.avgCost * assetHolding.shares
                                  const estValue = asset.basePrice * assetHolding.shares
                                  const pnl = estValue - costBasis
                                  const pnlColor = pnl >= 0 ? theme.palette.primary.main : '#ef5350'
                                  return <Typography component="span" sx={{ color: pnlColor, fontWeight: 600, fontSize: 13 }}>{pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}</Typography>
                                })()}
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </TableContainer>
                    ) : (
                      <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 15, py: 1 }}>No position in this asset.</Typography>
                    )}
                  </Box>

                  <Box>
                    <Typography sx={{ color: theme.palette.primary.main, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, mb: 1 }}>
                      Your orders
                    </Typography>
                    {assetOrders.length === 0 && (!assetHolding || assetHolding.shares === 0) ? (
                      <Typography sx={{ color: 'rgba(255,255,255,0.5)' }}>No orders for this asset.</Typography>
                    ) : (
                      <>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                        <FormControl size="small" sx={{ minWidth: 120 }}>
                          <InputLabel sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>Side</InputLabel>
                          <Select
                            multiple
                            value={ordersSideFilter}
                            label="Side"
                            onChange={(e) => setOrdersSideFilter(typeof e.target.value === 'string' ? [] : e.target.value)}
                            renderValue={(selected) => (selected.length === 0 ? 'All' : selected.map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(', '))}
                            sx={{
                              color: '#fff',
                              fontSize: 12,
                              borderRadius: 1.5,
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
                        <FormControl size="small" sx={{ minWidth: 140 }}>
                          <InputLabel sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>Status</InputLabel>
                          <Select
                            multiple
                            value={ordersStatusFilter}
                            label="Status"
                            onChange={(e) => setOrdersStatusFilter(typeof e.target.value === 'string' ? [] : e.target.value)}
                            renderValue={(selected) => (selected.length === 0 ? 'All' : selected.join(', '))}
                            sx={{
                              color: '#fff',
                              fontSize: 12,
                              borderRadius: 1.5,
                              bgcolor: 'rgba(255,255,255,0.06)',
                              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.12)' },
                            }}
                          >
                            {[...new Set(assetOrders.map((o) => o.status))].sort().map((s) => (
                              <MenuItem key={s} value={s}>
                                <Checkbox checked={ordersStatusFilter.includes(s)} size="small" sx={{ color: 'rgba(255,255,255,0.7)' }} />
                                <ListItemText primary={s} />
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                        {(ordersSideFilter.length > 0 || ordersStatusFilter.length > 0) && (
                          <Button
                            size="small"
                            onClick={() => { setOrdersSideFilter([]); setOrdersStatusFilter([]) }}
                            sx={{ textTransform: 'none', color: 'rgba(255,255,255,0.6)', fontSize: 12 }}
                          >
                            Clear filters
                          </Button>
                        )}
                      </Box>
                      {(ordersSideFilter.length > 0 || ordersStatusFilter.length > 0) && (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.75, mb: 1 }}>
                          {ordersSideFilter.length > 0 && (
                            <Chip size="small" label={`Side: ${ordersSideFilter.map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(', ')}`} sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.85)', fontSize: 11 }} />
                          )}
                          {ordersStatusFilter.length > 0 && (
                            <Chip size="small" label={`Status: ${ordersStatusFilter.join(', ')}`} sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.85)', fontSize: 11 }} />
                          )}
                        </Box>
                      )}
                      <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, mb: 1 }}>
                        {filteredOrders.length} order{filteredOrders.length !== 1 ? 's' : ''}
                        {(ordersSideFilter.length > 0 || ordersStatusFilter.length > 0) ? ' matching filters' : ''} · page {ordersPage} of {ordersPages}
                      </Typography>
                      <TableContainer sx={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 1, overflow: 'hidden' }}>
                        <Table size="small">
                          <TableHead>
                            <TableRow sx={{ bgcolor: 'rgba(255,255,255,0.04)' }}>
                              <TableCell sx={{ color: 'rgba(255,255,255,0.6)', fontWeight: 600, fontSize: 11, py: 1, borderColor: 'rgba(255,255,255,0.08)' }}>Side</TableCell>
                              <TableCell sx={{ color: 'rgba(255,255,255,0.6)', fontWeight: 600, fontSize: 11, py: 1, borderColor: 'rgba(255,255,255,0.08)' }}>Qty</TableCell>
                              <TableCell sx={{ color: 'rgba(255,255,255,0.6)', fontWeight: 600, fontSize: 11, py: 1, borderColor: 'rgba(255,255,255,0.08)' }}>Price</TableCell>
                              <TableCell sx={{ color: 'rgba(255,255,255,0.6)', fontWeight: 600, fontSize: 11, py: 1, borderColor: 'rgba(255,255,255,0.08)' }}>Status</TableCell>
                              <TableCell sx={{ color: 'rgba(255,255,255,0.6)', fontWeight: 600, fontSize: 11, py: 1, borderColor: 'rgba(255,255,255,0.08)' }}>Date</TableCell>
                              <TableCell sx={{ color: 'rgba(255,255,255,0.6)', fontWeight: 600, fontSize: 11, py: 1, borderColor: 'rgba(255,255,255,0.08)', width: '1%', whiteSpace: 'nowrap' }} align="right">Action</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {ordersPaged.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={6} sx={{ color: 'rgba(255,255,255,0.45)', py: 2, borderColor: 'rgba(255,255,255,0.08)' }}>
                                  {(ordersSideFilter.length > 0 || ordersStatusFilter.length > 0) ? 'No orders match your filters.' : 'No orders.'}
                                </TableCell>
                              </TableRow>
                            ) : (
                              ordersPaged.map((o) => (
                                <TableRow key={o.id} sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' } }}>
                                  <TableCell sx={{ color: o.side.toLowerCase() === 'buy' ? theme.palette.primary.main : '#ef5350', fontSize: 13, py: 1.5, borderColor: 'rgba(255,255,255,0.08)', textTransform: 'capitalize', fontWeight: 500 }}>{o.side}</TableCell>
                                  <TableCell sx={{ color: '#fff', fontSize: 13, py: 1.5, borderColor: 'rgba(255,255,255,0.08)' }}>{o.remainingQuantity}/{o.quantity}</TableCell>
                                  <TableCell sx={{ color: '#fff', fontSize: 13, py: 1.5, borderColor: 'rgba(255,255,255,0.08)' }}>{formatCurrency(o.price)}</TableCell>
                                  <TableCell sx={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                                    <Chip label={o.status} size="small" sx={{ height: 20, fontSize: 10, bgcolor: o.status === 'Completed' ? 'rgba(0,255,136,0.15)' : 'rgba(255,255,255,0.08)', color: o.status === 'Completed' ? theme.palette.primary.main : 'rgba(255,255,255,0.7)' }} />
                                  </TableCell>
                                  <TableCell sx={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, py: 1.5, borderColor: 'rgba(255,255,255,0.08)', whiteSpace: 'nowrap' }}>{formatDateTime(o.createdAt)}</TableCell>
                                  <TableCell align="right" sx={{ py: 1.5, borderColor: 'rgba(255,255,255,0.08)', width: '1%', whiteSpace: 'nowrap' }}>
                                    {['New', 'Pending', 'PartiallyFilled'].includes(o.status) && (
                                      <Button size="small" color="error" variant="outlined" onClick={() => openCancelConfirm(o.id)} disabled={cancellingId === o.id} sx={{ textTransform: 'none', fontSize: 10, minWidth: 0, px: 1, height: 20, minHeight: 20, py: 0 }}>
                                        {cancellingId === o.id ? '…' : 'Cancel'}
                                      </Button>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </TableContainer>
                      {filteredOrders.length > ORDERS_PAGE_SIZE && (
                        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}>
                          <Pagination count={ordersPages} page={ordersPage} onChange={(_, p) => setOrdersPage(p)} color="primary" size="small" sx={{ '& .MuiPaginationItem-root': { color: '#fff' } }} />
                        </Box>
                      )}
                      </>
                    )}
                  </Box>
                </Box>
              )}
            </Paper>

          </Grid>

          {/* Right Column: Place Order + Your Orders & Positions */}
          <Grid item xs={12} md={4}>
            {/* <Paper sx={{
              p: 3,
              border: '1px dashed rgba(255,255,255,0.15)',
              borderRadius: 2,
              position: { md: 'sticky' },
              top: { md: 100 },
            }}>
              <Typography sx={{ color: '#555' }}>Order form</Typography>
            </Paper> */}
            <Paper
              sx={{
                p: 3,
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 2.5,
                position: { md: 'sticky' },
                top: { md: 100 },
                bgcolor: 'rgba(255,255,255,0.02)',
              }}
            >
              <Box sx={sectionTitleSx}>
                <Typography sx={sectionTitleTextSx}>Place Order</Typography>
              </Box>

              <TextField
                select
                label="Order Type"
                fullWidth
                value={orderType}
                onChange={(e) => setOrderType(e.target.value as 'buy' | 'sell')}
                sx={{ mb: 2, '& .MuiOutlinedInput-root': { color: '#fff', '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' }, '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.35)' } }, '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' } }}
                SelectProps={{ sx: { color: '#fff', '& .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.5)' } } }}
              >
                <MenuItem value="buy">Buy</MenuItem>
                <MenuItem value="sell">Sell</MenuItem>
              </TextField>

              <TextField
                label="Price"
                type="number"
                fullWidth
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
                error={!!priceError}
                helperText={priceError}
                inputProps={{ min: 0, step: 0.01 }}
                sx={{ mb: 2, '& .MuiOutlinedInput-root': { color: '#fff', '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' }, '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.35)' } }, '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' }, '& .MuiFormHelperText-root': { color: 'rgba(255,255,255,0.5)' } }}
              />

              <TextField
                label="Quantity"
                type="number"
                fullWidth
                value={quantity}
                onChange={(e) => setQuantity(Math.floor(Number(e.target.value)) || 0)}
                error={!!quantityError}
                helperText={quantityError || (orderType === 'sell' && maxSellShares > 0 ? `You have ${maxSellShares} shares` : '')}
                inputProps={{ min: 1, step: 1 }}
                sx={{ mb: 3, '& .MuiOutlinedInput-root': { color: '#fff', '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' }, '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.35)' } }, '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' }, '& .MuiFormHelperText-root': { color: 'rgba(255,255,255,0.5)' } }}
              />

              <Button
                fullWidth
                variant="contained"
                onClick={() => formValid ? setConfirmPlaceOpen(true) : undefined}
                disabled={loading || !formValid}
                sx={{
                  py: 1.5,
                  fontWeight: 600,
                  textTransform: 'none',
                  fontSize: '1rem',
                  bgcolor: orderType === 'buy' ? theme.palette.primary.main : '#ef5350',
                  '&:hover': { bgcolor: orderType === 'buy' ? '#00cc6a' : '#e53935' },
                }}
              >
                {loading ? 'Placing...' : `${orderType === 'buy' ? 'Buy' : 'Sell'} ${symbol}`}
              </Button>
            </Paper>

            {/* Order Book - compact in sidebar */}
            {(() => {
              const asksBase = orderBook.asks ?? []
              const bidsBase = orderBook.bids ?? []

              const asksByPrice = [...asksBase].sort(
                (a: any, b: any) => a.priceMultiplier * asset.basePrice - b.priceMultiplier * asset.basePrice,
              )
              const bidsByPrice = [...bidsBase].sort(
                (a: any, b: any) => b.priceMultiplier * asset.basePrice - a.priceMultiplier * asset.basePrice,
              )

              const bestAsk = asksByPrice[0]
              const bestBid = bidsByPrice[0]

              let asksSorted = asksByPrice
              let bidsSorted = bidsByPrice

              if (orderBookSortBy === 'priceLow') {
                asksSorted = [...asksBase].sort(
                  (a: any, b: any) => a.priceMultiplier * asset.basePrice - b.priceMultiplier * asset.basePrice,
                )
                bidsSorted = [...bidsBase].sort(
                  (a: any, b: any) => a.priceMultiplier * asset.basePrice - b.priceMultiplier * asset.basePrice,
                )
              } else if (orderBookSortBy === 'size') {
                asksSorted = [...asksBase].sort((a: any, b: any) => {
                  const qa = a.size ?? a.quantity ?? 0
                  const qb = b.size ?? b.quantity ?? 0
                  if (qa === qb) {
                    return a.priceMultiplier - b.priceMultiplier
                  }
                  return qb - qa
                })
                bidsSorted = [...bidsBase].sort((a: any, b: any) => {
                  const qa = a.size ?? a.quantity ?? 0
                  const qb = b.size ?? b.quantity ?? 0
                  if (qa === qb) {
                    return b.priceMultiplier - a.priceMultiplier
                  }
                  return qb - qa
                })
              }

              const bestAskPrice = bestAsk ? bestAsk.priceMultiplier * asset.basePrice : null
              const bestBidPrice = bestBid ? bestBid.priceMultiplier * asset.basePrice : null
              const spread =
                bestAskPrice != null && bestBidPrice != null ? bestAskPrice - bestBidPrice : null
              const mid =
                bestAskPrice != null && bestBidPrice != null ? (bestAskPrice + bestBidPrice) / 2 : null
              const spreadPct = spread != null && mid ? (spread / mid) * 100 : null
              const maxAskQty = Math.max(...asksSorted.map((a: any) => a.size ?? a.quantity ?? 0), 1)
              const maxBidQty = Math.max(...bidsSorted.map((b: any) => b.size ?? b.quantity ?? 0), 1)
              const asksToShow = asksSorted
              const bidsToShow = bidsSorted

              return (
                <Paper
                  sx={{
                    p: 2.5,
                    mt: 3,
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 2.5,
                    bgcolor: 'rgba(255,255,255,0.02)',
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.2 }}>
                    <Box sx={{ ...sectionTitleSx, mb: 0 }}>
                      <Typography sx={sectionTitleTextSx}>Order Book</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 0.75 }}>
                      {(['best', 'priceLow', 'size'] as const).map((mode) => (
                        <Button
                          key={mode}
                          size="small"
                          onClick={() => setOrderBookSortBy(mode)}
                          sx={{
                            minWidth: 0,
                            px: 1.6,
                            py: 0.5,
                            fontSize: 11,
                            borderRadius: 999,
                            textTransform: 'none',
                            bgcolor: orderBookSortBy === mode ? 'rgba(255,255,255,0.18)' : 'transparent',
                            color: orderBookSortBy === mode ? '#fff' : 'rgba(255,255,255,0.6)',
                            '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' },
                          }}
                        >
                          {mode === 'best' ? 'Best' : mode === 'priceLow' ? 'Price ↑' : 'Size'}
                        </Button>
                      ))}
                    </Box>
                  </Box>
                  {bestBidPrice != null && bestAskPrice != null && (
                    <Box
                      sx={{
                        mb: 1.6,
                        py: 0.9,
                        px: 1.4,
                        borderRadius: 1.2,
                        bgcolor: 'rgba(255,255,255,0.05)',
                      }}
                    >
                      <Typography sx={{ color: 'rgba(255,255,255,0.85)', fontSize: 12.5, fontWeight: 500 }}>
                        <Box component="span" sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>
                          Bid
                        </Box>{' '}
                        {formatCurrency(bestBidPrice)}{' '}
                        <Box component="span" sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>
                          · Ask
                        </Box>{' '}
                        {formatCurrency(bestAskPrice)}
                        {spread != null && (
                          <>
                            {' '}
                            <Box component="span" sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>
                              · Spread
                            </Box>{' '}
                            {formatCurrency(spread)}
                            {spreadPct != null &&
                              ` (${spreadPct >= 0 ? '+' : ''}${spreadPct.toFixed(2)}%)`}
                          </>
                        )}
                      </Typography>
                    </Box>
                  )}
                  <Grid container spacing={1.5}>
                    <Grid item xs={6}>
                      <Typography sx={{ color: '#ef5350', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.5 }}>Asks</Typography>
                      {asksToShow.map((ask: any, i: number) => {
                        const price = ask.priceMultiplier * asset.basePrice
                        const qty = ask.size ?? ask.quantity ?? 0
                        const pct = maxAskQty ? (Number(qty) / maxAskQty) * 100 : 0
                        return (
                          <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.25, position: 'relative', overflow: 'hidden', borderRadius: 0.5 }}>
                            <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(pct, 100)}%`, bgcolor: 'rgba(239,83,80,0.12)', zIndex: 0 }} />
                            <Typography sx={{ color: '#ef5350', fontSize: 12, fontWeight: 500, position: 'relative', zIndex: 1 }}>{formatCurrency(price)}</Typography>
                            <Typography sx={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, position: 'relative', zIndex: 1 }}>{qty}</Typography>
                          </Box>
                        )
                      })}
                    </Grid>
                    <Grid item xs={6}>
                      <Typography sx={{ color: theme.palette.primary.main, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.5 }}>Bids</Typography>
                      {bidsToShow.map((bid: any, i: number) => {
                        const price = bid.priceMultiplier * asset.basePrice
                        const qty = bid.size ?? bid.quantity ?? 0
                        const pct = maxBidQty ? (Number(qty) / maxBidQty) * 100 : 0
                        return (
                          <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.25, position: 'relative', overflow: 'hidden', borderRadius: 0.5 }}>
                            <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(pct, 100)}%`, bgcolor: 'rgba(0,255,136,0.1)', zIndex: 0 }} />
                            <Typography sx={{ color: theme.palette.primary.main, fontSize: 12, fontWeight: 500, position: 'relative', zIndex: 1 }}>{formatCurrency(price)}</Typography>
                            <Typography sx={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, position: 'relative', zIndex: 1 }}>{qty}</Typography>
                          </Box>
                        )
                      })}
                    </Grid>
                  </Grid>
                </Paper>
              )
            })()}

          </Grid>
        </Grid>

        <Dialog open={confirmPlaceOpen} onClose={() => setConfirmPlaceOpen(false)} PaperProps={{ sx: { bgcolor: '#1e1e1e', color: '#fff', borderRadius: 2, border: '1px solid rgba(255,255,255,0.1)' } }}>
          <DialogTitle sx={{ color: '#fff', fontWeight: 600 }}>Confirm order</DialogTitle>
          <DialogContent>
            <DialogContentText sx={{ color: 'rgba(255,255,255,0.8)' }}>
              {orderType === 'buy'
                ? `Buy ${quantity} share(s) of ${symbol} at ${formatCurrency(price)} each (total ${formatCurrency(quantity * price)})?`
                : `Sell ${quantity} share(s) of ${symbol} at ${formatCurrency(price)} each?`}
            </DialogContentText>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
            <Button onClick={() => setConfirmPlaceOpen(false)} sx={{ color: 'rgba(255,255,255,0.8)', textTransform: 'none' }}>Back</Button>
            <Button variant="contained" onClick={placeOrder} disabled={loading} sx={{ textTransform: 'none', fontWeight: 600 }}>
              {loading ? 'Placing...' : 'Confirm'}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={confirmCancelOpen} onClose={() => { setConfirmCancelOpen(false); setOrderIdToCancel(null) }} PaperProps={{ sx: { bgcolor: '#1e1e1e', color: '#fff', borderRadius: 2, border: '1px solid rgba(255,255,255,0.1)' } }}>
          <DialogTitle sx={{ color: '#fff', fontWeight: 600 }}>Cancel order</DialogTitle>
          <DialogContent>
            <DialogContentText sx={{ color: 'rgba(255,255,255,0.8)' }}>Are you sure you want to cancel this order?</DialogContentText>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
            <Button onClick={() => { setConfirmCancelOpen(false); setOrderIdToCancel(null) }} sx={{ color: 'rgba(255,255,255,0.8)', textTransform: 'none' }}>Keep</Button>
            <Button
              color="error"
              variant="contained"
              onClick={() => orderIdToCancel && cancelOrder(orderIdToCancel)}
              disabled={!orderIdToCancel || cancellingId !== null}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              {cancellingId ? 'Cancelling...' : 'Cancel order'}
            </Button>
          </DialogActions>
        </Dialog>

        <Snackbar
          open={snackbar.open}
          autoHideDuration={5000}
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert severity={snackbar.severity} onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Container>
    </Box>
  )
}
