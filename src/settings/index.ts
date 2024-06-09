import PreviewDataPlugin from "src/main";
import {PluginSettingTab, App, Setting, TFolder} from "obsidian";
import {GenericTextSuggester} from "src/utils/generticTextSuggester";

export interface MoreDataSettings {
	dataviewFolderPath: string;
	dataviewTemplatePath: string;
	templateFolderPath: string;
	dataviewSuffix: string;
}

export const DEFAULT_SETTINGS: MoreDataSettings = {
	dataviewFolderPath: "",
	dataviewTemplatePath: "",
	templateFolderPath: "",
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
			.setName("Template folder path")
			.setDesc("Use for template files suggestion")
			.addText((text) => {
				{
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
						.setValue(this.plugin.settings.templateFolderPath)
						.onChange(async (value) => {
							this.plugin.settings.templateFolderPath = value;
							await this.plugin.saveSettings();
							this.display(); // Refresh the settings tab
						});
				}
			});

		new Setting(containerEl)
			.setName("Dataview template path")
			.setDesc("Tempalte file to use for dataview files")
			.addSearch((search) => {
				const templates: string[] = this.plugin.getTemplateFiles().map((f) => f.path);
				if (!this.plugin.settings.dataviewTemplatePath) {
					search.setPlaceholder("Template path");
				}
				search.setValue(this.plugin.settings.dataviewTemplatePath);
				new GenericTextSuggester(this.app, search.inputEl, templates, false, 50);
				return search.onChange(async (value) => {
					this.plugin.settings.dataviewTemplatePath = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Dataview folder path")
			.setDesc("Folder to save all dataview files")
			.addText((text) => {
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
			.addText((text) => {
				{
					return text.setValue(this.plugin.settings.dataviewSuffix).onChange(async (value) => {
						this.plugin.settings.dataviewSuffix = value;
						await this.plugin.saveSettings();
					});
				}
			});
	}
}
