import {AbstractInputSuggest, App, TAbstractFile, TFolder} from "obsidian";

export class GenericTextSuggester extends AbstractInputSuggest<string> {
	private paths: string[];

	constructor(public app: App, public inputEl: HTMLInputElement, paths: string[]) {
		super(app, inputEl);
		this.paths = paths;
	}

	getSuggestions(inputStr: string): string[] {
		const lowerCaseInputStr = inputStr.toLowerCase();
		return this.paths.filter((path) => path.toLowerCase().includes(lowerCaseInputStr));
	}

	renderSuggestion(path: string, el: HTMLElement): void {
		el.setText(path);
	}

	selectSuggestion(path: string): void {
		this.inputEl.value = path;
		this.inputEl.trigger("input");
		this.close();
	}
}
