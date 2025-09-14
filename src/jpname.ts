import { readFileSync } from "node:fs";
import * as cheerio from "cheerio";

function test() {
    const path = String.raw`.\data\oracle-cards-20250823211001.json`;
    // カード一覧
    console.log("Reading...");
    const oracles: any[] = JSON.parse(readFileSync(path, "utf-8"));
    console.log("length=" + oracles.length);

    // filter into valid cards
    const cards = oracles
        .filter(
            (c) =>
                ![
                    "art_series",
                    "double_faced_token",
                    "emblem",
                    "reversible_card",
                    "token",
                ].includes(c.layout)
        )
        .filter((c) => c.type_line !== "Card")
        .filter((c) => c.set_name !== "Unknown Event");
}

// mtgwikiからページ名を検索。最大20ページまで取得。
// TODO: ページが存在しない場合
// TODO: カード名辞書を作る
const cardname = ["Gaea's Cradle", "Thunder", "怒り"];
const card = cardname[2] as string;
const url = `http://mtgwiki.com/index.php?search=${encodeURIComponent(card)}`;

console.log(`<< ${card}`);
const response = await fetch(url);
console.log("get response");
const text = await response.text();

let hit_page_names = [];
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
        console.log(`>> ${n}`);
        hit_page_names.push(n);
    }
}

// console.log(hit_page_names);
