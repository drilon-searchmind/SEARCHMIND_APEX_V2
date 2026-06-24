import DemoPreviewGuard from "./DemoPreviewGuard";
import PreviewCustomersProvider from "./PreviewCustomersProvider";

export default function PreviewDashboardCustomerLayout({ children }) {
	return (
		<DemoPreviewGuard>
			<PreviewCustomersProvider>{children}</PreviewCustomersProvider>
		</DemoPreviewGuard>
	);
}
