// Credits go to chhoumann's Quick Add Plugin: https://github.com/chhoumann/quickadd

import {TextInputSuggest} from "./suggest";
import type {App} from "obsidian";

export class GenericTextSuggester extends TextInputSuggest<string> {
	constructor(public app: App, public inputEl: HTMLInputElement | HTMLTextAreaElement, private items: string[], private showSuggestionsWhenEmpty: boolean = true, private maxSuggestions = Infinity) {
		super(app, inputEl);
	}

	getSuggestions(inputStr: string): string[] {
		if (!inputStr && !this.showSuggestionsWhenEmpty) {
			return [];
		}
		const inputLowerCase: string = inputStr.toLowerCase();

		const filtered = this.items.filter((item) => {
			if (item.toLowerCase().contains(inputLowerCase)) return item;
		});

		if (!filtered) this.close();

		const limited = filtered.slice(0, this.maxSuggestions);

		return limited;
	}

	selectSuggestion(item: string): void {
		this.inputEl.value = item;
		this.inputEl.trigger("input");
		this.close();
	}

	renderSuggestion(value: string, el: HTMLElement): void {
		if (value) el.setText(value);
	}
}
