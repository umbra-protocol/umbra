package main

import (
	"crypto/subtle"
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
)

// AuthMiddleware validates API keys
func authMiddleware() gin.HandlerFunc {
	// Get API key from environment
	apiKey := os.Getenv("API_KEY")

	// If no API key is set, skip auth (development mode)
	if apiKey == "" {
		log.Warn("API_KEY not set - authentication disabled (NOT FOR PRODUCTION)")
		return func(c *gin.Context) {
			c.Next()
		}
	}

	return func(c *gin.Context) {
		// Get API key from header
		authHeader := c.GetHeader("Authorization")

		if authHeader == "" {
			log.WithFields(logrus.Fields{
				"client_ip": c.ClientIP(),
				"path":      c.Request.URL.Path,
			}).Warn("Missing Authorization header")

			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Missing Authorization header",
			})
			c.Abort()
			return
		}

		// Extract Bearer token
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			log.WithFields(logrus.Fields{
				"client_ip": c.ClientIP(),
				"path":      c.Request.URL.Path,
			}).Warn("Invalid Authorization header format")

			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Invalid Authorization header format. Expected: 'Bearer <token>'",
			})
			c.Abort()
			return
		}

		providedKey := parts[1]

		// Constant-time comparison to prevent timing attacks
		if subtle.ConstantTimeCompare([]byte(providedKey), []byte(apiKey)) != 1 {
			log.WithFields(logrus.Fields{
				"client_ip": c.ClientIP(),
				"path":      c.Request.URL.Path,
			}).Warn("Invalid API key")

			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Invalid API key",
			})
			c.Abort()
			return
		}

		log.WithFields(logrus.Fields{
			"client_ip": c.ClientIP(),
			"path":      c.Request.URL.Path,
		}).Debug("Authentication successful")

		c.Next()
	}
}

// CORSMiddleware handles CORS
func corsMiddleware() gin.HandlerFunc {
	allowedOrigins := os.Getenv("ALLOWED_ORIGINS")
	if allowedOrigins == "" {
		allowedOrigins = "*" // Allow all in development
		log.Warn("ALLOWED_ORIGINS not set - allowing all origins (NOT FOR PRODUCTION)")
	}

	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")

		// Check if origin is allowed
		if allowedOrigins == "*" || strings.Contains(allowedOrigins, origin) {
			c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
		} else {
			c.Writer.Header().Set("Access-Control-Allow-Origin", allowedOrigins)
		}

		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}

// SecurityHeadersMiddleware adds security headers
func securityHeadersMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Prevent clickjacking
		c.Writer.Header().Set("X-Frame-Options", "DENY")

		// Prevent MIME sniffing
		c.Writer.Header().Set("X-Content-Type-Options", "nosniff")

		// Enable XSS protection
		c.Writer.Header().Set("X-XSS-Protection", "1; mode=block")

		// Strict Transport Security (HTTPS only)
		if os.Getenv("ENABLE_HSTS") == "true" {
			c.Writer.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		}

		// Content Security Policy
		c.Writer.Header().Set("Content-Security-Policy", "default-src 'self'")

		// Referrer Policy
		c.Writer.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")

		c.Next()
	}
}
