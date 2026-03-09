'use client'

import { Box, Typography, Button, Paper, Grid } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { useRouter } from 'next/navigation'
import { TrendingUp, AccountBalance, ShowChart } from '@mui/icons-material'
import styles from './PortfolioSummaryCard.module.css'

interface PortfolioSummaryCardProps {
  totalValue: number
  investedAmount: number
  cashAvailable: number
  tradingBalance?: number
  tradingPositionsValue?: number
  loading?: boolean
  onInvestedClick?: () => void
}

export default function PortfolioSummaryCard({
  totalValue,
  investedAmount,
  cashAvailable,
  tradingBalance = 0,
  tradingPositionsValue = 0,
  loading = false,
  onInvestedClick,
}: PortfolioSummaryCardProps) {
  const theme = useTheme()
  const router = useRouter()

  const handleDepositClick = async () => {
    try {
      const response = await fetch('/api/payment-methods')
      if (response.status === 401) {
        router.push('/auth')
        return
      }
      if (!response.ok) {
        return
      }
      const data = await response.json()
      const hasMethods = Array.isArray(data.paymentMethods) && data.paymentMethods.length > 0
      router.push(hasMethods ? '/account/banking/deposit' : '/account/banking/add-payment-method')
    } catch (error) {
      console.error('Error checking payment methods:', error)
    }
  }

  const safeTotal = totalValue > 0 ? totalValue : 0
  const allocation = safeTotal
    ? [
        { label: 'Invested (primary)', value: investedAmount, color: '#00bcd4' },
        { label: 'Trading positions', value: tradingPositionsValue, color: '#ff9800' },
        { label: 'Trading cash', value: tradingBalance, color: theme.palette.primary.main },
        { label: 'Bank cash', value: cashAvailable, color: '#888888' },
      ].filter((s) => s.value > 0.01)
    : []

  return (
    <Paper className={styles.card}>
      <Box className={styles.header}>
        <Typography variant="h6" className={styles.title}>
          Portfolio Overview
        </Typography>
      </Box>

      <Box className={styles.content}>
        <Box className={styles.mainValue}>
          <Typography variant="h3" className={styles.totalValue}>
            {loading ? '—' : `$${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </Typography>
          <Typography variant="body2" className={styles.totalLabel}>
            {loading ? 'Loading...' : 'Total Portfolio Value'}
          </Typography>
        </Box>

        {allocation.length > 0 && (
          <Box sx={{ mb: 1 }}>
            <Box
              sx={{
                display: 'flex',
                height: 10,
                borderRadius: 999,
                overflow: 'hidden',
                background: 'rgba(255,255,255,0.04)',
                mb: 1,
              }}
            >
              {allocation.map((seg, idx) => {
                const pct = Math.max(2, (seg.value / safeTotal) * 100)
                return (
                  <Box
                    key={seg.label}
                    sx={{
                      flexBasis: `${pct}%`,
                      flexGrow: pct,
                      backgroundColor: seg.color,
                      opacity: 0.9,
                      '&:not(:last-of-type)': {
                        mr: 0.3,
                      },
                    }}
                  />
                )
              })}
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
              {allocation.map((seg) => (
                <Box key={seg.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: seg.color,
                    }}
                  />
                  <Typography sx={{ color: 'rgba(255,255,255,0.85)', fontSize: 17 }}>
                    {seg.label}{' '}
                    <Box
                      component="span"
                      sx={{ color: 'rgba(255,255,255,0.8)', fontSize: 17, fontWeight: 600 }}
                    >
                      ({((seg.value / safeTotal) * 100).toFixed(1)}%)
                    </Box>
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        )}

        <Grid container spacing={2} className={styles.statsGrid}>
          <Grid item xs={12} sm={6} md={4} lg={3}>
            <Box 
              className={styles.statCard}
              onClick={onInvestedClick}
              sx={{
                cursor: onInvestedClick ? 'pointer' : 'default',
                '&:hover': onInvestedClick ? {
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  borderColor: 'rgba(255, 255, 255, 0.15)',
                } : {},
              }}
            >
              <Box className={styles.statIcon} sx={{ backgroundColor: 'rgba(0, 188, 212, 0.15)' }}>
                <TrendingUp sx={{ color: '#00bcd4', fontSize: 24 }} />
              </Box>
              <Box className={styles.statContent}>
                <Typography variant="body2" className={styles.statLabel}>
                  Invested
                </Typography>
                <Typography variant="h6" className={styles.statValue}>
                  ${investedAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Typography>
              </Box>
            </Box>
          </Grid>

          <Grid item xs={12} sm={6} md={4} lg={3}>
            <Box className={styles.statCard}>
              <Box className={styles.statIcon} sx={{ backgroundColor: 'rgba(136, 136, 136, 0.15)' }}>
                <AccountBalance sx={{ color: '#888888', fontSize: 24 }} />
              </Box>
              <Box className={styles.statContent}>
                <Typography variant="body2" className={styles.statLabel}>
                  Cash Available
                </Typography>
                <Typography variant="h6" className={styles.statValue}>
                  ${cashAvailable.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Typography>
              </Box>
            </Box>
          </Grid>

          <Grid item xs={12} sm={6} md={4} lg={3}>
            <Box className={styles.statCard}>
              <Box className={styles.statIcon} sx={{ backgroundColor: 'rgba(0, 255, 136, 0.12)' }}>
                <AccountBalance sx={{ color: theme.palette.primary.main, fontSize: 24 }} />
              </Box>
              <Box className={styles.statContent}>
                <Typography variant="body2" className={styles.statLabel}>
                  Trading balance
                </Typography>
                <Typography variant="h6" className={styles.statValue}>
                  ${tradingBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Typography>
              </Box>
            </Box>
          </Grid>
          <Grid item xs={12} sm={6} md={4} lg={3}>
            <Box className={styles.statCard}>
              <Box className={styles.statIcon} sx={{ backgroundColor: 'rgba(255, 152, 0, 0.15)' }}>
                <ShowChart sx={{ color: '#ff9800', fontSize: 24 }} />
              </Box>
              <Box className={styles.statContent}>
                <Typography variant="body2" className={styles.statLabel}>
                  Trading positions
                </Typography>
                <Typography variant="h6" className={styles.statValue}>
                  ${tradingPositionsValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Typography>
              </Box>
            </Box>
          </Grid>

          <Grid item xs={12} sm={6} md={4} lg={3}>
            <Button
              variant="contained"
              fullWidth
              className={styles.depositButton}
              onClick={handleDepositClick}
              sx={{
                backgroundColor: theme.palette.primary.main,
                color: '#000000',
                fontWeight: 600,
                py: 2,
                '&:hover': {
                  backgroundColor: '#00cc6a',
                },
              }}
            >
              Deposit Funds
            </Button>
          </Grid>
        </Grid>
      </Box>
    </Paper>
  )
}
