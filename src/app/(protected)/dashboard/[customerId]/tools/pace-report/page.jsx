'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useCustomers } from '@/hooks/useCustomers';
import DashboardHeading from '@/components/dashboard/DashboardHeading';
import DateRangePicker from '@/components/dashboard/DateRangePicker';
import ToastProvider, { showToast } from '@/components/ui/ToastProvider';
import { usePaceReportData } from './usePaceReportData';
import PropertyObjectivesSidebar from './PropertyObjectivesSidebar';
import CostPaceSection from './CostPaceSection';
import RevenuePaceSection from './RevenuePaceSection';
import { pushDashboardDateRangeApplied, pushGTMEvent, GTM_EVENTS } from '@root/lib/gtmFunctions';
import { useShopifyMarketsFilter } from '@/hooks/useShopifyMarketsFilter';
import { useAdSpendPlatformsFilter } from '@/hooks/useAdSpendPlatformsFilter';

export default function PaceReportPage() {
	const params = useParams();
	const { customers, fetchCustomers } = useCustomers();
	const customer = customers.find((c) => c._id === params.customerId);

	const [updatedObjectives, setUpdatedObjectives] = useState(null);
	const objectives = updatedObjectives || customer?.CustomerPropertyObjectives || {};

	const today = new Date();
	const yyyy = today.getFullYear();
	const mm = String(today.getMonth() + 1).padStart(2, '0');
	const isFirstOfMonth = today.getDate() === 1;
	const defaultStart = `${yyyy}-${mm}-01`;
	const defaultEnd = isFirstOfMonth
		? `${yyyy}-${mm}-01`
		: `${yyyy}-${mm}-${String(today.getDate() - 1).padStart(2, '0')}`;

	const [tempDateRange, setTempDateRange] = useState({
		startDate: defaultStart,
		endDate: defaultEnd,
	});
	const [appliedDateRange, setAppliedDateRange] = useState({
		startDate: defaultStart,
		endDate: defaultEnd,
	});

	const handleDateRangeApply = ({ startDate, endDate }) => {
		pushDashboardDateRangeApplied({
			page: 'tools_pace_report',
			customerId: params.customerId,
			startDate,
			endDate,
		});
		setAppliedDateRange({ startDate, endDate });
	};
	const handleStartDateChange = (newStart) => {
		setTempDateRange((dr) => ({ ...dr, startDate: newStart }));
	};
	const handleEndDateChange = (newEnd) => {
		setTempDateRange((dr) => ({ ...dr, endDate: newEnd }));
	};

	const {
		shopifyMarketsFeatureOn,
		shopifyMarkets,
		shopifyMarketsLoading,
		excludedShopifyMarkets,
		appliedExcludedShopifyMarkets,
		toggleShopifyMarket,
		applyShopifyMarketFilters,
		syncDraftFromAppliedMarkets,
		marketQuerySuffix,
	} = useShopifyMarketsFilter(customer, params.customerId);

	const {
		configuredAdSpendChannels,
		draftExcludedPlatforms,
		appliedExcludedPlatforms,
		toggleAdSpendPlatformDraft,
		applyAdSpendPlatformFilters,
		syncDraftFromAppliedSpend,
		spendQuerySuffix,
	} = useAdSpendPlatformsFilter(customer, shopifyMarketsFeatureOn);

	const mergedSourcesQuerySuffix = `${marketQuerySuffix}${spendQuerySuffix}`;

	const {
		loading,
		error,
		costData,
		costByChannelSeries,
		budget,
		paceAnalysis,
		conversionValueData,
		conversionBudget,
		conversionPaceAnalysis,
	} = usePaceReportData(customer, objectives, appliedDateRange, mergedSourcesQuerySuffix);

	const [sidebarOpen, setSidebarOpen] = useState(false);
	const [localObjectives, setLocalObjectives] = useState({});
	const [savingObjectives, setSavingObjectives] = useState(false);
	const [showCalcs, setShowCalcs] = useState(false);

	useEffect(() => {
		if (sidebarOpen && customer) {
			setLocalObjectives(customer.CustomerPropertyObjectives || {});
		}
	}, [sidebarOpen, customer]);

	const handleObjectivesChange = (updated) => {
		setLocalObjectives(updated);
	};

	const handleSaveObjectives = async () => {
		if (!customer) return;
		setSavingObjectives(true);
		try {
			const res = await fetch(`/api/customers/${customer._id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					CustomerPropertyObjectives: localObjectives,
				}),
			});
			if (!res.ok) throw new Error('Failed to update objectives');

			setUpdatedObjectives(localObjectives);
			await fetchCustomers();

			showToast({
				message: 'Property objectives updated successfully!',
				type: 'success',
				position: 'top-center',
			});
			pushGTMEvent(GTM_EVENTS.DASHBOARD_PACE_REPORT_OBJECTIVES_SAVED, {
				eventData: { customerId: String(customer._id) },
			});
			setSidebarOpen(false);
		} catch (err) {
			showToast({
				message: err.message || 'Failed to update objectives',
				type: 'error',
				position: 'top-center',
			});
		} finally {
			setSavingObjectives(false);
		}
	};

	return (
		<div className="w-full">
			<ToastProvider />
			<PropertyObjectivesSidebar
				open={sidebarOpen}
				onClose={() => setSidebarOpen(false)}
				localObjectives={localObjectives}
				onObjectivesChange={handleObjectivesChange}
				onSave={handleSaveObjectives}
				savingObjectives={savingObjectives}
			/>
			<DashboardHeading
				title="Marketing Pace Report"
				label={customer ? customer.customerName : ''}
				customerId={params.customerId}
				dateRange={appliedDateRange}
				loading={loading}
				dashboardType="pace-report"
				dataSnapshot={{
					paceAnalysis,
					costData,
					budget,
					conversionBudget,
					conversionPaceAnalysis,
				}}
				shopifyMarketFilter={
					shopifyMarketsFeatureOn
						? {
								loading: shopifyMarketsLoading,
								options: shopifyMarkets,
								excludedMarkets: excludedShopifyMarkets,
								appliedExcludedMarkets: appliedExcludedShopifyMarkets,
								onToggleMarket: toggleShopifyMarket,
								onMenuWillOpen: syncDraftFromAppliedMarkets,
								onApplyMarkets: applyShopifyMarketFilters,
							}
						: null
				}
				adSpendPlatformFilter={
					shopifyMarketsFeatureOn && configuredAdSpendChannels.length > 0
						? {
								options: configuredAdSpendChannels.map((c) => ({
									id: c.id,
									label: c.label,
								})),
								excludedPlatforms: draftExcludedPlatforms,
								appliedExcludedPlatforms,
								onTogglePlatform: toggleAdSpendPlatformDraft,
								onMenuWillOpen: syncDraftFromAppliedSpend,
								onApplySpend: applyAdSpendPlatformFilters,
							}
						: null
				}
				right={
					<DateRangePicker
						onApply={handleDateRangeApply}
						startDate={tempDateRange.startDate}
						endDate={tempDateRange.endDate}
						onStartDateChange={handleStartDateChange}
						onEndDateChange={handleEndDateChange}
						monthOnly
					/>
				}
			/>
			<CostPaceSection
				costData={costData}
				costByChannelSeries={costByChannelSeries}
				paceAnalysis={paceAnalysis}
				appliedDateRange={appliedDateRange}
				loading={loading}
				error={error}
				onOpenSettings={() => setSidebarOpen(true)}
				showCalcs={showCalcs}
				onShowCalcsChange={setShowCalcs}
			/>
			<RevenuePaceSection
				costData={costData}
				conversionValueData={conversionValueData}
				conversionPaceAnalysis={conversionPaceAnalysis}
				appliedDateRange={appliedDateRange}
				loading={loading}
				error={error}
				onOpenSettings={() => setSidebarOpen(true)}
				showCalcs={showCalcs}
				revenueType={customer?.CustomerSettings?.customerRevenueType || 'total_sales'}
			/>
		</div>
	);
}
