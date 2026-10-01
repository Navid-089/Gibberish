#include <bits/stdc++.h>
using namespace std;

class Solution {
    public:
        vector <int> twoSum(vector<int>& nums, int target) {
            if(nums.size() == 0 || nums.size() == 1) return vector<int>();

            vector<int> results;
            for(int i = 0 ; i<nums.size() - 1 ; i++) {
                for(int j = i+1; j<nums.size(); j++) {
                    if(nums[i] + nums[j] == target) {
                        results.push_back(i);
                        results.push_back(j);
                        return results;
                    }
                }
            }

            return results;
        }
};

int main() {
    Solution sol;
    vector<int> nums = {2, 7, 11, 15};
    int target = 18;
    vector<int> ans = sol.twoSum(nums, target);
    for (int x : ans) cout << x << " ";  // prints: 0 1
}

