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
    
    // Time parsing with school day logic
    parseTimeToMinutes(timeStr: string): number {
        if (this.timeCache.has(timeStr)) {
            return this.timeCache.get(timeStr)!.totalMinutes;
        }

        const match = timeStr.match(TIME_REGEX);
        if (!match) {
            console.error(`Invalid time format: "${timeStr}". Expected H:MM or HH:MM format.`);
            return 0;
        }

        let hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);

        if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
            console.error(`Invalid time values: "${timeStr}". Hours must be 0-23, minutes 0-59.`);
            return 0;
        }

        // School day logic: Hours 1-7 are assumed to be PM (13-19 in 24-hour)
        // Hours 8-12 are assumed to be AM (8-12 in 24-hour)
        if (hours >= 1 && hours <= 7) {
            hours += 12; // Convert 1:00-7:59 to 13:00-19:59 (PM)
        }

        const totalMinutes = hours * 60 + minutes;
        
        // Cache the result
        this.timeCache.set(timeStr, {
            hours,
            minutes,
            totalMinutes,
            originalString: timeStr
        });

        return totalMinutes;
    }

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
            
            // Check for section headers
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

    // Update frontmatter classes list
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