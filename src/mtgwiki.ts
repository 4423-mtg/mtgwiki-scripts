import * as cheerio from "cheerio";
import type { DictEntry } from "./types/dict.js";
import { match } from "node:assert";

export async function search_pages(name: string): Promise<string[]> {
    const URL = `http://mtgwiki.com/index.php?search=${encodeURIComponent(
        name
    )}`;

    const response = await fetch(URL);
    if (response.status == 403) {
        throw Error("403 Forbidden");
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

function escapeRegExp(str: string) {
    // 以下の文字クラス内の文字を全てリテラル扱いにするために
    // \\ の後に元の文字（$&, etc）を置く
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const split_delimiter = "+";

export function get_splitcard_name(names: string[]) {
    return names.join(split_delimiter);
}

function regexp_title(
    name: string,
    type: "normal" | "playtest" | "plane" = "normal"
): RegExp {
    switch (type) {
        case "normal":
            return new RegExp(`^((?<jpname>.+)/)?${escapeRegExp(name)}$`);
        case "playtest":
            return new RegExp(
                `^((?<jpname>.+)/)?${escapeRegExp(name)} \(Playtest\)$`
            );
        case "plane":
            return new RegExp(
                `^((?<jpname>.+)/)?${escapeRegExp(name)} \(次元カード\)$`
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
    // 該当のページを探す
    const matched = page_titles
        .map((title) =>
            title.match(
                regexp_title(
                    name,
                    option?.playtest
                        ? "playtest"
                        : option?.plane
                        ? "plane"
                        : "normal"
                )
            )
        )
        .filter((m) => m !== null);
    if (matched.length == 1) {
        return { name: name, jpname: matched[0]?.groups?.jpname };
    } else {
        if (matched.length == 0) {
            const msg = "no pages.";
            console.warn(`> (mtgwiki.get_jpname2) "${name}":  ${msg}})`);
            return {
                name: name,
                jpname: undefined,
                info: `${msg} (${page_titles})`,
            };
        } else {
            const msg = "two or more pages.";
            console.warn(
                `> (mtgwiki.get_jpname2) "${name}":  ${msg} (${JSON.stringify(
                    page_titles
                )})`
            );
            return {
                name: name,
                jpname: undefined,
                info: `${msg} (${page_titles})`,
            };
        }
    }
}

/**
 * ```
 * // Example
 * ["Fire", "Ice"] => { name: "Fire+Ice", jpname: "火+氷"}
 * ```
 */
export async function get_entry_split(
    names: string[],
    option?: { playtest?: boolean; plane?: boolean }
): Promise<DictEntry> {
    // 各半分のprimalname => 全体のprimalname
    //  => 全体の日本語名 => 各半分の日本語名
    return get_jpname2(get_splitcard_name(names), option);
}
