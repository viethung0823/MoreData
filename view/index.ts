import PreviewDataPlugin from "main";
import {MarkdownView, TFile, WorkspaceLeaf} from "obsidian";

export const CSV_VIEW_TYPE = "CSV_VIEW";
const FILE_EXTENSIONS = ["csv"];

export class CSVView extends MarkdownView {
	plugin: PreviewDataPlugin;

	constructor(leaf: WorkspaceLeaf, plugin: PreviewDataPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.containerEl.id = "more-data-plugin";
		this.navigation = false;
	}

	getIcon() {
		return "link";
	}

	canAcceptExtension(extension: string) {
		return FILE_EXTENSIONS.contains(extension);
	}

	getViewType(): string {
		return CSV_VIEW_TYPE;
	}
}
