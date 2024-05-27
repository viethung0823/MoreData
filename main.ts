import {App, FrontmatterLinkCache, Plugin, PluginSettingTab, Setting, TFile, WorkspaceLeaf} from "obsidian";
import {CSVView, CSV_VIEW_TYPE} from "./view";

interface MyPluginSettings {
	csvFolderPath: string;
}

interface ExtendedFrontmatterLinkCache extends FrontmatterLinkCache {
	fullPath: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	csvFolderPath: "",
};

class MyPluginSettingTab extends PluginSettingTab {
	plugin: PreviewDataPlugin;

	constructor(app: App, plugin: PreviewDataPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		let {containerEl} = this;
		containerEl.empty();
		containerEl.createEl("h2", {text: "CSV Folder Settings"});

		new Setting(containerEl)
			.setName("CSV Folder Path")
			.setDesc("Path to the folder containing CSV files")
			.addText((text) =>
				text
					.setPlaceholder("/")
					.setValue(this.plugin.settings.csvFolderPath)
					.onChange(async (value) => {
						this.plugin.settings.csvFolderPath = value;
						await this.plugin.saveSettings();
					}),
			);
	}
}

export default class PreviewDataPlugin extends Plugin {
	settings: MyPluginSettings;
	csvLeaf: WorkspaceLeaf | null = null;
	workspace = this.app.workspace;
	activeFrontmatterLink: ExtendedFrontmatterLinkCache[] = [];

	async onload() {
		await this.loadSettings();

		this.addSettingTab(new MyPluginSettingTab(this.app, this));

		this.registerView(CSV_VIEW_TYPE, (leaf) => new CSVView(leaf, this));

		this.registerEvent(
			this.workspace.on("file-open", async (file) => {
				if (!this.isValidFile(file)) return;
				await this.getExistingCSVViewTypeLeaf();
				const csvFile = this.getCSVFile(file as TFile);
				if (!(csvFile instanceof TFile)) return;
				await this.setCSVLeafStateAndReveal(csvFile);
				this.renderLinkedCSVFiles();
				//
			}),
		);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async getExistingCSVViewTypeLeaf() {
		if (!this.csvLeaf) {
			const leaves = this.workspace.getLeavesOfType(CSV_VIEW_TYPE);
			if (leaves.length > 0) {
				this.csvLeaf = leaves[0];
			} else {
				this.csvLeaf = this.workspace.getRightLeaf(false);
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

	async setCSVLeafStateAndReveal(csvFile: TFile) {
		if (this.csvLeaf) {
			await this.csvLeaf.setViewState({
				type: CSV_VIEW_TYPE,
				state: {file: csvFile.path, mode: "preview"},
				active: false,
			});
			this.workspace.revealLeaf(this.csvLeaf);
		}
	}

	getCSVFile(file: TFile) {
		const cache = this.app.metadataCache.getFileCache(file);
		if (!cache) return;
		const firstFrontmatterLink = cache.frontmatterLinks?.find((link) => link.link.endsWith(".csv"))?.link;

		this.activeFrontmatterLink =
			cache.frontmatterLinks
				?.filter((link) => link.link.endsWith(".csv"))
				.map((link) => {
					return {
						...link,
						fullPath: this.settings.csvFolderPath + link.link,
					};
				}) || [];
		if (!firstFrontmatterLink) return;

		const csvRelativeFilePath = this.settings.csvFolderPath + firstFrontmatterLink;
		const csvFile = this.app.vault.getAbstractFileByPath(csvRelativeFilePath);
		return csvFile;
	}

	renderLinkedCSVFiles() {
		// Ensure csvLeaf is defined
		if (!this.csvLeaf) {
			console.error("csvLeaf is undefined");
			return;
		}

		// Remove the old container
		const oldContainer = this.csvLeaf.view.containerEl.querySelector(".linked-csv-files-container");
		if (oldContainer) {
			oldContainer.remove();
		}

		const contentElem = this.csvLeaf.view.containerEl.querySelector(".view-content");
		if (!contentElem) {
			console.error("contentElem is undefined");
			return;
		}

		if (this.activeFrontmatterLink.length > 1) {
			// Create a new container and prepend it to the content element
			const container = contentElem.createDiv();
			container.classList.add("linked-csv-files-container");
			contentElem.prepend(container);

			this.activeFrontmatterLink.forEach((link) => {
				const spanItem = container.createSpan();
				spanItem.innerText = link.displayText as string;
				spanItem.classList.add("external-link");

				// Add a click event listener to the span
				spanItem.addEventListener("click", () => {
					const csvFile = this.app.vault.getAbstractFileByPath(link.fullPath);
					if (!(csvFile instanceof TFile)) {
						console.error("csvFile is not an instance of TFile");
						return;
					}
					this.setCSVLeafStateAndReveal(csvFile);
				});
			});
		}
	}
}
