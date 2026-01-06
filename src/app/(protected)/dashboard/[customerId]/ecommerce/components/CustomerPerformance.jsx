"use client";

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import DateRangePicker from '@/components/dashboard/DateRangePicker';
import Spinner from '@/components/ui/Spinner';
import { Tooltip } from '@/components/ui/Tooltip';

const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

const defaultRange = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const defaultEnd = `${yyyy}-${mm}-${dd}`;
    const defaultStart = `${yyyy}-${mm}-01`;
    return { startDate: defaultStart, endDate: defaultEnd };
};

export default function CustomerPerformance() {
    const params = useParams();
    const customerId = params?.customerId;
    const [range, setRange] = useState(defaultRange());
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [segmentation, setSegmentation] = useState(null);

    useEffect(() => {
        if (!customerId || !range.startDate || !range.endDate) return;
        let cancelled = false;
        async function fetchSegmentation() {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch(`/api/customer-segmentation/${customerId}?startDate=${range.startDate}&endDate=${range.endDate}`);
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Failed to fetch segmentation');
                if (!cancelled) setSegmentation(data);
            } catch (err) {
                if (!cancelled) setError(err.message || String(err));
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        fetchSegmentation();
        return () => { cancelled = true; };
    }, [customerId, range.startDate, range.endDate]);

    const formatCurrency = (v) => (v === undefined ? '—' : `${Number(v).toLocaleString()} kr`);

    return (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-start justify-between mb-4">
                <div>
                    <h3 className="text-lg font-semibold text-gray-900">Customer Segmentation</h3>
                    <p className="text-sm text-gray-400">New vs returning customers</p>
                </div>
                <div className="flex items-center gap-3">
                    <DateRangePicker
                        startDate={range.startDate}
                        endDate={range.endDate}
                        onStartDateChange={d => setRange(r => ({ ...r, startDate: d }))}
                        onEndDateChange={d => setRange(r => ({ ...r, endDate: d }))}
                    />
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center items-center h-40"><Spinner size={36} /></div>
            ) : error ? (
                <div className="text-red-500">{error}</div>
            ) : !segmentation ? (
                <div className="text-sm text-gray-500">No segmentation data available</div>
            ) : (
                <div className="md:flex md:items-center md:gap-6">
                    <div className="w-full md:w-1/3 flex items-center justify-center">
                        <div className="flex flex-col items-center">
                            <ReactApexChart
                                options={{
                                    chart: { type: 'radialBar', sparkline: { enabled: true } },
                                    plotOptions: {
                                        radialBar: {
                                            startAngle: -100,
                                            endAngle: 100,
                                            hollow: { size: '70%' },
                                            track: { background: '#f3f4f6', strokeWidth: '100%' },
                                            dataLabels: {
                                                name: { show: false },
                                                value: {
                                                    offsetY: 10,
                                                    fontSize: '32px',
                                                    fontWeight: 700,
                                                    color: '#213834',
                                                    formatter: val => `${val}%`,
                                                },
                                            },
                                        },
                                    },
                                    stroke: { lineCap: 'round' },
                                    fill: { colors: ['#406969'] },
                                    labels: ['Returning'],
                                }}
                                series={[Number((segmentation.returningPct || 0).toFixed(2))]}
                                type="radialBar"
                                height={220}
                                width={220}
                            />
                            <div className="mt-3 text-sm text-gray-600">Returning customers ({segmentation.returningCount ?? segmentation.returningCustomers ?? 0})</div>
                        </div>
                    </div>

                    <div className="mt-4 md:mt-0 flex-1">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                                <div className="flex flex-col items-start gap-2 text-sm font-medium text-gray-400">Total unique customers</div>
                                <div className="font-semibold text-3xl mt-2">{segmentation.totalCustomers ?? segmentation.total ?? 0}</div>
                            </div>
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                                <div className="flex flex-col items-start gap-2 text-sm font-medium text-gray-400">New customers</div>
                                <div className="font-semibold text-3xl mt-2">{segmentation.newCustomers ?? segmentation.newCount ?? 0}</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}