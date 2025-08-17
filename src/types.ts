// Core data types for the Lesson Planner plugin

export interface DailyPlan {
    date: string; // YYYY-MM-DD format
    dayOfWeek: string;
    classes: string[];
    filePath: string;
}

export interface ClassSchedule {
    name: string;
    grade: string;
    teacher: string;
    dayOfWeek: string;
    regularTime: string;
    earlyDismissalTime?: string;
    testingDayTime?: string;
    currentUnits: string[];
    filePath: string;
}

export interface Unit {
    name: string;
    durationDays: number;
    activeClasses: string[];
    filePath: string;
}

export interface ClassEntry {
    className: string;
    time: string;
    unit: string;
    dayNumber: number;
    totalDays: number;
    scheduleNote?: string;
}

export interface ScheduleContext {
    className: string;
    regularTime: string;
    earlyDismissalTime?: string;
    testingDayTime?: string;
    specialSchedules: SpecialSchedules;
}

export interface SpecialSchedules {
    early_dismissal: string[];
    testing_day: string[];
}

export interface HolidayDates extends Array<string> {}

export interface BatchOperationResult {
    success: boolean;
    movements?: Movement[];
    scheduleWarnings?: number;
    error?: string;
}

export interface Movement {
    from: string;
    to: string;
    classCount?: number;
}

export interface ParsedTime {
    hours: number;
    minutes: number;
    totalMinutes: number;
    originalString: string;
}

export interface FileOperationResult {
    success: boolean;
    status?: string;
    hasScheduleWarning?: boolean;
    error?: string;
}

export interface CascadeSession {
    date: string;
    file: any; // TFile from Obsidian API
    content: string;
    classes?: string[];
}

export interface ClassFileInfo {
    success: boolean;
    dayOfWeek?: string;
    regularTime?: string;
    earlyDismissalTime?: string;
    testingDayTime?: string;
    file?: any;
    error?: string;
}

export interface InsertResult {
    content: string;
    conflict: boolean;
}

export interface ScheduleType {
    type: 'regular' | 'early_dismissal' | 'testing_day';
    date: string;
}

export interface LessonPlannerSettings {
    lessonPlanningRoot: string;
    enableCache: boolean;
    cacheSize: number;
    batchSize: number;
    virtualScrollThreshold: number;
    backgroundLoadDelay: number;
    debugPerformance: boolean;
    googleCalendarSync: boolean;
}

export const DEFAULT_SETTINGS: LessonPlannerSettings = {
    lessonPlanningRoot: "20 Lesson Planning",
    enableCache: true,
    cacheSize: 10, // MB
    batchSize: 10,
    virtualScrollThreshold: 50,
    backgroundLoadDelay: 1000, // ms
    debugPerformance: false,
    googleCalendarSync: false
};

// Performance monitoring types
export interface PerformanceMetric {
    operation: string;
    duration: number;
    timestamp: number;
    success: boolean;
}

export interface OperationHistory {
    operation: string;
    timestamp: number;
    data: any;
    canUndo: boolean;
}

// Validation types
export interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}

// View-related types
export interface WeeklyViewData {
    startDate: string;
    endDate: string;
    days: DailyPlan[];
    totalClasses: number;
}

export interface TimeSlot {
    time: string;
    className?: string;
    unit?: string;
    dayNumber?: number;
    scheduleNote?: string;
}

// Constants
export const TIME_REGEX = /^(\d{1,2}):(\d{2})$/;
export const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
export const CLASS_HEADER_REGEX = /^## (\d{1,2}:\d{2}) - /;
export const FRONTMATTER_CLASSES_REGEX = /classes: \[(.*?)\]/s;
export const YAML_STRING_REGEX = /:\s*"([^"]+)"/;

// Day of week mapping
export const DAY_MAP = {
    "Sunday": 0, 
    "Monday": 1, 
    "Tuesday": 2, 
    "Wednesday": 3, 
    "Thursday": 4, 
    "Friday": 5, 
    "Saturday": 6
} as const;

export type DayOfWeek = keyof typeof DAY_MAP;