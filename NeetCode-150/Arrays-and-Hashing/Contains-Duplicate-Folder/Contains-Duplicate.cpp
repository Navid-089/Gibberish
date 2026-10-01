#include <bits/stdc++.h>
using namespace std;

class Solution {
    public:
        bool hasDuplicate(vector<int>& nums) {
            if(nums.size() == 0 || nums.size() == 1) return false;
            for(int i = 0 ; i < nums.size() - 1 ; i++ ) {
                for(int j = i+1; j<nums.size(); j++) {
                    if(nums[i] == nums[j]) return true;
                }
            }

            return false;
            
            
        }
    };

int main() {
    Solution* solution = new Solution();
    vector<int> v1;
    v1.push_back(1);
    v1.push_back(2);
    v1.push_back(3);
   

    cout << solution->hasDuplicate(v1);
}