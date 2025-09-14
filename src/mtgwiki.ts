import * as cheerio from "cheerio";

export async function search_pages(name: string): Promise<string[]> {
    const URL = `http://mtgwiki.com/index.php?search=${encodeURIComponent(
        name
    )}`;

    const response = await fetch(URL);
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

export async function get_jpname(name: string) {
    const pages = await search_pages(name);

    const exp = new RegExp(`^(?<jpname>.+)/${escapeRegExp(name)}$`);

    const jpnames = pages
        .map((title) => title.match(exp)?.groups?.jpname)
        .filter((jpname) => jpname !== undefined);
    if (jpnames.length == 1) {
        return jpnames[0];
    } else {
        throw new Error(`failed to get jpname. ${pages}`);
    }
}
