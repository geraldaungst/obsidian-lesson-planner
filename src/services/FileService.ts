import { App, TFile, TFolder, normalizePath } from 'obsidian';

export class FileService {
    private app: App;
    private rootPath: string;
    private cache: Map<string, string> = new Map();

    constructor(app: App, rootPath: string) {
        this.app = app;
        this.rootPath = rootPath;
    }

    async folderExists(path: string): Promise<boolean> {
        const folder = this.app.vault.getAbstractFileByPath(normalizePath(path));
        return folder instanceof TFolder;
    }

    async fileExists(path: string): Promise<boolean> {
        const file = this.app.vault.getAbstractFileByPath(normalizePath(path));
        return file instanceof TFile;
    }

    async readFile(path: string, useCache: boolean = true): Promise<string | null> {
        const normalizedPath = normalizePath(path);
        
        if (useCache && this.cache.has(normalizedPath)) {
            return this.cache.get(normalizedPath)!;
        }

        try {
            const file = this.app.vault.getAbstractFileByPath(normalizedPath);
            if (!(file instanceof TFile)) {
                return null;
            }

            const content = await this.app.vault.read(file);
            
            if (useCache) {
                this.cache.set(normalizedPath, content);
            }

            return content;
        } catch (error) {
            console.error(`Error reading file ${path}:`, error);
            return null;
        }
    }

    async writeFile(path: string, content: string): Promise<boolean> {
        try {
            const normalizedPath = normalizePath(path);
            const file = this.app.vault.getAbstractFileByPath(normalizedPath);
            
            if (file instanceof TFile) {
                await this.app.vault.modify(file, content);
            } else {
                await this.app.vault.create(normalizedPath, content);
            }

            // Update cache
            this.cache.set(normalizedPath, content);
            return true;
        } catch (error) {
            console.error(`Error writing file ${path}:`, error);
            return false;
        }
    }

    // ADD: Missing createFile method that UnitAssignmentService expects
    async createFile(path: string, content: string): Promise<boolean> {
        try {
            const normalizedPath = normalizePath(path);
            await this.app.vault.create(normalizedPath, content);
            
            // Update cache
            this.cache.set(normalizedPath, content);
            return true;
        } catch (error) {
            console.error(`Error creating file ${path}:`, error);
            return false;
        }
    }

    async getFilesInFolder(folderPath: string, pattern?: RegExp): Promise<TFile[]> {
        try {
            const normalizedPath = normalizePath(`${this.rootPath}/${folderPath}`);
            const folder = this.app.vault.getAbstractFileByPath(normalizedPath);
            
            if (!(folder instanceof TFolder)) {
                return [];
            }

            const files: TFile[] = [];
            for (const child of folder.children) {
                if (child instanceof TFile) {
                    if (!pattern || pattern.test(child.name)) {
                        files.push(child);
                    }
                }
            }

            return files.sort((a, b) => a.name.localeCompare(b.name));
        } catch (error) {
            console.error(`Error getting files in folder ${folderPath}:`, error);
            return [];
        }
    }

    async getDailyPlans(startDate?: string, endDate?: string): Promise<TFile[]> {
        const dailyPlanPattern = /^\d{4}-\d{2}-\d{2}\.md$/;
        const allPlans = await this.getFilesInFolder('Daily Plans', dailyPlanPattern);

        if (!startDate && !endDate) {
            return allPlans;
        }

        return allPlans.filter(file => {
            const dateStr = file.basename;
            if (startDate && dateStr < startDate) return false;
            if (endDate && dateStr > endDate) return false;
            return true;
        });
    }

    async getUnits(): Promise<TFile[]> {
        return await this.getFilesInFolder('Units', /\.md$/);
    }

    async getClasses(): Promise<TFile[]> {
        return await this.getFilesInFolder('Classes', /\.md$/);
    }

    invalidateCache(path?: string): void {
        if (path) {
            this.cache.delete(normalizePath(path));
        } else {
            this.cache.clear();
        }
    }

    getFullPath(relativePath: string): string {
        return normalizePath(`${this.rootPath}/${relativePath}`);
    }
}