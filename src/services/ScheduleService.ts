import { FileService } from './FileService';
import { ParserService } from './ParserService';
import { SpecialSchedules, HolidayDates } from '../types';

export class ScheduleService {
    private fileService: FileService;
    private parserService: ParserService;
    private holidayCache: HolidayDates | null = null;
    private specialScheduleCache: SpecialSchedules | null = null;
    private lastHolidayLoad = 0;
    private lastSpecialLoad = 0;
    private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

    constructor(fileService: FileService, parserService: ParserService) {
        this.fileService = fileService;
        this.parserService = parserService;
    }

    async getHolidayDates(): Promise<HolidayDates> {
        // Use cache if recent
        const now = Date.now();
        if (this.holidayCache && (now - this.lastHolidayLoad) < this.CACHE_TTL) {
            return this.holidayCache;
        }

        try {
            const holidayPath = this.fileService.getFullPath('School Holidays.md');
            const content = await this.fileService.readFile(holidayPath);
            
            if (!content) {
                console.warn('School Holidays.md file not found');
                return [];
            }

            const dates = this.parserService.parseHolidayDates(content);
            
            // Cache the result
            this.holidayCache = dates;
            this.lastHolidayLoad = now;
            
            return dates;
        } catch (error) {
            console.error('Error loading holiday dates:', error);
            return [];
        }
    }

    async getSpecialSchedules(): Promise<SpecialSchedules> {
        // Use cache if recent
        const now = Date.now();
        if (this.specialScheduleCache && (now - this.lastSpecialLoad) < this.CACHE_TTL) {
            return this.specialScheduleCache;
        }

        try {
            const schedulePath = this.fileService.getFullPath('Special Schedules.md');
            const content = await this.fileService.readFile(schedulePath);
            
            if (!content) {
                console.warn('Special Schedules.md file not found');
                return { early_dismissal: [], testing_day: [] };
            }

            const schedules = this.parserService.parseSpecialSchedules(content);
            
            // Cache the result
            this.specialScheduleCache = schedules;
            this.lastSpecialLoad = now;
            
            return schedules;
        } catch (error) {
            console.error('Error loading special schedules:', error);
            return { early_dismissal: [], testing_day: [] };
        }
    }

    isHoliday(date: string): Promise<boolean> {
        return this.getHolidayDates().then(holidays => holidays.includes(date));
    }

    async getScheduleType(date: string): Promise<'regular' | 'early_dismissal' | 'testing_day'> {
        const schedules = await this.getSpecialSchedules();
        
        if (schedules.early_dismissal.includes(date)) {
            return 'early_dismissal';
        }
        if (schedules.testing_day.includes(date)) {
            return 'testing_day';
        }
        return 'regular';
    }

    async getNextSchoolDay(fromDate: string, dayOfWeek: string): Promise<string> {
        const dayMap = {
            "Sunday": 0, "Monday": 1, "Tuesday": 2, "Wednesday": 3, 
            "Thursday": 4, "Friday": 5, "Saturday": 6
        };

        const targetDay = dayMap[dayOfWeek as keyof typeof dayMap];
        if (targetDay === undefined) {
            throw new Error(`Invalid day of week: ${dayOfWeek}`);
        }

        const [year, month, day] = fromDate.split('-').map(Number);
        let currentDate = new Date(year, month - 1, day);
        const holidays = await this.getHolidayDates();

        // Move to the next occurrence of the target day
        currentDate.setDate(currentDate.getDate() + 7);

        // Skip holidays by moving forward one week at a time
        let attempts = 0;
        while (holidays.includes(currentDate.toISOString().split('T')[0]) && attempts < 10) {
            currentDate.setDate(currentDate.getDate() + 7);
            attempts++;
        }

        if (attempts >= 10) {
            console.warn(`Could not find non-holiday ${dayOfWeek} after ${fromDate}`);
        }

        return currentDate.toISOString().split('T')[0];
    }

