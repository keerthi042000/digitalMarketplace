'use client'

import { useState, useEffect } from 'react'
import {
  Box,
  List,
  Typography,
  ListItem,
  ListItemText,
  IconButton,
  Alert,
  Button,
} from '@mui/material'
import {
  ArrowForward,
} from '@mui/icons-material'
import PortfolioSummaryCard from './PortfolioSummaryCard'
import InvestmentsSection from './InvestmentsSection'
import styles from './CashBalance.module.css'

interface Investment {
  id: string
  amount: number
  payment_status: string
}

export interface TradingHolding {
  symbol: string
  shares: number
  avgCost: number
  assetTitle?: string
  currentPrice?: number
}

export interface TradingOrder {
  id: string
  symbol: string
  side: string
  quantity: number
  remainingQuantity: number
  price: number
  status: string
  createdAt: string
}

export default function CashBalance() {
  const [cashAvailable, setCashAvailable] = useState(0)
  const [investments, setInvestments] = useState<Investment[]>([])
  const [tradingBalance, setTradingBalance] = useState(0)
  const [tradingHoldings, setTradingHoldings] = useState<TradingHolding[]>([])
  const [tradingOrders, setTradingOrders] = useState<TradingOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [tradingError, setTradingError] = useState<string | null>(null)
  const [isPositionsExpanded, setIsPositionsExpanded] = useState(false)
  const [positionsExpandedSection, setPositionsExpandedSection] = useState<'holdings' | 'orders' | null>(null)

  const fetchBalances = async () => {
    try {
      const balanceResponse= await fetch('/api/banking/balance');

      if (balanceResponse.ok) {
        const data = await balanceResponse.json()
        setCashAvailable(Number(data.balance) || 0)
      }

    } catch (error) {
      console.error('Error fetching cash balance:', error)
    }
  }

  const fetchTradingPortfolio = async () => {
    setTradingError(null)
    try {
      const res = await fetch('/api/trading/portfolio')
      if (res.ok) {
        const data = await res.json()
        setTradingBalance(Number(data.cashBalance) ?? 0)
        setTradingHoldings(data.holdings ?? [])
        setTradingOrders(data.orders ?? [])
      } else {
        setTradingError('Could not load trading data')
      }
    } catch (error) {
      console.error('Error fetching trading portfolio:', error)
      setTradingError('Could not load trading data')
    }
  }

  useEffect(() => {
    fetchInvestments()
    fetchBalances()
    fetchTradingPortfolio()
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

  const investedAmount = investments
    .filter((inv) => inv.payment_status === 'COMPLETED')
    .reduce((sum, inv) => sum + inv.amount, 0)

  const tradingPositionsValue = tradingHoldings.reduce(
    (sum, h) => sum + h.shares * (h.currentPrice ?? h.avgCost),
    0
  )

  const portfolioValue =
    investedAmount + cashAvailable + tradingBalance + tradingPositionsValue

  return (
    <Box className={styles.content}>
      {/* Portfolio Summary Section */}
      <PortfolioSummaryCard
        totalValue={portfolioValue}
        cashAvailable={cashAvailable}
        investedAmount={investedAmount}
        tradingBalance={tradingBalance}
        tradingPositionsValue={tradingPositionsValue}
        loading={loading}
        onInvestedClick={() => {
          setIsPositionsExpanded(!isPositionsExpanded)
          setPositionsExpandedSection('holdings')
        }}
      />

      {tradingError && (
        <Alert
          severity="warning"
          action={
            <Button color="inherit" size="small" onClick={fetchTradingPortfolio} sx={{ fontWeight: 600 }}>
              Retry
            </Button>
          }
          sx={{ mb: 2, bgcolor: 'rgba(255,152,0,0.08)', border: '1px solid rgba(255,152,0,0.25)', color: '#fff' }}
        >
          {tradingError}
        </Alert>
      )}

      {/* Investments Section */}
      <InvestmentsSection
        isPositionsExpanded={isPositionsExpanded}
        onTogglePositions={() => setIsPositionsExpanded(!isPositionsExpanded)}
        tradingHoldings={tradingHoldings}
        tradingOrders={tradingOrders}
        initialExpandedSection={positionsExpandedSection}
        onExpandedSectionApplied={() => setPositionsExpandedSection(null)}
      />

      {/* All History Section */}
      <Box className={styles.historySection}>
        <Typography variant="h6" className={styles.sectionTitle}>
          ALL HISTORY
        </Typography>
        <List className={styles.historyList}>
          {tradingOrders.length > 0 && (
            <ListItem
              className={styles.historyItem}
              onClick={() => {
                setIsPositionsExpanded(true)
                setPositionsExpandedSection('orders')
              }}
              sx={{ cursor: 'pointer' }}
            >
              <ListItemText
                primary="Order history"
                secondary={`${tradingOrders.length} trading order(s)`}
                className={styles.historyText}
              />
              <IconButton edge="end" className={styles.historyArrow}>
                <ArrowForward />
              </IconButton>
            </ListItem>
          )}
          <ListItem
            className={styles.historyItem}
            onClick={() => {
              // Handle documents click
            }}
          >
            <ListItemText
              primary="All Transactions"
              secondary="Past Transactions"
              className={styles.historyText}
            />
            <IconButton edge="end" className={styles.historyArrow}>
              <ArrowForward />
            </IconButton>
          </ListItem>
          <ListItem className={styles.historyItem} onClick={() => {}}>
            <ListItemText
              primary="All Documents"
              secondary="Account Statements, Tax Docs..."
              className={styles.historyText}
            />
            <IconButton edge="end" className={styles.historyArrow}>
              <ArrowForward />
            </IconButton>
          </ListItem>
        </List>
      </Box>
    </Box>
  )
}
