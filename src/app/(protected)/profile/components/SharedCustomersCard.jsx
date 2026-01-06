"use client";

import React from "react";

export default function SharedCustomersCard({ sharedCustomers = [] }) {
  const items = (sharedCustomers || []).map((c) => {
    if (!c) return null;
    // Support both ObjectId refs and populated objects
    const id = typeof c === "string" ? c : c._id || c.id || String(c);
    const label = typeof c === "object" && c.customerName ? c.customerName : id;
    return { id, label };
  }).filter(Boolean);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Shared Customers</h3>
      </div>
      {items.length === 0 ? (
        <div className="text-sm text-gray-500">No shared customers.</div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <span key={item.id} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-50 text-gray-600 border border-gray-200">
              {item.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
