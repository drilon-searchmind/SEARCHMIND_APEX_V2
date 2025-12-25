import React from "react";
import FormButton from '@/components/form/FormButton';
import FormInputText from '@/components/form/FormInputText';
import FormLabel from '@/components/form/FormLabel';

export default function StaticExpensesForm({ form, onChange, saving }) {
    return (
        <form className="flex flex-col gap-4" onSubmit={e => { e.preventDefault(); }}>
            <h5 className="text-lg font-semibold text-[var(--color-primary-searchmind)] mb-2">Static Expenses</h5>
            <div>
                <FormLabel htmlFor="cogsPercentage">COGS %</FormLabel>
                <FormInputText id="cogsPercentage" name="cogsPercentage" type="number" value={form.CustomerStaticExpenses.cogsPercentage} onChange={onChange} data-group="CustomerStaticExpenses" min="0" step="0.01" />
            </div>
            <div>
                <FormLabel htmlFor="shippingCostPerOrder">Shipping Cost Per Order</FormLabel>
                <FormInputText id="shippingCostPerOrder" name="shippingCostPerOrder" type="number" value={form.CustomerStaticExpenses.shippingCostPerOrder} onChange={onChange} data-group="CustomerStaticExpenses" min="0" step="0.01" />
            </div>
            <div>
                <FormLabel htmlFor="transactionCostPercentage">Transaction Cost %</FormLabel>
                <FormInputText id="transactionCostPercentage" name="transactionCostPercentage" type="number" value={form.CustomerStaticExpenses.transactionCostPercentage} onChange={onChange} data-group="CustomerStaticExpenses" min="0" step="0.01" />
            </div>
            <div>
                <FormLabel htmlFor="marketingBureauCost">Marketing Bureau Cost</FormLabel>
                <FormInputText id="marketingBureauCost" name="marketingBureauCost" type="number" value={form.CustomerStaticExpenses.marketingBureauCost} onChange={onChange} data-group="CustomerStaticExpenses" min="0" step="0.01" />
            </div>
            <div>
                <FormLabel htmlFor="marketingToolingCost">Marketing Tooling Cost</FormLabel>
                <FormInputText id="marketingToolingCost" name="marketingToolingCost" type="number" value={form.CustomerStaticExpenses.marketingToolingCost} onChange={onChange} data-group="CustomerStaticExpenses" min="0" step="0.01" />
            </div>
            <div>
                <FormLabel htmlFor="fixedExpenses">Fixed Expenses</FormLabel>
                <FormInputText id="fixedExpenses" name="fixedExpenses" type="number" value={form.CustomerStaticExpenses.fixedExpenses} onChange={onChange} data-group="CustomerStaticExpenses" min="0" step="0.01" />
            </div>
        </form>
    );
}
