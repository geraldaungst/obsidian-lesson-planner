import { App, Plugin, PluginSettingTab, Setting, Notice } from 'obsidian';
import { LessonPlannerSettings, DEFAULT_SETTINGS } from './src/types';
import { FileService } from './src/services/FileService';
import { ParserService } from './src/services/ParserService';
import { ScheduleService } from './src/services/ScheduleService';

export default class LessonPlannerPlugin extends Plugin {
    settings: LessonPlannerSettings;
    
    // Core services
    fileService: FileService;
    parserService: ParserService;
    scheduleService: ScheduleService;

    async onload() {
        console.log('Loading Lesson Planner Plugin...');
        
        await this.loadSettings();
        
        // Initialize services
        this.initializeServices();
        
        // Register commands
        this.registerCommands();
        
        // Add settings tab
        this.addSettingTab(new LessonPlannerSettingTab(this.app, this));
        
        // Add ribbon icon
        this.addRibbonIcon('calendar-days', 'Lesson Planner', () => {
            new Notice('Lesson Planner is active!');
        });
        
        console.log('Lesson Planner Plugin loaded successfully');
    }

    onunload() {
        console.log('Unloading Lesson Planner Plugin...');
        
        // Clean up services
        if (this.fileService) {
            this.fileService.invalidateCache();
        }
        if (this.parserService) {
            this.parserService.clearCaches();
        }
        if (this.scheduleService) {
            this.scheduleService.clearCache();
        }
    }

    private initializeServices() {
        // Initialize core services with dependency injection
        this.fileService = new FileService(this.app, this.settings.lessonPlanningRoot);
        this.parserService = new ParserService();
        this.scheduleService = new ScheduleService(this.fileService, this.parserService);
    }

    private registerCommands() {
        // Test command to verify services are working
        this.addCommand({
            id: 'test-services',
            name: 'Test Services',
            callback: async () => {
                await this.testServices();
            }
        });

        // Unit Assignment Command
        this.addCommand({
            id: 'assign-unit-to-class',
            name: 'Assign Unit to Class',
            callback: () => {
                this.assignUnitToClass();
            }
        });

        // Single Class Bump Command
        this.addCommand({
            id: 'single-class-bump',
            name: 'Bump Single Class',
            callback: () => {
                this.singleClassBump();
            }
        });

        // Whole Day Bump Command
        this.addCommand({
            id: 'whole-day-bump',
            name: 'Bump Whole Day',
            callback: () => {
                this.wholeDayBump();
            }
        });

        // Open Today's Plans
        this.addCommand({
            id: 'open-todays-plans',
            name: 'Open Today\'s Plans',
            callback: () => {
                this.openTodaysPlans();
            }
        });

        // Open Weekly View
        this.addCommand({
            id: 'open-weekly-view',
            name: 'Open Weekly View',
            callback: () => {
                this.openWeeklyView();
            }
        });

        // Clear Cache
        this.addCommand({
            id: 'clear-cache',
            name: 'Clear File Cache',
            callback: () => {
                this.clearCache();
            }
        });
    }

    // Test function to verify services are working
    private async testServices() {
        try {
            // Test file service
            const units = await this.fileService.getUnits();
            const classes = await this.fileService.getClasses();
            
            // Test schedule service
            const holidays = await this.scheduleService.getHolidayDates();
            const specialSchedules = await this.scheduleService.getSpecialSchedules();
            
            new Notice(`✅ Services working! Found ${units.length} units, ${classes.length} classes, ${holidays.length} holidays`);
            console.log('Service test results:', {
                units: units.length,
                classes: classes.length,
                holidays: holidays.length,
                specialSchedules
            });
        } catch (error) {
            new Notice(`❌ Service test failed: ${error.message}`);
            console.error('Service test error:', error);
        }
    }    // Command implementations (stub for now, will be fully implemented in next phases)
    private async assignUnitToClass() {
        new Notice('Unit assignment - Coming in Phase 2');
        // TODO: Implement unit assignment workflow
    }

    private async singleClassBump() {
        new Notice('Single class bump - Coming in Phase 2');
        // TODO: Implement single class bump workflow
    }

    private async wholeDayBump() {
        new Notice('Whole day bump - Coming in Phase 2');
        // TODO: Implement whole day bump workflow
    }

    private async openTodaysPlans() {
        const today = new Date().toISOString().split('T')[0];
        const todayPlanPath = this.fileService.getFullPath(`Daily Plans/${today}.md`);
        
        if (await this.fileService.fileExists(todayPlanPath)) {
            // Open the file
            const file = this.app.vault.getAbstractFileByPath(todayPlanPath);
            if (file) {
                this.app.workspace.openLinkText(file.path, '', false);
            }
        } else {
            new Notice(`No plans found for today (${today})`);
        }
    }

    private async openWeeklyView() {
        new Notice('Weekly view - Coming in Phase 2');
        // TODO: Implement weekly view
    }

    private clearCache() {
        this.fileService.invalidateCache();
        this.scheduleService.clearCache();
        new Notice('Cache cleared');
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
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'Lesson Planner Settings' });

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
            .setName('Enable File Caching')
            .setDesc('Cache file contents for better performance')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableCache)
                .onChange(async (value) => {
                    this.plugin.settings.enableCache = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Debug Performance')
            .setDesc('Log performance metrics to console')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.debugPerformance)
                .onChange(async (value) => {
                    this.plugin.settings.debugPerformance = value;
                    await this.plugin.saveSettings();
                }));
    }
}