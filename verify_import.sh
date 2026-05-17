#!/bin/bash

BASE_URL="http://localhost:3000/api"

echo "1. Testing Bulk Import API directly..."
# We reuse a known link or a mock if possible. 
# Since we don't want to spam external site, we test the logic with a fake URL if we can mock it, 
# but scraper requires real HTML. 
# We'll rely on the fact that previous verification steps showed scraper works. 
# Here we test the endpoint's handling of bad URLs and maybe a real one if needed, but cautiously.

# Test bad URL
RES=$(curl -s -X POST $BASE_URL/movies/import -H "Content-Type: application/json" -d '{"url": "http://google.com"}')
echo "   Bad URL Check: $RES"
if echo "$RES" | grep -q "HDRezka URL required"; then
    echo "   SUCCESS: Rejected non-hdrezka"
else
    echo "   FAILED: Accepted non-hdrezka"
fi

# We won't spam real imports in script to respect rate limits, but we verified the code logic.
# The endpoint calls getMovieDetails which implies if that works (verified before), this works.

echo -e "\nDone."
