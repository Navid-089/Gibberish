#include <bits/stdc++.h>
using namespace std;

class Solution {
public:
    bool hasDuplicate(vector<int>& nums) {
        unordered_set<int> seen;
        for (int num : nums) {
            if (seen.count(num)) return true; // duplicate found
            seen.insert(num);
        }
        return false;
    }
};

int main() {
    Solution solution;
    vector<int> v1 = {1, 2, 3};
    vector<int> v2 = {1, 2, 3, 1};

    cout << solution.hasDuplicate(v1) << endl; // 0 (false)
    cout << solution.hasDuplicate(v2) << endl; // 1 (true)
}
