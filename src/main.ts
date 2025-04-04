import { MarkdownView, Notice, Plugin, TFile, WorkspaceLeaf } from "obsidian";
import { MoreDataView, MORE_DATA_VIEW_TYPE, PLUGIN_ICON, PLUGIN_VIEW_ID } from "./view";
import { DEFAULT_SETTINGS, MoreDataSettings, MoreDataSettingTab } from "./settings";
import { CreateDataViewFileModal } from "./modal";
import { writeFile } from "fs";
import { parse } from "path";
import { exec as execCallback } from "child_process";
import { promisify } from "util";

const exec = promisify(execCallback);
const homeDir = process.env.HOME || process.env.USERPROFILE;
let obsidianConfigDir = ".obsidian";

if (!homeDir?.includes("viethung")) {
    obsidianConfigDir = ".obsidian_second_mac";
}
const defaultFilepathData = `${homeDir}/Library/Mobile Documents/iCloud~md~obsidian/Documents/Vault/${obsidianConfigDir}/plugins/more-data/resolvedLinks.json`
export default class MoreDataPlugin extends Plugin {
	settings: MoreDataSettings;
	activeLeaf: WorkspaceLeaf | null = null;
	workspace = this.app.workspace;
	currentResolvedLinks: Record<string, string[]> = {};

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new MoreDataSettingTab(this.app, this));

		this.addCommand({
			id: "create-new-dataview-file",
			name: "Create new Dataview file",
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

		this.addCommand({
			id: "get-resolved-links",
			name: "Get Resolved Links",
			callback: async () => {
				this.getResolvedLinks(this.settings.pathsToExtractMetadata);
			},
		});

		this.addCommand({
			id: "get_resolved_links_of_active_file",
			name: "Get Resolved Links Of Active File",
			callback: async () => {
				this.getResolvedLinksOfActiveFile();
			},
		});

		this.addCommand({
			id: "get_resolved_links_of_selected_file",
			name: "Get Resolved Links Of Selected File",
			callback: async () => {
				this.getResolvedLinksOfSelectedFile();
			},
		});

		this.addCommand({
			id: "get_resolved_links_from_active_workspace",
			name: "Get Resolved Links From Active Workspace",
			callback: async () => {
				this.getResolvedLinksFromActiveWorkspace();
			},
		});

		this.addCommand({
			id: "update_active_logs",
			name: "Update Active Logs",
			callback: async () => {
				this.updateActiveLogs();
			},
		});

		this.registerView(MORE_DATA_VIEW_TYPE, (leaf) => new MoreDataView(leaf));

		this.registerEvent(
			this.workspace.on("file-open", async (file) => {
				if (!(file instanceof TFile)) {
					return;
				}
				if (this.activeLeaf && this.activeLeaf.view) {
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
				this.currentResolvedLinks = this.getActiveFileResolvedLinks(file);
				if (!Object.keys(this.currentResolvedLinks).length) return;
				const firstFile = this.currentResolvedLinks?.csv?.[0] || this.currentResolvedLinks?.md?.[0];
				if (firstFile) {
					const firstCSVFile = this.app.vault.getAbstractFileByPath(firstFile);
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
				state: { file: csvFile.path, mode: "preview" },
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
				if (extension === "md" && (!filePath.includes(this.settings.dataviewSuffix) || !filePath.includes(this.settings.dataviewFolderPath)) && !this.settings.validMDFoldersPath.some((path) => filePath.includes(path))) {
					continue;
				}
				result[extension].push(filePath);
			}
		}

		return result;
	}

	renderLinks() {
		if (!this.activeLeaf) {
			console.error("activeLeaf is undefined");
			return;
		}

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

	getActiveMDFile() {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		const file = view?.file;
		return file;
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async getResolvedLinks(filepaths: Record<string, string>, filepathData: string = defaultFilepathData, successCallback?: () => void) {
		const resolvedLinks: Record<string, any> = {};
		const basePath = this.app.vault.getRoot().vault.adapter.basePath;

		for (const [key, path] of Object.entries(filepaths)) {
			const abstractFile = this.app.vault.getAbstractFileByPath(path);
			if (!(abstractFile instanceof TFile)) {
				console.error(`File not found or not a TFile: ${path}`);
				continue;
			}
			const fullPath = `${basePath}/${path}`;
			let resolvedMDLinkArr: string[] = [];
			let mergedLinks: any[] = [];

			if (abstractFile.extension === "md") {
				const fileMetadata = this.app.metadataCache.getFileCache(abstractFile);
				const resolvedLinkData = this.app.metadataCache.resolvedLinks[path];

				const resolvedLinkArr = Object.keys(resolvedLinkData).length > 0 ? Object.keys(resolvedLinkData) : [];
				resolvedMDLinkArr = resolvedLinkArr.filter((link) => link.endsWith(".md"));

				const frontMatterLinks = fileMetadata?.frontmatter?.["links"]?.filter((l: string) => this.isURLorScheme(l)) || [];

				mergedLinks = [...mergedLinks, ...resolvedMDLinkArr, ...frontMatterLinks].map((link) => {
					const isFilePath = this.isFilePath(link);
					return {
						fileName: this.getFilename(link),
						uri: isFilePath ? this.getFilepathURI(link) : link,
						uriGetResolvedLinkOfSelected: isFilePath ? this.getResolvedLinksOfSelectedURI(link) : "",
					};
				});

				const getMDLinkCommand = `"${homeDir}/Library/Mobile Documents/iCloud~md~obsidian/Documents/Vault/Data/Apps/Alfred/Scripts/Obsidian/GetLinkData/GetLinkData" "mdLink" "${fullPath}"`;
				try {
					const { stdout } = await exec(getMDLinkCommand);
					const goOutput = stdout ? JSON.parse(String(stdout)) : [];
					if (Array.isArray(goOutput)) {
						const convertedGoOutput = goOutput.map((link) => ({
							fileName: link["Title"],
							uri: link["Link"],
							uriGetResolvedLinkOfSelected: "",
						}));
						mergedLinks = [...mergedLinks, ...convertedGoOutput];
					}
				} catch (error) {
					console.error("Error executing Go binary or parsing output:", error);
				}
			}

			if (abstractFile.extension === "canvas") {
				const getCanvasLinkCommand = `"${homeDir}/Library/Mobile Documents/iCloud~md~obsidian/Documents/Vault/Data/Apps/Alfred/Scripts/Obsidian/GetLinkData/GetLinkData" "canvasLink" "${fullPath}"`;
				try {
					const { stdout } = await exec(getCanvasLinkCommand);
					const goOutput = stdout ? JSON.parse(String(stdout)) : [];
					if (Array.isArray(goOutput)) {
						const convertedGoOutput = goOutput.map((link) => {
							const absolutePath = this.app.metadataCache.getFirstLinkpathDest(link["Link"], "")?.path || "";
							return {
								fileName: link["Title"],
								uri: this.getFilepathURI(absolutePath),
								uriGetResolvedLinkOfSelected: this.getResolvedLinksOfSelectedURI(absolutePath),
							}
						});
						mergedLinks = [...mergedLinks, ...convertedGoOutput];
					}
				} catch (error) {
					console.error("Error executing Go binary or parsing output:", error);
				}
			}

			resolvedLinks[key] = {
				uri: this.getFilepathURI(path),
				resolvedLinks: mergedLinks,
			};
		}

		const jsonData = JSON.stringify(resolvedLinks, null, 2);
		writeFile(filepathData, jsonData, (err) => {
			if (err) {
				console.error("Error writing to file:", err);
			} else {
				new Notice("Resolved links saved!");
				console.log("Resolved links saved!");
				if (successCallback) {
					successCallback();
				}
			}
		});
	}

	getUniqueLinksByUri(links: { fileName: string, uri: string }[]): { fileName: string, uri: string }[] {
    const seenUris = new Set<string>();
    return links.filter(link => {
        if (seenUris.has(link.uri)) {
            return false;
        } else {
            seenUris.add(link.uri);
            return true;
        }
    });
	}

	getFilepathURI(filePath: string): string {
		const encodedFilePath = encodeURIComponent(filePath);
		return `obsidian://adv-uri?vault=${encodeURIComponent("Vault")}&filepath=${encodedFilePath}`;
	}

	getResolvedLinksOfSelectedURI(filePath: string): string {
		const encodedFilePath = encodeURIComponent(filePath);
		const commandid = "more-data:get_resolved_links_of_selected_file";
		return `obsidian://adv-uri?vault=${encodeURIComponent("Vault")}&selectedFilepath=${encodedFilePath}&commandid=${commandid}`;
	}

	getFilename(link: string): string {
		if (this.isFilePath(link)) {
			return parse(link).name;
		} else {
			return link
		}
	}

	isURLorScheme(str: string) {
    try {
        new URL(str);
        return true;
    } catch (_) {
        return false;
    }
	}

	isFilePath(str: string) {
    if (this.isURLorScheme(str)) {
        return false;
    }

    return true;
	}

	async getResolvedLinksOfActiveFile() {
		const activeFile = this.app.workspace.getActiveFile();
		if (activeFile instanceof TFile) {
			this.settings.pathsToExtractMetadata[activeFile.name] = activeFile.path;
			await this.saveSettings();
			this.getResolvedLinks(this.settings.pathsToExtractMetadata);
		}
	}

	async getResolvedLinksOfSelectedFile() {
		const data = this.app.plugins.plugins["obsidian-advanced-uri"].lastParameters as { selectedFilepath?: string };
		if (data?.selectedFilepath) {
			const selectedFilePath = {
				"obsidian:ShowResolvedLinks:getResolvedLinksOfSelected": data?.selectedFilepath,
			}
			const successCallback = () => {
				open("alfred://runtrigger/viethung0823.scripts/actions/?argument=obsidian%3AShowResolvedLinks%3AgetResolvedLinksOfSelected");
			}
			const path = `${homeDir}/Library/Mobile Documents/iCloud~md~obsidian/Documents/Vault/${obsidianConfigDir}/plugins/more-data/resolvedLinksOfSelectedFile.json`
			this.getResolvedLinks(selectedFilePath, path, successCallback);
		}
	}

	async getResolvedLinksFromActiveWorkspace() {
    const workspacesDataPath = `${obsidianConfigDir}/workspaces.json`;

    const workspacesData = JSON.parse(await this.app.vault.adapter.read(workspacesDataPath));

    const activeWorkspaceName = workspacesData.active;
    const activeWorkspace = workspacesData.workspaces[activeWorkspaceName].main.children;

    const activeWorkspacePaths: Record<string, string> = {};
    activeWorkspace.forEach((tabGroup: { children: { state: any; }[]; }) => {
        tabGroup.children.forEach((tab: { state: any; }) => {
            const state = tab.state;
            if (state.type === 'markdown' || state.type === 'canvas') {
                activeWorkspacePaths[state.title] = state.state.file;
            }
        });
    });

    this.settings.pathsToExtractMetadata = activeWorkspacePaths;
    await this.saveSettings();
    this.getResolvedLinks(this.settings.pathsToExtractMetadata);
	}

	async updateActiveLogs() {
		const activeLogsFilePath = `${homeDir}/Library/Mobile Documents/iCloud~md~obsidian/Documents/Vault/Data/json/Obsidian/activeLogs.json`;
		const activeFile = this.app.workspace.getActiveFile();
		const successMsg = "Active file path updated!";
		if (activeFile instanceof TFile) {
			const jsonData = {
				filepath: activeFile.path
			};
			writeFile(activeLogsFilePath, JSON.stringify(jsonData, null, 2), (err) => {
				if (err) {
					console.error("Error writing to file:", err);
				} else {
					new Notice(successMsg);
					console.log(successMsg);
				}
			});
		}
	}
}
