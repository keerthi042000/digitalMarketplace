'use client'

/**
 * SECONDARY MARKETPLACE - Asset Listing Page
 *
 * Build this page to display available trading assets with filtering and search.
 * Navigate to /investing/secondary-trading/[id] on asset click.
 *
 * Data: GET /api/trading/assets → { assets: [...], total: 5 }
 * Or: import secondaryTradingAssets from '@/data/secondaryTradingAssets.json'
 * Utils: import { formatCurrency, slugify } from '@/lib/investmentUtils'
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/Header'
// import {
//   Box,
//   Container,
//   Typography,
//   Grid,
//   Paper,
// } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { useAuth } from '@/contexts/AuthContext'
import secondaryTradingAssets from '@/data/secondaryTradingAssets.json'
import { formatCurrency, getSecondaryTradingSymbol, getSeededColor } from '@/lib/investmentUtils'

import {
  Box,
  Container,
  Typography,
  Grid,
  Paper,
  TextField,
  InputAdornment,
  MenuItem,
  Button,
  Chip,
  FormControl,
  InputLabel,
  Select,
  Checkbox,
  ListItemText,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'

type Asset = {
  id: string
  title: string
  category: string
  basePrice: number
  previousValue: number
  currentValue: number
  performancePercent: number
  isPositive: boolean
  volume: string
  companyDescription: string
  marketCap?: string
  avgVolume?: string
  peRatio?: number
  dividendYield?: number
   yearHigh?: number
   yearLow?: number
   revenueGrowth?: number
   // dailyHistory is present in JSON; we treat it as loosely typed here for sparkline
   dailyHistory?: any[]
  symbol?: string
}

type SortOption = 'featured' | 'priceAsc' | 'priceDesc' | 'changeDesc'

export default function SecondaryTradingPage() {
  const router = useRouter()
  const theme = useTheme()
  const { user, isAuthenticated } = useAuth()
  const allAssets = secondaryTradingAssets.investments as Asset[]

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string[]>([])
  const [performanceFilter, setPerformanceFilter] = useState<string[]>([])
  const [sortBy, setSortBy] = useState<SortOption>('featured')

  const categories = Array.from(new Set(allAssets.map((a) => a.category).filter(Boolean))).sort()
  const topPerformance = Math.max(...allAssets.map((a) => a.performancePercent))

  const hasActiveFilters = search !== '' || categoryFilter.length > 0 || performanceFilter.length > 0

  const clearFilters = () => {
    setSearch('')
    setCategoryFilter([])
    setPerformanceFilter([])
  }

  const filteredAssets = allAssets.filter((asset) => {
    const matchesSearch =
      asset.title.toLowerCase().includes(search.toLowerCase()) ||
      getSecondaryTradingSymbol(asset.title, asset.symbol).toLowerCase().includes(search.toLowerCase())
    const matchesCategory = categoryFilter.length === 0 || categoryFilter.includes(asset.category)
    const matchesPerformance =
      performanceFilter.length === 0 ||
      (performanceFilter.includes('Gainers') && asset.isPositive) ||
      (performanceFilter.includes('Losers') && !asset.isPositive)
    return matchesSearch && matchesCategory && matchesPerformance
  })

  const sortedAssets = [...filteredAssets].sort((a, b) => {
    if (sortBy === 'priceAsc') {
      return a.currentValue - b.currentValue
    }
    if (sortBy === 'priceDesc') {
      return b.currentValue - a.currentValue
    }
    if (sortBy === 'changeDesc') {
      return b.performancePercent - a.performancePercent
    }
    return 0
  })


  // ─── Replace this placeholder layout with your implementation ───

  return (
    <Box sx={{ minHeight: '100vh' }}>
      <Header />

      <Container maxWidth="lg" sx={{ pt: { xs: '100px', sm: '120px' }, pb: 6 }}>
        <Box
          sx={{
            borderLeft: `4px solid ${theme.palette.primary.main}`,
            pl: 2,
            mb: 3,
          }}
        >
          <Typography
            variant="h4"
            sx={{
              fontWeight: 800,
              color: '#fff',
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
              mb: 0.75,
              textShadow: '0 0 40px rgba(0,255,136,0.15)',
            }}
          >
            Secondary Marketplace
          </Typography>
          <Typography
            sx={{
              color: 'rgba(255,255,255,0.7)',
              fontSize: 15,
              fontWeight: 500,
              letterSpacing: 0.2,
              maxWidth: 480,
            }}
          >
            Browse and trade digital securities on the secondary market.
          </Typography>
        </Box>

        <Paper
          sx={{
            p: 2,
            mb: 3,
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 2,
            bgcolor: 'rgba(255,255,255,0.02)',
          }}
        >
          <Grid container spacing={2} alignItems="center" sx={{ flexWrap: { xs: 'wrap', md: 'nowrap' } }}>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                placeholder="Search by name or description"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                size="small"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: 'rgba(255,255,255,0.5)' }} />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    bgcolor: 'rgba(255,255,255,0.04)',
                    borderRadius: 1.5,
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' },
                    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                  },
                }}
              />
            </Grid>

            <Grid item xs={6} md={3}>
              <FormControl fullWidth size="small" sx={{ minWidth: 100 }}>
                <InputLabel sx={{ color: 'rgba(255,255,255,0.6)' }}>Category</InputLabel>
                <Select
                  multiple
                  value={categoryFilter}
                  label="Category"
                  onChange={(e) => setCategoryFilter(typeof e.target.value === 'string' ? [] : e.target.value)}
                  renderValue={(selected) => (selected.length === 0 ? 'All' : selected.map((c) => c.charAt(0).toUpperCase() + c.slice(1)).join(', '))}
                  sx={{
                    color: '#fff',
                    bgcolor: 'rgba(255,255,255,0.04)',
                    borderRadius: 1.5,
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' },
                    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                    '& .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.5)' },
                  }}
                >
                  {categories.map((cat) => (
                    <MenuItem key={cat} value={cat}>
                      <Checkbox checked={categoryFilter.includes(cat)} size="small" sx={{ color: 'rgba(255,255,255,0.7)' }} />
                      <ListItemText primary={cat.charAt(0).toUpperCase() + cat.slice(1)} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={6} md={3}>
              <FormControl fullWidth size="small" sx={{ minWidth: 100 }}>
                <InputLabel sx={{ color: 'rgba(255,255,255,0.6)' }}>Performance</InputLabel>
                <Select
                  multiple
                  value={performanceFilter}
                  label="Performance"
                  onChange={(e) => setPerformanceFilter(typeof e.target.value === 'string' ? [] : e.target.value)}
                  renderValue={(selected) => (selected.length === 0 ? 'All' : selected.join(', '))}
                  sx={{
                    color: '#fff',
                    bgcolor: 'rgba(255,255,255,0.04)',
                    borderRadius: 1.5,
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' },
                    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                    '& .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.5)' },
                  }}
                >
                  <MenuItem value="Gainers">
                    <Checkbox checked={performanceFilter.includes('Gainers')} size="small" sx={{ color: 'rgba(255,255,255,0.7)' }} />
                    <ListItemText primary="Gainers" />
                  </MenuItem>
                  <MenuItem value="Losers">
                    <Checkbox checked={performanceFilter.includes('Losers')} size="small" sx={{ color: 'rgba(255,255,255,0.7)' }} />
                    <ListItemText primary="Losers" />
                  </MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={6} md={3}>
              <TextField
                select
                fullWidth
                size="small"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                label="Sort by"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    bgcolor: 'rgba(255,255,255,0.04)',
                    borderRadius: 1.5,
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' },
                    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                  },
                  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.6)' },
                  '& .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.5)' },
                }}
              >
                <MenuItem value="featured">Featured</MenuItem>
                <MenuItem value="priceAsc">Price · Low to high</MenuItem>
                <MenuItem value="priceDesc">Price · High to low</MenuItem>
                <MenuItem value="changeDesc">Performance · Top gainers</MenuItem>
              </TextField>
            </Grid>


          </Grid>
        </Paper>


        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.45)' }}>
            {filteredAssets.length} asset{filteredAssets.length !== 1 ? 's' : ''} available
            {hasActiveFilters ? ' matching filters' : ''}
          </Typography>
          {hasActiveFilters && (
            <Button size="small" onClick={clearFilters} sx={{ textTransform: 'none', color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>
              Clear filters
            </Button>
          )}
        </Box>

        <Grid container spacing={2}>
          {sortedAssets.map((asset) => {
            const symbol = getSecondaryTradingSymbol(asset.title, asset.symbol)
            const categoryLabel = asset.category ? asset.category.charAt(0).toUpperCase() + asset.category.slice(1) : ''
            const isTopGainer = asset.performancePercent === topPerformance
            const hasDividend = asset.dividendYield != null && asset.dividendYield > 0
            const hasGrowth = asset.revenueGrowth != null && asset.revenueGrowth > 0
            return (
              <Grid item xs={12} sm={6} md={4} key={asset.id}>
                <Paper
                  onClick={() => router.push(`/investing/secondary-trading/${asset.id}`)}
                  elevation={0}
                  sx={{
                    p: 3,
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 3,
                    cursor: 'pointer',
                    transition: 'all 0.22s ease',
                    backgroundColor: 'rgba(255,255,255,0.02)',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      borderColor: 'rgba(0,255,136,0.4)',
                      boxShadow: '0 12px 28px rgba(0,0,0,0.35)',
                      backgroundColor: 'rgba(255,255,255,0.04)',
                    },
                  }}

                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.75, mb: 2.5 }}>
                    <Box
                      sx={{
                        width: 44,
                        height: 44,
                        borderRadius: '12px',
                        backgroundColor: getSeededColor(symbol),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '15px' }}>
                        {symbol.slice(0, 2)}
                      </Typography>
                    </Box>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography sx={{ color: '#ffffff', fontWeight: 600, fontSize: '15px', lineHeight: 1.3 }} noWrap>
                        {asset.title}
                      </Typography>
                      <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px' }}>
                        {symbol}
                        {categoryLabel ? ` · ${categoryLabel}` : ''}
                      </Typography>
                      {asset.companyDescription && (
                        <Typography
                          sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, mt: 0.5 }}
                          noWrap
                        >
                          {asset.companyDescription}
                        </Typography>
                      )}
                    </Box>
                    {isTopGainer && (
                      <Chip
                        label="Top gainer"
                        size="small"
                        sx={{
                          ml: 1,
                          fontSize: 10,
                          height: 20,
                          bgcolor: 'rgba(0,255,136,0.16)',
                          color: theme.palette.primary.main,
                        }}
                      />
                    )}
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
                    <Typography sx={{ color: '#ffffff', fontWeight: 700, fontSize: '1.25rem' }}>
                      {formatCurrency(asset.currentValue)}
                    </Typography>
                    <Typography
                      sx={{
                        color: asset.isPositive ? theme.palette.primary.main : '#ef5350',
                        fontWeight: 600,
                        fontSize: '13px',
                      }}
                    >
                      {asset.isPositive ? '+' : ''}{asset.performancePercent.toFixed(2)}%
                    </Typography>
                  </Box>
                  {asset.yearHigh != null && asset.yearLow != null && (
                    <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, mb: 1 }}>
                      52w: {formatCurrency(asset.yearLow)} – {formatCurrency(asset.yearHigh)}
                    </Typography>
                  )}
                  {Array.isArray(asset.dailyHistory) && asset.dailyHistory.length > 1 && (
                    <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 0.4, height: 32, mb: 1.2 }}>
                      {(() => {
                        const closes = asset.dailyHistory!.map((c: any) => c.close ?? asset.basePrice * (c.closeMultiplier ?? 1))
                        const minC = Math.min(...closes)
                        const maxC = Math.max(...closes)
                        const range = maxC - minC || 1
                        return asset.dailyHistory!.map((candle: any, idx: number) => {
                          const closeVal = candle.close ?? asset.basePrice * (candle.closeMultiplier ?? 1)
                          const pct = ((closeVal - minC) / range) * 100
                          const h = Math.max(6, (pct / 100) * 28)
                          return (
                            <Box
                              key={idx}
                              sx={{
                                flex: 1,
                                minWidth: 2,
                                height: `${h}px`,
                                borderRadius: 999,
                                backgroundColor: closeVal >= closes[0] ? theme.palette.primary.main : '#ef5350',
                                opacity: 0.8,
                              }}
                            />
                          )
                        })
                      })()}
                    </Box>
                  )}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
                    <Box>
                      <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                        Market cap
                      </Typography>
                      <Typography sx={{ color: '#ffffff', fontSize: 13, fontWeight: 500 }}>
                        {asset.marketCap ?? '—'}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                        Avg volume
                      </Typography>
                      <Typography sx={{ color: '#ffffff', fontSize: 13, fontWeight: 500 }}>
                        {asset.avgVolume ?? asset.volume ?? '—'}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                        P/E
                      </Typography>
                      <Typography sx={{ color: '#ffffff', fontSize: 13, fontWeight: 500 }}>
                        {asset.peRatio != null ? asset.peRatio.toFixed(1) : '—'}
                      </Typography>
                    </Box>
                  </Box>
                  {(hasDividend || hasGrowth) && (
                    <Box sx={{ display: 'flex', gap: 0.5, mt: 1, flexWrap: 'wrap' }}>
                      {hasDividend && (
                        <Chip
                          label={`Dividend ${asset.dividendYield!.toFixed(1)}%`}
                          size="small"
                          sx={{
                            height: 20,
                            fontSize: 10,
                            bgcolor: 'rgba(255,255,255,0.1)',
                            color: '#fff',
                          }}
                        />
                      )}
                      {hasGrowth && (
                        <Chip
                          label={`Rev growth ${asset.revenueGrowth!.toFixed(1)}%`}
                          size="small"
                          sx={{
                            height: 20,
                            fontSize: 10,
                            bgcolor: 'rgba(0,255,136,0.14)',
                            color: theme.palette.primary.main,
                          }}
                        />
                      )}
                    </Box>
                  )}
                </Paper>
              </Grid>
            )
          })}
        </Grid>
        {filteredAssets.length === 0 && (
          <Paper
            elevation={0}
            sx={{
              mt: 3,
              p: 4,
              textAlign: 'center',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 2,
              bgcolor: 'rgba(255,255,255,0.02)',
            }}
          >
            <Typography sx={{ color: 'rgba(255,255,255,0.7)', mb: 1 }}>No assets match your filters.</Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, mb: 2 }}>
              Try a different search or category.
            </Typography>
            <Button
              variant="outlined"
              size="small"
              onClick={clearFilters}
              sx={{ textTransform: 'none', borderColor: 'rgba(255,255,255,0.3)', color: 'rgba(255,255,255,0.9)', '&:hover': { borderColor: 'rgba(255,255,255,0.5)' } }}
            >
              Clear filters
            </Button>
          </Paper>
        )}


        {/* Remove this notice once you start building */}
        {/* <Paper sx={{
          mt: 4, p: 2.5,
          border: '1px dashed rgba(114, 110, 92, 0.25)',
          borderRadius: 2,
          backgroundColor: 'rgba(255, 200, 0, 0.02)',
        }}>
          <Typography sx={{ color: '#998a00', fontSize: '13px', lineHeight: 1.7 }}>
            The layout above is a generic wireframe to help you get started.
            Remove it and build your own — this is your playground, feel free to explore.
          </Typography>
        </Paper> */}
      </Container>
    </Box>
  )
}
