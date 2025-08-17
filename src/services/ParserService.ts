import { 
    ParsedTime, 
    ClassEntry, 
    DailyPlan, 
    ClassSchedule, 
    Unit,
    ValidationResult,
    TIME_REGEX,
    DATE_REGEX,
    CLASS_HEADER_REGEX,
    FRONTMATTER_CLASSES_REGEX,
    YAML_STRING_REGEX
} from '../types';

export class ParserService {
    private timeCache = new Map<string, ParsedTime>();
    
    // Time parsing function with school day AM/PM logic - COPIED FROM WORKING SCRIPT
    parseTimeToMinutes(timeStr: string): number {
        // Match H:MM or HH:MM format exactly
        const timeMatch = timeStr.match(/^(\d{1,2}):(\d{2})$/);
        
        if (!timeMatch) {
            console.error(`Invalid time format: "${timeStr}". Expected H:MM or HH:MM format.`);
            return 0; // Default to midnight if parsing fails
        }
        
        let hours = parseInt(timeMatch[1], 10);
        const minutes = parseInt(timeMatch[2], 10);
        
        if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
            console.error(`Invalid time values: "${timeStr}". Hours must be 0-23, minutes 0-59.`);
            return 0;
        }
        
        // School day logic: Hours 1-7 are assumed to be PM (13-19 in 24-hour)
        // Hours 8-12 are assumed to be AM (8-12 in 24-hour)
        // Hours 0, 13-23 are left as-is (24-hour format)
        if (hours >= 1 && hours <= 7) {
            hours += 12; // Convert 1:00-7:59 to 13:00-19:59 (PM)
        }
        
