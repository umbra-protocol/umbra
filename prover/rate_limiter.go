package main

import (
	"sync"
	"time"
)

// RateLimiter implements token bucket rate limiting per IP
type RateLimiter struct {
	mu       sync.Mutex
	buckets  map[string]*TokenBucket
	maxRate  int           // requests per period
	period   time.Duration // time period
	cleanupInterval time.Duration
}

// TokenBucket represents a token bucket for one IP
type TokenBucket struct {
	tokens    int
	lastRefill time.Time
}

// NewRateLimiter creates a new rate limiter
func NewRateLimiter(maxRate int, period time.Duration) *RateLimiter {
	rl := &RateLimiter{
		buckets:  make(map[string]*TokenBucket),
		maxRate:  maxRate,
		period:   period,
		cleanupInterval: 5 * time.Minute,
	}

	// Start cleanup goroutine to remove old buckets
	go rl.cleanup()

	return rl
}

// Allow checks if a request from the given IP should be allowed
func (rl *RateLimiter) Allow(ip string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	bucket, exists := rl.buckets[ip]
	if !exists {
		bucket = &TokenBucket{
			tokens:    rl.maxRate,
			lastRefill: time.Now(),
		}
		rl.buckets[ip] = bucket
	}

	// Refill tokens based on time elapsed
	now := time.Now()
	elapsed := now.Sub(bucket.lastRefill)
	tokensToAdd := int(elapsed / rl.period * time.Duration(rl.maxRate))

	if tokensToAdd > 0 {
		bucket.tokens += tokensToAdd
		if bucket.tokens > rl.maxRate {
			bucket.tokens = rl.maxRate
		}
		bucket.lastRefill = now
	}

	// Check if request can be allowed
	if bucket.tokens > 0 {
		bucket.tokens--
		return true
	}

	return false
}

// cleanup removes old bucket entries
func (rl *RateLimiter) cleanup() {
	ticker := time.NewTicker(rl.cleanupInterval)
	defer ticker.Stop()

	for range ticker.C {
		rl.mu.Lock()
		now := time.Now()
		for ip, bucket := range rl.buckets {
			// Remove buckets not used in last 10 minutes
			if now.Sub(bucket.lastRefill) > 10*time.Minute {
				delete(rl.buckets, ip)
			}
		}
		rl.mu.Unlock()
	}
}
