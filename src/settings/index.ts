import PreviewDataPlugin from "src/main";
import {PluginSettingTab, App, Setting, TFolder, TFile} from "obsidian";
import {GenericTextSuggester} from "src/utils/generticTextSuggester";

export interface MoreDataSettings {
	dataviewFolderPath: string;
	dataviewTemplatePath: string;
	validMDFoldersPath: string[];
	dataviewSuffix: string;
}

export const DEFAULT_SETTINGS: MoreDataSettings = {
	dataviewFolderPath: "",
	dataviewTemplatePath: "",
	validMDFoldersPath: [],
	dataviewSuffix: "_dataview",
};

export class MoreDataSettingTab extends PluginSettingTab {
	plugin: PreviewDataPlugin;

	constructor(app: App, plugin: PreviewDataPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		let {containerEl} = this;
		containerEl.empty();
		containerEl.createEl("h2", {text: "MoreData Settings"});

		new Setting(containerEl)
			.setName("Dataview template path")
			.setDesc("Tempalte file to use for dataview files")
			.addSearch((search) => {
				const allFiles: string[] = this.app.vault
					.getAllLoadedFiles()
					.filter((f) => f instanceof TFile && f.path !== "/")
					.map((f) => f.path);
				if (!this.plugin.settings.dataviewTemplatePath) {
					search.setPlaceholder("Template path");
				}
				search.setValue(this.plugin.settings.dataviewTemplatePath);
				new GenericTextSuggester(this.app, search.inputEl, allFiles);
				return search.onChange(async (value) => {
					this.plugin.settings.dataviewTemplatePath = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Dataview folder path")
			.setDesc("Folder to save all dataview files")
			.addSearch((text) => {
				new GenericTextSuggester(
					this.app,
					text.inputEl,
					this.app.vault
						.getAllLoadedFiles()
						.filter((f) => f instanceof TFolder && f.path !== "/")
						.map((f) => f.path),
				);
				return text
					.setPlaceholder("")
					.setValue(this.plugin.settings.dataviewFolderPath)
					.onChange(async (value) => {
						this.plugin.settings.dataviewFolderPath = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Dataview suffix")
			.setDesc("Suffix to use for dataview file name")
			.addSearch((text) => {
				{
					return text.setValue(this.plugin.settings.dataviewSuffix).onChange(async (value) => {
						this.plugin.settings.dataviewSuffix = value;
						await this.plugin.saveSettings();
					});
				}
			});

		let currentSearchValueForValidMDFoldersPath = "";

		new Setting(containerEl)
			.setName("Valid markdown folders path")
			.setDesc("Markdown files that are located within these specified folders will be visible in the view")
			.addSearch((text) => {
				new GenericTextSuggester(
					this.app,
					text.inputEl,
					this.app.vault
						.getAllLoadedFiles()
						.filter((f) => f instanceof TFolder && f.path !== "/")
						.filter((f) => !this.plugin.settings.validMDFoldersPath.includes(f.path))
						.map((f) => f.path),
				);
				return text
					.setPlaceholder("")
					.setValue("")
					.onChange(async (value) => {
						currentSearchValueForValidMDFoldersPath = value;
					});
			})
			.addButton((button) => {
				button.setButtonText("Add Path").onClick(async () => {
					this.plugin.settings.validMDFoldersPath.push(currentSearchValueForValidMDFoldersPath); // Add the current search value
					currentSearchValueForValidMDFoldersPath = ""; // Clear the current search value
					await this.plugin.saveSettings();
					this.display();
				});
			});

		this.plugin.settings.validMDFoldersPath.forEach((path, index) => {
			new Setting(containerEl)
				.setName(path)
				.addButton((button) => {
					button
						.setButtonText("X")
						.setCta()
						.onClick(async () => {
							this.plugin.settings.validMDFoldersPath.splice(index, 1); // Remove the path at the current index
							await this.plugin.saveSettings();
							this.display();
						});
				});
		});
	}
}
