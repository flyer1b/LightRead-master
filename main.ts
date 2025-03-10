import { FolderSuggest } from 'file_suggest';
import { App, Notice, Plugin, PluginSettingTab, Setting,Vault,TFile, normalizePath, requestUrl, FileManager } from 'obsidian';

// Remember to rename these classes and interfaces!

interface SyncReadPluginSettings {
	email: string;
	password: string;
	token: string;
	time: string;
	noteTime: string;
	apiKey: string;
	articleFolder: string;
	noteFolder: string;
}

const DEFAULT_SETTINGS: SyncReadPluginSettings = {
	email: '',
	password: '',
	token: '',
	time: '2020-01-01 00:00:00',
	noteTime: '2024-03-09T10:37:49',
	apiKey: '',
	articleFolder: '',
	noteFolder: ''
}

var isWriting = false;

export default class SyncReadPlugin extends Plugin {
	settings: SyncReadPluginSettings;

	async onload() {
		await this.loadSettings();

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('sync', 'SyncRead',async (evt: MouseEvent)  => {
			// Called when the user clicks the icon.
			// new Notice('This is a notice!');
			// new Notice(`path: ${this.app.vault.getRoot().path}`);
			// craeteFile(this.app.vault);
			// new Notice(`token: ${this.settings.token}`);
		 	await writeAllArticles(this.app,this);
			writeAllNote(this.app,this);
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

		// new Setting(containerEl)
		// 	.setName('用户名')
		// 	.setDesc('输入你在SyncRead注册的邮箱')
		// 	.addText(text => text
		// 		.setPlaceholder('请输入邮箱')
		// 		.setValue(this.plugin.settings.email)
		// 		.onChange(async (value) => {
		// 			this.plugin.settings.email = value;
		// 			await this.plugin.saveSettings();
		// 		}));
		// new Setting(containerEl)
		// 	.setName('密码')
		// 	.setDesc('')
		// 	.addText(text => text
		// 		.setPlaceholder('请输入密码')
		// 		.setValue(this.plugin.settings.password)
		// 		.onChange(async (value) => {
		// 			this.plugin.settings.password = value;
		// 			await this.plugin.saveSettings();
		// 		}));
		// new Setting(containerEl)
		// 	.addButton(button => {
		// 		button
		// 			.setButtonText('登录')
		// 			.onClick(async () => {
		// 				button.disabled = true;
		// 				button.setButtonText('登录中...');
		// 				const {email, password} = this.plugin.settings;
		// 				// new Notice(`email: ${email}`);
		// 				try{
		// 				const res = await requestUrl({
		// 					url:'http://43.138.149.38:5050/login/',
		// 					method: 'POST',
		// 					contentType: 'application/json',
		// 					body: JSON.stringify({
		// 							'username':email,
		// 							'password':password
							
		// 				})});
		// 				if (res.status !== 200) {
		// 					new Notice('登录失败');
		// 					button.disabled = false;
		// 					button.setButtonText('登录');
		// 					return;
		// 				}
		// 				const data = await res.json;
		// 				// new Notice(`res: ${JSON.stringify(data)}`);
		// 				this.plugin.settings.token = data.data.token;
		// 				await this.plugin.saveSettings();
		// 				new Notice('登录成功');
		// 				button.setButtonText('登录成功');
		// 				button.disabled = false;
		// 			}catch(error){
		// 				new Notice('登录失败: ' + error.message);
		// 				button.disabled = false;
		// 				button.setButtonText('登录');
		// 				return;
		// 			}
		// 			});
		// 	})

		new Setting(containerEl)
			.setName('api key')
			.addText(text => text
				.setPlaceholder('请输入api key')
				.setValue(this.plugin.settings.apiKey)
				.onChange(async (value) => {
					this.plugin.settings.apiKey = value;
					await this.plugin.saveSettings();
				}));
		
		new Setting(containerEl)
		.setName('文章文件夹')
		// .setDesc('同步文章保存的文件夹')
		.addSearch(search => {
			new FolderSuggest(this.app, search.inputEl)
			search
			.setPlaceholder('请输入文件夹路径')
			.setValue(this.plugin.settings.articleFolder)
			.onChange(async (value) => {
				this.plugin.settings.articleFolder = value
				// new Notice(`value: ${value}`);
				await this.plugin.saveSettings()
			})
		}
		);
	
		new Setting(containerEl)
		.setName('标注文件夹')
		// .setDesc('同步标注保存的文件夹')
		.addSearch(search => {
			new FolderSuggest(this.app, search.inputEl)
			search
			.setPlaceholder('请输入文件夹路径')
			.setValue(this.plugin.settings.noteFolder)
			.onChange(async (value) => {
				this.plugin.settings.noteFolder = value
				// new Notice(`value: ${value}`);
				await this.plugin.saveSettings()
			})
		}
		);
		}
}


async function fetchArticle(settings: SyncReadPluginSettings,time: string,page: number){

	try {

	const apiKey = settings.apiKey;
	let res;
	if(apiKey === ''){
		
		new Notice('请填写api key');
	}else{
		res = await requestUrl(
			{
				url:`http://101.32.116.127:5050/get_synced_articles_by_key?time=${time}&page_number=${page}&page_size=50`, 
				method: 'GET',
				headers: {
					'api_key':  apiKey
				},
			}
			);
			if (res.status !== 200) {
				new Notice('同步文章失败');
				isWriting = false;
				return;
			}
			const data = await res.json;
			// new Notice(`res: ${data.data.length}`);
			return data.data;
	}
	// new Notice(`token: ${settings.token}`);
	
} catch (error) {
	new Notice('同步失败: ' + error.message);
	isWriting = false;
	return;
}
}

async function fetchNote(settings: SyncReadPluginSettings,time: string,page: number){
	
	try {

	const apiKey = settings.apiKey;
	let res;
	if(apiKey === ''){
		
		new Notice('请填写api key');
	}else{
		res = await requestUrl(
			{
				url:`http://101.32.116.127:5050/get_notes_by_key?time=${time}&page_number=${page}&page_size=50`, 
				method: 'GET',
				headers: {
					'api_key':  apiKey
				},
			}
			);
			if (res.status !== 200) {
				new Notice('同步标注失败');
				isWriting = false;
				return;
			}
			const data = await res.json;
			// new Notice(`res: ${data.data.length}`);
			if(data.code===0){
				return data.data;
			}else{
				new Notice(data.message);
				isWriting = false;
				return;
			
			}
	}
} catch (error) {
	new Notice('同步失败: ' + error.message);
	isWriting = false;
	return;
}
}

async function writeArticle(settings:SyncReadPluginSettings,vault: Vault,fileManager:FileManager, article: { title: string, content: string ,site:string}): Promise<void> {
	var folder:String|undefined = settings.articleFolder;
	if( folder === ''){
		folder = vault.getAbstractFileByPath('SyncRead同步文件夹')?.path;
		if(!folder) folder = (await vault.createFolder('SyncRead同步文件夹')).path;
	}
	// new Notice('url: ' + article.site);
	let file = await vault.create(folder+'/'+filterIllegalChars(normalizePath(article.title)) + ".md", article.content);
	return fileManager.processFrontMatter(file,(frontMatter) => {
		frontMatter['created_at'] = new Date().toISOString();
		frontMatter['url'] = article.site;
	});
}

async function writeNote(settings:SyncReadPluginSettings,vault: Vault,fileManager:FileManager, note: {id:string; text: string; annotation: string;articleTitle:string;update_at:string }): Promise<void> {
	var noteFolder:String|undefined = settings.noteFolder;

	if( noteFolder === ''){
		noteFolder = vault.getAbstractFileByPath('SyncRead同步文件夹/标注')?.path;
		if(!noteFolder) noteFolder = (await vault.createFolder('SyncRead同步文件夹/标注')).path;
	}
	
	let noteFile = vault.getAbstractFileByPath(noteFolder+'/[标注]'+filterIllegalChars(normalizePath(note.articleTitle)) + ".md");
	if(!noteFile) {
		noteFile = await vault.create(noteFolder+'/[标注]'+filterIllegalChars(normalizePath(note.articleTitle)) + ".md", "\n");
		fileManager.processFrontMatter(noteFile as TFile,(frontMatter) => {
			frontMatter['originArticle'] = `[[${filterIllegalChars(normalizePath(note.articleTitle))}]]`;
		});
	}
	let noteText = note.text.replace(/\n+$/, "");  // Remove trailing newlines

	let noteTextWithQuotes = "\n\n\n>" + noteText.replace(/\n/g, "\n>");
	// new Notice(noteTextWithQuotes);
	return vault.append(noteFile as TFile,noteTextWithQuotes+"\n\n"+(note.annotation!==null?note.annotation:""));
	
}

async function writeAllNote(app: App,plugin: SyncReadPlugin){
	let vault = app.vault;
	let fileManager = app.fileManager;
	if(isWriting) return;
		isWriting = true;
	var time = plugin.settings.noteTime;
	var page = 1;
	do{
		
		const notes = await fetchNote(plugin.settings,time,page);
		if (notes.length === 0) {
			isWriting = false;
			new Notice('同步标注完成');
			break;	
		}
		try{
			await Promise.all(notes.map((note: {id:string; text: string; annotation: string;articleTitle:string;update_at:string }) => writeNote(vault, fileManager,note)));
		}catch(error){
			// new Notice(error.message);
			// isWriting = false;
			// return;
		}
		// new Notice(`page: ${page}`);
		plugin.settings.noteTime = notes[notes.length-1].update_at;
		plugin.saveSettings();
		page++;
		await new Promise((resolve) => setTimeout(resolve, 1000));
		// new Notice(`page: ${page}`);
	}while(true);
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
			new Notice('同步文章完成');
			break;	
		}
		try{
			await Promise.all(articles.map((article: { title: string; content: string;site:string }) => writeArticle(plugin.settings,vault, fileManager,article)));
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