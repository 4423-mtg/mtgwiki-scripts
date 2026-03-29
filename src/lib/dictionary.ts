import { ScryfallCard } from "@scryfall/api-types";
import { readFileSync } from "node:fs";
import { fetchOracleCardsBulkData } from "./scryfall.js";

export type DictEntry = {
    japaneseName: string | undefined;
    choices: string[] | undefined;
    source: "mtgwiki" | "cache" | "annotation";
    info: string | undefined;
};
export type Dictionary = Record<string, DictEntry>;

/** 既存の辞書データを読む */
export function readDictionaryCache(filepath: string): Dictionary {
    const data: Dictionary = JSON.parse(
        readFileSync(filepath, { encoding: "utf-8" }),
    );
    return data;
}

/** アノテーションを読む */
export function readAnnotation(filepath: string) {
    const data: Record<string, { japaneseName?: string }> = JSON.parse(
        readFileSync(filepath, { encoding: "utf-8" }),
    );
    return data;
}

/** カードデータ取得。
 * キャッシュを読むか、またはScryfallからオラクルカードデータを取得する */
export async function getOracleCards(
    useCache: boolean,
    cacheFile: string | undefined = undefined,
): Promise<ScryfallCard.Any[]> {
    if (useCache) {
        if (cacheFile === undefined) {
            throw new Error();
        }
        return JSON.parse(readFileSync(cacheFile, { encoding: "utf-8" }));
    } else {
        const data = await fetchOracleCardsBulkData();
        if (data === undefined) {
            throw new Error();
        }
        return data;
    }
}
