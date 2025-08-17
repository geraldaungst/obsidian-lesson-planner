import { Notice, TFile } from 'obsidian';
import { FileService } from './FileService';
import { ParserService } from './ParserService';
import { ScheduleService } from './ScheduleService';

export interface UnitAssignmentResult {
    success: boolean;
    message?: string;
    error?: string;
    createdPlans?: number;
    skippedPlans?: number;
    scheduleWarnings?: number;
}

export interface UnitAssignmentOptions {
    unitName: string;
    className: string;
    startDate: string;
}

export class UnitAssignmentService {
    private fileService: FileService;
    private parserService: ParserService;
    private scheduleService: ScheduleService;

    constructor(
        fileService: FileService,
        parserService: ParserService,
        scheduleService: ScheduleService
    ) {
        this.fileService = fileService;
        this.parserService = parserService;
        this.scheduleService = scheduleService;
    }

    /**
     * Interactive unit assignment workflow
     * This will be called from the main plugin
     */
    async assignUnitToClass(): Promise<UnitAssignmentResult> {
        try {
            // For now, we'll implement a simple workflow without modal
            // Later we'll replace this with a proper modal interface
            
            // Get available units and classes
            const availableUnits = await this.getAvailableUnits();
            const availableClasses = await this.getAvailableClasses();
            
            if (availableUnits.length === 0) {
                return { success: false, error: "No units found in Units folder" };
            }
            
            if (availableClasses.length === 0) {
                return { success: false, error: "No classes found in Classes folder" };
            }
            
            // For now, just show what we found and return a descriptive message
            // Later we'll implement the modal for user selection
            const unitsText = availableUnits.map(u => `${u.name} (${u.duration} days)`).join(', ');
            const classesText = availableClasses.map(c => `${c.name} (${c.dayOfWeek} ${c.time})`).join(', ');
            
            return {
                success: true,
                message: `Found ${availableUnits.length} units: ${unitsText}. Found ${availableClasses.length} classes: ${classesText}. Modal interface coming next!`
            };
            
        } catch (error) {
            console.error('Unit assignment error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Assign a specific unit to a specific class with given options
     * This is the core logic that will be called by the modal
     */
    async assignUnitToClassWithOptions(options: UnitAssignmentOptions): Promise<UnitAssignmentResult> {
        try {
            const { unitName, className, startDate } = options;

            // Validate inputs
            const validation = await this.validateAssignmentInputs(unitName, className, startDate);
            if (!validation.success) {
                return validation;
            }

            // Get unit duration and class schedule info
            const unitInfo = await this.getUnitInfo(unitName);
            if (!unitInfo.success) {
                return { success: false, error: unitInfo.error };
            }

            const classInfo = await this.getClassInfo(className);
            if (!classInfo.success) {
                return { success: false, error: classInfo.error };
            }

            // Calculate all class dates for this unit
            const dates = await this.calculateClassDates(
                startDate, 
                classInfo.dayOfWeek, 
                unitInfo.duration
            );

            // Create schedule context - FROM WORKING SCRIPT
            const scheduleContext = {
                className: className,
                regularTime: classInfo.regularTime,
                earlyDismissalTime: classInfo.earlyDismissalTime,
                testingDayTime: classInfo.testingDayTime,
                specialSchedules: await this.scheduleService.getSpecialSchedules()
            };

            // Create daily plan entries
            let createdPlans = 0;
            let skippedPlans = 0;
            let scheduleWarnings = 0;

            for (let i = 0; i < dates.length; i++) {
                const result = await this.createDailyPlanEntry(
                    dates[i],
                    className,
                    unitName,
                    i + 1,
                    unitInfo.duration,
                    scheduleContext
                );

                if (result.success) createdPlans++;
                if (result.skipped) skippedPlans++;
                if (result.hasScheduleWarning) scheduleWarnings++;
            }

            // Update unit and class metadata
            await this.updateUnitWithClass(unitName, className);
            await this.updateClassWithUnit(className, unitName);

            const message = `Created ${createdPlans} daily plans, skipped ${skippedPlans} duplicates` +
                           (scheduleWarnings > 0 ? `, ${scheduleWarnings} schedule warnings` : '');

            return {
                success: true,
                message: message,
                createdPlans: createdPlans,
                skippedPlans: skippedPlans,
                scheduleWarnings: scheduleWarnings
            };

        } catch (error) {
            console.error('Unit assignment error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // COPIED EXACTLY FROM WORKING UNIT ASSIGNMENT SCRIPT
    private async createDailyPlanEntry(
        date: string,
        className: string,
        unitName: string,
        dayNumber: number,
        totalDays: number,
        scheduleContext: any
    ): Promise<{ success: boolean; skipped?: boolean; hasScheduleWarning?: boolean }> {
        try {
            const dailyPlanPath = this.fileService.getFullPath(`Daily Plans/${date}.md`);
            let content = "";
            let isExistingPlan = false;
            
            if (this.fileService.fileExists(dailyPlanPath)) {
                content = await this.fileService.readFile(dailyPlanPath);
                isExistingPlan = true;
            } else {
                // Create new daily plan
                const [year, month, day] = date.split('-');
                const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                content = `---
date: ${date}
day_of_week: "${dateObj.toLocaleDateString('en-US', {weekday: 'long'})}"
classes: []
---

# ${dateObj.toLocaleDateString('en-US', {weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'})}`;
            }

            // Check for duplicates
            const classRegex = new RegExp(`## [^\\n]*${className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^\\n]*$`, 'm');
            if (classRegex.test(content)) {
                return { success: true, skipped: true, hasScheduleWarning: false };
            }
            
            // Calculate correct time and schedule note for this specific date
            const scheduleType = this.getScheduleTypeForDate(date, scheduleContext.specialSchedules);
            let classTime = scheduleContext.regularTime;
            let scheduleNote = "";
            let hasScheduleWarning = false;

            if (scheduleType === 'early_dismissal') {
                if (scheduleContext.earlyDismissalTime && 
                    scheduleContext.earlyDismissalTime.trim() !== "" && 
                    scheduleContext.earlyDismissalTime !== "TBD") {
                    classTime = scheduleContext.earlyDismissalTime;
                    scheduleNote = " (Early Dismissal)";
                } else {
                    scheduleNote = " (⚠️ Early Dismissal - using regular time, adjust manually)";
                    hasScheduleWarning = true;
                }
            } else if (scheduleType === 'testing_day') {
                if (scheduleContext.testingDayTime && 
                    scheduleContext.testingDayTime !== scheduleContext.regularTime) {
                    classTime = scheduleContext.testingDayTime;
                    scheduleNote = " (Testing Day)";
                } else {
                    scheduleNote = " (⚠️ Testing Day - using regular time, update testing_day_time when known)";
                    hasScheduleWarning = true;
                }
            }

            // Create class entry with correct transclusion format
            const transclusionRef = `![[${unitName}#Day ${dayNumber}]]`;            
            const classEntry = `

## ${classTime} - ${className}${scheduleNote}

**Unit:** [[${unitName}]]  
**Day:** ${dayNumber} of ${totalDays}  
**Lesson:** Day ${dayNumber}

### Quick Reference

${transclusionRef}

---

`;

            // Insert class entry in proper time order
            const insertResult = this.parserService.insertClassByTimeFixed(content, classEntry, classTime, className);
            content = insertResult.content;
            
            if (insertResult.conflict) {
                console.warn(`Time conflict: ${classTime} already has a class scheduled for ${date}`);
                new Notice(`Warning: Time conflict at ${classTime} on ${date}`);
            }
            
            // Update frontmatter classes list
            content = this.parserService.updateClassesList(content, className, 'add');

            // Save the file
            if (isExistingPlan) {
                await this.fileService.writeFile(dailyPlanPath, content);
            } else {
                await this.fileService.createFile(dailyPlanPath, content);
            }
            
            return { success: true, hasScheduleWarning: hasScheduleWarning };
            
        } catch (error) {
            console.error(`Error creating daily plan for ${date}:`, error);
            return { success: false, hasScheduleWarning: false };
        }
    }

    // Helper method copied from working script
    private getScheduleTypeForDate(date: string, specialSchedules: any): 'regular' | 'early_dismissal' | 'testing_day' {
        if (specialSchedules.early_dismissal.includes(date)) {
            return 'early_dismissal';
        }
        if (specialSchedules.testing_day.includes(date)) {
            return 'testing_day';
        }
        return 'regular';
    }

    private async validateAssignmentInputs(unitName: string, className: string, startDate: string): Promise<UnitAssignmentResult> {
        // Check if unit exists
        const units = await this.fileService.getFilesInFolder('Units');
        const unitExists = units.some(file => file.basename === unitName);
        if (!unitExists) {
            return { success: false, error: `Unit "${unitName}" not found` };
        }

        // Check if class exists
        const classes = await this.fileService.getFilesInFolder('Classes');
        const classExists = classes.some(file => file.basename === className);
        if (!classExists) {
            return { success: false, error: `Class "${className}" not found` };
        }

        // Validate date format
        if (!this.parserService.isValidDate(startDate)) {
            return { success: false, error: 'Invalid date format. Use YYYY-MM-DD' };
        }

        return { success: true };
    }

    private async getUnitInfo(unitName: string): Promise<{ success: boolean; duration?: number; error?: string }> {
        try {
            const units = await this.fileService.getFilesInFolder('Units');
            const unitFile = units.find(file => file.basename === unitName);
            
            if (!unitFile) {
                return { success: false, error: `Unit file not found: ${unitName}` };
            }

            const content = await this.fileService.readFile(unitFile.path);
            const durationMatch = content.match(/duration_days:\s*(\d+)/);
            
            if (!durationMatch) {
                return { success: false, error: `Unit "${unitName}" missing duration_days in frontmatter` };
            }

            return { success: true, duration: parseInt(durationMatch[1]) };
        } catch (error) {
            return { success: false, error: `Error reading unit file: ${error.message}` };
        }
    }

    private async getClassInfo(className: string): Promise<{ 
        success: boolean; 
        dayOfWeek?: string; 
        regularTime?: string;
        earlyDismissalTime?: string;
        testingDayTime?: string;
        error?: string 
    }> {
        try {
            const classes = await this.fileService.getFilesInFolder('Classes');
            const classFile = classes.find(file => file.basename === className);
            
            if (!classFile) {
                return { success: false, error: `Class file not found: ${className}` };
            }

            const content = await this.fileService.readFile(classFile.path);
            
            const dayMatch = content.match(/day_of_week:\s*"([^"]+)"/);
            const regularTimeMatch = content.match(/regular_time:\s*"([^"]+)"/);
            const earlyTimeMatch = content.match(/early_dismissal_time:\s*"([^"]+)"/);
            const testingTimeMatch = content.match(/testing_day_time:\s*"([^"]+)"/);

            if (!dayMatch) {
                return { success: false, error: `Class "${className}" missing day_of_week in frontmatter` };
            }

            return {
                success: true,
                dayOfWeek: dayMatch[1],
                regularTime: regularTimeMatch ? regularTimeMatch[1] : "TBD",
                earlyDismissalTime: earlyTimeMatch ? earlyTimeMatch[1] : null,
                testingDayTime: testingTimeMatch ? testingTimeMatch[1] : null
            };
        } catch (error) {
            return { success: false, error: `Error reading class file: ${error.message}` };
        }
    }

    private async calculateClassDates(startDate: string, dayOfWeek: string, duration: number): Promise<string[]> {
        const dates = [];
        const [year, month, day] = startDate.split('-');
        let currentDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));

        const dayMap = {
            "Sunday": 0, "Monday": 1, "Tuesday": 2, "Wednesday": 3,
            "Thursday": 4, "Friday": 5, "Saturday": 6
        };

        const targetDay = dayMap[dayOfWeek];
        if (targetDay === undefined) {
            throw new Error(`Invalid day of week: ${dayOfWeek}`);
        }

        // Adjust to correct day of week if needed
        const currentDay = currentDate.getDay();
        if (currentDay !== targetDay) {
            const daysToAdd = (targetDay - currentDay + 7) % 7;
            currentDate.setDate(currentDate.getDate() + daysToAdd);
        }

        // Get holiday dates
        const holidays = await this.scheduleService.getHolidayDates();

        // Generate dates, skipping holidays
        while (dates.length < duration) {
            const dateString = currentDate.toISOString().split('T')[0];

            if (!holidays.includes(dateString)) {
                dates.push(dateString);
            }

            currentDate.setDate(currentDate.getDate() + 7); // Next week
        }

        return dates;
    }

