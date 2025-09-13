#include <bits/stdc++.h>
using namespace std;

class Solution {
public:
    
    string encode(vector<string>& strs) {
        string result;
        for (string& s : strs) {
            result += to_string(s.size()) + "#" + s;
        }
        return result;
    }

   
    vector<string> decode(string s) {
        vector<string> result;
        int i = 0;
        while (i < s.size()) {
            int j = i;
            while (s[j] != '#') j++;              
            int len = stoi(s.substr(i, j - i));   
            string word = s.substr(j + 1, len);  
            result.push_back(word);
            i = j + 1 + len;                      
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
