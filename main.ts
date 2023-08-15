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
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('Status Bar Text');

		this.addRibbonIcon('dice', 'Greet', () => {
  			new Notice('Hello, world!');
		});

		this.registerEvent(
      		this.app.workspace.on("file-menu", (menu, file) => {
        		menu.addItem((item) => {
          			item
            			.setTitle("Publish File 👈")
            			.setIcon("document")
            			.onClick(async () => {
              				new PublishModal(this.app, (result: Object) => {
              					// let fileStatus = await this.getFileId(file);
	              				// if (fileStatus) {
	              				// 	this.uploadFile(file, result, fileStatus)
	              				// } else {
	              				// 	this.uploadFile(file, result)
	              				// }
	              				console.log(result);
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

	async uploadFile(file: File, info: Object, id: number | null) {
		const title = file.name.split('.')[0];
		const fileObj = await this.app.vault.read(file);
		const fileBlob = new Blob([fileObj], {type: file.type});
		const data = new FormData();
		data.append('markdown_file', fileBlob, file.name);
		data.append('title', title);
		data.append("slug", title);
		data.append("publish_date", "2023-07-01")

		let url = this.settings.publishUrl;

		if (id) {
			url += `/${id}/`	
		}

		const headers = new Headers();
		headers.append("Authorization", `Token ${this.settings.token}`);

		const res = await fetch(url, {
			method: 'POST',
			headers: headers,
			body: data
		});

		if (res.ok) {
			new Notice("File Uploaded");
		} else {
			new Notice("File Upload Failed: " + res.status + " " + res.statusText);
		}
	}
}

class PublishModal extends Modal {
	status: string;
	title: string;

	onSubmit: (result: Object) => void;

	constructor(app: App, onSubmit: (result: Object) => void) {
		super(app);
		this.onSubmit = onSubmit;
		this.status = "draft";
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.createEl("h1", { text: "Publish Settings:" });

        new Setting(contentEl)
      		.setName("Title")
      		.addText((text) =>
        		text.onChange((value) => {
          		this.title = value
        	}));

        new Setting(contentEl)
  			.setName('Status')
  			.setDesc('Here you can set the status')
  			.addDropdown(dropDown => {
  				dropDown.addOption('draft', 'Draft');
  				dropDown.addOption('published', 'Published');
  				dropDown.onChange(async (value) =>	{
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
			  				title: this.title
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
