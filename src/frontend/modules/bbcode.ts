import { findModuleExport } from "millennium";
import type { FC } from "react";

interface BBCodeParserProps {
	text?: string;
}

export const BBCodeParser: FC<BBCodeParserProps> = findModuleExport(
	(m) => typeof m === "function" && m.toString().includes("ElementAccumulator"),
);
