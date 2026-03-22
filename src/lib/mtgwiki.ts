import * as cheerio from "cheerio";
import { HTTPError, type DictEntry } from "../types/dict.js";
import { CardName } from "./commonTypes.js";

/** wikiページ検索 */
export async function searchWikiPages(
    name: string,
    option: { retry?: boolean; maxRetry?: number; interval?: number } = {},
): Promise<{ pages: string[]; info: string | undefined }> {
    const URL = `http://mtgwiki.com/index.php?fulltext=Search&redirs=1&search=${encodeURIComponent(
        name,
    )}`;
    // console.log(`URL: ${URL}`);

    // フェッチ
    let text: string | undefined = undefined;
    let tryCount = 0;
    const _max = option?.maxRetry ?? 10;
    while (true) {
        console.info(
            `search for page "${name}"... (${new Date().toLocaleTimeString()})`,
        );

        tryCount++;
        const response = await fetch(URL);
        if (response.status == 200) {
            text = await response.text();
            break;
        } else {
            console.error(`HTTPError: ${response.status}, ${URL}`);
            // TODO: 4xx, 5xxエラー
            if (option?.retry === true && tryCount < _max) {
                continue;
            } else {
                break;
            }
        }
    }

    if (text === undefined) {
        console.error(`Failed to search mtgwiki (query=${name}, URL=${URL})`);
        throw new Error();
    }

    const $ = cheerio.load(text);
    const searchresults = $("div.searchresults").first();
    if (
        searchresults.children().eq(0).hasClass("mw-search-createlink") &&
        searchresults.children().eq(1).children().eq(1).text() ==
            "ページ名と一致" &&
        searchresults.children().eq(2).hasClass("mw-search-results")
    ) {
        const hit_page_names: string[] = [];
        const hits = searchresults.children().eq(2).children();
        for (let i = 0; i < hits.length; i++) {
            const n = $("div > a", hits.eq(i)).attr("title");
            if (typeof n !== "undefined") {
                hit_page_names.push(n);
            }
        }
        return { pages: hit_page_names, info: undefined };
    } else {
        return { pages: [], info: undefined };
    }
}

/** mtgwikiで英語名から日本語名を取得する */
export async function getJapaneseNameFromMtgWiki(
    englishName: string,
): Promise<{ cardName: CardName; choices: string[]; info: string | undefined }>;
export async function getJapaneseNameFromMtgWiki(
    englishName: string[],
): Promise<{
    cardName: CardName[];
    choices: string[];
    info: string | undefined;
}>;
export async function getJapaneseNameFromMtgWiki(
    englishName: string | string[],
): Promise<{
    cardName: CardName | CardName[];
    choices: string[];
    info: string | undefined;
}> {
    // wiki検索
    const isMultiFaced = Array.isArray(englishName);
    const results = await searchWikiPages(
        !isMultiFaced
            ? englishName
            : toPageName(englishName.map((en) => ({ englishName: en }))),
    );
    // パース
    const parsed = results.pages
        .map((r) => {
            const p = parsePageNameToCardName(r);
            if (p === undefined) {
                console.warn(`Failed to parse page name: "${r}"`);
            }
            return p;
        })
        .filter((p) => p !== undefined);
    // 判定
    if (!isMultiFaced) {
        // 分割カードのページでなく、英語名が一致しているもの
        const filtered = parsed
            .filter((p) => !p.isSplit)
            .filter((p) => p.cardName.englishName === englishName);
        // 該当1件
        if (filtered.length === 1) {
            const f0 = filtered[0];
            if (f0 === undefined) {
                throw new Error();
            }
            return {
                cardName: f0.cardName,
                choices: results.pages,
                info: undefined,
            };
        } else {
            return {
                cardName: { englishName: englishName, japaneseName: undefined },
                choices: results.pages,
                info: "Failed to determine a page of the card",
            };
        }
    } else {
        // 分割カードのページで、英語名が一致しているもの
        const filtered = parsed
            .filter((p) => p.isSplit)
            .filter((p) => p.cardName.join("+") === englishName.join("+"));
        if (filtered.length === 1) {
            const f0 = filtered[0];
            if (f0 === undefined) {
                throw new Error();
            }
            return {
                cardName: f0.cardName,
                choices: results.pages,
                info: undefined,
            };
        } else {
            return {
                cardName: englishName.map((en) => ({
                    englishName: en,
                    japaneseName: undefined,
                })),
                choices: results.pages,
                info: "Failed to determine a page of the card",
            };
        }
    }
}

/** mtgwikiで日本語名から英語名を取得する */
export async function getEnglishNameFromMtgWiki(
    japaneseName: string,
): Promise<string> {
    const pages = await searchWikiPages(japaneseName);
    // TODO: 検索結果から英語名を判定する
    // - 分割カード・次元カード・プレイテストカードの場合...
    return "";
}

