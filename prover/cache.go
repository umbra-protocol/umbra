package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"sync"
	"time"
)

// ProofCache implements an in-memory cache for generated proofs
type ProofCache struct {
	mu      sync.RWMutex
	cache   map[string]*CachedProof
	maxSize int
	ttl     time.Duration
}

// CachedProof represents a cached proof with metadata
type CachedProof struct {
	Proof        string
	PublicInputs string
	GeneratedAt  time.Time
	AccessCount  int
}

// NewProofCache creates a new proof cache
func NewProofCache(maxSize int, ttl time.Duration) *ProofCache {
	pc := &ProofCache{
		cache:   make(map[string]*CachedProof),
		maxSize: maxSize,
		ttl:     ttl,
	}

	// Start cleanup goroutine
	go pc.cleanup()

	return pc
}

// generateKey creates a cache key from proof request
func generateCacheKey(req *ProofRequest) string {
	// Create deterministic key from public inputs only
	// (private inputs shouldn't affect cache key for same public constraints)
	data := req.MinAmount + req.RecipientKey + req.MaxBlockAge
	hash := sha256.Sum256([]byte(data))
	return hex.EncodeToString(hash[:])
}

// Get retrieves a cached proof if it exists and is still valid
func (pc *ProofCache) Get(req *ProofRequest) (*ProofResponse, bool) {
	key := generateCacheKey(req)

	pc.mu.RLock()
	defer pc.mu.RUnlock()

	cached, exists := pc.cache[key]
	if !exists {
		return nil, false
	}

	// Check if expired
	if time.Since(cached.GeneratedAt) > pc.ttl {
		return nil, false
	}

	// Increment access count
	cached.AccessCount++

	return &ProofResponse{
		Proof:          cached.Proof,
		PublicInputs:   cached.PublicInputs,
		GenerationTime: 0, // Cached, so instant
	}, true
}

// Set stores a proof in the cache
func (pc *ProofCache) Set(req *ProofRequest, resp *ProofResponse) {
	key := generateCacheKey(req)

	pc.mu.Lock()
	defer pc.mu.Unlock()

	// Check if we need to evict
	if len(pc.cache) >= pc.maxSize {
		pc.evictLRU()
	}

	pc.cache[key] = &CachedProof{
		Proof:        resp.Proof,
		PublicInputs: resp.PublicInputs,
		GeneratedAt:  time.Now(),
		AccessCount:  1,
	}
}

// evictLRU evicts the least recently used item
func (pc *ProofCache) evictLRU() {
	var oldestKey string
	var oldestTime time.Time = time.Now()

	for key, cached := range pc.cache {
		if cached.GeneratedAt.Before(oldestTime) {
			oldestTime = cached.GeneratedAt
			oldestKey = key
		}
	}

	if oldestKey != "" {
		delete(pc.cache, oldestKey)
	}
}

// cleanup periodically removes expired entries
func (pc *ProofCache) cleanup() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		pc.mu.Lock()
		now := time.Now()
		for key, cached := range pc.cache {
			if now.Sub(cached.GeneratedAt) > pc.ttl {
				delete(pc.cache, key)
			}
		}
		pc.mu.Unlock()
	}
}

// Stats returns cache statistics
func (pc *ProofCache) Stats() map[string]interface{} {
	pc.mu.RLock()
	defer pc.mu.RUnlock()

	totalAccess := 0
	for _, cached := range pc.cache {
		totalAccess += cached.AccessCount
	}

	return map[string]interface{}{
		"size":         len(pc.cache),
		"maxSize":      pc.maxSize,
		"totalAccess":  totalAccess,
		"ttlSeconds":   int(pc.ttl.Seconds()),
	}
}
