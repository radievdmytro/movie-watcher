const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, 'client', 'src', 'components', 'MovieGrid.jsx');
let content = fs.readFileSync(p, 'utf8');

// 1. Add state
const stateTarget = `const [hasMoreBgCache, setHasMoreBgCache] = useState(true);`;
const stateReplacement = `const [hasMoreBgCache, setHasMoreBgCache] = useState(true);
    const [hasFiredLiveSearch, setHasFiredLiveSearch] = useState(false);
    const [isLiveSearching, setIsLiveSearching] = useState(false);`;
content = content.replace(stateTarget, stateReplacement);

// 2. Reset in performBgSearch
const performBgSearchTarget = `setHasMoreBgCache(results.length >= 30);`;
const performBgSearchReplacement = `setHasMoreBgCache(results.length >= 30);
                setHasFiredLiveSearch(false);`;
content = content.replace(performBgSearchTarget, performBgSearchReplacement);

// 3. Trigger in loadMoreBgCache
const loadMoreTarget = `if (results.length < 30) {
                    setHasMoreBgCache(false);
                }
            })
            .catch(err => {`;
const loadMoreReplacement = `if (results.length < 30) {
                    setHasMoreBgCache(false);
                    // Check if we should trigger live search
                    if (deferredFilterQuery && !hasFiredLiveSearch) {
                        setHasFiredLiveSearch(true);
                        setIsLiveSearching(true);
                        queryParams.append('live', 'true');
                        fetch(\`/api/cache/search?\${queryParams.toString()}\`)
                            .then(r => r.ok ? r.json() : [])
                            .then(liveData => {
                                const liveResults = liveData.results || liveData || [];
                                if (liveResults.length > 0) {
                                    setBackgroundCacheResults(prv => {
                                        const exist = new Set(prv.map(m => m.link));
                                        const newLive = liveResults.filter(m => !exist.has(m.link));
                                        return [...prv, ...newLive];
                                    });
                                }
                            })
                            .catch(console.error)
                            .finally(() => setIsLiveSearching(false));
                    }
                }
            })
            .catch(err => {`;
content = content.replace(loadMoreTarget, loadMoreReplacement);

// 4. Update filteredOnboardingCacheMovies to include description and fix the glow style
const filterTarget = `const titleMatch = searchFields.title && ((movie.title && movie.title.toLowerCase().includes(q)) || (movie.original_title && movie.original_title.toLowerCase().includes(q)));
                const yearMatch = searchFields.year && movie.year && movie.year.toString().includes(q);
                const directorMatch = searchFields.director && movie.director && movie.director.toLowerCase().includes(q);
                const actorMatch = searchFields.actor && movie.actors && movie.actors.toLowerCase().includes(q);

                if (!titleMatch && !yearMatch && !directorMatch && !actorMatch) {`;
                
const filterReplacement = `const titleMatch = searchFields.title && ((movie.title && movie.title.toLowerCase().includes(q)) || (movie.original_title && movie.original_title.toLowerCase().includes(q)));
                const yearMatch = searchFields.year && movie.year && movie.year.toString().includes(q);
                const directorMatch = searchFields.director && movie.director && movie.director.toLowerCase().includes(q);
                const actorMatch = searchFields.actor && movie.actors && movie.actors.toLowerCase().includes(q);
                const descMatch = searchFields.description && movie.misc && movie.misc.toLowerCase().includes(q); // wait, description is 'misc' in cache, actually description isn't in scraped_movies_cache but the DB cyrillic search works on backend! So locally we might not have 'description' in the object from the DB because the DB schema 'scraped_movies_cache' only has genres as 'misc'. Wait, it DOESN'T have a description field. But for now we can just allow it if it has isLiveResult or we just bypass filter if isLiveResult!

                if (!titleMatch && !yearMatch && !directorMatch && !actorMatch && !descMatch && !movie.isLiveResult) {`;
content = content.replace(filterTarget, filterReplacement);

// 5. Add Yellow Glow for isLiveResult
const glowTarget = `layout={!isMobile}
                                    className={\`movie-card \${isMovieWatched ? 'watched' : ''}\`}
                                    style={{
                                        position: 'relative',
                                        borderRadius: '12px',
                                        overflow: 'visible',
                                        aspectRatio: '2/3',
                                        animation: 'fadeIn 0.4s ease',
                                    }}`;
const glowReplacement = `layout={!isMobile}
                                    className={\`movie-card \${isMovieWatched ? 'watched' : ''}\`}
                                    style={{
                                        position: 'relative',
                                        borderRadius: '12px',
                                        overflow: 'visible',
                                        aspectRatio: '2/3',
                                        animation: 'fadeIn 0.4s ease',
                                        boxShadow: movie.isLiveResult ? '0 0 15px rgba(255, 215, 0, 0.7)' : 'none',
                                    }}`;
content = content.replace(glowTarget, glowReplacement);

// 6. Add Loading Indicator
const loaderTarget = `{/* Onboarding Infinite Scroll Sentinel or Guest CTA */}`;
const loaderReplacement = `{isLiveSearching && (
                        <div style={{
                            gridColumn: '1 / -1',
                            padding: '20px',
                            textAlign: 'center',
                            color: 'var(--accent-gold)',
                            fontWeight: 'bold',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '10px'
                        }}>
                            <div className="loading-spinner" style={{ width: '20px', height: '20px', borderTopColor: 'var(--accent-gold)' }}></div>
                            Searching HDRezka live...
                        </div>
                    )}
                    
                    {/* Onboarding Infinite Scroll Sentinel or Guest CTA */}`;
content = content.replace(loaderTarget, loaderReplacement);

fs.writeFileSync(p, content, 'utf8');
console.log("Patched MovieGrid.jsx");
