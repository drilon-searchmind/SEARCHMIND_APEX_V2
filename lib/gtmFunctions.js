import { GTM_EVENTS } from "./gtmEvents";
export { GTM_EVENTS };

/**
 * Push a custom event to Google Tag Manager's dataLayer
 * @param {string} event - The event name (e.g., 'user_action', 'page_view', 'button_click')
 * @param {object} params - Additional event parameters as key-value pairs
 * @example
 *       pushGTMEvent('profile_update', {
 *           eventData: {
 *               userId: userId,
 *           }
 *       })
 */

export function pushGTMEvent(event, params = {}) {
    if (typeof window === 'undefined') {
        console.warn('GTM: Cannot push event on server-side');
        return;
    }

    if (!window.dataLayer) {
        console.warn('GTM: dataLayer not initialized');
        return;
    }

    if (!event || typeof event !== 'string') {
        console.error('GTM: Event name must be a non-empty string');
        return;
    }

    // Push event to dataLayer
    window.dataLayer.push({
        event,
        ...params,
        timestamp: params.timestamp || new Date().toISOString(),
    });

    console.log('GTM Event pushed:', { event, ...params });
}

/**
 * Fired when the user applies a date range from DateRangePicker (dashboard scope).
 * @param {object} payload
 * @param {string} payload.page - Stable route key, e.g. `performance_dashboard`, `tools_pace_report`
 * @param {string} [payload.customerId]
 * @param {string} payload.startDate
 * @param {string} payload.endDate
 * @param {string} [payload.comparisonMethod]
 */
export function pushDashboardDateRangeApplied({
    page,
    customerId,
    startDate,
    endDate,
    comparisonMethod,
} = {}) {
    const eventData = {
        page,
        startDate,
        endDate,
    };
    if (customerId) eventData.customerId = customerId;
    if (comparisonMethod != null && comparisonMethod !== "") {
        eventData.comparisonMethod = comparisonMethod;
    }
    pushGTMEvent(GTM_EVENTS.DASHBOARD_DATE_RANGE_APPLIED, { eventData });
}