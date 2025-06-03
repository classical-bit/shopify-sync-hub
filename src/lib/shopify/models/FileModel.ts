import { FileSchema, ShopifyFile } from "../schemas/file/ShopifyFile";
import { MediaSchema, ShopifyMedia } from "../schemas/file/ShopifyMedia";

class FileModelError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "FileModelError";
    }
}

export class FileModel implements ShopifyFile {
    id
    preview

    constructor(shopifyData: unknown) {
        const result = FileSchema.safeParse(shopifyData);
        if (!result.success) {
            throw new Error(`Invalid file data: ${JSON.stringify(result.error.format())}`);
        }
        const data = result.data;
        this.id = data.id;
        this.preview = data.preview;
    }

    GetName() {
        const fileUrl = this.preview?.image?.url;
        if (!fileUrl) return "";
        return FileModel.GetNameFromImageURL(fileUrl);
    }

    static GetNameFromImageURL(fileUrl: string): string {
        const fileName = new URL(fileUrl).pathname.split("/").pop();
        if (!fileName) throw new FileModelError(`Could not get file name: "${fileUrl}"`);
        return fileName.split("?")[0].replace(/_[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/, '')
    }
}

export class MediaModel extends FileModel implements ShopifyMedia {
    alt
    mediaContentType

    constructor(shopifyData: unknown) {
        super(shopifyData)
        const result = MediaSchema.safeParse(shopifyData);
        if (!result.success) {
            throw new Error(`Invalid media data: ${JSON.stringify(result.error.format())}`);
        }
        const data = result.data;
        this.alt = data.alt;
        this.mediaContentType = data.mediaContentType;
    }
}