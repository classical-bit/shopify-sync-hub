import { IsSafe } from "../..";
import { FileModel } from "../shopify/models/FileModel";
import { ShopifyFile } from "../shopify/schemas/file/ShopifyFile";
import { ShopifyConnection } from "../shopify/ShopifyConnection";
import { Logger } from "../utils/Logger";
import Sentry from "../utils/Sentry";

export class FileServiceError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "FileServiceError";
    }
}

export class FileService {
    sFiles: FileModel[] = [];
    tFiles: FileModel[] = [];
    initialized = false;

    async init() {
        this.sFiles = await this.source.GetFiles();
        this.tFiles = await this.target.GetFiles();
        this.initialized = true;
    }

    async requireInit() {
        if (!this.initialized) {
            await this.init();
        }
    }

    constructor(private source: ShopifyConnection, private target: ShopifyConnection) {
        this.source = source;
        this.target = target;
    }

    static IsFileMatch(fileA: FileModel | undefined, fileB: FileModel | undefined) {
        return fileA?.GetName() === fileB?.GetName();
    }

    async GetTargetFileFromSourceByName(fileName: string): Promise<ShopifyFile | null> {
        const tFile = await this.target.GetFileByName(fileName);
        if (!tFile) {
            Logger.warn(`File not found at target: ${fileName}`);
            return null;
        }

        return tFile;
    }

    async GetTargetFileFromSource(gid: string): Promise<ShopifyFile | null> {
        const sFile = await this.source.GetFileById(gid);
        if (!sFile) {
            throw new FileServiceError(`File not found at source, id: ${gid}`);
        }
        return await this.GetTargetFileFromSourceByName(sFile.GetName());
    }

    async GetTargetFileFromSourceOrThrow(gid: string): Promise<ShopifyFile> {
        const sFile = await this.source.GetFileById(gid);
        if (!sFile) {
            throw new FileServiceError(`File not found at source, id: ${gid}`);
        }
        const fileName = sFile.GetName();
        const tFile = await this.GetTargetFileFromSourceByName(fileName);
        if (!tFile) {
            throw new FileServiceError(`File not found at target: ${fileName}{${gid}}`);
        }
        return tFile;
    }

    async SyncFile(sFile: FileModel, tFile: FileModel | undefined) {
        Logger.debug(`Sync file, name: ${sFile.GetName()}, id: ${sFile.id}`);
        if (tFile) {
            Logger.debug(`File matched, name: ${sFile.GetName()}`);
            // No update
            return tFile
        }

        Logger.debug(`File not found, name: ${sFile.GetName()}`);
        const newTFiles = await this.target.CreateFiles([{
            filename: sFile.GetName(),
            originalSource: sFile.preview.image.url,
            alt: sFile.preview.image.altText,
            duplicateResolutionMode: "APPEND_UUID",
        }])
        Logger.info(`Created file at target, name: ${sFile.GetName()} tid: ${newTFiles[0].id}`);
    }

    async SyncFiles() {
        await this.requireInit();
        let completedFiles = 0;
        const startTime = Date.now();

        for (const sFile of this.sFiles) {
            const fileStartTime = Date.now();
            const tFile = this.tFiles.find(f => f.GetName() === sFile.GetName());
            try {
                await this.SyncFile(sFile, tFile);
            } catch (err) {
                Logger.error(`Failed while sync file, name: ${sFile.GetName()}, url: ${sFile.preview.image.url}`, err);
                Sentry.captureException(err);
            }

            const fileElapsedTime = Date.now() - fileStartTime;
            Logger.debug(`Sync completed for file, name: ${sFile.GetName()}, url: ${sFile.preview.image.url} in ${(fileElapsedTime / 1000).toFixed(2)} seconds.`);

            completedFiles++;
            const elapsedTime = Date.now() - startTime;
            const avgTimePerFile = elapsedTime / completedFiles;
            const remainingTime = avgTimePerFile * (this.sFiles.length - completedFiles);

            Logger.debug(
                `Completed ${completedFiles}/${this.sFiles.length}. ` +
                `Estimated time remaining: ${(remainingTime / 1000).toFixed(2)} seconds.`
            );
        }
    }
}