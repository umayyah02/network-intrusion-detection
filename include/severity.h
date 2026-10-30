#pragma once
// Severity is NOT part of the dataset labels (PRD section 8.4). This is a simple, documented
// mapping from attack type (and confidence) to Low / Medium / High. It is a PROPOSAL for the team to
// agree on in the PRD's open question 3. Change it here and nowhere else.
//
//   DoS        -> High    (service impact)
//   BruteForce -> Medium  (someone is guessing credentials)
//   PortScan   -> Low     (reconnaissance only)
//   anything else -> Medium
//   confidence below 0.6 lowers the level by one step (never below Low)
#include <algorithm>
#include <cctype>
#include <string>

namespace api {

inline std::string severityFor(const std::string& attackClass, double confidence) {
    std::string c = attackClass;
    std::transform(c.begin(), c.end(), c.begin(), [](unsigned char ch) { return std::tolower(ch); });
    int level = 2;  // 1 = Low, 2 = Medium, 3 = High
    if (c == "dos") level = 3;
    else if (c == "bruteforce") level = 2;
    else if (c == "portscan") level = 1;
    if (confidence < 0.6 && level > 1) --level;
    static const char* const names[] = {"", "Low", "Medium", "High"};
    return names[level];
}

}  // namespace api
