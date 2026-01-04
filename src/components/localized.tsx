import { DialogButton, PanelSection } from "@steambrew/client";
import type { PropsWithChildren } from "react";

import { Localize } from "@/modules/localization";

interface LocalizedBaseProps {
	/**
	 * Localization token.
	 */
	strToken: string;
}

interface LocalizedButtonProps extends LocalizedBaseProps {
	onClick: () => void;
}

export function LocalizedButton(props: LocalizedButtonProps) {
	const { onClick, strToken } = props;
	return <DialogButton onClick={onClick}>{Localize(strToken)}</DialogButton>;
}

interface LocalizedPanelSectionProps
	extends LocalizedBaseProps,
		PropsWithChildren {}

export function LocalizedPanelSection(props: LocalizedPanelSectionProps) {
	const { strToken, children } = props;
	return <PanelSection title={Localize(strToken)}>{children}</PanelSection>;
}
