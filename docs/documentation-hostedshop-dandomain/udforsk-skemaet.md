apiLogsV2(input: ApiLogsV2Input): ApiLogsV2Payload!
Fetch API logs.

currencies(input: CurrenciesInput): CurrenciesPayload!
Fetch currencies.

currencyById(input: CurrencyByIdInput!): CurrencyByIdPayload!
Fetch a single currency by ID.

currencyCodes: CurrencyCodesPayload!
Fetch all ISO-4217 currency codes.

discounts(input: DiscountsInput): DiscountsPayload!
Fetch discounts.

discountById(input: DiscountByIdInput!): DiscountByIdPayload!
Fetch a single discount by ID.

generateDiscountCode: GenerateDiscountCodePayload!
Generate a discount code.

domains(
pagination: PaginationOptions = {limit: 100, page: 1}
search: [DomainSearchInput] = []
sorting: DomainSortingInput = {field: id, direction: ASC}
): DomainPagination!
Fetch domains.

giftCards(input: GiftCardsInput): GiftCardsPayload!
Fetch gift cards.

giftCardById(input: GiftCardByIdInput!): GiftCardByIdPayload!
Fetch a single gift card by ID.

orders(
pagination: PaginationOptions = {limit: 100, page: 1}
search: [OrderSearchInput] = []
sorting: OrderSortingInput = {field: id, direction: ASC}
): OrderPagination!
Fetch orders.

orderById(id: ID!): Order
Fetch a single order by ID.

ordersByCustomerEmail(input: OrdersByCustomerEmailInput): OrdersByCustomerEmailPayload!
Fetch orders by customer email.

orderStatuses: [OrderStatus!]!
Fetch order statuses

invoices(
pagination: PaginationOptions = {limit: 100, page: 1}
search: [OrderInvoiceSearchInput] = []
sorting: OrderInvoiceSortingInput = {field: id, direction: ASC}
): OrderInvoicePagination!
Fetch invoices.

paymentMethods: PaymentMethodsPayload!
Fetch payment methods.

productCategories(input: ProductCategoriesInput): ProductCategoriesPayload!
Fetch product categories.

productCategoryTree(input: ProductCategoryTreeInput!): ProductCategoryTreePayload!
Fetch a minimalist representation of all product categories.

redirects(input: RedirectsInput): RedirectsPayload!
Fetch redirects.

redirectById(input: RedirectByIdInput!): RedirectByIdPayload!
Fetch a single redirect by ID.

unitById(input: UnitByIdInput!): UnitByIdPayload!
Fetch a single unitById by ID.

units(input: UnitsInput): UnitsPayload!
Fetch units.