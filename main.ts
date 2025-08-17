import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { FileService } from './src/services/FileService';
import { ParserService } from './src/services/ParserService';
import { ScheduleService } from './src/services/ScheduleService';
import { UnitAssignmentService } from './src/services/UnitAssignmentService';
// TODO: Uncomment as we implement these services and modals
// import { ClassBumpService } from './src/services/ClassBumpService';
// import { UnitAssignmentModal } from './src/modals/UnitAssignmentModal';
// import { ClassBumpModal } from './src/modals/ClassBumpModal';
// import { WholeWeekBumpModal } from './src/modals/WholeWeekBumpModal';

interface LessonPlannerSettings {
	lessonPlanningRoot: string;
	enableDebugLogging: boolean;
}

const DEFAULT_SETTINGS: LessonPlannerSettings = {
	lessonPlanningRoot: '20 Lesson Planning',
	enableDebugLogging: false
}

export default class LessonPlannerPlugin extends Plugin {
	settings: LessonPlannerSettings;
	
	// Services
	fileService: FileService;
	parserService: ParserService;
	scheduleService: ScheduleService;
	unitAssignmentService: UnitAssignmentService;
	// TODO: Uncomment as we implement these services
	// classBumpService: ClassBumpService;

	async onload() {
		await this.loadSettings();
		
		// Initialize services
		await this.initializeServices();
		
		// Register commands
		this.registerCommands();

		// Add settings tab
		this.addSettingTab(new LessonPlannerSettingTab(this.app, this));

		console.log('Lesson Planner Plugin loaded successfully');
	}

	private async initializeServices() {
		try {
			// Initialize core services
			this.fileService = new FileService(this.app, this.settings.lessonPlanningRoot);
			this.parserService = new ParserService();
			this.scheduleService = new ScheduleService(this.fileService, this.parserService);
			
			// Initialize unit assignment service
			this.unitAssignmentService = new UnitAssignmentService(
				this.fileService, 
				this.parserService, 
				this.scheduleService
			);
			
			// TODO: Initialize these services as we implement them
			// this.classBumpService = new ClassBumpService(this.fileService, this.parserService, this.scheduleService);
			
			console.log('All services initialized successfully');
		} catch (error) {
			console.error('Error initializing services:', error);
			new Notice('Error initializing Lesson Planner services');
		}
	}

	private registerCommands() {
		// Test command
		this.addCommand({
			id: 'test-services',
			name: 'Test Services',
			callback: async () => {
				await this.testServices();
			}
		});

		// Unit assignment command - now with UnitAssignmentService
		this.addCommand({
			id: 'assign-unit-to-class',
			name: 'Assign Unit to Class',
			callback: async () => {
				await this.assignUnitToClass();
			}
		});

		// Bump commands - TODO: implement with ClassBumpModal and WholeWeekBumpModal
		this.addCommand({
			id: 'bump-single-class',
			name: 'Bump Single Class',
			callback: async () => {
				// TODO: new ClassBumpModal(this.app, this.classBumpService).open();
				new Notice('Single class bump - coming in next step!');
			}
		});

		this.addCommand({
			id: 'bump-whole-day',
			name: 'Bump Whole Day',
			callback: async () => {
				// TODO: new WholeWeekBumpModal(this.app, this.classBumpService).open();
				new Notice('Whole day bump - coming in next step!');
			}
		});
	}

	private async testServices() {
		try {
			// Use the existing FileService methods
			const units = await this.fileService.getFilesInFolder('Units');
			const classes = await this.fileService.getFilesInFolder('Classes');
			const holidays = await this.scheduleService.getHolidayDates();
			
			const message = `Services working! Found ${units.length} units, ${classes.length} classes, ${holidays.length} holidays`;
			new Notice(message);
			console.log(message);
		} catch (error) {
			console.error('Service test failed:', error);
			new Notice('Service test failed - check console for details');
		}
	}

	private async assignUnitToClass() {
		try {
			// Show progress
			new Notice('Starting unit assignment workflow...');
			
			// Use the unit assignment service
			const result = await this.unitAssignmentService.assignUnitToClass();
			
			if (result.success) {
				const message = `✅ Unit assignment completed! ${result.message}`;
				new Notice(message, 5000);
				console.log(message); // Add console logging for consistency
			} else {
				const errorMessage = `❌ Unit assignment failed: ${result.error}`;
				new Notice(errorMessage, 5000);
				console.error(errorMessage); // Use console.error for failures
			}
		} catch (error) {
			console.error('Unit assignment error:', error);
			new Notice(`❌ Unit assignment error: ${error.message}`, 5000);
		}
	}

	onunload() {
		console.log('Lesson Planner Plugin unloaded');
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
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

		new Setting(containerEl)
			.setName('Lesson Planning Root Folder')
			.setDesc('The root folder for all lesson planning files')
			.addText(text => text
				.setPlaceholder('20 Lesson Planning')
				.setValue(this.plugin.settings.lessonPlanningRoot)
				.onChange(async (value) => {
					this.plugin.settings.lessonPlanningRoot = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Enable Debug Logging')
			.setDesc('Enable detailed console logging for troubleshooting')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableDebugLogging)
				.onChange(async (value) => {
					this.plugin.settings.enableDebugLogging = value;
					await this.plugin.saveSettings();
				}));
	}
}