    private async updateUnitWithClass(unitName: string, className: string): Promise<void> {
        // TODO: Update unit file to include this class in active_classes
        console.log(`Would update unit ${unitName} to include class ${className}`);
    }

    private async updateClassWithUnit(className: string, unitName: string): Promise<void> {
        // TODO: Update class file to include this unit in current_units
        console.log(`Would update class ${className} to include unit ${unitName}`);
    }

    /**
     * Get available units for selection
     */
    async getAvailableUnits(): Promise<{ name: string; duration: number }[]> {
        try {
            const units = await this.fileService.getFilesInFolder('Units');
            const unitList = [];

            for (const unitFile of units) {
                try {
                    const content = await this.fileService.readFile(unitFile.path);
                    const durationMatch = content.match(/duration_days:\s*(\d+)/);
                    const duration = durationMatch ? parseInt(durationMatch[1]) : 0;
                    
                    unitList.push({
                        name: unitFile.basename,
                        duration: duration
                    });
                } catch (error) {
                    console.warn(`Error reading unit ${unitFile.basename}:`, error);
                }
            }

            return unitList;
        } catch (error) {
            console.error('Error getting available units:', error);
            return [];
        }
    }

    /**
     * Get available classes for selection
     */
    async getAvailableClasses(): Promise<{ name: string; dayOfWeek: string; time: string }[]> {
        try {
            const classes = await this.fileService.getFilesInFolder('Classes');
            const classList = [];

            for (const classFile of classes) {
                try {
                    const content = await this.fileService.readFile(classFile.path);
                    const dayMatch = content.match(/day_of_week:\s*"([^"]+)"/);
                    const timeMatch = content.match(/regular_time:\s*"([^"]+)"/);
                    
                    classList.push({
                        name: classFile.basename,
                        dayOfWeek: dayMatch ? dayMatch[1] : 'Unknown',
                        time: timeMatch ? timeMatch[1] : 'TBD'
                    });
                } catch (error) {
                    console.warn(`Error reading class ${classFile.basename}:`, error);
                }
            }

            return classList;
        } catch (error) {
            console.error('Error getting available classes:', error);
            return [];
        }
    }
}