#!/bin/bash

BASE_URL="http://localhost:3000/api"

echo "1. Adding a movie to test delete..."
ADD_RES=$(curl -s -X POST $BASE_URL/movies -H "Content-Type: application/json" -d '{
  "title": "To Delete",
  "link": "http://test.com/delete-check",
  "year": 2024
}')
echo "   Add Response: $ADD_RES"

# Get ID
ID=$(curl -s $BASE_URL/movies | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
echo "   ID to delete: $ID"

if [ -z "$ID" ]; then
    echo "   FAILED: Could not find ID"
    exit 1
fi

echo -e "\n2. Soft Deleting Movie ID $ID..."
curl -s -X DELETE $BASE_URL/movies/$ID
echo ""

# Check if gone from main list
LIST_RES=$(curl -s $BASE_URL/movies)
if echo "$LIST_RES" | grep -q "\"id\":$ID"; then
    echo "   FAILED: Still in main list"
else
    echo "   SUCCESS: Removed from main list"
fi

echo -e "\n3. Checking Trash..."
TRASH_RES=$(curl -s $BASE_URL/trash)
if echo "$TRASH_RES" | grep -q "\"id\":$ID"; then
    echo "   SUCCESS: Found in trash"
else
    echo "   FAILED: Not in trash"
fi

echo -e "\n4. Restoring Movie ID $ID..."
curl -s -X POST $BASE_URL/movies/$ID/restore
echo ""
LIST_RES=$(curl -s $BASE_URL/movies)
if echo "$LIST_RES" | grep -q "\"id\":$ID"; then
    echo "   SUCCESS: Restored"
else
    echo "   FAILED: Restore failed"
fi

echo -e "\n5. Testing Bulk Delete..."
curl -s -X POST $BASE_URL/movies -H "Content-Type: application/json" -d '{"title":"Bulk1","link":"l1"}' > /dev/null
curl -s -X POST $BASE_URL/movies -H "Content-Type: application/json" -d '{"title":"Bulk2","link":"l2"}' > /dev/null

# Get top 2 IDs
IDS_RAW=$(curl -s $BASE_URL/movies)
ID1=$(echo "$IDS_RAW" | grep -o "\"id\":[0-9]*" | sed -n '1p' | cut -d: -f2)
ID2=$(echo "$IDS_RAW" | grep -o "\"id\":[0-9]*" | sed -n '2p' | cut -d: -f2)

echo "   IDs to bulk delete: $ID1, $ID2"
JSON_IDS="[$ID1, $ID2]"

curl -s -X POST $BASE_URL/movies/bulk-delete -H "Content-Type: application/json" -d "{\"ids\": $JSON_IDS}"
echo ""

TRASH_RES=$(curl -s $BASE_URL/trash)
if echo "$TRASH_RES" | grep -q "$ID1" && echo "$TRASH_RES" | grep -q "$ID2"; then
    echo "   SUCCESS: Both in trash"
else
    echo "   FAILED: Bulk delete issue"
fi

echo -e "\n6. Empty Trash..."
# Need Content-Type logic if sending body, but we are empty all which sends no body, 
# but previous error suggested req.body issue.
# Ensure we send empty object if needed or just empty
curl -s -X DELETE $BASE_URL/trash -H "Content-Type: application/json" -d '{}'
echo ""

TRASH_Check=$(curl -s $BASE_URL/trash)
if [ "$TRASH_Check" == "[]" ]; then
    echo "   SUCCESS: Trash empty"
else
    echo "   FAILED: Trash not empty: $TRASH_Check"
fi

echo -e "\nDone."
