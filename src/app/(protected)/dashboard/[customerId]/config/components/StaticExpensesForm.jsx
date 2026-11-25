import React, { useEffect, useState } from "react";
import FormInputText from '@/components/form/FormInputText';
import FormLabel from '@/components/form/FormLabel';
import { FiPlus, FiX } from 'react-icons/fi';

/**
 * @param {{
 *   form: object,
 *   onChange: Function,
 *   saving?: boolean,
 *   shopifyMarketsEnabled?: boolean,
 *   customerId?: string,
 * }} props
 */
export default function StaticExpensesForm({
    form,
    onChange,
    saving,
    shopifyMarketsEnabled = false,
    customerId,
}) {
    const [markets, setMarkets] = useState([]);
    const [marketsLoading, setMarketsLoading] = useState(false);

    useEffect(() => {
        if (!shopifyMarketsEnabled || !customerId) {
            setMarkets([]);
            return undefined;
        }
        let cancelled = false;
        setMarketsLoading(true);
        fetch(`/api/shopify-markets/${customerId}`, { credentials: "same-origin" })
            .then(async (r) => {
                const body = await r.json().catch(() => ({}));
                if (!r.ok) throw new Error(body.error || "Failed to load markets");
                return body;
            })
            .then((body) => {
                if (cancelled) return;
                setMarkets(Array.isArray(body.markets) ? body.markets : []);
            })
            .catch(() => {
                if (!cancelled) setMarkets([]);
            })
            .finally(() => {
                if (!cancelled) setMarketsLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [shopifyMarketsEnabled, customerId]);

    const setExpensesField = (name, value) => {
        onChange({
            target: {
                name,
                value,
                dataset: { group: 'CustomerStaticExpenses' },
            },
        });
    };

    const handleLineItemChange = (fieldName, index, field, value) => {
        const lineItems = [...(form.CustomerStaticExpenses[fieldName] || [])];
        lineItems[index] = {
            ...lineItems[index],
            [field]: field === 'amount' ? parseFloat(value) || 0 : value,
        };
        setExpensesField(fieldName, lineItems);
    };

    const handleAddLineItem = (fieldName) => {
        const lineItems = [...(form.CustomerStaticExpenses[fieldName] || [])];
        lineItems.push({ name: '', amount: 0, marketId: '' });
        setExpensesField(fieldName, lineItems);
    };

    const handleRemoveLineItem = (fieldName, index) => {
        const lineItems = [...(form.CustomerStaticExpenses[fieldName] || [])];
        lineItems.splice(index, 1);
        setExpensesField(fieldName, lineItems);
    };

    const marketVariableCosts = form.CustomerStaticExpenses.marketVariableCosts || [];

    const upsertMarketVariable = (marketId, marketName, patch) => {
        const next = [...marketVariableCosts];
        const idx = next.findIndex((r) => String(r.marketId) === String(marketId));
        if (idx >= 0) {
            next[idx] = { ...next[idx], ...patch, marketId, marketName };
        } else {
            next.push({
                marketId,
                marketName,
                shippingCostPerOrder: null,
                pickNPackCostPerOrder: null,
                ...patch,
            });
        }
        // Drop rows that both inherit (null) — keep only real overrides
        const cleaned = next.filter(
            (r) =>
                r.shippingCostPerOrder != null ||
                r.pickNPackCostPerOrder != null
        );
        setExpensesField('marketVariableCosts', cleaned);
    };

    const clearMarketVariableField = (marketId, field) => {
        const next = marketVariableCosts
            .map((r) =>
                String(r.marketId) === String(marketId) ? { ...r, [field]: null } : r
            )
            .filter(
                (r) =>
                    r.shippingCostPerOrder != null ||
                    r.pickNPackCostPerOrder != null
            );
        setExpensesField('marketVariableCosts', next);
    };

    const getMarketOverride = (marketId) =>
        marketVariableCosts.find((r) => String(r.marketId) === String(marketId));

    const renderLineItems = (fieldName, label, { nested = false } = {}) => {
        const lineItems = form.CustomerStaticExpenses[fieldName] || [];
        const total = lineItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

        return (
            <div className={nested ? "mb-4 last:mb-0" : "apex-config-card"}>
                <div className="flex justify-between items-center mb-1">
                    <div>
                        <FormLabel>{label}</FormLabel>
                        <p className="apex-config-field-hint">Per month</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => handleAddLineItem(fieldName)}
                        className="apex-config-link-btn"
                        disabled={saving}
                    >
                        <FiPlus size={16} />
                        <span>Add Item</span>
                    </button>
                </div>

                {lineItems.length === 0 ? (
                    <p className="apex-config-empty mb-2">No line items added. Click &quot;Add Item&quot; to add one.</p>
                ) : (
                    <div className="apex-config-line-items">
                        {lineItems.map((item, index) => (
                            <div key={index} className="apex-config-line-item apex-config-line-item--market">
                                <FormInputText
                                    placeholder="Item name (e.g., Employees)"
                                    value={item.name || ''}
                                    onChange={(e) => handleLineItemChange(fieldName, index, 'name', e.target.value)}
                                    disabled={saving}
                                />
                                <FormInputText
                                    type="number"
                                    placeholder="Amount"
                                    value={item.amount || 0}
                                    onChange={(e) => handleLineItemChange(fieldName, index, 'amount', e.target.value)}
                                    min="0"
                                    step="0.01"
                                    className="apex-config-line-item__amount"
                                    disabled={saving}
                                />
                                {shopifyMarketsEnabled ? (
                                    <select
                                        className="apex-config-select"
                                        aria-label="Market for cost"
                                        value={item.marketId || ''}
                                        onChange={(e) =>
                                            handleLineItemChange(fieldName, index, 'marketId', e.target.value)
                                        }
                                        disabled={saving || marketsLoading}
                                    >
                                        <option value="">All markets (global)</option>
                                        {markets.map((m) => (
                                            <option key={m.shopifyqlMarketId} value={m.shopifyqlMarketId}>
                                                {m.name || m.handle || m.shopifyqlMarketId}
                                            </option>
                                        ))}
                                    </select>
                                ) : null}
                                <button
                                    type="button"
                                    onClick={() => handleRemoveLineItem(fieldName, index)}
                                    className="apex-config-icon-btn"
                                    disabled={saving}
                                    aria-label="Remove line item"
                                >
                                    <FiX size={18} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <div className="apex-config-total-row">
                    <span className="apex-config-total-row__label">Total:</span>
                    <span className="apex-config-total-row__value">
                        {total.toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}
                    </span>
                </div>
            </div>
        );
    };

    return (
        <form className="apex-config-form" onSubmit={e => { e.preventDefault(); }}>
            <h2 className="apex-config-form__title">Expenses</h2>

            <div className="apex-config-split">
                <div className="apex-config-card">
                    <div className="apex-config-card__title">Variable Costs</div>
                    <p className="apex-config-card__subtitle">Per month · default rates apply to all markets</p>

                    <div className="mb-3">
                        <FormLabel htmlFor="cogsPercentage">COGS %</FormLabel>
                        <div className="apex-config-field-row">
                            <FormInputText
                                id="cogsPercentage"
                                name="cogsPercentage"
                                type="number"
                                value={form.CustomerStaticExpenses.cogsPercentage}
                                onChange={onChange}
                                data-group="CustomerStaticExpenses"
                                min="0"
                                max="1"
                                step="0.1"
                            />
                            <span className="apex-config-field-unit">%</span>
                        </div>
                        <p className="apex-config-field-hint">0.1 = 10%</p>
                    </div>

                    <div className="mb-3">
                        <FormLabel htmlFor="shippingCostPerOrder">Shipping Cost Per Order (global)</FormLabel>
                        <div className="apex-config-field-row">
                            <FormInputText
                                id="shippingCostPerOrder"
                                name="shippingCostPerOrder"
                                type="number"
                                value={form.CustomerStaticExpenses.shippingCostPerOrder}
                                onChange={onChange}
                                data-group="CustomerStaticExpenses"
                                min="0"
                                step="0.01"
                            />
                            <span className="apex-config-field-unit">DKK</span>
                        </div>
                    </div>

                    <div className="mb-3">
                        <FormLabel htmlFor="pickNPackCostPerOrder">Pick & Pack Cost Per Order (global)</FormLabel>
                        <div className="apex-config-field-row">
                            <FormInputText
                                id="pickNPackCostPerOrder"
                                name="pickNPackCostPerOrder"
                                type="number"
                                value={form.CustomerStaticExpenses.pickNPackCostPerOrder}
                                onChange={onChange}
                                data-group="CustomerStaticExpenses"
                                min="0"
                                step="0.01"
                            />
                            <span className="apex-config-field-unit">DKK</span>
                        </div>
                    </div>

                    {shopifyMarketsEnabled ? (
                        <div className="mb-3 apex-config-market-rates">
                            <FormLabel>Shipping / pick &amp; pack per market</FormLabel>
                            <p className="apex-config-field-hint mb-2">
                                Leave blank to use the global rate. Only markets for this store are listed.
                            </p>
                            {marketsLoading ? (
                                <p className="apex-config-empty">Loading markets…</p>
                            ) : markets.length === 0 ? (
                                <p className="apex-config-empty">No Shopify Markets found.</p>
                            ) : (
                                <div className="apex-config-market-rates__list">
                                    {markets.map((m) => {
                                        const mid = m.shopifyqlMarketId;
                                        const ov = getMarketOverride(mid);
                                        return (
                                            <div key={mid} className="apex-config-market-rates__row">
                                                <div className="apex-config-market-rates__name">
                                                    {m.name || m.handle || mid}
                                                </div>
                                                <div className="apex-config-field-row">
                                                    <FormInputText
                                                        type="number"
                                                        placeholder={`Ship (${form.CustomerStaticExpenses.shippingCostPerOrder || 0})`}
                                                        value={ov?.shippingCostPerOrder ?? ''}
                                                        onChange={(e) => {
                                                            const v = e.target.value;
                                                            if (v === '') {
                                                                clearMarketVariableField(mid, 'shippingCostPerOrder');
                                                            } else {
                                                                upsertMarketVariable(mid, m.name || m.handle || mid, {
                                                                    shippingCostPerOrder: parseFloat(v) || 0,
                                                                });
                                                            }
                                                        }}
                                                        min="0"
                                                        step="0.01"
                                                        disabled={saving}
                                                    />
                                                    <span className="apex-config-field-unit">DKK ship</span>
                                                </div>
                                                <div className="apex-config-field-row">
                                                    <FormInputText
                                                        type="number"
                                                        placeholder={`P&P (${form.CustomerStaticExpenses.pickNPackCostPerOrder || 0})`}
                                                        value={ov?.pickNPackCostPerOrder ?? ''}
                                                        onChange={(e) => {
                                                            const v = e.target.value;
                                                            if (v === '') {
                                                                clearMarketVariableField(mid, 'pickNPackCostPerOrder');
                                                            } else {
                                                                upsertMarketVariable(mid, m.name || m.handle || mid, {
                                                                    pickNPackCostPerOrder: parseFloat(v) || 0,
                                                                });
                                                            }
                                                        }}
                                                        min="0"
                                                        step="0.01"
                                                        disabled={saving}
                                                    />
                                                    <span className="apex-config-field-unit">DKK P&amp;P</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    ) : null}

                    <div>
                        <FormLabel htmlFor="transactionCostPercentage">Transaction Cost %</FormLabel>
                        <div className="apex-config-field-row">
                            <FormInputText
                                id="transactionCostPercentage"
                                name="transactionCostPercentage"
                                type="number"
                                value={form.CustomerStaticExpenses.transactionCostPercentage}
                                onChange={onChange}
                                data-group="CustomerStaticExpenses"
                                min="0"
                                max="1"
                                step="0.1"
                            />
                            <span className="apex-config-field-unit">%</span>
                        </div>
                        <p className="apex-config-field-hint">0.1 = 10%</p>
                    </div>

                    <div>
                        <FormLabel htmlFor="returnsCostPercentage">Returns handling cost %</FormLabel>
                        <div className="apex-config-field-row">
                            <FormInputText
                                id="returnsCostPercentage"
                                name="returnsCostPercentage"
                                type="number"
                                value={form.CustomerStaticExpenses.returnsCostPercentage}
                                onChange={onChange}
                                data-group="CustomerStaticExpenses"
                                min="0"
                                max="1"
                                step="0.01"
                            />
                            <span className="apex-config-field-unit">%</span>
                        </div>
                        <p className="apex-config-field-hint">
                            0.1 = 10% of return value (handling cost on returns in the period)
                        </p>
                    </div>
                </div>

                <div className="apex-config-card">
                    <div className="apex-config-card__title">Fixed Expenses</div>
                    <p className="apex-config-card__subtitle">
                        All fixed monthly costs
                        {shopifyMarketsEnabled
                            ? " · optionally bind a line to one market"
                            : ""}
                    </p>
                    {renderLineItems('marketingBureauCostLineItems', 'Marketing Bureau Cost', { nested: true })}
                    {renderLineItems('marketingToolingCostLineItems', 'Marketing Tooling Cost', { nested: true })}
                    {renderLineItems('fixedExpensesLineItems', 'Other Fixed Expenses', { nested: true })}
                </div>
            </div>
        </form>
    );
}
