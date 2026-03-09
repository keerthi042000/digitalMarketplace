import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { getAuthUserId } from '@/lib/auth'
import db from '@/lib/db'
import { matchOrder } from '@/lib/matchingEngine'
import secondaryTradingAssets from '@/data/secondaryTradingAssets.json'

export const dynamic = 'force-dynamic'

type Asset = { id: string; symbol?: string; title?: string }

const assets = (secondaryTradingAssets as { investments?: Asset[] }).investments ?? []

function getSymbolFromAssetId(assetId: string): string | null {
  const asset = assets.find((a) => a.id === assetId)
  if (!asset) return null
  if (asset.symbol?.trim()) return asset.symbol.toUpperCase()
  const title = (asset.title ?? '').replace(/[^A-Za-z]/g, '').toUpperCase()
  return title.slice(0, 4) || null
}

function ensureTradingBalance(userId: string): number {
  let row = db.prepare('SELECT cash_balance FROM trading_balances WHERE user_id = ?').get(userId) as
    | { cash_balance: number }
    | undefined
  if (!row) {
    db.prepare(
      `INSERT INTO trading_balances (id, user_id, cash_balance, created_at, updated_at)
       VALUES (?, ?, 0, datetime('now'), datetime('now'))`
    ).run(`bal_${userId}`, userId)
    return 0
  }
  return Number(row.cash_balance)
}

function getHoldingShares(userId: string, symbol: string): number {
  const row = db.prepare('SELECT shares FROM trading_holdings WHERE user_id = ? AND symbol = ?').get(
    userId,
    symbol
  ) as { shares: number } | undefined
  return row ? Number(row.shares) : 0
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthUserId(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const assetId = body?.assetId
    const side = body?.side
    const quantity = Number(body?.quantity)
    const price = Number(body?.price)

    if (!assetId || typeof assetId !== 'string') {
      return NextResponse.json({ error: 'Invalid or missing assetId' }, { status: 400 })
    }
    if (side !== 'buy' && side !== 'sell') {
      return NextResponse.json({ error: 'side must be buy or sell' }, { status: 400 })
    }
    if (!Number.isInteger(quantity) || quantity < 1) {
      return NextResponse.json({ error: 'quantity must be a positive integer' }, { status: 400 })
    }
    if (typeof price !== 'number' || price <= 0 || !Number.isFinite(price)) {
      return NextResponse.json({ error: 'price must be a positive number' }, { status: 400 })
    }

    const symbol = getSymbolFromAssetId(assetId)
    if (!symbol) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    }

    const orderAmount = quantity * price

    if (side === 'buy') {
      const cashBalance = ensureTradingBalance(userId)
      if (cashBalance < orderAmount) {
        return NextResponse.json(
          { error: 'Insufficient trading balance', required: orderAmount, available: cashBalance },
          { status: 400 }
        )
      }
      db.prepare(
        `UPDATE trading_balances SET cash_balance = cash_balance - ?, updated_at = datetime('now') WHERE user_id = ?`
      ).run(orderAmount, userId)
    } else {
      const shares = getHoldingShares(userId, symbol)
      if (shares < quantity) {
        return NextResponse.json(
          { error: 'Insufficient shares to sell', required: quantity, available: shares },
          { status: 400 }
        )
      }
    }

    let result: { orderId: string; status: string; remaining: number }
    try {
      result = matchOrder(
        crypto.randomUUID(),
        userId,
        symbol,
        side,
        quantity,
        price,
        'day',
        null
      )
    } catch (err) {
      if (side === 'buy') {
        db.prepare(
          `UPDATE trading_balances SET cash_balance = cash_balance + ?, updated_at = datetime('now') WHERE user_id = ?`
        ).run(orderAmount, userId)
      }
      throw err
    }

    if (side === 'buy' && result.remaining > 0) {
      const refund = result.remaining * price
      db.prepare(
        `UPDATE trading_balances SET cash_balance = cash_balance + ?, updated_at = datetime('now') WHERE user_id = ?`
      ).run(refund, userId)
    }

    return NextResponse.json({
      orderId: result.orderId,
      status: result.status,
      remaining: result.remaining,
      filled: quantity - result.remaining,
    })
  } catch (error) {
    console.error('Place order error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to place order' },
      { status: 500 }
    )
  }
}
