/**
 * GTM / dataLayer event name constants.
 * @see docs/gtm-events.md
 */
export const GTM_EVENTS = Object.freeze({
    PROFILE_UPDATE: "profile_update",

    DASHBOARD_CONFIG_SAVED: "dashboard_config_saved",
    DASHBOARD_PARENT_CUSTOMER_CREATED: "dashboard_parent_customer_created",
    DASHBOARD_DATE_RANGE_APPLIED: "dashboard_date_range_applied",
    DASHBOARD_PACE_REPORT_OBJECTIVES_SAVED: "dashboard_pace_report_objectives_saved",

    PERFORMANCE_DASHBOARD_CUSTOM_KPI_SAVED: "performance_dashboard_custom_kpi_saved",
    PERFORMANCE_DASHBOARD_CUSTOM_KPI_DELETED: "performance_dashboard_custom_kpi_deleted",

    CAMPAIGN_PLANNER_V1_CAMPAIGN_CREATED: "campaign_planner_v1_campaign_created",
    CAMPAIGN_PLANNER_V1_CAMPAIGN_UPDATED: "campaign_planner_v1_campaign_updated",
    CAMPAIGN_PLANNER_V1_CAMPAIGN_DELETED: "campaign_planner_v1_campaign_deleted",

    CAMPAIGN_PLANNER_V2_LINE_ITEM_COMMENT_ADDED:
        "campaign_planner_v2_line_item_comment_added",

    ECOMMERCE_TAB_CHANGED: "ecommerce_tab_changed",
    DATA_WRAPPED_MODAL_OPENED: "data_wrapped_modal_opened",
});
