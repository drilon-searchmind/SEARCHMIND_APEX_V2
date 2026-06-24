import PreviewShell from "./PreviewShell";
import "./preview.css";

export const metadata = {
	robots: { index: false, follow: false },
};

export default function PreviewLayout({ children }) {
	return <PreviewShell>{children}</PreviewShell>;
}
