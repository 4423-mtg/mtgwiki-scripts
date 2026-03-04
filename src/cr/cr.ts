export type CRNumber = {
    major: string | undefined;
    minor: string | undefined;
    patch: string | undefined;
};

export function equals(arg1: CRNumber, arg2: CRNumber): boolean {
    return (
        arg1.major === arg2.major &&
        arg1.minor === arg2.minor &&
        arg1.patch === arg2.patch
    );
}
