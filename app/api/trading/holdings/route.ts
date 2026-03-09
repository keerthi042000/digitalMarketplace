import { NextRequest, NextResponse } from 'next/server'
import { getAuthUserId } from '@/lib/auth'
import db from '@/lib/db'
import secondaryTradingAssets from '@/data/secondaryTradingAssets.json'

export const dynamic = 'force-dynamic'

const assets = (secondaryTradingAssets as { investments?: Array<{ symbol?: string; title?: string; currentValue?: number }> }).investments ?? []

function findAssetBySymbol(sym: string) {
  return assets.find((a) => a.symbol?.toUpperCase() === sym.toUpperCase())
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthUserId(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const symbolParam = searchParams.get('symbol')?.toUpperCase()

    let query = 'SELECT symbol, shares, avg_cost FROM trading_holdings WHERE user_id = ? AND shares > 0'
    const params: string[] = [userId]
    if (symbolParam) {
      query += ' AND symbol = ?'
      params.push(symbolParam)
    }
    query += ' ORDER BY symbol'

    const rows = db.prepare(query).all(...params) as Array<{ symbol: string; shares: number; avg_cost: number }>

    const holdings = rows.map((h) => {
      const asset = findAssetBySymbol(h.symbol)
      return {
        symbol: h.symbol,
        shares: Number(h.shares),
        avgCost: Number(h.avg_cost),
        assetTitle: asset?.title ?? h.symbol,
        currentPrice: asset?.currentValue ?? Number(h.avg_cost),
      }
    })

    return NextResponse.json({ holdings })
  } catch (error) {
    console.error('Fetch holdings error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch holdings' },
      { status: 500 }
    )
  }
}
