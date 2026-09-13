export type Consumer = 'shared' | 'Hugo' | 'Benjamin'

export interface MonthSummary {
  key: string
  label: string
  short: string
  receiptCount: number
  countedReceiptCount: number
}

export interface MonthsResponse {
  months: MonthSummary[]
  currentMonthKey: string
}

export interface Tally {
  Hugo: number
  Benjamin: number
  shared: number
  total: number
  discount: number
  receiptCount: number
  countedReceiptCount: number
}

export interface DiscountLine {
  id: number
  rawName: string
  lineTotal: number
}

export interface ReceiptLine {
  id: number
  lineNo: number
  rawName: string
  displayName: string
  category: string | null
  quantity: number | null
  consumer: Consumer
  appliesToLineId: number | null
  isReceiptDiscount: boolean
  grossTotal: number
  discountTotal: number
  netTotal: number
  discountLines: DiscountLine[]
}

export interface Receipt {
  id: string
  kivraId: string
  purchasedAt: string
  buyer: Consumer
  store: string | null
  total: number
  excluded: boolean
  lines: ReceiptLine[]
}

export interface MonthData {
  monthKey: string
  label: string
  short: string
  prevKey: string | null
  nextKey: string | null
  tally: Tally
  receipts: Receipt[]
}

export interface TrendsMonth extends Tally {
  key: string
  label: string
  short: string
}

export interface TrendsResponse {
  months: TrendsMonth[]
}

export interface TopProduct {
  rank: number
  name: string
  count: number
  total: number
}

export interface CategoryReport {
  name: string
  Hugo: number
  Benjamin: number
  shared: number
  total: number
}

export type PersonFilter = 'total' | Consumer

export interface ReportsResponse {
  scope: 'month' | 'all'
  monthKey: string | null
  person: PersonFilter
  label: string
  total: number
  topProducts: TopProduct[]
  categories: CategoryReport[]
}

export interface ProductRow {
  rawName: string
  displayName: string | null
  category: string | null
  count: number
  total: number
  defaultConsumer: Consumer | null
}

export interface ProductsResponse {
  products: ProductRow[]
}

export interface ProductOption {
  name: string
  total: number
}

export interface ProductOptionsResponse {
  options: ProductOption[]
}

export interface ProductMonthlyCell {
  key: string
  label: string
  short: string
  Hugo: number
  Benjamin: number
  shared: number
  total: number
  count: number
}

export interface ProductMonthlyResponse {
  name: string
  months: ProductMonthlyCell[]
}

export type Tab = 'month' | 'trends' | 'receipts' | 'products'
export type Scope = 'month' | 'all'
