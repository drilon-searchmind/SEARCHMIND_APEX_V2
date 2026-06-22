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
		<div className="apex-pace-sidebar-scrim" onClick={onClose}>
			<aside
				className="apex-pace-sidebar"
				onClick={(e) => e.stopPropagation()}
				role="dialog"
				aria-modal="true"
				aria-labelledby="pace-objectives-title"
			>
				<div className="apex-pace-sidebar__head">
					<div>
						<h2 id="pace-objectives-title" className="apex-pace-sidebar__title">
							Property Objectives
						</h2>
						<p className="apex-pace-sidebar__lede">
							{shopifyMarketsFeatureOn
								? 'Set global or per-market revenue targets and marketing budgets'
								: 'Adjust marketing budgets for each month'}
						</p>
					</div>
					<button
						type="button"
						className="apex-pace-sidebar__close"
						onClick={onClose}
						aria-label="Close"
					>
						<FiX size={20} />
					</button>
				</div>

				<div className="apex-pace-sidebar__body">
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

				<div className="apex-pace-sidebar__foot">
					<button
						type="button"
						className="apex-perf-btn"
						onClick={onClose}
						disabled={savingObjectives}
					>
						Cancel
					</button>
					<button
						type="button"
						className="apex-perf-btn apex-perf-btn--primary"
						onClick={onSave}
						disabled={savingObjectives}
					>
						{savingObjectives ? 'Saving...' : 'Save Objectives'}
					</button>
				</div>
			</aside>
		</div>
	);
}
