import {App, ButtonComponent, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile, TFolder, WorkspaceLeaf} from "obsidian";
import {MoreDataView, MORE_DATA_VIEW_TYPE, PLUGIN_ICON, PLUGIN_VIEW_ID} from "./view";
import {GenericTextSuggester} from "src/utils/generticTextSuggester";
import {DEFAULT_SETTINGS, MoreDataSettings, MoreDataSettingTab} from "./settings";

export class CreateDataViewFileModal extends Modal {
	result: string;
	onSubmit: (result: string) => void;

	constructor(app: App, private plugin: PreviewDataPlugin, onSubmit: (result: string) => void) {
		super(app);
		this.onSubmit = onSubmit;
	}

	onOpen() {
		let {contentEl} = this;
		contentEl.createEl("h2", {text: "Create new dataview file"});

		let form = contentEl.createEl("form");
		form.classList.add("create-dataview-file-form");
		let nameInput = form.createEl("input", {type: "text"});

		const activeFile = this.plugin.getActiveFile();
		const activeFileSuggestion = activeFile?.basename + this.plugin.settings.dataviewSuffix;
		const linkedCSVFilesSuggestions = [...new Set(this.plugin.currentResolvedLinks?.csv?.map((link) => link.split("/").pop() + this.plugin.settings.dataviewSuffix))];
		const allSuggestions = [activeFileSuggestion, ...linkedCSVFilesSuggestions];

		new GenericTextSuggester(this.app, nameInput, allSuggestions, false);

		let buttonWrapper = form.createEl("div");
		buttonWrapper.classList.add("create-dataview-file-button-wrapper");
		const cancelButton = new ButtonComponent(buttonWrapper);
		cancelButton.setButtonText("Cancel");
		const createButton = new ButtonComponent(buttonWrapper);
		createButton.setButtonText("Create");
		createButton.setDisabled(true);

		nameInput.addEventListener("input", () => {
			createButton.setDisabled(nameInput.value === "");
		});

		form.addEventListener("submit", (event) => {
			event.preventDefault();

			if (nameInput.value !== "") {
				this.result = nameInput.value;
				this.close();
				this.onSubmit(this.result);
			}
		});

		cancelButton.onClick(() => this.close());
	}

	onClose() {
		let {contentEl} = this;
		contentEl.empty();
	}
}

export default class PreviewDataPlugin extends Plugin {
	settings: MoreDataSettings;
	activeLeaf: WorkspaceLeaf | null = null;
	workspace = this.app.workspace;
	currentResolvedLinks: Record<string, string[]> = {};

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new MoreDataSettingTab(this.app, this));

		this.addCommand({
			id: "create-new-dataview-file",
			name: "Create new dataview file",
			callback: async () => {
				const templateFile = this.app.vault.getAbstractFileByPath(this.settings.dataviewTemplatePath);
				if (!(templateFile instanceof TFile)) {
					console.error("Template file not found");
					return;
				}

				const templateContent = await this.app.vault.read(templateFile);
				new CreateDataViewFileModal(this.app, this, async (result) => {
					try {
						const newFilePath = `${this.settings.dataviewFolderPath}/${result}.md`;
						const newFile = await this.app.vault.create(newFilePath, templateContent);
						await this.app.workspace.getLeaf().openFile(newFile);
					} catch (error) {
						new Notice("Failed to create new file: " + error.message);
					}
				}).open();
			},
		});

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
					this.activeLeaf.view.containerEl.id = PLUGIN_VIEW_ID;
					this.activeLeaf.view.getIcon = () => PLUGIN_ICON;
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
		const dataviewFolderPathRegex = new RegExp(this.settings.dataviewFolderPath);
		const allDataviewLinks = (this.currentResolvedLinks?.md || []).filter((link) => dataviewFolderPathRegex.test(link));
		const allLinks = [...(this.currentResolvedLinks?.csv || []), ...allDataviewLinks];

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
					spanItem.classList.add("dataview-link");
				}

				// Add a click event listener to the span
				spanItem.addEventListener("click", () => {
					const file = this.app.vault.getAbstractFileByPath(link);
					if (!(file instanceof TFile)) {
						console.error("file is not an instance of TFile");
						return;
					}
					this.setActiveLeafStateAndReveal(file);
				});
			});
		}
	}

	getActiveFile() {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		const file = view?.file;
		return file;
	}

	public getTemplateFiles(): TFile[] {
		if (!String.isString(this.settings.templateFolderPath)) return [];
		return this.app.vault.getFiles().filter((file) => file.path.startsWith(this.settings.templateFolderPath));
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}
}
