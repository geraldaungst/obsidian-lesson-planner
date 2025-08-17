import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { FileService } from './src/services/FileService';
import { ParserService } from './src/services/ParserService';
import { ScheduleService } from './src/services/ScheduleService';
import { UnitAssignmentService } from './src/services/UnitAssignmentService';

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

		// Unit assignment command - now with real testing
		this.addCommand({
			id: 'assign-unit-to-class',
			name: 'Assign Unit to Class',
			callback: async () => {
				await this.assignUnitToClass();
			}
		});

		// NEW: Test real unit assignment with sample data
		this.addCommand({
			id: 'test-real-unit-assignment',
			name: 'Test Real Unit Assignment',
			callback: async () => {
				await this.testRealUnitAssignment();
			}
		});

		// Bump commands - placeholders for next steps
		this.addCommand({
			id: 'bump-single-class',
			name: 'Bump Single Class',
			callback: async () => {
				new Notice('Single class bump - coming in next step!');
			}
		});

		this.addCommand({
			id: 'bump-whole-day',
			name: 'Bump Whole Day',
			callback: async () => {
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
			
			// Use the unit assignment service (current list-only version)
			const result = await this.unitAssignmentService.assignUnitToClass();
			
			if (result.success) {
				const message = `✅ Unit assignment workflow ready! ${result.message}`;
				new Notice(message, 5000);
				console.log(message);
			} else {
				const errorMessage = `❌ Unit assignment failed: ${result.error}`;
				new Notice(errorMessage, 5000);
				console.error(errorMessage);
			}
		} catch (error) {
			console.error('Unit assignment error:', error);
			new Notice(`❌ Unit assignment error: ${error.message}`, 5000);
		}
	}

	/**
	 * NEW: Test the real unit assignment logic with sample data
	 * This will actually create daily plan files
	 */
	private async testRealUnitAssignment() {
		try {
			new Notice('🧪 Starting real unit assignment test...');
			
			// Get available units and classes for testing
			const availableUnits = await this.unitAssignmentService.getAvailableUnits();
			const availableClasses = await this.unitAssignmentService.getAvailableClasses();
			
			if (availableUnits.length === 0) {
				new Notice('❌ No units found for testing. Create a unit file first.');
				return;
			}
			
			if (availableClasses.length === 0) {
				new Notice('❌ No classes found for testing. Create a class file first.');
				return;
			}
			
			// Use the first available unit and class for testing
			const testUnit = availableUnits[0];
			const testClass = availableClasses[0];
			
			// Calculate test start date (next Monday)
			const testStartDate = this.getNextMonday();
			
			// Confirm with user before creating real files
			const confirmMessage = `Test assignment:\n• Unit: ${testUnit.name} (${testUnit.duration} days)\n• Class: ${testClass.name} (${testClass.dayOfWeek} ${testClass.time})\n• Start: ${testStartDate}\n\nThis will create real daily plan files. Continue?`;
			
			// For now, we'll skip the confirmation and proceed
			// Later we can add a proper confirmation modal
			new Notice(`Testing: ${testUnit.name} → ${testClass.name} starting ${testStartDate}`, 3000);
			
			// Execute real unit assignment
			const result = await this.unitAssignmentService.assignUnitToClassWithOptions({
				unitName: testUnit.name,
				className: testClass.name,
				startDate: testStartDate
			});
			
			if (result.success) {
				const successMessage = `✅ Real unit assignment test successful!\n${result.message}`;
				new Notice(successMessage, 8000);
				console.log('Real Unit Assignment Test Results:', result);
				
				// Show detailed results
				if (result.createdPlans > 0) {
					console.log(`📝 Created ${result.createdPlans} daily plan files`);
				}
				if (result.skippedPlans > 0) {
					console.log(`⏭️ Skipped ${result.skippedPlans} duplicate entries`);
				}
				if (result.scheduleWarnings > 0) {
					console.log(`⚠️ ${result.scheduleWarnings} schedule warnings need review`);
				}
				
			} else {
				const errorMessage = `❌ Real unit assignment test failed: ${result.error}`;
				new Notice(errorMessage, 5000);
				console.error('Real Unit Assignment Test Error:', result);
			}
			
		} catch (error) {
			console.error('Real unit assignment test error:', error);
			new Notice(`❌ Test error: ${error.message}`, 5000);
		}
	}

	/**
	 * Helper method to get next Monday's date in YYYY-MM-DD format
	 */
	private getNextMonday(): string {
		const today = new Date();
		const daysUntilMonday = (8 - today.getDay()) % 7;
		const nextMonday = new Date(today);
		nextMonday.setDate(today.getDate() + (daysUntilMonday === 0 ? 7 : daysUntilMonday));
		return nextMonday.toISOString().split('T')[0];
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