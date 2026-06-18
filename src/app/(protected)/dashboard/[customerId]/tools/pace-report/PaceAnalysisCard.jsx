'use client';

import dynamic from 'next/dynamic';
import { FiSettings } from 'react-icons/fi';
import CobaltLoader from '@/components/ui/CobaltLoader';
import PaceAnalysisShell from './PaceAnalysisShell';
import {
	formatPaceCurrency,
	getPaceProgressPercent,
	getPaceRadialChartOptions,
} from './paceCardUtils';

const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

function SettingsButton({ onClick, text }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="apex-perf-btn apex-perf-btn--ghost apex-pace-analysis__settings"
		>
			<FiSettings aria-hidden />
			{text}
		</button>
	);
}

export default function PaceAnalysisCard({
	title,
	analysis,
	loading,
	error,
	onOpenSettings,
	settingsButtonText = 'Adjust your property budgets here.',
	showCalcs = false,
	objectivesScopeLabel,
}) {
	if (loading) {
		return (
			<PaceAnalysisShell title={title}>
				<CobaltLoader
					variant="block"
					title="Loading pace"
					request="GET /api/merged-sources"
					className="w-full"
				/>
			</PaceAnalysisShell>
		);
	}

	if (error) {
		return (
			<PaceAnalysisShell title={title}>
				<div className="apex-pace-analysis__error">{error}</div>
			</PaceAnalysisShell>
		);
	}

	if (!analysis) {
		return (
			<PaceAnalysisShell title={title}>
				<div className="apex-pace-analysis__empty">No analysis available.</div>
			</PaceAnalysisShell>
		);
	}

	const progressPercent = getPaceProgressPercent(
		analysis.actualSpendToDate,
		analysis.budget
	);
	const formatCurrency = formatPaceCurrency;

	return (
		<PaceAnalysisShell
			title={title}
			footer={
				<SettingsButton onClick={onOpenSettings} text={settingsButtonText} />
			}
		>
			<div className="apex-pace-analysis__gauge">
				<ReactApexChart
					options={getPaceRadialChartOptions(progressPercent)}
					series={[progressPercent]}
					type="radialBar"
					height={260}
					width={240}
				/>
			</div>
			<dl className="apex-pace-analysis__stats">
				<div className="apex-pace-analysis__stat apex-pace-analysis__stat--primary">
					<dt>Pace</dt>
					<dd>{analysis.pace.toFixed(2)}</dd>
				</div>
				<div className="apex-pace-analysis__stat">
					<dt>Budget</dt>
					<dd>{formatCurrency(analysis.budget)}</dd>
				</div>
				<div className="apex-pace-analysis__stat">
					<dt>Actual Spend to Date</dt>
					<dd>{formatCurrency(analysis.actualSpendToDate)}</dd>
				</div>
				<div className="apex-pace-analysis__stat">
					<dt>Ideal Spend to Date</dt>
					<dd>{formatCurrency(analysis.idealSpendToDate)}</dd>
				</div>
				<div className="apex-pace-analysis__stat">
					<dt>Suggested Daily Adjustment</dt>
					<dd>{formatCurrency(analysis.suggestedDailyAdjustment)}</dd>
				</div>
				<div className="apex-pace-analysis__stat">
					<dt>Total Days</dt>
					<dd>{analysis.totalDays}</dd>
				</div>
			</dl>
			{showCalcs && (
				<div className="apex-pace-analysis__calcs">
					<div className="space-y-0.5">
						<div className="apex-pace-analysis__calcs-row">
							<span>
								Budget (from property objectives
								{objectivesScopeLabel ? ` · ${objectivesScopeLabel}` : ''})
							</span>
							<span>{formatCurrency(analysis.budget)}</span>
						</div>
						<div className="apex-pace-analysis__calcs-row">
							<span>Actual Spend (Meta + Google Ads)</span>
							<span>{formatCurrency(analysis.actualSpendToDate)}</span>
						</div>
						<div className="apex-pace-analysis__calcs-row">
							<span>Days passed</span>
							<span>{analysis.daysPassed}</span>
						</div>
						<div className="apex-pace-analysis__calcs-row">
							<span>Total days in range</span>
							<span>{analysis.totalDays}</span>
						</div>
						<div className="apex-pace-analysis__calcs-row">
							<span>Daily target (Budget ÷ Total days)</span>
							<span>{formatCurrency(analysis.dailyTarget)}</span>
						</div>
						<div className="apex-pace-analysis__calcs-row">
							<span>Ideal spend to date (Daily target × Days passed)</span>
							<span>{formatCurrency(analysis.idealSpendToDate)}</span>
						</div>
					</div>
					<div className="apex-pace-analysis__calcs-divider apex-pace-analysis__calcs-result">
						<span>Pace = Actual Spend ÷ Ideal Spend to date</span>
						<strong>
							= {formatCurrency(analysis.actualSpendToDate)} ÷{' '}
							{formatCurrency(analysis.idealSpendToDate)} ={' '}
							{analysis.pace.toFixed(2)}
						</strong>
					</div>
				</div>
			)}
		</PaceAnalysisShell>
	);
}
