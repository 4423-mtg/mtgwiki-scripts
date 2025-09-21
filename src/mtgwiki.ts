import * as cheerio from "cheerio";
import { HTTPError, type DictEntry } from "./types/dict.js";

export async function search_pages(name: string): Promise<string[]> {
    const URL = `http://mtgwiki.com/index.php?fulltext=Search&redirs=1&search=${encodeURIComponent(
        name
    )}`;

    console.info(`⚙ [${new Date().toLocaleTimeString()}] search "${name}"`);
    const response = await fetch(URL);
    if (response.status !== 200) {
        throw new HTTPError(undefined, response);
    }
    const text = await response.text();

    let hit_page_names: string[] = [];
    const $ = cheerio.load(text);
    const searchresults = $("div.searchresults").first();
    if (
        searchresults.children().eq(0).hasClass("mw-search-createlink") &&
        searchresults.children().eq(1).children().eq(1).text() ==
            "ページ名と一致" &&
        searchresults.children().eq(2).hasClass("mw-search-results")
    ) {
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
    type: "normal" | "playtest" | "plane" = "normal"
): RegExp {
    switch (type) {
        case "normal":
            return new RegExp(
                String.raw`^((?<jpname>.+)/)?` +
                    escapeRegExp(name) +
                    String.raw`$`
            );
        case "playtest":
            return new RegExp(
                String.raw`^((?<jpname>.+)/)?` +
                    escapeRegExp(name) +
                    String.raw` \([Pp]laytest\)$`
            );
        case "plane":
            return new RegExp(
                String.raw`^((?<jpname>.+)/)?` +
                    escapeRegExp(name) +
                    String.raw` \(次元カード\)$`
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
    option?: { playtest?: boolean; plane?: boolean }
): Promise<DictEntry> {
    // 検索
    const page_titles = await search_pages(name);
    const expr = regexp_title(
        name,
        option?.playtest ? "playtest" : option?.plane ? "plane" : "normal"
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
                    matched.map((m) => m[0])
                )})`
            );
            return {
                name: name,
                jpname: undefined,
                info: "manypages",
            };
        }
    }
}
