import React from "react";
import FormButton from '@/components/form/FormButton';
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
            <div className={nested ? "mb-4 last:mb-0" : "border border-gray-200 rounded-lg p-4"}>
                <div className="flex justify-between items-center mb-1">
                    <div>
                        <FormLabel>{label}</FormLabel>
                        <p className="text-xs text-gray-500 mt-0.5">Per month</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => handleAddLineItem(fieldName)}
                        className="flex items-center gap-1 text-sm text-[var(--color-primary-searchmind)] hover:text-[var(--color-primary-searchmind-lighter)]"
                        disabled={saving}
                    >
                        <FiPlus size={16} />
                        <span>Add Item</span>
                    </button>
                </div>

                {lineItems.length === 0 ? (
                    <p className="text-sm text-gray-400 mb-2">No line items added. Click "Add Item" to add one.</p>
                ) : (
                    <div className="space-y-2 mb-3">
                        {lineItems.map((item, index) => (
                            <div key={index} className="flex gap-2 items-center">
                                <FormInputText
                                    placeholder="Item name (e.g., Employees)"
                                    value={item.name || ''}
                                    onChange={(e) => handleLineItemChange(fieldName, index, 'name', e.target.value)}
                                    className="flex-1"
                                    disabled={saving}
                                />
                                <FormInputText
                                    type="number"
                                    placeholder="Amount"
                                    value={item.amount || 0}
                                    onChange={(e) => handleLineItemChange(fieldName, index, 'amount', e.target.value)}
                                    min="0"
                                    step="0.01"
                                    className="w-32"
                                    disabled={saving}
                                />
                                <button
                                    type="button"
                                    onClick={() => handleRemoveLineItem(fieldName, index)}
                                    className="text-red-500 hover:text-red-700 p-1"
                                    disabled={saving}
                                >
                                    <FiX size={18} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <div className="pt-2 border-t border-gray-200">
                    <div className="flex justify-between items-center">
                        <span className="text-sm font-semibold text-gray-700">Total:</span>
                        <span className="text-sm font-semibold text-[var(--color-primary-searchmind)]">
                            {total.toLocaleString('da-DK', { style: 'currency', currency: 'DKK' })}
                        </span>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <form className="flex flex-col gap-4" onSubmit={e => { e.preventDefault(); }}>
            <h5 className="text-lg font-semibold text-[var(--color-primary-searchmind)] mb-2">Expenses</h5>

            <span className="flex flex-row gap-4">
                <span className="border border-gray-200 rounded-lg p-4 flex-1">
                    <div className="mb-2">
                        <div className="block text-sm font-medium text-gray-700">Variable Costs</div>
                        <p className="text-xs text-gray-500 mt-0.5">Per month</p>
                    </div>

                    <div className="mb-3">
                        <FormLabel htmlFor="cogsPercentage">COGS %</FormLabel>
                        <div className="flex items-center gap-2">
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
                                className="flex-1 max-w-[90%]"
                            />
                            <span className="text-sm text-gray-900 shrink-0 mt-2">%</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">0.1 = 10%</p>
                    </div>

                    <div className="mb-3">
                        <FormLabel htmlFor="shippingCostPerOrder">Shipping Cost Per Order</FormLabel>
                        <div className="flex items-center gap-2">
                            <FormInputText
                                id="shippingCostPerOrder"
                                name="shippingCostPerOrder"
                                type="number"
                                value={form.CustomerStaticExpenses.shippingCostPerOrder}
                                onChange={onChange}
                                data-group="CustomerStaticExpenses"
                                min="0"
                                step="0.01"
                                className="flex-1 max-w-[90%]"
                            />
                            <span className="text-sm text-gray-900 shrink-0 mt-2">DKK</span>
                        </div>
                    </div>

                    <div className="mb-3">
                        <FormLabel htmlFor="pickNPackCostPerOrder">Pick & Pack Cost Per Order</FormLabel>
                        <div className="flex items-center gap-2">
                            <FormInputText
                                id="pickNPackCostPerOrder"
                                name="pickNPackCostPerOrder"
                                type="number"
                                value={form.CustomerStaticExpenses.pickNPackCostPerOrder}
                                onChange={onChange}
                                data-group="CustomerStaticExpenses"
                                min="0"
                                step="0.01"
                                className="flex-1 max-w-[90%]"
                            />
                            <span className="text-sm text-gray-900 shrink-0 mt-2">DKK</span>
                        </div>
                    </div>

                    <div className="mb-2">
                        <FormLabel htmlFor="transactionCostPercentage">Transaction Cost %</FormLabel>
                        <div className="flex items-center gap-2">
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
                                className="flex-1 max-w-[90%]"
                            />
                            <span className="text-sm text-gray-900 shrink-0 mt-2">%</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">0.1 = 10%</p>
                    </div>
                </span>

                <div className="border border-gray-200 rounded-lg p-4 flex-1">
                    <div className="mb-4">
                        <FormLabel>Fixed Expenses</FormLabel>
                        <p className="text-xs text-gray-500 mt-0.5">All fixed monthly costs</p>
                    </div>
                    {renderLineItems('marketingBureauCostLineItems', 'Marketing Bureau Cost', { nested: true })}
                    {renderLineItems('marketingToolingCostLineItems', 'Marketing Tooling Cost', { nested: true })}
                    {renderLineItems('fixedExpensesLineItems', 'Other Fixed Expenses', { nested: true })}
                </div>
            </span>
        </form>
    );
}
