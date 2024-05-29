import {MarkdownView, TFile, WorkspaceLeaf} from "obsidian";

export const MORE_DATA_VIEW_TYPE = "MORE_DATA_VIEW_TYPE";
export const pluginViewId = "more-data-plugin";
export const pluginIcon = "file-symlink";
const FILE_EXTENSIONS = ["csv", "md"];

export class MoreDataView extends MarkdownView {
	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
		this.loadViewConfig();
	}

	loadViewConfig() {
		this.containerEl.id = pluginViewId;
		this.getIcon = () => pluginIcon;
		this.canAcceptExtension = (extension: string) => FILE_EXTENSIONS.contains(extension);
		this.getViewType = () => MORE_DATA_VIEW_TYPE;
		this.navigation = false;
		this.addActions();
	}

	addActions() {
		this.addAction("file-spreadsheet", "CSV Links", () => {
			this.toggleVisibilityOnByClass("csv-link");
		});
		this.addAction("sticky-note", "Md Links", () => {
			this.toggleVisibilityOnByClass("md-link");
		});
		this.addAction("filter-x", "All Links", () => {
			this.toggleVisibilityOnByClass("all");
		});
	}

	toggleVisibilityOnByClass(className: string) {
		const linksContainer = this.containerEl.querySelector(".linked-csv-files-container")?.children;
		if (!linksContainer) return;

		Array.from(linksContainer).forEach((link) => {
			if (className === "all") {
				link.classList.remove("hidden");
			} else {
				link.classList.toggle("hidden", !link.classList.contains(className));
			}
		});
	}
}
