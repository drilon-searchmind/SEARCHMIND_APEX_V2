import React from "react";
import FormInputText from '@/components/form/FormInputText';
import FormLabel from '@/components/form/FormLabel';
import { FiPlus, FiX } from 'react-icons/fi';

export default function StaticExpensesForm({ form, onChange, saving }) {
    const handleLineItemChange = (fieldName, index, field, value) => {
        const lineItems = [...(form.CustomerStaticExpenses[fieldName] || [])];
        lineItems[index] = {
            ...lineItems[index],
            [field]: field === 'amount' ? parseFloat(value) || 0 : value
        };

        onChange({
            target: {
                name: fieldName,
                value: lineItems,
                dataset: { group: 'CustomerStaticExpenses' }
            }
        });
    };

    const handleAddLineItem = (fieldName) => {
        const lineItems = [...(form.CustomerStaticExpenses[fieldName] || [])];
        lineItems.push({ name: '', amount: 0 });

        onChange({
            target: {
                name: fieldName,
                value: lineItems,
                dataset: { group: 'CustomerStaticExpenses' }
            }
        });
    };

    const handleRemoveLineItem = (fieldName, index) => {
        const lineItems = [...(form.CustomerStaticExpenses[fieldName] || [])];
        lineItems.splice(index, 1);

        onChange({
            target: {
                name: fieldName,
                value: lineItems,
                dataset: { group: 'CustomerStaticExpenses' }
            }
        });
    };

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
                            <div key={index} className="apex-config-line-item">
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
                    <p className="apex-config-card__subtitle">Per month</p>

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
                        <FormLabel htmlFor="shippingCostPerOrder">Shipping Cost Per Order</FormLabel>
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
                        <FormLabel htmlFor="pickNPackCostPerOrder">Pick & Pack Cost Per Order</FormLabel>
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
                    <p className="apex-config-card__subtitle">All fixed monthly costs</p>
                    {renderLineItems('marketingBureauCostLineItems', 'Marketing Bureau Cost', { nested: true })}
                    {renderLineItems('marketingToolingCostLineItems', 'Marketing Tooling Cost', { nested: true })}
                    {renderLineItems('fixedExpensesLineItems', 'Other Fixed Expenses', { nested: true })}
                </div>
            </div>
        </form>
    );
}
