// src/lib/magentoPerformanceDashboardApi.js
//
// Magento ecommerce via merged-sources: Invoice + Credit Memo REST APIs
// (GET /V1/invoices, GET /V1/creditmemos) — not GET /V1/orders.
//
// Requires integration ACL for Magento_Sales::sales_invoice and sales_creditmemo
// (typical when Resource Access is "All").
//
// Semantics: revenue is bucketed by invoice created_at; refunds by credit memo created_at.
// Order count per day = distinct order_id among invoices that day (avoids multi-invoice inflation).

const PAGE_SIZE = 200;
const MAX_PAGES = 250;
const CONCURRENCY = 6;

/**
 * @param {string} baseUrl
 * @param {string} accessToken
 * @param {string} startDate YYYY-MM-DD
 * @param {string} endDate YYYY-MM-DD
 * @param {string} [currencyFilter] e.g. DKK — filters order_currency_code
 * @returns {Promise<Array<{ period, gross_sales, discounts, returns, net_sales, shipping_charges, duties, additional_fees, taxes, total_sales, orders, custom_1 }>>}
 */
export async function fetchMagentoPerformanceDaily(baseUrl, accessToken, startDate, endDate, currencyFilter) {
    const debug = process.env.MAGENTO_API_DEBUG === '1';
    if (debug) {
        console.log('::: MAGENTO PERFORMANCE (invoices + creditmemos) :::');
        console.log('Date range:', { startDate, endDate });
    }

    const now = new Date();
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start > now) {
        return [];
    }
    const effectiveEndDate = end > now ? now.toISOString().split('T')[0] : endDate;

    const [invoices, creditMemos] = await Promise.all([
        fetchAllInvoices(baseUrl, accessToken, startDate, effectiveEndDate, currencyFilter),
        fetchAllCreditMemos(baseUrl, accessToken, startDate, effectiveEndDate, currencyFilter),
    ]);

    const filterCurrency = currencyFilter && String(currencyFilter).trim();
    let inv = invoices;
    let cms = creditMemos;
    if (filterCurrency) {
        const target = filterCurrency.trim().toUpperCase();
        inv = inv.filter((row) =>
            (row.order_currency_code || row.base_currency_code || '').toUpperCase() === target
        );
        cms = cms.filter((row) =>
            (row.order_currency_code || row.base_currency_code || '').toUpperCase() === target
        );
    }

    const daily = aggregateInvoicesByDay(inv, debug);
    applyCreditMemosToDaily(daily, cms);
    return Object.values(daily).sort((a, b) => a.period.localeCompare(b.period));
}

function buildInvoiceParams(startDate, endDate, currentPage, pageSize, currencyFilter) {
    const params = new URLSearchParams();

    params.append('searchCriteria[filter_groups][0][filters][0][field]', 'created_at');
    params.append('searchCriteria[filter_groups][0][filters][0][value]', `${startDate} 00:00:00`);
    params.append('searchCriteria[filter_groups][0][filters][0][condition_type]', 'gteq');

    params.append('searchCriteria[filter_groups][1][filters][0][field]', 'created_at');
    params.append('searchCriteria[filter_groups][1][filters][0][value]', `${endDate} 23:59:59`);
    params.append('searchCriteria[filter_groups][1][filters][0][condition_type]', 'lteq');

    // Exclude canceled invoices (state 3)
    params.append('searchCriteria[filter_groups][2][filters][0][field]', 'state');
    params.append('searchCriteria[filter_groups][2][filters][0][value]', '3');
    params.append('searchCriteria[filter_groups][2][filters][0][condition_type]', 'neq');

    const trimmedCurrency = currencyFilter && String(currencyFilter).trim();
    if (trimmedCurrency) {
        params.append('searchCriteria[filter_groups][3][filters][0][field]', 'order_currency_code');
        params.append('searchCriteria[filter_groups][3][filters][0][value]', trimmedCurrency.toUpperCase());
        params.append('searchCriteria[filter_groups][3][filters][0][condition_type]', 'eq');
    }

    params.append('searchCriteria[pageSize]', String(pageSize));
    params.append('searchCriteria[currentPage]', String(currentPage));
    params.append('searchCriteria[sortOrders][0][field]', 'created_at');
    params.append('searchCriteria[sortOrders][0][direction]', 'ASC');

    return params;
}

