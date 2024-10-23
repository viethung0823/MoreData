import {Modal, App, ButtonComponent, TFile, Notice} from "obsidian";
import MoreDataPlugin from "src/main";
import {GenericTextSuggester} from "src/utils/generticTextSuggester";

export class CreateDataViewFileModal extends Modal {
	result: string;
	onSubmit: (result: string) => void;

	constructor(app: App, private plugin: MoreDataPlugin, onSubmit: (result: string) => void) {
		super(app);
		this.onSubmit = onSubmit;
	}

	onOpen() {
		const activeFile = this.plugin.getActiveMDFile();
		if (!(activeFile instanceof TFile)) {
			new Notice("There is no active file");
			return;
		}
		let {contentEl} = this;
		contentEl.createEl("h2", {text: "Create new Dataview file"});

		let form = contentEl.createEl("form");
		form.classList.add("create-dataview-file-form");
		let nameInput = form.createEl("input", {type: "text"});


		const activeFileSuggestion = activeFile?.basename + this.plugin.settings.dataviewSuffix;
		this.plugin.currentResolvedLinks = this.plugin.getActiveFileResolvedLinks(activeFile);
		const linkedCSVFilesSuggestions = [
			...new Set(
				this.plugin.currentResolvedLinks?.csv?.map(
					(link) =>
						link
							.split("/")
							.pop()
							?.replace(/\.[^/.]+$/, "") + this.plugin.settings.dataviewSuffix,
				),
			),
		];
		const allSuggestions = [activeFileSuggestion, ...linkedCSVFilesSuggestions];

		new GenericTextSuggester(this.app, nameInput, allSuggestions);

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
