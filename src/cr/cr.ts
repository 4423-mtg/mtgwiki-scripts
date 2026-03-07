/** 項番行の頭から項番をキャプチャする */
export function parseCRNumber(text: string): CRNumber {
    const ptn = /^([0-9]+)(\.(([0-9]+)(\.|([a-z]))?)?)?/;
    const m = text.match(ptn);
    if (m === null) {
        return {
            major: undefined,
            minor: undefined,
            patch: undefined,
        };
    } else {
        return {
            major: m[1],
            minor: m[4],
            patch: m[6],
        };
    }
}
/** 項番を除いたテキスト */ // TODO: 型付け
export function parseTextBody(text: string): string {
    const ptn = /^([0-9]+)(\.(([0-9]+)(\.|([a-z]))?)?)?/;
    return text.replace(ptn, "").replace(/^ */, "");
}
/** 番号付きの項番かどうか */
export function isNumberedLine(text: string): boolean {
    const ptn = /^([0-9]+)(\.(([0-9]+)(\.|([a-z]))?)?)?/;
    return text.match(ptn) !== null;
}

// =======================================================
/** CR番号 */
export type CRNumber = {
    major: string | undefined;
    minor: string | undefined;
    patch: string | undefined;
};

/** CR番号の階層レベル */
export function getLevel(crNumber: CRNumber): number {
    let level = 0;
    if (crNumber.major !== undefined) {
        level++;
        if (crNumber.minor !== undefined) {
            level++;
            if (crNumber.patch !== undefined) {
                level++;
            }
        }
    }
    return level;
}

/** CR番号から文字列に変換する */
export function crNumberToString(crNumber: CRNumber): string {
    let str = "";
    str += crNumber.major ? crNumber.major.toString() : "";
    str += crNumber.minor ? "." + crNumber.minor.toString() : "";
    str += crNumber.patch ? crNumber.patch.toString() : "";
    return str;
}

/** CR番号からセクション番号を取得 */
export function crNumberToSectionNumber(
    crNumber: CRNumber,
): string | undefined {
    return crNumber.major?.at(0);
}

// =======================================================
/** 前書きの項目 */
export type HeaderItem = { part: "header"; text: string };
/** 目次の項目 */
export type TocItem = {
    part: "toc";
    text: string;
    crNumber: string;
    noNumberText: string;
};
/** 本文の項目 */
export type BodyItem = {
    part: "body";
    text: string;
    crNumber: CRNumber;
    noNumberText: string;
};
/** 用語集の項目 */
export type DictItem = {
    part: "dict";
    text: string;
    itemName: string;
    body: string;
};

/** 本文の項目をテキストに変換する */
export function bodyItemToText(item: BodyItem): string | undefined {
    if (
        item.crNumber.major !== undefined &&
        parseInt(item.crNumber.major) < 100
    ) {
        // 一番大きいレベル (0, 1, 2, ..., 9) はコメントで出力
        // return `<!-- ${item.text} -->`;
        return item.text;
    } else {
        let ret = "";
        const headingMark = "=".repeat(getLevel(item.crNumber));
        if (getLevel(item.crNumber) === 1) {
            ret += "\n";
        }
        ret += headingMark;
        // ret += '<span style="color:blue;">';
        ret += crNumberToString(item.crNumber);
        // ret += "</span>";
        ret += headingMark;
        ret += "\n";
        ret += item.noNumberText
            // rule 103.2a-e
            .replaceAll(
                /\brule ([0-9]+(\.[0-9]+([a-z](-[a-z])?)?)?)\.?/g,
                (match, p1: string, p2, p3, p4: string | undefined) => {
                    const crNumber = p1;
                    const range = p4;
                    return crNumber.length === 1
                        ? `[[総合ルール/${crNumber}|${match}]]`
                        : range === undefined
                          ? `[[総合ルール/${crNumber[0]}#${crNumber}|${match}]]`
                          : `[[総合ルール/${crNumber[0]}#${crNumber.slice(0, crNumber.length - range.length)}|${match}]]`;
                },
            )
            .replaceAll(/\n/g, "\n\n");
        return ret;
    }
}
/** 項番を各ページの目次に追加 */
export function bodyItemToTocText(item: BodyItem): string | undefined {
    const level = getLevel(item.crNumber);

    switch (level) {
        case 0:
            return "*" + `[[#${crNumberToString(item.crNumber)}|${item.text}]]`;
        case 1:
            return (
                (item.crNumber.major !== undefined &&
                item.crNumber.major.length < 3
                    ? "*"
                    : "**") +
                `[[#${crNumberToString(item.crNumber)}|${item.text}]]`
            );
        case 2:
            if (
                item.crNumber.major === "701" ||
                item.crNumber.major === "702"
            ) {
                return (
                    "***" +
                    (item.crNumber.minor !== "1"
                        ? `[[#${crNumberToString(item.crNumber)}|${item.text}]]`
                        : `[[#${crNumberToString(item.crNumber)}|${crNumberToString(item.crNumber)}]]`)
                );
            }
            break;
    }
    return undefined;
}
