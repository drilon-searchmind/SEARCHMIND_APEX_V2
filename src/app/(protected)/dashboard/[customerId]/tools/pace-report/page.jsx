'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useCustomers } from '@/hooks/useCustomers';
import DashboardHeading from '@/components/dashboard/DashboardHeading';
import DateRangePicker from '@/components/dashboard/DateRangePicker';
import ToastProvider, { showToast } from '@/components/ui/ToastProvider';
import { usePaceReportData } from './usePaceReportData';
import PropertyObjectivesSidebar from './PropertyObjectivesSidebar';
import CostPaceSection from './CostPaceSection';
import RevenuePaceSection from './RevenuePaceSection';
import './pace-report.css';
import { pushDashboardDateRangeApplied, pushGTMEvent, GTM_EVENTS } from '@root/lib/gtmFunctions';
import { useShopifyMarketsFilter } from '@/hooks/useShopifyMarketsFilter';
import { useAdSpendPlatformsFilter } from '@/hooks/useAdSpendPlatformsFilter';
import { adSpendChannelsForShopifyMarketsFilterUi } from '@/lib/mergeAdSpendDaily';
import { useDashboardDataOptional } from '@/contexts/DashboardDataContext';
import {
	getObjectivesScopeLabel,
	normalizeMarketPropertyObjectives,
	resolvePropertyObjectives,
	resolvePropertyObjectivesMode,
	PROPERTY_OBJECTIVES_MODE_PER_MARKET,
} from '@/lib/propertyObjectivesUtils';

