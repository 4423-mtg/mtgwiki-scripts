import * as cheerio from "cheerio";
import { HTTPError, type DictEntry } from "../types/dict.js";
import { CardName } from "./commonTypes.js";

/** wikiページ検索 */
export async function searchWikiPages(
    name: string,
    option?: { retry?: boolean; maxRetry?: number; interval?: number },
): Promise<string[]> {
    const URL = `http://mtgwiki.com/index.php?fulltext=Search&redirs=1&search=${encodeURIComponent(
        name,
    )}`;
    // console.log(`URL: ${URL}`);

    // フェッチ
    let text;
    let tryCount = 0;
    const _max = option?.maxRetry ?? 10;
    while (true) {
        console.info(
            `search for page "${name}"... (${new Date().toLocaleTimeString()})`,
        );

        const response = await fetch(URL);
        tryCount++;
        if (response.status !== 200) {
            console.error(`HTTPError: ${response.status}, ${URL}`);
            throw new HTTPError(undefined, response);
        }
        // TODO: 4xx, 5xxエラー
        text = await response.text();

        if (option?.retry !== true || tryCount > _max) {
            break;
        }
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
        return hit_page_names;
    } else {
        return [];
    }
}

/** mtgwikiで英語名から日本語名を取得する */
export async function getJapaneseName(
    englishName: string,
): Promise<CardName | { info: string }>;
export async function getJapaneseName(
    englishName: string[],
): Promise<CardName[] | { info: string }>;
export async function getJapaneseName(
    englishName: string | string[],
): Promise<CardName | CardName[] | { info: string }> {
    if (!Array.isArray(englishName)) {
        // 通常カードの場合
        // ページ検索
        const results = await searchWikiPages(englishName);
        // ページ名をパースし、分割カードのページとパース失敗したページを除外
        const parsed = results
            .map((name) => parsePageNameToCardName(name))
            .filter((p) => p !== undefined && !p.isSplit);
        // 判定
        if (parsed.length === 1) {
            const p = parsed[0];
            if (p === undefined) {
                throw new Error();
            }
            return p.cardName;
        } else {
            // TODO: - 普通に検索してヒットしない場合は次元カード・プレイテストカードで検索する
            const _temp = "[" + results.map((s) => `'${s}'`).join(", ") + "]";
            const msg = `Failed to get japanese name (searchResult=${_temp})`;
            console.warn(msg);
            return { info: msg };
        }
    } else {
        // マルチフェイスの場合
        const pageName = getPageNameOfCard(
            englishName.map((en) => ({ englishName: en })),
        );
        const results = await searchWikiPages(pageName);
        // ページ名のパース
        const parsed = results
            .map((name) => parsePageNameToCardName(name))
            .filter((p) => p !== undefined && p.isSplit);
        // 判定
        if (parsed.length === 1) {
            const p = parsed[0];
            if (p === undefined) {
                throw new Error();
            }
            return p.cardNames;
        } else {
            // TODO: - 普通に検索してヒットしない場合は次元カード・プレイテストカードで検索する
            const _temp = "[" + results.map((s) => `'${s}'`).join(", ") + "]";
            const msg = `Failed to get japanese name (searchResult=${_temp})`;
            console.warn(msg);
            return { info: msg };
        }
    }
}

/** mtgwikiで日本語名から英語名を取得する */
export async function getEnglishName(japaneseName: string): Promise<string> {
    const pages = await searchWikiPages(japaneseName);
    // TODO: 検索結果から英語名を判定する
    // - 分割カード・次元カード・プレイテストカードの場合...
    return "";
}

/** カード名のmtgwiki表記を返す */
export function getPageNameOfCard(
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
    cardNames: Required<CardName>[];
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
                cardNames: ennames.map((en) => ({
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
                cardNames: ennames.map((en, idx) => ({
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

// ======================================================
// region: old
// ======================================================
function escapeRegExp(str: string): string {
    // 以下の文字クラス内の文字を全てリテラル扱いにするために
    // \\ の後に元の文字（$&, etc）を置く
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const split_delimiter = "+";

export function get_splitcard_name(names: string[]): string {
    return names.join(split_delimiter);
}

export function get_splitcard_name_inverse(name: string): string[] {
    return name.split(split_delimiter);
}

function regexp_title(
    name: string,
    type: "normal" | "playtest" | "plane" = "normal",
): RegExp {
    switch (type) {
        case "normal":
            return new RegExp(
                String.raw`^((?<jpname>.+)/)?` +
                    escapeRegExp(name) +
                    String.raw`$`,
            );
        case "playtest":
            return new RegExp(
                String.raw`^((?<jpname>.+)/)?` +
                    escapeRegExp(name) +
                    String.raw` \([Pp]laytest\)$`,
            );
        case "plane":
            return new RegExp(
                String.raw`^((?<jpname>.+)/)?` +
                    escapeRegExp(name) +
                    String.raw` \(次元カード\)$`,
            );
    }
    const x = type;
}

/**
 * ```
 * // Example
 * "Lightning Bolt" => "稲妻"
 * "Fire+Ice" => "火+氷"
 * ```
 */
export async function get_jpname2(
    name: string,
    option?: { playtest?: boolean; plane?: boolean },
): Promise<DictEntry> {
    // 検索
    const page_titles = await searchWikiPages(name);
    const expr = regexp_title(
        name,
        option?.playtest ? "playtest" : option?.plane ? "plane" : "normal",
    );
    // 該当のページを探す
    // FIXME: The Lord Master of Hell
    // FIXME: Misinformation
    const matched = page_titles
        .map((title) => title.match(expr))
        .filter((m) => m !== null);
    if (matched.length == 1) {
        const jpname = matched[0]?.groups?.jpname;
        return {
            name: name,
            jpname: jpname,
            info: jpname === undefined ? "nojpname" : undefined,
        };
    } else {
        if (matched.length == 0) {
            console.warn(`> (mtgwiki.get_jpname2) "${name}": "no pages."})`);
            return {
                name: name,
                jpname: undefined,
                info: "nopage",
            };
        } else {
            console.warn(
                `> (mtgwiki.get_jpname2) "${name}": "two or more pages." (${JSON.stringify(
                    matched.map((m) => m[0]),
                )})`,
            );
            return {
                name: name,
                jpname: undefined,
                info: "manypages",
            };
        }
    }
}
