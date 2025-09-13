#include <bits/stdc++.h>
using namespace std;

class Solution {
public:
    // Encodes a list of strings to a single string.
    string encode(vector<string>& strs) {
        string result;
        for (string& s : strs) {
            result += to_string(s.size()) + "#" + s;
        }
        return result;
    }

    // Decodes a single string to a list of strings.
    vector<string> decode(string s) {
        vector<string> result;
        int i = 0;
        while (i < s.size()) {
            int j = i;
            while (s[j] != '#') j++;              // find '#'
            int len = stoi(s.substr(i, j - i));   // length before '#'
            string word = s.substr(j + 1, len);   // extract word
            result.push_back(word);
            i = j + 1 + len;                      // move pointer
        }
        return result;
    }
};

int main() {
    Solution solution;
    vector<string> strs = {"leet", "code", "hello#world", "123"};
    
    string encoded = solution.encode(strs);
    cout << "Encoded: " << encoded << endl;

    vector<string> decoded = solution.decode(encoded);
    cout << "Decoded:" << endl;
    for (string& s : decoded) {
        cout << s << endl;
    }
}