export default function PaceReportPage() {
	const params = useParams();
	const { customers, fetchCustomers } = useCustomers();
	const customer = customers.find((c) => c._id === params.customerId);
	const shared = useDashboardDataOptional();

	const [updatedObjectives, setUpdatedObjectives] = useState(null);
	const [updatedMarketObjectives, setUpdatedMarketObjectives] = useState(null);
	const [updatedPropertyObjectivesMode, setUpdatedPropertyObjectivesMode] = useState(null);

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

	const handleDateRangeApply = (payload) => {
		pushDashboardDateRangeApplied({
			page: 'tools_pace_report',
			customerId: params.customerId,
			startDate: payload.startDate,
			endDate: payload.endDate,
		});
		if (shared?.handleDateRangeApply) {
			shared.handleDateRangeApply(payload);
		} else {
			setAppliedDateRange({ startDate: payload.startDate, endDate: payload.endDate });
		}
	};
	const handleStartDateChange = (newStart) => {
		if (shared?.handleStartDateChange) {
			shared.handleStartDateChange(newStart);
		} else {
			setTempDateRange((dr) => ({ ...dr, startDate: newStart }));
		}
	};
	const handleEndDateChange = (newEnd) => {
		if (shared?.handleEndDateChange) {
			shared.handleEndDateChange(newEnd);
		} else {
			setTempDateRange((dr) => ({ ...dr, endDate: newEnd }));
		}
	};

	useEffect(() => {
		if (!shared) return;
		setAppliedDateRange(shared.appliedDateRange);
		setTempDateRange(shared.tempDateRange);
	}, [shared, shared?.appliedDateRange, shared?.tempDateRange]);

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
		draftFilterAdSpendByMarket,
		appliedFilterAdSpendByMarket,
		setDraftFilterAdSpendByMarket,
	} = useShopifyMarketsFilter(customer, params.customerId);

	const {
		adSpendFilterUiChannels,
		draftExcludedPlatforms,
		appliedExcludedPlatforms,
		toggleAdSpendPlatformDraft,
		applyAdSpendPlatformFilters,
		syncDraftFromAppliedSpend,
		spendQuerySuffix,
	} = useAdSpendPlatformsFilter(customer, shopifyMarketsFeatureOn);

	const mergedSourcesQuerySuffix = shared?.mergedSourcesQuerySuffix ?? `${marketQuerySuffix}${spendQuerySuffix}`;

	const customerForObjectives = useMemo(() => {
		if (!customer) return null;
		const propertyObjectivesMode =
			updatedPropertyObjectivesMode ?? resolvePropertyObjectivesMode(customer);
		return {
			...customer,
			CustomerSettings: {
				...(customer.CustomerSettings || {}),
				propertyObjectivesMode,
			},
			CustomerPropertyObjectives:
				updatedObjectives ?? customer.CustomerPropertyObjectives ?? {},
			CustomerMarketPropertyObjectives:
				updatedMarketObjectives ??
				normalizeMarketPropertyObjectives(customer.CustomerMarketPropertyObjectives),
		};
	}, [customer, updatedObjectives, updatedMarketObjectives, updatedPropertyObjectivesMode]);

	const objectives = useMemo(
		() =>
			resolvePropertyObjectives({
				customer: customerForObjectives,
				shopifyMarketsFeatureOn,
				shopifyMarkets,
				appliedExcludedMarkets: appliedExcludedShopifyMarkets,
			}),
		[
			customerForObjectives,
			shopifyMarketsFeatureOn,
			shopifyMarkets,
			appliedExcludedShopifyMarkets,
		]
	);

	const objectivesScopeLabel = useMemo(
		() =>
			getObjectivesScopeLabel({
				customer: customerForObjectives,
				shopifyMarketsFeatureOn,
				shopifyMarkets,
				appliedExcludedMarkets: appliedExcludedShopifyMarkets,
			}),
		[
			customerForObjectives,
			shopifyMarketsFeatureOn,
			shopifyMarkets,
			appliedExcludedShopifyMarkets,
		]
	);

	const paceChannelSpecs = useMemo(() => {
		if (
			!shopifyMarketsFeatureOn ||
			customer?.CustomerSettings?.shopifyMarketsEnabled !== true
		) {
			return null;
		}
		return adSpendChannelsForShopifyMarketsFilterUi(customer.CustomerSettings).filter(
			(c) => appliedExcludedPlatforms[c.id] !== true
		);
	}, [shopifyMarketsFeatureOn, customer?.CustomerSettings, appliedExcludedPlatforms]);

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
		revenueLabel,
	} = usePaceReportData(customer, objectives, appliedDateRange, mergedSourcesQuerySuffix, paceChannelSpecs);

	const [sidebarOpen, setSidebarOpen] = useState(false);
	const [localObjectives, setLocalObjectives] = useState({});
	const [localMarketObjectives, setLocalMarketObjectives] = useState({});
	const [localPropertyObjectivesMode, setLocalPropertyObjectivesMode] = useState('global');
	const [savingObjectives, setSavingObjectives] = useState(false);
	const [showCalcs, setShowCalcs] = useState(false);

	useEffect(() => {
		if (sidebarOpen && customer) {
			setLocalObjectives(customer.CustomerPropertyObjectives || {});
			setLocalMarketObjectives(
				normalizeMarketPropertyObjectives(
					updatedMarketObjectives ?? customer.CustomerMarketPropertyObjectives
				)
			);
			setLocalPropertyObjectivesMode(
				updatedPropertyObjectivesMode ?? resolvePropertyObjectivesMode(customer)
			);
		}
	}, [sidebarOpen, customer, updatedMarketObjectives, updatedPropertyObjectivesMode]);

	const handleObjectivesChange = (updated) => {
		setLocalObjectives(updated);
	};

	const handleMarketObjectivesChange = (updated) => {
		setLocalMarketObjectives(updated);
	};

	const handlePropertyObjectivesModeChange = (mode) => {
		setLocalPropertyObjectivesMode(mode);
	};

	const handleSaveObjectives = async () => {
		if (!customer) return;
		setSavingObjectives(true);
		try {
			const payload = {
				CustomerSettings: {
					...(customer.CustomerSettings || {}),
					propertyObjectivesMode: localPropertyObjectivesMode,
				},
			};

			if (
				shopifyMarketsFeatureOn &&
				localPropertyObjectivesMode === PROPERTY_OBJECTIVES_MODE_PER_MARKET
			) {
				payload.CustomerMarketPropertyObjectives = localMarketObjectives;
			} else {
				payload.CustomerPropertyObjectives = localObjectives;
			}

			const res = await fetch(`/api/customers/${customer._id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});
			if (!res.ok) throw new Error('Failed to update objectives');

			setUpdatedPropertyObjectivesMode(localPropertyObjectivesMode);
			if (
				shopifyMarketsFeatureOn &&
				localPropertyObjectivesMode === PROPERTY_OBJECTIVES_MODE_PER_MARKET
			) {
				setUpdatedMarketObjectives(localMarketObjectives);
			} else {
				setUpdatedObjectives(localObjectives);
			}
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
		<div id="PaceReportPage" className="apex-perf w-full">
			<ToastProvider />
			<PropertyObjectivesSidebar
				open={sidebarOpen}
				onClose={() => setSidebarOpen(false)}
				shopifyMarketsFeatureOn={shopifyMarketsFeatureOn}
				customerType={customer?.customerType}
				customerId={params.customerId}
				localPropertyObjectivesMode={localPropertyObjectivesMode}
				onPropertyObjectivesModeChange={handlePropertyObjectivesModeChange}
				localObjectives={localObjectives}
				localMarketObjectives={localMarketObjectives}
				onObjectivesChange={handleObjectivesChange}
				onMarketObjectivesChange={handleMarketObjectivesChange}
				onSave={handleSaveObjectives}
				savingObjectives={savingObjectives}
			/>
			<DashboardHeading
				variant="cobalt"
				showRunAudit={false}
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
								filterAdSpendByMarket: draftFilterAdSpendByMarket,
								appliedFilterAdSpendByMarket,
								onFilterAdSpendByMarketChange: setDraftFilterAdSpendByMarket,
							}
						: null
				}
				adSpendPlatformFilter={
					shopifyMarketsFeatureOn && adSpendFilterUiChannels.length > 0
						? {
								options: adSpendFilterUiChannels.map((c) => ({
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
						variant="cobalt"
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
				objectivesScopeLabel={objectivesScopeLabel}
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
				revenueLabel={revenueLabel}
				objectivesScopeLabel={objectivesScopeLabel}
			/>
		</div>
	);
}
