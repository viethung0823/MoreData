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

		const savedLeafState = await this.loadData();
		if (savedLeafState && savedLeafState.leafId) {
			const leaves = this.workspace.getLeavesOfType(CSV_VIEW_TYPE);
			this.csvLeaf = leaves.find((leaf) => leaf.getViewState() === savedLeafState.leafId) || null;
		}

		this.registerEvent(
			this.workspace.on("file-open", async (file) => {
				await this.getExistingCSVViewTypeLeaf();
				if (!this.isValidFile(file)) return;

				const csvFile = this.getCSVFile(file as TFile);
				if (!(csvFile instanceof TFile)) return;

				await this.setCSVLeafStateAndReveal(csvFile);
			}),
		);
	}

	async onunload() {
		if (this.csvLeaf) {
			this.saveData(this.csvLeaf.getViewState());
		}
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
				state: {file: csvFile.path},
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
}
