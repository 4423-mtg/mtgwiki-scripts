import * as cheerio from "cheerio";
import { writeFileSync } from "node:fs";

const outdir = "./cr";

// fetch
const content = await fetch("https://mtg-jp.com/gameplay/rules/docs/0006836/");
const $ = cheerio.load(await content.text());

// メイン部分HTML
const main = $(
    "body > div#wrap > main > article > div#contents > div.inner > div.reading-main > section > div.detail",
);

// 本文テキスト \n等が含まれているので行ごとに分割する
const lines: string[] = [];
let _paragraphs: { type: string; text: string; html: string | null }[] = [];
main.children().each((i, e) => {
    if (e.type !== "style") {
        lines.push(
            ...$(e)
                .text()
                .split(/\n/g)
                .filter((p) => p !== ""),
        );
    }
    _paragraphs[i] = {
        type: e.type,
        html: $(e).html(),
        text: $(e).text(),
    };
});
writeFileSync(outdir + "/lines.txt", lines.join("\n"));
console.log("> " + outdir + "/lines.txt");

type CRNumber = {
    major: string | undefined;
    minor: string | undefined;
    patch: string | undefined;
};

// 正規表現で内容を確認する
// 項番
const ptn1 = /^([0-9]+)\.(([0-9]+)(\.?|([a-z])))?/;
// 例
const ptn2 = /^ *例[:：][ 　]*(.*)$/;

const parsedLines: (
    | {
          type: "numbered";
          crNumber: CRNumber;
          text: string;
          textBody: string;
      }
    | { type: "example" | "other"; text: string }
)[] = lines.map((l) => {
    const m1 = l.match(ptn1);
    const m2 = l.match(ptn2);
    if (m1 !== null) {
        return {
            type: "numbered",
            crNumber: {
                major: m1[1],
                minor: m1[3],
                patch: m1[5],
            },
            text: l,
            textBody: omitCRNumber(l),
        };
    } else if (m2 !== null) {
        return {
            type: "example",
            text: l,
        };
    } else {
        return {
            type: "other",
            text: l,
        };
    }
});

// テキスト化
let text: string[] = [];
let mode: "header" | "toc" | "body" | "dict" | undefined = "header" as const;
parsedLines.forEach((e, i) => {
    // モード切替
    if (mode === "header" && e.text === "もくじ") {
        mode = "toc";
        // header.txtを出力
        writeFileSync(outdir + "/header.txt", text.join("\n") + "\n", {
            encoding: "utf-8",
        });
        console.log("> " + outdir + "/header.txt");
        text = [];
    } else if (
        mode === "toc" &&
        e.text === "マジック：ザ・ギャザリング　総合ルール"
    ) {
        mode = "body";
        // toc.txtを出力
        writeFileSync(outdir + "/toc.txt", text.join("\n") + "\n", {
            encoding: "utf-8",
        });
        console.log("> " + outdir + "/toc.txt");
        text = [];
        return;
    } else if (mode === "body" && e.text === "用語集") {
        mode = "dict";
        // ${major}.txtを出力
        const _prev = parsedLines[i - 1];
        if (_prev !== undefined) {
            const filename =
                _prev.type === "numbered" && _prev.crNumber.major !== undefined
                    ? _prev.crNumber.major[0] + ".txt" // FIXME: 905の1桁目を取っている
                    : "unknown.txt";
            writeFileSync(outdir + `/${filename}`, text.join("\n") + "\n", {
                encoding: "utf-8",
            });
            console.log("> " + outdir + `/${filename}`);
            text = [];
        }
    }

    // テキスト化
    if (mode === "header") {
        text.push(e.text);
    } else if (mode === "toc") {
        text.push(e.text);
    } else if (mode === "body") {
        // 番号付き項番
        if (e.type === "numbered") {
            const headingMark = "=".repeat(getLevel(e.crNumber));
            // レベル1
            if (getLevel(e.crNumber) === 1) {
                // 大項目ごとにファイルに出力
                if (e.crNumber.major === undefined) {
                    throw new Error();
                }
                const _major = parseInt(e.crNumber.major);
                // 1桁の場合はtextをflushしてから追加
                // ただし0の場合はモード切替時にflush済みなのでスキップ
                if (_major < 100) {
                    if (_major > 0) {
                        writeFileSync(
                            outdir + `/${_major - 1}.txt`,
                            text.join("\n") + "\n",
                            {
                                encoding: "utf-8",
                            },
                        );
                        console.log("> " + outdir + `/${_major - 1}.txt`);
                        text = [];
                    }
                    text.push(`<!-- ${e.text} -->`);
                } else {
                    text.push(
                        "\n" +
                            headingMark +
                            crNumberToString(e.crNumber) +
                            headingMark +
                            "\n" +
                            e.textBody +
                            "\n",
                    );
                }
            }
            // レベル2以降
            else {
                text.push(
                    headingMark +
                        crNumberToString(e.crNumber) +
                        headingMark +
                        "\n" +
                        e.text,
                );
            }
        }
        // 例
        else if (e.type === "example") {
            text.push("*" + e.text);
        } else {
            if (text.length > 0) {
                // 例が別れていることがあるので対応
                if (parsedLines[i - 1]?.type === "example") {
                    text[text.length - 1] = text[text.length - 1] + e.text;
                } else {
                    text.push(e.text);
                }
            } else {
                text.push(e.text);
            }
        }
    } else if (mode === "dict") {
        text.push(e.text);
    } else {
        text.push(e.text);
    }
});

// 保存
writeFileSync(outdir + "/dict.txt", text.join("\n") + "\n", {
    encoding: "utf-8",
});
console.log("> " + outdir + "/dict.txt");

console.log("hello");

// ==================================================================
/** 項番の階層レベル */
function getLevel(crNumber: CRNumber): number {
    if (
        crNumber.major === undefined &&
        crNumber.minor === undefined &&
        crNumber.patch === undefined
    ) {
        return 0;
    } else if (
        crNumber.major !== undefined &&
        crNumber.minor === undefined &&
        crNumber.patch === undefined
    ) {
        return 1;
    } else if (
        crNumber.major !== undefined &&
        crNumber.minor !== undefined &&
        crNumber.patch === undefined
    ) {
        return 2;
    } else if (
        crNumber.major !== undefined &&
        crNumber.minor !== undefined &&
        crNumber.patch !== undefined
    ) {
        return 3;
    } else {
        return 0;
    }
}

/** 各レベルの結合した項番文字列 */
function crNumberToString(crNumber: CRNumber): string {
    let str = "";
    if (crNumber.major !== undefined) {
        str += crNumber.major.toString();
    }
    if (crNumber.minor !== undefined) {
        str += ".";
        str += crNumber.minor.toString();
    }
    if (crNumber.patch !== undefined) {
        str += ".";
        str += crNumber.patch.toString();
    }
    return str;
}

/** 項番を除いたテキスト */
function omitCRNumber(text: string): string {
    const ptn = /^([0-9]+)\.(([0-9]+)(\.|([a-z])))? */;
    return text.replace(ptn, "");
}
