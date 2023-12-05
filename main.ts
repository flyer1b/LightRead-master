import { time } from 'console';
import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting,Vault,TFile } from 'obsidian';

// Remember to rename these classes and interfaces!

interface MyPluginSettings {
	email: string;
	password: string;
	token: string;
	time: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	email: '',
	password: '',
	token: '',
	time: '2020-01-01 00:00:00',
}

var isWriting = false;

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		await this.loadSettings();

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('sync', '轻阅', (evt: MouseEvent) => {
			// Called when the user clicks the icon.
			// new Notice('This is a notice!');
			// new Notice(`path: ${this.app.vault.getRoot().path}`);
			// craeteFile(this.app.vault);
			// new Notice(`token: ${this.settings.token}`);
		 	writeAllArticles(this.app.vault,this);
		});
		// Perform additional things with the ribbon
		ribbonIconEl.addClass('my-plugin-ribbon-class');

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('Status Bar Text');

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'open-sample-modal-simple',
			name: 'Open sample modal (simple)',
			callback: () => {
				new SampleModal(this.app).open();
			}
		});
		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'sample-editor-command',
			name: 'Sample editor command',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				console.log(editor.getSelection());
				editor.replaceSelection('Sample Editor Command');
			}
		});
		// This adds a complex command that can check whether the current state of the app allows execution of the command
		this.addCommand({
			id: 'open-sample-modal-complex',
			name: 'Open sample modal (complex)',
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						new SampleModal(this.app).open();
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		// if(this.settings.token !== ''){
		// 	this.addSettingTab(new SettingsTab(this.app, this));
		// }else{
		// }
		this.addSettingTab(new SampleSettingTab(this.app, this));


		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt);
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	onunload() {
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		// this.settings.time = '2020-01-01 00:00:00';
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
		
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('用户名')
			.setDesc('输入你在轻阅注册的邮箱')
			.addText(text => text
				.setPlaceholder('请输入邮箱')
				.setValue(this.plugin.settings.email)
				.onChange(async (value) => {
					this.plugin.settings.email = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('密码')
			.setDesc('')
			.addText(text => text
				.setPlaceholder('请输入密码')
				.setValue(this.plugin.settings.password)
				.onChange(async (value) => {
					this.plugin.settings.password = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.addButton(button => {
				button
					.setButtonText('登录')
					.onClick(async () => {
						button.disabled = true;
						button.setButtonText('登录中...');
						const {email, password} = this.plugin.settings;
						// new Notice(`email: ${email}`);
						const res = await fetch('http://129.226.195.147:5050/login/', {
							method: 'POST',
							headers: {	
								'Content-Type': 'application/json'
							},
							body: JSON.stringify({
									'username':email,
									'password':password
							
						})});
						if (!res.ok) {
							new Notice('登录失败');
							button.disabled = false;
							button.setButtonText('登录');
							return;
						}
						const data = await res.json();
						// new Notice(`res: ${JSON.stringify(data)}`);
						this.plugin.settings.token = data.data.token;
						await this.plugin.saveSettings();
						new Notice('登录成功');
						button.setButtonText('登录成功');
						button.disabled = false;
					});
			})
	}
}

class SettingsTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
		
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('用户名')
			.setDesc(this.plugin.settings.email)
			.addButton(button => {
				button
					.setButtonText('退出登录')
					.onClick(async () => {
						this.plugin.settings.token = '';
						await this.plugin.saveSettings();
					
						new Notice('退出登录成功');
					});
			});
			   
	}
}


async function fetchArticle(settings: MyPluginSettings,time: string,page: number){

	try {
	const res = await fetch(`http://129.226.195.147:5050/get_synced_articles?time=${time}&page_number=${page}&page_size=50`, {
		method: 'GET',
		headers: {
			'Authorization': 'Bearer ' + settings.token
		}
		});
	// new Notice(`token: ${settings.token}`);
	if (!res.ok) {
		new Notice('同步失败');
		isWriting = false;
		return;
	}
	const data = await res.json();
	// new Notice(`res: ${data.data.length}`);
	return data.data;
} catch (error) {
	new Notice('同步失败: ' + error.message);
	isWriting = false;
	return;
}
}

async function writeArticle(vault: Vault, article: { title: string, content: string }): Promise<TFile> {
	var folder = vault.getAbstractFileByPath('轻阅同步文件夹');
	if(!folder) folder = await vault.createFolder('轻阅同步文件夹');
	return vault.create(folder.path+'/'+sanitizeFilename(article.title) + ".md", article.content);
}

async function writeAllArticles(vault: Vault,plugin: MyPlugin){

	new Notice(isWriting ? '正在同步' : '开始同步');
	if(isWriting) return;
		isWriting = true;
	var time = plugin.settings.time;
	var page = 1;
	// new Notice(`time: ${time}`);
	do{
		
		const articles = await fetchArticle(plugin.settings,time,page);
		if (articles.length === 0) {
			isWriting = false;
			new Notice('同步完成');
			break;	
		}
		try{
			await Promise.all(articles.map((article: { title: string; content: string; }) => writeArticle(vault, article)));
		}catch(error){
			new Notice(error.message);
			isWriting = false;
			return;
		}
		// new Notice(`page: ${page}`);
		plugin.settings.time = articles[articles.length-1].created_at;
		plugin.saveSettings();
		page++;
		// new Notice(`page: ${page}`);
	}while(true);

}

function sanitizeFilename(filename: string): string {
	return filename.replace(/[\\/:\*\?"<>\|]/g, '_');
  }