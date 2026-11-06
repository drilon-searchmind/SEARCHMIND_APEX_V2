/**
 * Stylesheets for the custom dashboards. They are imported statically by the /custom route instead of
 * inside each lazily loaded (next/dynamic) dashboard component, because CSS imported there is not
 * injected in dev. Add each customer's stylesheets here.
 */
import "../performance-dashboard/performance-dashboard.css";
import "../service-dashboard/ppc/ppc-dashboard.css";
import "./aura/aura-dashboard.css";