        const totalMinutes = hours * 60 + minutes;
        return totalMinutes;
    }

    // Time insertion function for format: ## H:MM - Class Name - COPIED FROM WORKING SCRIPT
    insertClassByTimeFixed(content: string, classEntry: string, newTime: string, className: string): { content: string; conflict: boolean } {
        const lines = content.split('\n');
        const newTimeMinutes = this.parseTimeToMinutes(newTime);
        
        let insertIndex = -1;
        let timeConflict = false;
        const existingTimes = [];
        
        // Find all existing class times and their positions
        for (let i = 0; i < lines.length; i++) {
            // Match exact format: ## H:MM - Class Name or ## HH:MM - Class Name
            const timeMatch = lines[i].match(/^## (\d{1,2}:\d{2}) - /);
            if (timeMatch) {
                const existingTime = timeMatch[1];
                const existingTimeMinutes = this.parseTimeToMinutes(existingTime);
                
                existingTimes.push({
                    time: existingTime,
                    minutes: existingTimeMinutes,
                    lineIndex: i
                });
                
                // Check for exact time conflict
                if (newTimeMinutes === existingTimeMinutes) {
                    timeConflict = true;
                }
            }
        }
        
        // Sort existing times to find correct insertion point
        existingTimes.sort((a, b) => a.minutes - b.minutes);
        
        // Find where to insert the new class
        for (const existing of existingTimes) {
            if (newTimeMinutes < existing.minutes) {
                insertIndex = existing.lineIndex;
                break;
            }
        }
        
        // If no insertion point found, append at the end
        if (insertIndex === -1) {
            return { content: content + '\n' + classEntry + '\n', conflict: timeConflict };
        }
        
        let actualInsertIndex = insertIndex;
        let foundExistingDivider = false;
        
        // Look backward from insertion point to see if there's a divider we should insert above
        for (let i = insertIndex - 1; i >= 0; i--) {
            if (lines[i].trim() === '---') {
                // Found a divider above the insertion point - insert above it
                actualInsertIndex = i;
                foundExistingDivider = true;
                break;
            } else if (lines[i].trim() !== '' && !lines[i].match(/^## \d{1,2}:\d{2} - /)) {
                // Found non-empty, non-class content - stop looking
                break;
            }
        }
        
        // Clean insertion: remove any existing dividers from classEntry and add properly
        const cleanedClassEntry = classEntry.replace(/^---\s*\n?/gm, '').replace(/\n---\s*$/gm, '');
        const classEntryLines = cleanedClassEntry.trim().split('\n');
        
        // Insert content - handle divider placement properly
        let insertContent;
        if (foundExistingDivider) {
            // Insert above existing divider: add divider above, use existing below
            insertContent = ['---', '', ...classEntryLines, '']; 
        } else {
            // No existing divider: add divider below
            insertContent = [...classEntryLines, '', '---'];
        }

        lines.splice(actualInsertIndex, 0, ...insertContent);
        
        return { content: lines.join('\n'), conflict: timeConflict };
    }

    // Validation for date format - COPIED FROM WORKING SCRIPT
    isValidDate(dateString: string): boolean {
        const regex = /^\d{4}-\d{2}-\d{2}$/;
        if (!regex.test(dateString)) return false;
        const date = new Date(dateString);
        return date instanceof Date && !isNaN(date.getTime()) && date.toISOString().split('T')[0] === dateString;
    }

    // Rest of existing ParserService methods remain unchanged...
    
    // Parse daily plan from file content
    parseDailyPlan(content: string, filePath: string): DailyPlan | null {
        try {
            // Extract date from filename
            const dateMatch = filePath.match(/(\d{4}-\d{2}-\d{2})\.md$/);
            if (!dateMatch) {
                return null;
            }

            const date = dateMatch[1];
            
            // Extract day of week from frontmatter
            const dayMatch = content.match(/day_of_week:\s*"([^"]+)"/);
            const dayOfWeek = dayMatch ? dayMatch[1] : '';

            // Extract classes from frontmatter
            const classesMatch = content.match(FRONTMATTER_CLASSES_REGEX);
            let classes: string[] = [];
            
            if (classesMatch && classesMatch[1].trim()) {
                classes = classesMatch[1]
                    .split(',')
                    .map(c => c.trim().replace(/['"]/g, ''))
                    .filter(c => c.length > 0);
            }

            return {
                date,
                dayOfWeek,
                classes,
                filePath
            };
        } catch (error) {
            console.error(`Error parsing daily plan from ${filePath}:`, error);
            return null;
        }
    }

    // Parse class schedule from file content
    parseClassSchedule(content: string, filePath: string): ClassSchedule | null {
        try {
            const fileName = filePath.split('/').pop()?.replace('.md', '') || '';
            
            const gradeMatch = content.match(/grade:\s*"([^"]+)"/);
            const teacherMatch = content.match(/teacher:\s*"([^"]+)"/);
            const dayMatch = content.match(/day_of_week:\s*"([^"]+)"/);
            const regularTimeMatch = content.match(/regular_time:\s*"([^"]+)"/);
            const earlyTimeMatch = content.match(/early_dismissal_time:\s*"([^"]+)"/);
            const testingTimeMatch = content.match(/testing_day_time:\s*"([^"]+)"/);
            const unitsMatch = content.match(/current_units:\s*\[(.*?)\]/);

            let currentUnits: string[] = [];
            if (unitsMatch && unitsMatch[1].trim()) {
                currentUnits = unitsMatch[1]
                    .split(',')
                    .map(u => u.trim().replace(/['"]/g, ''))
                    .filter(u => u.length > 0);
            }

            return {
                name: fileName,
                grade: gradeMatch ? gradeMatch[1] : '',
                teacher: teacherMatch ? teacherMatch[1] : '',
                dayOfWeek: dayMatch ? dayMatch[1] : '',
                regularTime: regularTimeMatch ? regularTimeMatch[1] : '',
                earlyDismissalTime: earlyTimeMatch ? earlyTimeMatch[1] : undefined,
                testingDayTime: testingTimeMatch ? testingTimeMatch[1] : undefined,
                currentUnits,
                filePath
            };
        } catch (error) {
            console.error(`Error parsing class schedule from ${filePath}:`, error);
            return null;
        }
    }

    // Parse unit from file content
    parseUnit(content: string, filePath: string): Unit | null {
        try {
            const fileName = filePath.split('/').pop()?.replace('.md', '') || '';
            
            const durationMatch = content.match(/duration_days:\s*(\d+)/);
            const classesMatch = content.match(/active_classes:\s*\[(.*?)\]/);

            let activeClasses: string[] = [];
            if (classesMatch && classesMatch[1].trim()) {
                activeClasses = classesMatch[1]
                    .split(',')
                    .map(c => c.trim().replace(/['"]/g, ''))
                    .filter(c => c.length > 0);
            }

            return {
                name: fileName,
                durationDays: durationMatch ? parseInt(durationMatch[1]) : 0,
                activeClasses,
                filePath
            };
        } catch (error) {
            console.error(`Error parsing unit from ${filePath}:`, error);
            return null;
        }
    }

    // Extract class entries from daily plan content
    extractClassEntries(content: string): ClassEntry[] {
        const entries: ClassEntry[] = [];
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const headerMatch = line.match(CLASS_HEADER_REGEX);
            
            if (headerMatch) {
                const time = headerMatch[1];
                
                // Extract class name from header
                const classNameMatch = line.match(/^## [^-]+ - ([^(\n]+)/);
                const className = classNameMatch ? classNameMatch[1].trim() : '';
                
                // Look for unit and day information in following lines
                let unit = '';
                let dayNumber = 0;
                let totalDays = 0;
                let scheduleNote = '';
                
                // Check for schedule note in header
                const noteMatch = line.match(/\(([^)]+)\)$/);
                if (noteMatch) {
                    scheduleNote = noteMatch[1];
                }
                
                // Search next few lines for unit and day info
                for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
                    const nextLine = lines[j];
                    
                    if (nextLine.match(/^## /)) break; // Next class entry
                    
                    const unitMatch = nextLine.match(/\*\*Unit:\*\*\s*\[\[([^\]]+)\]\]/);
                    if (unitMatch) {
                        unit = unitMatch[1];
                    }
                    
                    const dayMatch = nextLine.match(/\*\*Day:\*\*\s*(\d+)\s*of\s*(\d+)/);
                    if (dayMatch) {
                        dayNumber = parseInt(dayMatch[1]);
                        totalDays = parseInt(dayMatch[2]);
                    }
                }
                
                entries.push({
                    className,
                    time,
                    unit,
                    dayNumber,
                    totalDays,
                    scheduleNote
                });
            }
        }

        return entries;
    }

    // Extract holiday dates from holiday file content
    parseHolidayDates(content: string): string[] {
        const dates: string[] = [];
        const lines = content.split('\n');
        
        for (const line of lines) {
            const match = line.match(/^- (\d{4}-\d{2}-\d{2})/);
            if (match) {
                dates.push(match[1]);
            }
        }
        
        return dates;
    }

    // Parse special schedule dates
    parseSpecialSchedules(content: string): { early_dismissal: string[]; testing_day: string[] } {
        const schedules = { early_dismissal: [] as string[], testing_day: [] as string[] };
        const lines = content.split('\n');
        let currentType: 'early_dismissal' | 'testing_day' | null = null;
        
        for (const line of lines) {
            if (line.trim() === '---') {
                break; // Stop at separator
            }
            
            // Check for section headers - ONLY look at lines that start with ##
            if (line.startsWith('##') && line.toLowerCase().includes('early dismissal')) {
                currentType = 'early_dismissal';
                continue;
            } else if (line.startsWith('##') && line.toLowerCase().includes('testing day')) {
                currentType = 'testing_day';
                continue;
            }
            
            // Extract dates when we have a current type
            if (currentType && line.match(/^- (\d{4}-\d{2}-\d{2})/)) {
                const match = line.match(/^- (\d{4}-\d{2}-\d{2})/);
                if (match) {
                    schedules[currentType].push(match[1]);
                }
            }
        }
        
        return schedules;
    }

    // Update frontmatter classes list - COPIED FROM WORKING SCRIPT
    updateClassesList(content: string, className: string, action: 'add' | 'remove'): string {
        const classesMatch = content.match(FRONTMATTER_CLASSES_REGEX);
        
        if (!classesMatch) {
            // No classes array found, add one
            const frontmatterEnd = content.indexOf('---', 3);
            if (frontmatterEnd === -1) return content;
            
            const newClasses = action === 'add' ? [`"${className}"`] : [];
            const newFrontmatter = content.slice(0, frontmatterEnd) + 
                `classes: [${newClasses.join(', ')}]\n` + 
                content.slice(frontmatterEnd);
            return newFrontmatter;
        }
        
        const classesStr = classesMatch[1];
        let classList: string[] = [];
        
        if (classesStr.trim()) {
            classList = classesStr
                .split(',')
                .map(c => c.trim().replace(/['"]/g, ''))
                .filter(c => c.length > 0);
        }
        
        if (action === 'add' && !classList.includes(className)) {
            classList.push(className);
        } else if (action === 'remove') {
            classList = classList.filter(c => c !== className);
        }
        
        classList.sort();
        
        const newClassesStr = classList.map(c => `"${c}"`).join(', ');
        return content.replace(
            FRONTMATTER_CLASSES_REGEX,
            `classes: [${newClassesStr}]`
        );
    }

    // Validation methods
    validateDate(dateString: string): ValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];
        
        if (!DATE_REGEX.test(dateString)) {
            errors.push("Date must be in YYYY-MM-DD format");
        } else {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) {
                errors.push("Invalid date");
            }
        }
        
        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    validateTime(timeString: string): ValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];
        
        if (!TIME_REGEX.test(timeString)) {
            errors.push("Time must be in H:MM or HH:MM format");
        } else {
            const match = timeString.match(TIME_REGEX);
            if (match) {
                const hours = parseInt(match[1]);
                const minutes = parseInt(match[2]);
                
                if (hours < 0 || hours > 23) {
                    errors.push("Hours must be between 0 and 23");
                }
                if (minutes < 0 || minutes > 59) {
                    errors.push("Minutes must be between 0 and 59");
                }
            }
        }
        
        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    // Clear caches for memory management
    clearCaches(): void {
        this.timeCache.clear();
    }
}