import { Button, Input } from "@astravia-org/ui";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@astravia-org/ui/dialog";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

export function EnterpriseExpertTokenDialog(): JSX.Element {
	const { t } = useTranslation("agent-teams");
	const [open, setOpen] = useState(false);
	const [token, setToken] = useState("");
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string>();

	useEffect(() => window.astravia?.enterpriseExperts?.onAuthRequired(() => setOpen(true)), []);

	async function save(): Promise<void> {
		if (!token.trim() || saving) return;
		setSaving(true);
		setError(undefined);
		try {
			await window.astravia.enterpriseExperts.setToken(token);
			setToken("");
			setOpen(false);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : String(cause));
		} finally {
			setSaving(false);
		}
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogContent className="sm:max-w-[480px]">
				<DialogHeader>
					<DialogTitle>{t("enterprise.tokenTitle")}</DialogTitle>
					<DialogDescription>{t("enterprise.tokenDescription")}</DialogDescription>
				</DialogHeader>
				<Input
					type="password"
					autoComplete="off"
					value={token}
					placeholder={t("enterprise.tokenPlaceholder")}
					onChange={(event) => setToken(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === "Enter") void save();
					}}
				/>
				{error && <p className="text-[12px] text-destructive">{error}</p>}
				<DialogFooter>
					<Button variant="ghost" onClick={() => setOpen(false)}>{t("enterprise.cancel")}</Button>
					<Button disabled={!token.trim() || saving} onClick={() => void save()}>
						{saving ? t("enterprise.validating") : t("enterprise.saveToken")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
