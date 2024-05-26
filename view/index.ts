import PreviewDataPlugin from "main";
import { MarkdownView, Menu, TFile, WorkspaceLeaf } from "obsidian";

export const CSV_VIEW_TYPE = "CSV_VIEW";

export class CSVView extends MarkdownView {
	plugin: PreviewDataPlugin;

	constructor(leaf: WorkspaceLeaf, plugin: PreviewDataPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.containerEl.classList.add("preview-data-plugin");
	}

	getIcon() {
		return "link";
	}

	async onOpen() {
		this.renderLinkedCSVFiles();
	}

	renderLinkedCSVFiles() {
		const contentElem = this.containerEl.querySelector(".view-content");
		if (contentElem) {
			// Create a ul list
			const container = contentElem.createDiv();
			container.classList.add("linked-csv-files-container");
			contentElem.prepend(container);
			// For each CSV file, create a li item
			this.plugin.activeFrontmatterLink.forEach((link) => {
				const spanItem = container.createSpan();
				spanItem.innerText = link.displayText as string;
				spanItem.classList.add("external-link");
				spanItem.addEventListener("click", () => {
					const csvFile = this.app.vault.getAbstractFileByPath(
						link.fullPath
					);
					if (!(csvFile instanceof TFile)) return;
					this.plugin.setCSVLeafStateAndReveal(csvFile);
				});
			});
		}
	}
}
