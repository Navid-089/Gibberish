#include <bits/stdc++.h> 
using namespace std;

class Solution {
    public: 
        vector<vector<string>> groupAnagrams(vector<string>& strs) {
            unordered_map<string, vector<string>> mp;

            for(string s: strs) {
                string key = s;
                sort(key.begin(), key.end());
                mp[key].push_back(s);
                
            }

            vector<vector<string>> results;
            for(auto p: mp) {
                results.push_back(p.second);
            }

            return results;
        }
};

int main() {
    Solution solution;
    vector<string> strs = {"eat","tea","tan","ate","nat","bat"};
    vector<vector<string>> ans = solution.groupAnagrams(strs);

    for(auto group: ans) {
        for(auto word : group) cout << word << " ";
        cout << endl;
    }
}