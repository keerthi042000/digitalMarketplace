import { NextRequest, NextResponse } from 'next/server'
import { getAuthUserId } from '@/lib/auth'
import db from '@/lib/db'

export const dynamic = 'force-dynamic'

const CANCELLABLE_STATUSES = ['New', 'Pending', 'PartiallyFilled']

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthUserId(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const orderId = body?.orderId ?? body?.id

    if (!orderId || typeof orderId !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid orderId' }, { status: 400 })
    }

    const order = db.prepare(
      'SELECT id, user_id, side, remaining_quantity, price, status FROM trading_orders WHERE id = ?'
    ).get(orderId) as
      | { id: string; user_id: string; side: string; remaining_quantity: number; price: number; status: string }
      | undefined

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }
    if (order.user_id !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (!CANCELLABLE_STATUSES.includes(order.status)) {
      return NextResponse.json(
        { error: `Order cannot be cancelled (status: ${order.status})` },
        { status: 400 }
      )
    }

    const remaining = Number(order.remaining_quantity)
    const price = Number(order.price)

    if (order.side === 'buy' && remaining > 0) {
      const refund = remaining * price
      db.prepare(
        `UPDATE trading_balances SET cash_balance = cash_balance + ?, updated_at = datetime('now') WHERE user_id = ?`
      ).run(refund, userId)
    }

    db.prepare(
      `UPDATE trading_orders SET status = 'Cancelled', remaining_quantity = 0, updated_at = datetime('now') WHERE id = ?`
    ).run(orderId)

    return NextResponse.json({
      orderId,
      status: 'Cancelled',
      message: 'Order cancelled',
    })
  } catch (error) {
    console.error('Cancel order error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to cancel order' },
      { status: 500 }
    )
  }
}
