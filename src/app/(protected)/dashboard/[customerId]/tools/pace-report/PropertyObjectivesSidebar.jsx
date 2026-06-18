'use client';

import { FiX } from 'react-icons/fi';
import PropertyObjectives from '@/app/(protected)/dashboard/[customerId]/config/components/PropertyObjectives';

export default function PropertyObjectivesSidebar({
	open,
	onClose,
	shopifyMarketsFeatureOn,
	customerType,
	customerId,
	localPropertyObjectivesMode,
	onPropertyObjectivesModeChange,
	localObjectives,
	localMarketObjectives,
	onObjectivesChange,
	onMarketObjectivesChange,
	onSave,
	savingObjectives,
}) {
	if (!open) return null;

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-end glassmorphism2"
			onClick={onClose}
		>
			<div
				className="bg-white h-full w-full max-w-2xl shadow-2xl flex flex-col relative"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="bg-[var(--color-primary-searchmind)] text-white px-8 py-6 flex items-center justify-between border-b border-gray-200">
					<div className="flex-1">
						<h2 className="text-2xl font-bold mb-1">Property Objectives</h2>
						<p className="text-sm text-white/80">
							{shopifyMarketsFeatureOn
								? 'Set global or per-market revenue targets and marketing budgets'
								: 'Adjust marketing budgets for each month'}
						</p>
					</div>
					<button
						className="text-white/80 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/10"
						onClick={onClose}
						aria-label="Close"
					>
						<FiX size={24} />
					</button>
				</div>

				<div className="overflow-y-auto flex-1 p-8">
					<PropertyObjectives
						showTitle={false}
						customerId={customerId}
						customerType={customerType}
						shopifyMarketsEnabled={shopifyMarketsFeatureOn}
						propertyObjectivesMode={localPropertyObjectivesMode}
						onPropertyObjectivesModeChange={onPropertyObjectivesModeChange}
						objectives={localObjectives}
						marketObjectives={localMarketObjectives}
						onObjectivesChange={onObjectivesChange}
						onMarketObjectivesChange={onMarketObjectivesChange}
					/>
				</div>

				<div className="border-t border-gray-200 px-8 py-6 bg-gray-50 flex justify-end gap-3">
					<button
						className="px-6 py-2 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
						onClick={onClose}
						disabled={savingObjectives}
					>
						Cancel
					</button>
					<button
						className="px-6 py-2 bg-[var(--color-primary-searchmind)] text-white rounded-lg font-semibold shadow-sm hover:bg-[var(--color-primary-searchmind-lighter)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
						onClick={onSave}
						disabled={savingObjectives}
					>
						{savingObjectives ? 'Saving...' : 'Save Objectives'}
					</button>
				</div>
			</div>
		</div>
	);
}
