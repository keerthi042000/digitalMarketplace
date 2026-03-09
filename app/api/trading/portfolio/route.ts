import { NextRequest, NextResponse } from 'next/server'
import { getAuthUserId } from '@/lib/auth'
import db from '@/lib/db'
import secondaryTradingAssets from '@/data/secondaryTradingAssets.json'

const assets = (secondaryTradingAssets as { investments?: Array<{ symbol?: string; title?: string; currentValue?: number }> }).investments || []

export const dynamic = 'force-dynamic'

function findAssetBySymbol(symbol: string) {
  return assets.find((a: { symbol?: string; title?: string; currentValue?: number }) =>
    (a.symbol && a.symbol.toUpperCase() === symbol.toUpperCase())
  )
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthUserId(request)
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in to continue.' },
        { status: 401 }
      )
    }

    const balanceRow = db.prepare(
      'SELECT cash_balance FROM trading_balances WHERE user_id = ?'
    ).get(userId) as { cash_balance: number } | undefined
    const cashBalance = balanceRow ? Number(balanceRow.cash_balance) : 0

    const holdings = db.prepare(
      'SELECT symbol, shares, avg_cost FROM trading_holdings WHERE user_id = ? AND shares > 0 ORDER BY symbol'
    ).all(userId) as Array<{ symbol: string; shares: number; avg_cost: number }>

    const orders = db.prepare(
      `SELECT id, symbol, side, quantity, remaining_quantity, price, status, created_at
       FROM trading_orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`
    ).all(userId) as Array<{
      id: string
      symbol: string
      side: string
      quantity: number
      remaining_quantity: number
      price: number
      status: string
      created_at: string
    }>

    const holdingsEnriched = holdings.map((h) => {
      const asset = findAssetBySymbol(h.symbol)
      return {
        symbol: h.symbol,
        shares: Number(h.shares),
        avgCost: Number(h.avg_cost),
        assetTitle: asset?.title ?? h.symbol,
        currentPrice: asset?.currentValue ?? Number(h.avg_cost),
      }
    })

    return NextResponse.json({
      cashBalance,
      holdings: holdingsEnriched,
      orders: orders.map((o) => ({
        id: o.id,
        symbol: o.symbol,
        side: o.side,
        quantity: Number(o.quantity),
        remainingQuantity: Number(o.remaining_quantity),
        price: Number(o.price),
        status: o.status,
        createdAt: o.created_at,
      })),
    })
  } catch (error: unknown) {
    console.error('Error fetching trading portfolio:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch portfolio' },
      { status: 500 }
    )
  }
}
