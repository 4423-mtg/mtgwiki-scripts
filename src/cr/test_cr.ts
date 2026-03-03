import * as cheerio from "cheerio";

// fetch
const content = await fetch("https://mtg-jp.com/gameplay/rules/docs/0006836/");
const $ = cheerio.load(await content.text());

// メイン部分
const main = $(
    "body > div#wrap > main > article > div#contents > div.inner > div.reading-main > section > div.detail",
);

// 本文
let paragraphs: { html: string | null; text: string; type: string }[] = [];
const lines: string[] = [];
main.children().each((i, e) => {
    paragraphs[i] = {
        html: $(e).html(),
        text: $(e).text(),
        type: e.type,
    };
    if (e.type !== "style") {
        lines.push(
            ...$(e)
                .text()
                .split(/\n/g)
                .filter((p) => p !== ""),
        );
    }
});

const parsed: {
    major: string | undefined;
    minor: string | undefined;
    patch: string | undefined;
    text: string;
}[] = [];
let flag1 = false;
let flag2 = false;
for (const l of lines) {
    if (l === "マジック：ザ・ギャザリング　総合ルール") {
        flag1 = true;
    }
    if (flag1 && l === "1. ゲームの考え方") {
        flag2 = true;
    } else if (l === "用語集") {
        flag2 = false;
    }
    if (flag1 && flag2) {
        const m = l.match(/^([0-9]+)\.(([0-9]+)(\.|([a-z])))?/);
        if (m !== null) {
            let content: any = {};
            if (m[1] !== undefined) {
                content["major"] = m[1];
            }
            if (m[3] !== undefined) {
                content["minor"] = m[3];
            }
            if (m[5] !== undefined) {
                content["patch"] = m[5];
            }
            content["text"] = l;
            // parsed.push({ major: m[1], minor: m[3], patch: m[5], text: l });
            parsed.push(content);
        }
    }
}

console.log("hello");
