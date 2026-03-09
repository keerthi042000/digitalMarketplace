import { NextRequest, NextResponse } from 'next/server'
import { getAuthUserId } from '@/lib/auth'
import db from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthUserId(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const symbol = searchParams.get('symbol')?.toUpperCase()
    const status = searchParams.get('status')
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10) || 50))

    let query = 'SELECT id, symbol, side, quantity, remaining_quantity, price, status, created_at FROM trading_orders WHERE user_id = ?'
    const params: (string | number)[] = [userId]
    if (symbol) {
      query += ' AND symbol = ?'
      params.push(symbol)
    }
    if (status) {
      query += ' AND status = ?'
      params.push(status)
    }
    query += ' ORDER BY created_at DESC LIMIT ?'
    params.push(limit)

    const orders = db.prepare(query).all(...params) as Array<{
      id: string
      symbol: string
      side: string
      quantity: number
      remaining_quantity: number
      price: number
      status: string
      created_at: string
    }>

    return NextResponse.json({
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
  } catch (error) {
    console.error('Fetch orders error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch orders' },
      { status: 500 }
    )
  }
}
