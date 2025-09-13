#include <bits/stdc++.h>
using namespace std;

class Solution {
    public:
        vector <int> topKFrequent(vector<int> &nums, int k) {
            unordered_map<int,int> mp; 
            for(int num: nums) {
                mp[num]++;
            }
            
            priority_queue<pair<int,int>, vector<pair<int,int>>, greater<pair<int,int>>> minHeap;

            for(auto [num,count] : mp) {
                minHeap.push({count,num});
                if(minHeap.size() > k) minHeap.pop();
            }

            vector<int> result;
            while(!minHeap.empty()) {
                result.push_back(minHeap.top().second);
                minHeap.pop();
            }

            return result;

        }

};

int main() {
    Solution sol;
    vector<int> nums = {1,1,1,2,2,3};
    int k = 2;
    vector<int> ans = sol.topKFrequent(nums, k);

    for (int x : ans) cout << x << " ";  
}