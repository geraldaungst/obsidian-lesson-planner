import { App, Plugin, PluginSettingTab, Setting, Notice, TFile } from 'obsidian';

// Core Services
import { FileService } from './src/services/FileService';
import { ScheduleService } from './src/services/ScheduleService';
import { ParserService } from './src/services/ParserService';
import { IndexService } from './src/services/IndexService';

interface LessonPlannerSettings {
	lessonPlanningRoot: string;
	enableWeeklyView: boolean;
	enablePBLFeatures: boolean;
	defaultPBLFramework: 'Gold Standard' | 'PBL Essentials' | 'Custom';
}

const DEFAULT_SETTINGS: LessonPlannerSettings = {
	lessonPlanningRoot: '20 Lesson Planning',
	enableWeeklyView: true,
	enablePBLFeatures: true,
	defaultPBLFramework: 'Gold Standard'
}

export default class LessonPlannerPlugin extends Plugin {
	settings: LessonPlannerSettings;
	
	// Core Services
	private fileService: FileService;
	private scheduleService: ScheduleService;
	private parserService: ParserService;
	private indexService: IndexService;

	async onload() {
		await this.loadSettings();
		
		// Initialize core services
		this.initializeServices();
		
		// Register commands
		this.registerCommands();
		
		// Add settings tab
		this.addSettingTab(new LessonPlannerSettingTab(this.app, this));
		
		// Initialize plugin
		await this.initialize();
		
		console.log('Lesson Planner Plugin loaded successfully');
	}

	onunload() {
		console.log('Lesson Planner Plugin unloaded');
	}

	private initializeServices() {
		this.fileService = new FileService(this.app, this.settings.lessonPlanningRoot);
		this.scheduleService = new ScheduleService(this.fileService);
		this.parserService = new ParserService();
		this.indexService = new IndexService(this.fileService, this.parserService);
	}

	private registerCommands() {
		// Open Weekly View
		this.addCommand({
			id: 'open-weekly-view',
			name: 'Open Weekly View',
			callback: () => {
				new Notice('Weekly View coming soon!');
			}
		});

		// Quick Unit Assignment
		this.addCommand({
			id: 'assign-unit',
			name: 'Assign Unit to Class',
			callback: () => {
				new Notice('Unit Assignment coming soon!');
			}
		});

		// Create PBL Project
		this.addCommand({
			id: 'create-pbl-project',
			name: 'Create PBL Project',
			callback: () => {
				new Notice('PBL Project Creation coming soon!');
			}
		});
	}

	private async initialize() {
		// Validate lesson planning folder structure
		const rootExists = await this.fileService.folderExists(this.settings.lessonPlanningRoot);
		if (!rootExists) {
			new Notice(
				`Lesson Planning folder "${this.settings.lessonPlanningRoot}" not found. Please check your settings.`,
				5000
			);
			return;
		}

		// Initialize indexes
		await this.indexService.buildIndexes();
		
		new Notice('Lesson Planner initialized successfully!');
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		
		// Reinitialize services if root folder changed
		this.initializeServices();
		await this.initialize();
	}

	// Getters for other components to access services
	getFileService(): FileService { return this.fileService; }
	getScheduleService(): ScheduleService { return this.scheduleService; }
	getParserService(): ParserService { return this.parserService; }
	getIndexService(): IndexService { return this.indexService; }
}

class LessonPlannerSettingTab extends PluginSettingTab {
	plugin: LessonPlannerPlugin;

	constructor(app: App, plugin: LessonPlannerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;
		containerEl.empty();

		containerEl.createEl('h2', {text: 'Lesson Planner Settings'});

		// Lesson Planning Root Folder
		new Setting(containerEl)
			.setName('Lesson Planning Root Folder')
			.setDesc('The folder containing your lesson planning structure')
			.addText(text => text
				.setPlaceholder('20 Lesson Planning')
				.setValue(this.plugin.settings.lessonPlanningRoot)
				.onChange(async (value) => {
					this.plugin.settings.lessonPlanningRoot = value;
					await this.plugin.saveSettings();
				}));

		// Weekly View Toggle
		new Setting(containerEl)
			.setName('Enable Weekly View')
			.setDesc('Enable the interactive weekly planning dashboard')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableWeeklyView)
				.onChange(async (value) => {
					this.plugin.settings.enableWeeklyView = value;
					await this.plugin.saveSettings();
				}));

		// PBL Features Toggle
		new Setting(containerEl)
			.setName('Enable PBL Features')
			.setDesc('Enable Project-Based Learning planning tools')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enablePBLFeatures)
				.onChange(async (value) => {
					this.plugin.settings.enablePBLFeatures = value;
					await this.plugin.saveSettings();
				}));

		// Default PBL Framework
		new Setting(containerEl)
			.setName('Default PBL Framework')
			.setDesc('Choose the default framework for new PBL projects')
			.addDropdown(dropdown => dropdown
				.addOption('Gold Standard', 'Gold Standard PBL')
				.addOption('PBL Essentials', 'PBL Essentials')
				.addOption('Custom', 'Custom Framework')
				.setValue(this.plugin.settings.defaultPBLFramework)
				.onChange(async (value) => {
					this.plugin.settings.defaultPBLFramework = value as any;
					await this.plugin.saveSettings();
				}));
	}
}