function buildCreditMemoParams(startDate, endDate, currentPage, pageSize, currencyFilter) {
    const params = new URLSearchParams();

    params.append('searchCriteria[filter_groups][0][filters][0][field]', 'created_at');
    params.append('searchCriteria[filter_groups][0][filters][0][value]', `${startDate} 00:00:00`);
    params.append('searchCriteria[filter_groups][0][filters][0][condition_type]', 'gteq');

    params.append('searchCriteria[filter_groups][1][filters][0][field]', 'created_at');
    params.append('searchCriteria[filter_groups][1][filters][0][value]', `${endDate} 23:59:59`);
    params.append('searchCriteria[filter_groups][1][filters][0][condition_type]', 'lteq');

    const trimmedCurrency = currencyFilter && String(currencyFilter).trim();
    if (trimmedCurrency) {
        params.append('searchCriteria[filter_groups][2][filters][0][field]', 'order_currency_code');
        params.append('searchCriteria[filter_groups][2][filters][0][value]', trimmedCurrency.toUpperCase());
        params.append('searchCriteria[filter_groups][2][filters][0][condition_type]', 'eq');
    }

    params.append('searchCriteria[pageSize]', String(pageSize));
    params.append('searchCriteria[currentPage]', String(currentPage));
    params.append('searchCriteria[sortOrders][0][field]', 'created_at');
    params.append('searchCriteria[sortOrders][0][direction]', 'ASC');

    return params;
}

async function fetchAllInvoices(baseUrl, accessToken, startDate, endDate, currencyFilter) {
    return fetchAllPages(
        baseUrl,
        accessToken,
        '/V1/invoices',
        (page) => buildInvoiceParams(startDate, endDate, page, PAGE_SIZE, currencyFilter)
    );
}

async function fetchAllCreditMemos(baseUrl, accessToken, startDate, endDate, currencyFilter) {
    return fetchAllPages(
        baseUrl,
        accessToken,
        '/V1/creditmemos',
        (page) => buildCreditMemoParams(startDate, endDate, page, PAGE_SIZE, currencyFilter)
    );
}

