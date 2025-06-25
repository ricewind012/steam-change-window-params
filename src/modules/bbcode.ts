import { findModuleExport } from "@steambrew/client";
import type { FC, ReactNode } from "react";

interface BBCodeParserProps {
	bShowShortSpeakerInfo?: boolean;
	event?: any;
	languageOverride?: any;
	showErrorInfo?: boolean;
	text?: ReactNode;
}

export const BBCodeParser: FC<BBCodeParserProps> = findModuleExport(
	(m) =>
		typeof m === "function" && m.toString().includes("this.ElementAccumulator"),
);
