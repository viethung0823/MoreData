import { Plugin, TFile, WorkspaceLeaf } from "obsidian";
import { MoreDataView, MORE_DATA_VIEW_TYPE, pluginIcon, pluginViewId } from "./view";

export default class PreviewDataPlugin extends Plugin {
	activeLeaf: WorkspaceLeaf | null = null;
	workspace = this.app.workspace;
	currentResolvedLinks: Record<string, string[]> = {};

	async onload() {
		this.registerView(MORE_DATA_VIEW_TYPE, (leaf) => new MoreDataView(leaf));

		this.registerEvent(
			this.workspace.on("file-open", async (file) => {
				if (this.activeLeaf && this.activeLeaf.view) {
					// TODO: find correct way to handle this, this is temporary workaround for keep active leaf state has type: MORE_DATA_VIEW_TYPE so it wont open any new leaf
					const currentViewState = this.activeLeaf.getViewState();
					await this.activeLeaf.setViewState({
						...currentViewState,
						type: MORE_DATA_VIEW_TYPE,
						active: false,
					});
					this.activeLeaf.view.containerEl.id = pluginViewId;
					this.activeLeaf.view.getIcon = () => pluginIcon;
				}
				if (!this.isValidFile(file)) return;
				this.currentResolvedLinks = this.getActiveFileResolvedLinks(file as TFile);
				if (!Object.keys(this.currentResolvedLinks).length) return;
				const firstCSVLink = this.currentResolvedLinks?.csv?.[0];
				if (firstCSVLink) {
					const firstCSVFile = this.app.vault.getAbstractFileByPath(firstCSVLink);
					if (!(firstCSVFile instanceof TFile)) return;
					await this.getExistingMoreDataViewTypeLeaf();
					await this.setActiveLeafStateAndReveal(firstCSVFile);
					this.renderLinks();
				}
			}),
		);
	}

	async getExistingMoreDataViewTypeLeaf() {
		if (this.activeLeaf && !this.workspace.getLeavesOfType(MORE_DATA_VIEW_TYPE).includes(this.activeLeaf)) {
			this.activeLeaf = null;
		}
		if (!this.activeLeaf) {
			const leaves = this.workspace.getLeavesOfType(MORE_DATA_VIEW_TYPE);
			if (leaves.length > 0) {
				this.activeLeaf = leaves[0];
			} else {
				this.activeLeaf = this.workspace.getRightLeaf(false);
			}
		}
	}

	isValidFile(file: TFile | null) {
		if (!file) {
			console.log("File is null or undefined");
			return false;
		}
		if (file.extension !== "md") {
			console.log("File is not a markdown file");
			return false;
		}
		return true;
	}

	async setActiveLeafStateAndReveal(csvFile: TFile) {
		if (this.activeLeaf) {
			await this.activeLeaf.setViewState({
				type: MORE_DATA_VIEW_TYPE,
				state: {file: csvFile.path, mode: "preview"},
				active: false,
			});
			this.workspace.revealLeaf(this.activeLeaf);
		}
	}

	getActiveFileResolvedLinks(file: TFile) {
		const resolvedLinks = this.app.metadataCache.resolvedLinks[file.path];
		const result: Record<string, string[]> = {};

		for (const filePath in resolvedLinks) {
			const extension = filePath.split(".").pop();
			if (extension) {
				if (!result[extension]) {
					result[extension] = [];
				}
				result[extension].push(filePath);
			}
		}

		return result;
	}

	renderLinks() {
		// Ensure activeLeaf is defined
		if (!this.activeLeaf) {
			console.error("activeLeaf is undefined");
			return;
		}

		// Remove the old container
		const oldContainer = this.activeLeaf.view.containerEl.querySelector(".linked-csv-files-container");
		if (oldContainer) {
			oldContainer.remove();
		}

		const contentElem = this.activeLeaf.view.containerEl.querySelector(".view-content");
		if (!contentElem) {
			console.error("contentElem is undefined");
			return;
		}
		const allLinks = [...(this.currentResolvedLinks?.csv || []), ...(this.currentResolvedLinks?.md || [])];

		if (allLinks?.length > 1) {
			// Create a new container and prepend it to the content element
			const container = contentElem.createDiv();
			container.classList.add("linked-csv-files-container");
			contentElem.prepend(container);

			allLinks?.forEach((link) => {
				const spanItem = container.createSpan();
				spanItem.innerText = link as string;
				spanItem.classList.add("external-link");
				if (link.endsWith(".csv")) {
					spanItem.classList.add("csv-link");
				} else if (link.endsWith(".md")) {
					spanItem.classList.add("md-link");
				}

				// Add a click event listener to the span
				spanItem.addEventListener("click", () => {
					const csvFile = this.app.vault.getAbstractFileByPath(link);
					if (!(csvFile instanceof TFile)) {
						console.error("csvFile is not an instance of TFile");
						return;
					}
					this.setActiveLeafStateAndReveal(csvFile);
				});
			});
		}
	}
}
