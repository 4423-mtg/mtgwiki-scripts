import { readFileSync } from "node:fs";
import { fetchOracleCardsBulkData } from "../lib/scryfall.js";

async function main() {
    const cards = await getCards(false);
    // TODO:
    // - 非対象カードを除外する
    // - 日本語名キャッシュを読む
    // - キャッシュにないカードについて、日本語名を取得
    //   - 日本語名が取得できたものはキャッシュに追加する
    //   - 日本語名が取得できないものはキャッシュに理由を保存する

    // - キャッシュから日本語名が取得できていないものを抽出する
    // - 人力で確認し、特別リストを作る
}

/** カードデータ取得 */
async function getCards(
    useCache: boolean,
    cacheFile: string | undefined = undefined,
) {
    let cards;
    if (useCache) {
        if (cacheFile === undefined) {
            return;
        }
        cards = JSON.parse(readFileSync(cacheFile, { encoding: "utf-8" }));
    } else {
        cards = await fetchOracleCardsBulkData();
    }
    if (cards === undefined) {
        return;
    }
    // FIXME: cardsの型ガード
    cards;
    return cards;
}

await main();
