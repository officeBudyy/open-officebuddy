import logoUrl from "../assets/officebuddy-logo.png";

// officeBuddy brand mark — the mascot asset, used at every size.
export function LogoMark({ size = 24 }: { size?: number }) {
	return (
		<img
			src={logoUrl}
			alt="officeBuddy"
			className="shrink-0 select-none"
			style={{ width: size, height: size }}
		/>
	);
}

export function Logo({
	size = 24,
	fontSize = 15,
	className = "",
}: {
	size?: number;
	fontSize?: number;
	className?: string;
}) {
	return (
		<span className={`flex items-center gap-2 ${className}`}>
			<LogoMark size={size} />
			<span className="font-display font-semibold tracking-tight" style={{ fontSize }}>
				officeBuddy
			</span>
		</span>
	);
}
