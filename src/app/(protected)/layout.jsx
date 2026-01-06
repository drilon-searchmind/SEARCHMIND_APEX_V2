import ToastProvider from "@/components/ui/ToastProvider";

export default function ProtectedLayout({ children }) {
	return (
		<>
			{children}
			<ToastProvider />
		</>
	);
}