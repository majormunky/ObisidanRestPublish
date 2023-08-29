import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';


interface RestPublishSettings {
	token: string;
	publishUrl: string;
}

const DEFAULT_SETTINGS: RestPublishSettings = {
	token: '',
	publishUrl: ''
}

export default class RestPublishPlugin extends Plugin {
	settings: RestPublishSettings;

	async onload() {
		const { vault } = this.app;
		await this.loadSettings();

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		// const statusBarItemEl = this.addStatusBarItem();
		// statusBarItemEl.setText('Status Bar Text');

		// this.addRibbonIcon('dice', 'Greet', () => {
  		// 	new Notice('Hello, world!');
		// });

		this.registerEvent(
      		this.app.workspace.on("file-menu", (menu, file) => {
        		menu.addItem((item) => {
          			item
            			.setTitle("Publish File")
            			.setIcon("document")
            			.onClick(async () => {
            				this.app.selectedFileInfo = await this.getFrontmatter(file);
              				new PublishModal(this.app, async (result: Object) => {
              					let fileId = null;
								if ((this.app.selectedFileInfo) && (this.app.selectedFileInfo.id)) {
				  					fileId = this.app.selectedFileInfo.id;
			  					}
              					result.id = fileId;
              					await this.uploadFile(file, result);
              				}).open();
     					});
        		});
      		})
    	);

		// // This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new RestPublishSettingsTab(this.app, this));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async getFileId(file: File): number | null {
		const frontmatter = this.app.metadataCache.getFileCache(file).frontmatter;
		try {
			return frontmatter.id;
		} catch (error) {
			return null;
		}
	}

	async getFrontmatter(file: File): Object | null {
		const frontmatter = this.app.metadataCache.getFileCache(file).frontmatter;
		try {
			return frontmatter.webInfo;
		} catch (error) {
			return null;
		}
	}

	async uploadFile(file: File, info: Object) {
		const fileObj = await this.app.vault.read(file);
		const fileBlob = new Blob([fileObj], {type: file.type});
		const data = new FormData();
		data.append('markdown_file', fileBlob, file.name);
		data.append('title', info.title);
		data.append("slug", "test");
		data.append("publish_date", info.publishDate);

		let url = this.settings.publishUrl;
		let method = "POST";

		if (info.id) {
			url += `${info.id}/`;
			method = "PATCH";
		}

		const headers = new Headers();
		headers.append("Authorization", `Token ${this.settings.token}`);

		const res = await fetch(url, {
			method: method,
			headers: headers,
			body: data
		});

		const jsonData = await res.json();

		if (res.ok) {
			// Update frontmatter with data about post
			app.fileManager.processFrontMatter(file, (data) => {
				data.webInfo = jsonData;
			});

			new Notice("Document Published!");
		} else {
			new Notice("File Upload Failed: " + res.status + " " + res.statusText + " " + res.body);
		}
	}
}


class ResultModal extends Modal {
	content: Object;

	constructor(app: App, content: Object) {
		super(app);
		this.content = content;
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.empty();

		contentEl.createEl("p", { text: JSON.stringify(this.content) });
	}
}

class PublishModal extends Modal {
	status: string;
	title: string;
	publishDate: string;

	onSubmit: (result: Object) => void;

	constructor(app: App, onSubmit: (result: Object) => void) {
		super(app);
		this.info = app.selectedFileInfo;
		this.onSubmit = onSubmit;
		this.status = this.info?.status || "draft";
		this.publishDate = this.info?.publish_date || "";
		this.title = this.info?.title || "";
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.createEl("h1", { text: "Publish Settings:" });

        new Setting(contentEl)
      		.setName("Title")
      		.addText((text) => text
      			.setValue(this.title)
      			.onChange((value) => {
          			this.title = value
        		}
        	));

        new Setting(contentEl)
      		.setName("Publish Date")
      		.addText((text) => text
      			.setValue(this.publishDate)
      			.onChange((value) => {
          			this.publishDate = value
        		}
        	));

        new Setting(contentEl)
  			.setName('Status')
  			.setDesc('Here you can set the status')
  			.addDropdown(dropDown => { dropDown
  				.addOption('draft', 'Draft')
  				.addOption('published', 'Published')
  				.setValue(this.status)
  				.onChange(async (value) =>	{
  					this.status = value;
  				});
  			});	

    	new Setting(contentEl)
      		.addButton((btn) =>
        		btn
          			.setButtonText("Submit")
          			.setCta()
          			.onClick(() => {
            			this.close();
            			this.onSubmit({
            				status: this.status,
			  				title: this.title,
			  				publishDate: this.publishDate
            			});
          			}));
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

class RestPublishSettingsTab extends PluginSettingTab {
	plugin: RestPublishPlugin;

	constructor(app: App, plugin: RestPublishPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Token')
			.setDesc('Enter your token')
			.addText(text => text
				.setPlaceholder('Enter your token')
				.setValue(this.plugin.settings.token)
				.onChange(async (value) => {
					this.plugin.settings.token = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Publish URL')
			.setDesc('Enter your publish URL')
			.addText(text => text
				.setPlaceholder('Enter your publish URL')
				.setValue(this.plugin.settings.publishUrl)
				.onChange(async (value) => {
					this.plugin.settings.publishUrl = value;
					await this.plugin.saveSettings();
				}));
	}
}
