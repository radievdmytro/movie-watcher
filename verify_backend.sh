#!/bin/bash

BASE_URL="http://localhost:3000/api"

echo "1. Testing Search (Query: 'Matrix')..."
SEARCH_RES=$(curl -s -X POST $BASE_URL/movies/search -H "Content-Type: application/json" -d '{"query":"Matrix"}')
echo "$SEARCH_RES" | head -c 200
echo "..."

echo -e "\n\n2. Adding Movie (Mock)..."
ADD_RES=$(curl -s -X POST $BASE_URL/movies -H "Content-Type: application/json" -d '{
  "title": "The Matrix Test",
  "original_title": "The Matrix",
  "year": 1999,
  "link": "https://hdrezka.ag/films/fiction/1-the-matrix-1999.html",
  "rating": 8.7,
  "description": "A computer hacker...",
  "poster_url": "https://static.hdrezka.ac/i/2013/11/5/u3acbdd512596ri98s28b.jpg",
  "genres": "Sci-Fi, Action",
  "actors": "Keanu Reeves, Laurence Fishburne",
  "director": "Lana Wachowski"
}')
echo "Response: $ADD_RES"

echo -e "\n\n3. Listing Movies..."
LIST_RES=$(curl -s $BASE_URL/movies)
echo "$LIST_RES"

echo -e "\n\nDone."