async function fetchAllPages(baseUrl, accessToken, path, buildParams) {
    const cleanBase = baseUrl.replace(/\/$/, '');
    const endpoint = `${cleanBase}/rest${path}`;
    const debug = process.env.MAGENTO_API_DEBUG === '1';

    const headers = {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
    };

    const fetchPage = async (page) => {
        const params = buildParams(page);
        const fullUrl = `${endpoint}?${params.toString()}`;
        if (page === 1 && debug) {
            console.log(`🌐 MAGENTO ${path}:`, fullUrl);
        }
        const response = await fetch(fullUrl, { headers });
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ MAGENTO ${path} ${response.status}:`, errorText);
            throw new Error(`Magento API error: ${response.status} ${response.statusText} — ${errorText}`);
        }
        return response.json();
    };

    const first = await fetchPage(1);
    const firstItems = first.items || [];
    const totalCount = first.total_count ?? 0;

    if (totalCount <= 0) {
        if (firstItems.length < PAGE_SIZE) {
            return firstItems;
        }
        const all = [...firstItems];
        let page = 2;
        let lastChunkLen = firstItems.length;
        while (page <= MAX_PAGES) {
            const data = await fetchPage(page);
            const chunk = data.items || [];
            lastChunkLen = chunk.length;
            all.push(...chunk);
            if (chunk.length < PAGE_SIZE) break;
            page++;
        }
        if (lastChunkLen === PAGE_SIZE && page > MAX_PAGES) {
            console.warn(`⚠️ MAGENTO ${path}: page cap ${MAX_PAGES}; list may be incomplete`);
        }
        return all;
    }

    const totalPagesRaw = Math.ceil(totalCount / PAGE_SIZE);
    const totalPages = Math.min(Math.max(totalPagesRaw, 1), MAX_PAGES);
    if (totalPagesRaw > MAX_PAGES) {
        console.warn(`⚠️ MAGENTO ${path}: ${totalPagesRaw} pages exceed cap ${MAX_PAGES}; truncating`);
    }
    if (totalPages <= 1) {
        return firstItems;
    }

    const all = [...firstItems];
    const remaining = [];
    for (let p = 2; p <= totalPages; p++) {
        remaining.push(p);
    }
    for (let i = 0; i < remaining.length; i += CONCURRENCY) {
        const batch = remaining.slice(i, i + CONCURRENCY);
        const results = await Promise.all(batch.map((p) => fetchPage(p)));
        for (const data of results) {
            all.push(...(data.items || []));
        }
    }
    if (all.length > totalCount) {
        return all.slice(0, totalCount);
    }
    return all;
}

function emptyDay(period) {
    return {
        period,
        gross_sales: 0,
        discounts: 0,
        returns: 0,
        net_sales: 0,
        shipping_charges: 0,
        duties: 0,
        additional_fees: 0,
        taxes: 0,
        total_sales: 0,
        orders: 0,
        custom_1: 0,
        _orderIds: new Set(),
    };
}

function aggregateInvoicesByDay(invoices, debug) {
    /** @type {Record<string, ReturnType<typeof emptyDay>>} */
    const dailyData = {};

    for (const inv of invoices) {
        const rawDate = inv.created_at || '';
        const orderDate = rawDate.split('T')[0].split(' ')[0];
        if (!orderDate) continue;

        if (!dailyData[orderDate]) {
            dailyData[orderDate] = emptyDay(orderDate);
        }
        const day = dailyData[orderDate];
        if (inv.order_id != null && inv.order_id !== '') {
            day._orderIds.add(String(inv.order_id));
        }

        const subtotal = parseFloat(inv.subtotal || 0);
        const discountAmount = Math.abs(parseFloat(inv.discount_amount || 0));
        const taxAmount = parseFloat(inv.tax_amount || 0);
        const shippingAmount = parseFloat(inv.shipping_amount || 0);
        const grandTotal = parseFloat(inv.grand_total || 0);
        const totalRefunded = parseFloat(inv.total_refunded ?? inv.base_total_refunded ?? 0) || 0;

        if (debug) {
            const currency = inv.order_currency_code || inv.base_currency_code || 'unknown';
            console.log(
                `📄 MAGENTO INV ${inv.increment_id}: ${orderDate} — ${currency} grand=${grandTotal} sub=${subtotal}`
            );
        }

        const netSales = subtotal - discountAmount - totalRefunded;
        const totalSales = netSales + shippingAmount;
        const custom1 = netSales + totalRefunded + shippingAmount;

        day.gross_sales += grandTotal;
        day.discounts += discountAmount;
        day.returns += totalRefunded;
        day.net_sales += netSales;
        day.shipping_charges += shippingAmount;
        day.taxes += taxAmount;
        day.total_sales += totalSales;
        day.custom_1 += custom1;
    }

    for (const day of Object.values(dailyData)) {
        day.orders = day._orderIds.size;
        delete day._orderIds;
    }

    return dailyData;
}

function applyCreditMemosToDaily(dailyData, creditMemos) {
    for (const cm of creditMemos) {
        const rawDate = cm.created_at || '';
        const d = rawDate.split('T')[0].split(' ')[0];
        if (!d) continue;

        const refund = parseFloat(cm.grand_total || 0);
        if (!refund) continue;

        if (!dailyData[d]) {
            dailyData[d] = emptyDay(d);
        }
        const day = dailyData[d];
        day.returns += refund;
        day.net_sales -= refund;
        day.total_sales -= refund;
        day.custom_1 -= refund;
    }

    for (const day of Object.values(dailyData)) {
        if (day._orderIds) {
            day.orders = day._orderIds.size;
            delete day._orderIds;
        }
    }
}
