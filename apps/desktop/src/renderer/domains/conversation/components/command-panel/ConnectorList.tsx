import { motion } from "motion/react";
import type { ConnectorListItem } from "../../hooks/useConnectorList";

export interface ConnectorListProps {
	items: readonly ConnectorListItem[];
	activeIndex: number;
	indexOffset: number;
	title: string;
	onHover: (index: number) => void;
	onSelect: (connector: ConnectorListItem) => void;
}

/** 已安装连接器的单列选择区，与 skill 列表使用相同的行高和选中反馈。 */
export function ConnectorList({
	items,
	activeIndex,
	indexOffset,
	title,
	onHover,
	onSelect,
}: ConnectorListProps): JSX.Element | null {
	if (items.length === 0) return null;
	return (
		<div className="py-1">
			<div className="px-4 pb-1 pt-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50">
				{title}
			</div>
			{items.map((connector, index) => (
				<button
					key={connector.name}
					type="button"
					data-index={index + indexOffset}
					onMouseEnter={() => onHover(index)}
					onClick={() => onSelect(connector)}
					title={connector.label}
					className="relative flex h-8 w-full items-center gap-2 px-4 text-left transition-colors"
					style={{
						background:
							activeIndex === index ? "color-mix(in srgb, var(--primary) 9%, transparent)" : "transparent",
					}}
				>
					{activeIndex === index ? (
						<motion.span
							layoutId="command-panel-active-marker"
							className="absolute inset-y-1 left-0 w-px rounded-full bg-primary"
							transition={{ type: "spring", stiffness: 500, damping: 32 }}
						/>
					) : null}
					<span className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/40 bg-accent/50 text-foreground">
						{connector.iconUrl ? (
							<img
								src={connector.iconUrl}
								alt=""
								className="h-3.5 w-3.5 object-contain"
								draggable={false}
							/>
						) : (
							<span className="icon-[solar--plug-circle-linear] h-3.5 w-3.5 text-muted-foreground" />
						)}
					</span>
					<span className="min-w-0 shrink-0 truncate text-[12px] font-medium text-foreground">
						{connector.label}
					</span>
					{connector.description ? (
						<span className="min-w-0 flex-1 truncate text-right text-[11px] text-muted-foreground/50">
							{connector.description}
						</span>
					) : null}
				</button>
			))}
		</div>
	);
}
