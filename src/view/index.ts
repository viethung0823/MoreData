import {MarkdownView, WorkspaceLeaf, TFile} from "obsidian";

export const MORE_DATA_VIEW_TYPE = "MORE_DATA_VIEW_TYPE";
export const PLUGIN_VIEW_ID = "more-data-plugin";
export const PLUGIN_ICON = "file-symlink";
const FILE_EXTENSIONS = ["csv", "md"];

export class MoreDataView extends MarkdownView {
	activeAction: HTMLElement;
	defaultAction: HTMLElement;

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
		this.loadViewConfig();
	}

	private loadViewConfig(): void {
		this.containerEl.id = PLUGIN_VIEW_ID;
		this.getIcon = () => PLUGIN_ICON;
		this.canAcceptExtension = (extension: string) => FILE_EXTENSIONS.includes(extension);
		this.getViewType = () => MORE_DATA_VIEW_TYPE;
		this.navigation = false;
		this.addActions();
	}

	async onLoadFile(file: TFile): Promise<void> {
		this.setActiveAction(this.defaultAction);
		return super.onLoadFile(file);
	}

	private addActions(): void {
		this.addAction("file-spreadsheet", "CSV links", (e) => this.handleAction(e, "csv-link"));
		this.addAction("braces", "Dataview links", (e) => this.handleAction(e, "dataview-link"));
		this.defaultAction = this.addAction("filter-x", "All links", (e) => this.handleAction(e, "all"));
	}

	private handleAction(e: Event, className: string): void {
		this.setActiveAction(e.target as HTMLElement);
		this.toggleVisibilityOnByClass(className);
	}

	private toggleVisibilityOnByClass(className: string): void {
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

	private setActiveAction(actionElem: HTMLElement): void {
		if (this.activeAction) {
			this.activeAction.classList.remove("is-active");
		}
		this.activeAction = actionElem;
		actionElem.classList.add("is-active");
	}
}
