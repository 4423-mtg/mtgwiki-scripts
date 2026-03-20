export type CardName = {
    englishName: string;
    japaneseName?: string | undefined;
};

export function isCardName(arg: unknown): arg is CardName {
    return (
        typeof arg === "object" &&
        arg !== null &&
        "japaneseName" in arg &&
        typeof arg.japaneseName === "string" &&
        "englishName" in arg &&
        typeof arg.englishName === "string"
    );
}
