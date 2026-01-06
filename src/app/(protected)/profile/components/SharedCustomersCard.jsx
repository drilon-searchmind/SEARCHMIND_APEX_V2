"use client";

import React from "react";

export default function SharedCustomersCard({ sharedCustomers = [] }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-[var(--color-primary-searchmind)]">Shared Customers</h3>
        <span className="text-xs text-gray-400">Read-only</span>
      </div>
      {sharedCustomers.length === 0 ? (
        <p className="text-sm text-gray-500">No shared customers.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {sharedCustomers.map((id) => (
            <span
              key={id}
              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border border-gray-200 bg-gray-50 text-gray-700"
              title={id}
            >
              {id.substring(0, 6)}...{id.substring(id.length - 4)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
