import PreviewDataPlugin from "src/main";
import { PluginSettingTab, App, Setting, TFolder, TFile } from "obsidian";
import { GenericTextSuggester } from "src/utils/generticTextSuggester";
import JSONEditor from "jsoneditor";

export interface MoreDataSettings {
	dataviewFolderPath: string;
	dataviewTemplatePath: string;
	validMDFoldersPath: string[];
	pathsToExtractMetadata: {
		[key: string]: string;
	};
	dataviewSuffix: string;
}

export const DEFAULT_SETTINGS: MoreDataSettings = {
	dataviewFolderPath: "",
	dataviewTemplatePath: "",
	validMDFoldersPath: [],
	pathsToExtractMetadata: {},
	dataviewSuffix: "_dataview",
};

export class MoreDataSettingTab extends PluginSettingTab {
	plugin: PreviewDataPlugin;

	constructor(app: App, plugin: PreviewDataPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		let { containerEl } = this;
		containerEl.empty();
		containerEl.createEl("h2", { text: "MoreData Settings" });

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
			new Setting(containerEl).setName(path).addButton((button) => {
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

		containerEl.createEl("h2", { text: "Get Resolved Links Settings" });
		containerEl.createEl("p", { text: "Paths to extract metadata from" });
		const editorContainer = containerEl.createDiv();
		editorContainer.style.height = "400px";

		new JSONEditor(
			editorContainer,
			{
					mode: "tree",
					onChangeJSON: debounce(async (json) => {
							try {
									this.plugin.settings.pathsToExtractMetadata = json;
							} catch (error) {
									console.error("Error updating settings:", error);
							}
					}, 300),
					search: false,
					mainMenuBar: false,
			},
			this.plugin.settings.pathsToExtractMetadata,
		);
		new Setting(containerEl).addButton((button) => {
			button
				.setButtonText("Save Settings")
				.setCta()
				.onClick(async () => {
					await this.plugin.saveSettings();
				});
		});
	}
}

function debounce(func: (...args: any[]) => void, wait: number) {
	let timeout: NodeJS.Timeout;
	return (...args: any[]) => {
			clearTimeout(timeout);
			timeout = setTimeout(() => func(...args), wait);
	};
}