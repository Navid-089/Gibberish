def build_lps(pattern: str) -> list[int]:
    
    lps = [0] * len(pattern)
    length = 0  # length of the previous longest prefix suffix
    i = 1

    while i < len(pattern):
        if pattern[i] == pattern[length]:
            length += 1
            lps[i] = length
            i += 1
        else:
            if length != 0:
                length = lps[length - 1]  # fallback
            else:
                lps[i] = 0
                i += 1
    return lps


def kmp_search(text: str, pattern: str) -> int:
    
    if not pattern:
        return 0

    lps = build_lps(pattern)
    i = j = 0  # i -> text, j -> pattern

    while i < len(text):
        if text[i] == pattern[j]:
            i += 1
            j += 1
            if j == len(pattern):
                return i - j
        else:
            if j != 0:
                j = lps[j - 1]
            else:
                i += 1
    return -1


def kmp_find_all(text: str, pattern: str) -> list[int]:
    
    if not pattern:
        return list(range(len(text) + 1))

    lps = build_lps(pattern)
    i = j = 0
    res = []

    while i < len(text):
        if text[i] == pattern[j]:
            i += 1
            j += 1
            if j == len(pattern):
                res.append(i - j)
                j = lps[j - 1]  # look for next match
        else:
            if j != 0:
                j = lps[j - 1]
            else:
                i += 1
    return res



if __name__ == "__main__":
    text = "ababcabcabababd"
    pattern = "ababd"

    first = kmp_search(text, pattern)
    print("First index:", first)  # 10

    
    all_indices = kmp_find_all("aaaaa", "aa")
    print("All indices:", all_indices)  # [0, 1, 2, 3]
