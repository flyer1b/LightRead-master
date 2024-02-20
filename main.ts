import { time } from 'console';
import { App, Notice, Plugin, PluginSettingTab, Setting,Vault,TFile, normalizePath, requestUrl, FileManager } from 'obsidian';

// Remember to rename these classes and interfaces!

interface SyncReadPluginSettings {
	email: string;
	password: string;
	token: string;
	time: string;
	apiKey: string;
}

const DEFAULT_SETTINGS: SyncReadPluginSettings = {
	email: '',
	password: '',
	token: '',
	time: '2020-01-01 00:00:00',
	apiKey: ''
}

var isWriting = false;

export default class SyncReadPlugin extends Plugin {
	settings: SyncReadPluginSettings;

	async onload() {
		await this.loadSettings();

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('sync', 'SyncRead', (evt: MouseEvent) => {
			// Called when the user clicks the icon.
			// new Notice('This is a notice!');
			// new Notice(`path: ${this.app.vault.getRoot().path}`);
			// craeteFile(this.app.vault);
			// new Notice(`token: ${this.settings.token}`);
		 	writeAllArticles(this.app,this);
		});
		

		// This adds a settings tab so the user can configure various aspects of the plugin
		// if(this.settings.token !== ''){
		// 	this.addSettingTab(new SettingsTab(this.app, this));
		// }else{
		// }
		this.addSettingTab(new SyncReadSettingTab(this.app, this));

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


class SyncReadSettingTab extends PluginSettingTab {
	plugin: SyncReadPlugin;

	constructor(app: App, plugin: SyncReadPlugin) {
		super(app, plugin);
		this.plugin = plugin;
		
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('用户名')
			.setDesc('输入你在SyncRead注册的邮箱')
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
						try{
						const res = await requestUrl({
							url:'http://43.138.149.38:5050/login/',
							method: 'POST',
							contentType: 'application/json',
							body: JSON.stringify({
									'username':email,
									'password':password
							
						})});
						if (res.status !== 200) {
							new Notice('登录失败');
							button.disabled = false;
							button.setButtonText('登录');
							return;
						}
						const data = await res.json;
						// new Notice(`res: ${JSON.stringify(data)}`);
						this.plugin.settings.token = data.data.token;
						await this.plugin.saveSettings();
						new Notice('登录成功');
						button.setButtonText('登录成功');
						button.disabled = false;
					}catch(error){
						new Notice('登录失败: ' + error.message);
						button.disabled = false;
						button.setButtonText('登录');
						return;
					}
					});
			})

		new Setting(containerEl)
			.setName('api key(可选)')
			.addText(text => text
				.setPlaceholder('请输入api key')
				.setValue(this.plugin.settings.apiKey)
				.onChange(async (value) => {
					this.plugin.settings.apiKey = value;
					await this.plugin.saveSettings();
				}));
	}
}


async function fetchArticle(settings: SyncReadPluginSettings,time: string,page: number){

	try {

	const apiKey = settings.apiKey;
	let res;
	if(apiKey === ''){
		res = await requestUrl(
		{
			url:`http://43.138.149.38:5050/get_synced_articles?time=${time}&page_number=${page}&page_size=50`, 
			method: 'GET',
			headers: {
				'Authorization': 'Bearer ' + settings.token
			},
		}
		);
	}else{
		res = await requestUrl(
			{
				url:`http://43.138.149.38:5050/get_synced_articles_by_key?time=${time}&page_number=${page}&page_size=50`, 
				method: 'GET',
				headers: {
					'api_key':  apiKey
				},
			}
			);
	}
	// new Notice(`token: ${settings.token}`);
	if (res.status !== 200) {
		new Notice('同步失败');
		isWriting = false;
		return;
	}
	const data = await res.json;
	// new Notice(`res: ${data.data.length}`);
	return data.data;
} catch (error) {
	new Notice('同步失败: ' + error.message);
	isWriting = false;
	return;
}
}

async function writeArticle(vault: Vault,fileManager:FileManager, article: { title: string, content: string ,site:string}): Promise<void> {
	var folder = vault.getAbstractFileByPath('SyncRead同步文件夹');
	if(!folder) folder = await vault.createFolder('SyncRead同步文件夹');
	new Notice('url: ' + article.site);
	let file = await vault.create(folder.path+'/'+filterIllegalChars(normalizePath(article.title)) + ".md", article.content);
	return fileManager.processFrontMatter(file,(frontMatter) => {
		frontMatter['created_at'] = new Date().toISOString();
		frontMatter['url'] = article.site;
	});
}

async function writeAllArticles(app: App,plugin: SyncReadPlugin){

	let vault = app.vault;
	let fileManager = app.fileManager;
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
			await Promise.all(articles.map((article: { title: string; content: string;site:string }) => writeArticle(vault, fileManager,article)));
		}catch(error){
			// new Notice(error.message);
			// isWriting = false;
			// return;
		}
		// new Notice(`page: ${page}`);
		plugin.settings.time = articles[articles.length-1].created_at;
		plugin.saveSettings();
		page++;
		await new Promise((resolve) => setTimeout(resolve, 1000));
		// new Notice(`page: ${page}`);
	}while(true);

}

function filterIllegalChars(title: string): string {
    // 定义非法字符
    const illegalChars = /[\\/:*?"<>|]/g;
    // 使用正则表达式替换非法字符
    const filteredTitle = title.replace(illegalChars, "");
    return filteredTitle;
}