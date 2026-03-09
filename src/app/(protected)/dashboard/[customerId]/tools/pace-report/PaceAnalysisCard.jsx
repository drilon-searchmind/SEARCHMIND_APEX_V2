'use client';

import dynamic from 'next/dynamic';
import { FiSettings } from 'react-icons/fi';
import Spinner from '@/components/ui/Spinner';

const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

export default function PaceAnalysisCard({
	title,
	analysis,
	loading,
	error,
	onOpenSettings,
	settingsButtonText = 'Adjust your property budgets here.',
	showCalcs = false,
}) {
	if (loading) {
		return (
			<div className="w-full md:w-1/3 bg-white border border-gray-200 rounded-xl p-6 flex flex-col gap-4">
				<h6 className="text-[var(--color-primary-searchmind)] mb-2 font-bold">
					{title}
				</h6>
				<div className="flex justify-center items-center min-h-[200px]">
					<Spinner size={40} color="#406969" />
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="w-full md:w-1/3 bg-white border border-gray-200 rounded-xl p-6 flex flex-col gap-4">
				<h6 className="text-[var(--color-primary-searchmind)] mb-2 font-bold">
					{title}
				</h6>
				<div className="text-red-500">{error}</div>
			</div>
		);
	}

	if (!analysis) {
		return (
			<div className="w-full md:w-1/3 bg-white border border-gray-200 rounded-xl p-6 flex flex-col gap-4">
				<h6 className="text-[var(--color-primary-searchmind)] mb-2 font-bold">
					{title}
				</h6>
				<div className="text-gray-400">No analysis available.</div>
			</div>
		);
	}

	const progressPercent = Number(
		((analysis.actualSpendToDate / analysis.budget) * 100).toFixed(0)
	);

	const formatCurrency = (val) =>
		val.toLocaleString('da-DK', {
			style: 'currency',
			currency: 'DKK',
			maximumFractionDigits: 0,
		});

	return (
		<div className="w-full md:w-1/3 bg-white border border-gray-200 rounded-xl p-6 flex flex-col gap-4">
			<h6 className="text-[var(--color-primary-searchmind)] mb-2 font-bold">
				{title}
			</h6>
			<div className="flex flex-col items-center mb-2">
				<ReactApexChart
					options={{
						chart: { type: 'radialBar', sparkline: { enabled: true } },
						plotOptions: {
							radialBar: {
								startAngle: -100,
								endAngle: 100,
								hollow: { size: '75%' },
								track: { background: '#e5e7eb', strokeWidth: '100%' },
								dataLabels: {
									name: { show: false },
									value: {
										offsetY: 15,
										fontSize: '30px',
										fontWeight: 700,
										color: '#213834',
										formatter: (val) => `${val}%`,
									},
								},
							},
						},
						stroke: { lineCap: 'round' },
						fill: { colors: ['#406969'] },
						labels: ['Progress'],
					}}
					series={[progressPercent]}
					type="radialBar"
					height={300}
					width={250}
				/>
			</div>
			<div className="flex flex-col gap-2 mt-2">
				<div className="flex justify-between text-base font-bold border-b border-gray-200 pb-1">
					<span>Pace:</span>
					<span>{analysis.pace.toFixed(2)}</span>
				</div>
				<div className="flex justify-between text-sm">
					<span>Budget:</span>
					<span>{formatCurrency(analysis.budget)}</span>
				</div>
				<div className="flex justify-between text-sm">
					<span>Actual Spend to Date:</span>
					<span>{formatCurrency(analysis.actualSpendToDate)}</span>
				</div>
				<div className="flex justify-between text-sm">
					<span>Ideal Spend to Date:</span>
					<span>{formatCurrency(analysis.idealSpendToDate)}</span>
				</div>
				<div className="flex justify-between text-sm">
					<span>Suggested Daily Adjustment:</span>
					<span>{formatCurrency(analysis.suggestedDailyAdjustment)}</span>
				</div>
				<div className="flex justify-between text-sm">
					<span>Total Days:</span>
					<span>{analysis.totalDays}</span>
				</div>
			</div>
			{showCalcs && (
				<div className="mt-4 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-[10px] font-mono text-gray-600 leading-tight">
					<div className="mb-1.5 pb-1.5 border-b border-gray-200 space-y-0.5">
						<div className="flex justify-between gap-4">
							<span className="text-gray-500">Budget (from property objectives):</span>
							<span className="tabular-nums">{formatCurrency(analysis.budget)}</span>
						</div>
						<div className="flex justify-between gap-4">
							<span className="text-gray-500">Actual Spend (Meta + Google Ads):</span>
							<span className="tabular-nums">{formatCurrency(analysis.actualSpendToDate)}</span>
						</div>
						<div className="flex justify-between gap-4">
							<span className="text-gray-500">Days passed (excl. today):</span>
							<span className="tabular-nums">{analysis.daysPassedExcludingToday}</span>
						</div>
						<div className="flex justify-between gap-4">
							<span className="text-gray-500">Total days in range:</span>
							<span className="tabular-nums">{analysis.totalDays}</span>
						</div>
						<div className="flex justify-between gap-4">
							<span className="text-gray-500">Daily target (Budget ÷ Total days):</span>
							<span className="tabular-nums">{formatCurrency(analysis.dailyTarget)}</span>
						</div>
						<div className="flex justify-between gap-4">
							<span className="text-gray-500">Ideal spend to date (Daily target × Days passed):</span>
							<span className="tabular-nums">{formatCurrency(analysis.idealSpendToDate)}</span>
						</div>
					</div>
					<div className="flex flex-col items-end gap-0.5 pt-1">
						<span>Pace = Actual Spend ÷ Ideal Spend to date</span>
						<span className="font-bold text-[var(--color-primary-searchmind)]">
							= {formatCurrency(analysis.actualSpendToDate)} ÷ {formatCurrency(analysis.idealSpendToDate)} = {analysis.pace.toFixed(2)}
						</span>
					</div>
				</div>
			)}
			<button
				onClick={onOpenSettings}
				className="mt-4 text-sm underline hover:text-[var(--color-primary-searchmind-lighter)] text-center flex items-center justify-center gap-1 text-blue-500 w-full"
			>
				<span className="text-gray-500 flex items-center gap-1">
					<FiSettings /> {settingsButtonText}
				</span>
			</button>
		</div>
	);
}