/** カード名のmtgwiki表記を返す */
export function toPageName(
    cardName: CardName | CardName[],
    options?: { planar?: boolean; playtest?: boolean },
): string {
    let ret: string;
    if (Array.isArray(cardName)) {
        // 分割カードの場合
        // 日本語名1+日本語名2/英語名1+英語名2
        const jp = cardName
            .map((c) => c.japaneseName)
            .filter((n) => n !== undefined)
            .join("+");
        const en = cardName.map((c) => c.englishName).join("+");
        ret = jp.length > 0 ? jp + "/" + en : en;
    } else {
        // 通常カードの場合
        // 日本語名/英語名
        ret =
            cardName.japaneseName !== undefined
                ? cardName.japaneseName + "/" + cardName.englishName
                : cardName.englishName;
    }

    // (次元カード)
    if (options?.planar) {
        ret += " (次元カード)";
    }
    // (playtest)
    if (options?.playtest) {
        ret += " (playtest)"; // FIXME: playtest / Playtest
    }
    return ret;
}

type SplittedParseResult = {
    isSplit: true;
    cardName: Required<CardName>[];
    isPlanar: boolean;
    isPlaytest: boolean;
};
type NotSplittedParseResult = {
    isSplit: false;
    cardName: Required<CardName>;
    isPlanar: boolean;
    isPlaytest: boolean;
};
/** mtgwikiのページ名をパースしてカード名を得る。 */
export function parsePageNameToCardName(
    pageName: string,
): SplittedParseResult | NotSplittedParseResult | undefined {
    // 特殊カード名
    const special: Record<
        string,
        ReturnType<typeof parsePageNameToCardName>
    > = {
        "ペニーが操縦するSP//dr/SP//dr, Piloted by Peni": {
            isSplit: false,
            cardName: {
                japaneseName: "ペニーが操縦するSP//dr",
                englishName: "SP//dr, Piloted by Peni",
            },
            isPlanar: false,
            isPlaytest: false,
        },
        "召喚：チョコボ＆モーグリ/Summon: Choco/Mog": {
            isSplit: false,
            cardName: {
                japaneseName: "召喚：チョコボ＆モーグリ",
                englishName: "Summon: Choco/Mog",
            },
            isPlanar: false,
            isPlaytest: false,
        },
        "メイス＋２/+2 Mace": {
            isSplit: false,
            cardName: {
                japaneseName: "メイス＋２",
                englishName: "+2 Mace",
            },
            isPlanar: false,
            isPlaytest: false,
        },
    };
    if (special[pageName] !== undefined) {
        return special[pageName];
    }

    // 正規表現でパース
    const regexp = new RegExp(
        /^((?<jpname>.*)\/)?(?<enname>.*)( *\((?<annotation>.*)\))? *$/,
    );
    const match = pageName.match(regexp);
    if (match === null) {
        console.warn(`Failed to parse page "${pageName}"`);
        return undefined;
    }
    // 結果判定
    const enname = match.groups?.["enname"];
    const annotation = match.groups?.["annotation"];
    const isPlanar = annotation === "次元カード";
    const isPlaytest = annotation === "playtest";
    if (enname === undefined) {
        console.warn(`Page "${pageName}" has no english name for some reason`);
        return undefined;
    }
    if (enname.includes("+")) {
        // 分割カードの場合
        const ennames = enname.split("+");
        const jpnames = match.groups?.["jpname"]?.split("+");
        if (jpnames === undefined) {
            // 日本語名なし
            return {
                isSplit: true,
                cardName: ennames.map((en) => ({
                    englishName: en,
                    japaneseName: undefined,
                })),
                isPlanar: isPlanar,
                isPlaytest: isPlaytest,
            };
        } else {
            // 日本語名あり
            if (ennames.length !== jpnames.length) {
                throw new Error();
            }

            return {
                isSplit: true,
                cardName: ennames.map((en, idx) => ({
                    englishName: en,
                    japaneseName: jpnames[idx],
                })),
                isPlanar: isPlanar,
                isPlaytest: isPlaytest,
            };
        }
    } else {
        // 通常カードの場合
        return {
            isSplit: false,
            cardName: {
                englishName: enname,
                japaneseName: match.groups?.["jpname"],
            },
            isPlanar: isPlanar,
            isPlaytest: isPlaytest,
        };
    }

    // Evil Boros Charm (playtest)
    // Bind+Liberate (playtest)
    // Horizon Boughs (次元カード)
    // アガディームの面晶体原/Hedron Fields of Agadeem (次元カード)

    // 生+死/Life+Death
    // 稲妻/Lightning Bolt

    // The Tabernacle at Pendrell Vale
    // Who+What+When+Where+Why
}
