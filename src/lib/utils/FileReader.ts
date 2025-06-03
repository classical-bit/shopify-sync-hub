import { readFile } from "fs/promises";

export class CustomFileReader {
    static async GetProductHandles() {
        return (await readFile("./products_handle.txt")).toString().split("\n");
    }
}