    async calculateClassDates(startDate: string, dayOfWeek: string, duration: number): Promise<string[]> {
        const dates: string[] = [];
        const dayMap = {
            "Sunday": 0, "Monday": 1, "Tuesday": 2, "Wednesday": 3, 
            "Thursday": 4, "Friday": 5, "Saturday": 6
        };

        const targetDay = dayMap[dayOfWeek as keyof typeof dayMap];
        if (targetDay === undefined) {
            throw new Error(`Invalid day of week: ${dayOfWeek}`);
        }

        const [year, month, day] = startDate.split('-').map(Number);
        let currentDate = new Date(year, month - 1, day);
        const currentDay = currentDate.getDay();
        
        // Adjust to correct day of week if needed
        if (currentDay !== targetDay) {
            const daysToAdd = (targetDay - currentDay + 7) % 7;
            currentDate.setDate(currentDate.getDate() + daysToAdd);
        }
        
        const holidays = await this.getHolidayDates();
        
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

    async getTimeForScheduleType(
        className: string, 
        scheduleType: 'regular' | 'early_dismissal' | 'testing_day'
    ): Promise<{ time: string; note: string; needsReview: boolean }> {
        try {
            const classPath = this.fileService.getFullPath(`Classes/${className}.md`);
            const content = await this.fileService.readFile(classPath);
            
            if (!content) {
                return { 
                    time: '12:00', 
                    note: 'Class file not found', 
                    needsReview: true 
                };
            }

            const classSchedule = this.parserService.parseClassSchedule(content, classPath);
            if (!classSchedule) {
                return { 
                    time: '12:00', 
                    note: 'Could not parse class schedule', 
                    needsReview: true 
                };
            }

            switch (scheduleType) {
                case 'early_dismissal':
                    if (classSchedule.earlyDismissalTime && classSchedule.earlyDismissalTime !== "TBD") {
                        return {
                            time: classSchedule.earlyDismissalTime,
                            note: ' (Early Dismissal)',
                            needsReview: false
                        };
                    } else {
                        return {
                            time: classSchedule.regularTime,
                            note: ' (⚠️ Early Dismissal - check time manually)',
                            needsReview: true
                        };
                    }

                case 'testing_day':
                    if (classSchedule.testingDayTime && classSchedule.testingDayTime !== classSchedule.regularTime) {
                        return {
                            time: classSchedule.testingDayTime,
                            note: ' (Testing Day)',
                            needsReview: false
                        };
                    } else {
                        return {
                            time: classSchedule.regularTime,
                            note: ' (⚠️ Testing Day - update testing_day_time when known)',
                            needsReview: true
                        };
                    }

                case 'regular':
                default:
                    return {
                        time: classSchedule.regularTime,
                        note: '',
                        needsReview: false
                    };
            }
        } catch (error) {
            console.error(`Error getting time for ${className} on ${scheduleType}:`, error);
            return { 
                time: '12:00', 
                note: 'Error loading schedule', 
                needsReview: true 
            };
        }
    }

    // Check if dates span any holidays or special schedules
    async checkDateRangeForScheduleIssues(dates: string[]): Promise<{
        holidayConflicts: string[];
        specialScheduleConflicts: Array<{ date: string; type: string }>;
    }> {
        const holidays = await this.getHolidayDates();
        const specialSchedules = await this.getSpecialSchedules();
        
        const holidayConflicts = dates.filter(date => holidays.includes(date));
        const specialScheduleConflicts: Array<{ date: string; type: string }> = [];
        
        for (const date of dates) {
            if (specialSchedules.early_dismissal.includes(date)) {
                specialScheduleConflicts.push({ date, type: 'early_dismissal' });
            }
            if (specialSchedules.testing_day.includes(date)) {
                specialScheduleConflicts.push({ date, type: 'testing_day' });
            }
        }
        
        return { holidayConflicts, specialScheduleConflicts };
    }

    // Clear caches (useful for testing or when files are updated)
    clearCache(): void {
        this.holidayCache = null;
        this.specialScheduleCache = null;
        this.lastHolidayLoad = 0;
        this.lastSpecialLoad = 0;
    }

    // Force reload from files
    async forceReload(): Promise<void> {
        this.clearCache();
        await Promise.all([
            this.getHolidayDates(),
            this.getSpecialSchedules()
        ]);
    }
}