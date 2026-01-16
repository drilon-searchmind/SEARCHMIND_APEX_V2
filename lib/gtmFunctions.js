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