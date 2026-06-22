'use client';

export default function PaceAnalysisShell({ title, children, footer }) {
	return (
		<aside className="apex-pace-analysis">
			<div className="apex-pace-analysis__head">
				<h3 className="apex-pace-analysis__title">{title}</h3>
			</div>
			<div className="apex-pace-analysis__body">
				{children}
				{footer ? <div className="apex-pace-analysis__footer">{footer}</div> : null}
			</div>
		</aside>
	);
}
