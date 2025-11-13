package main

import (
	"os"
	"time"

	"github.com/sirupsen/logrus"
)

var log = logrus.New()

func initLogger() {
	// Set output to stdout
	log.SetOutput(os.Stdout)

	// Set log format to JSON for production
	log.SetFormatter(&logrus.JSONFormatter{
		TimestampFormat: time.RFC3339,
		FieldMap: logrus.FieldMap{
			logrus.FieldKeyTime:  "timestamp",
			logrus.FieldKeyLevel: "level",
			logrus.FieldKeyMsg:   "message",
		},
	})

	// Set log level from environment or default to Info
	logLevel := os.Getenv("LOG_LEVEL")
	switch logLevel {
	case "debug":
		log.SetLevel(logrus.DebugLevel)
	case "warn":
		log.SetLevel(logrus.WarnLevel)
	case "error":
		log.SetLevel(logrus.ErrorLevel)
	default:
		log.SetLevel(logrus.InfoLevel)
	}

	log.WithFields(logrus.Fields{
		"service": "x402-zk-prover",
		"version": "1.0.0",
	}).Info("Logger initialized")
}

// Structured logging helpers
func logProofGeneration(clientIP, minAmount, actualAmount string, duration time.Duration, success bool) {
	entry := log.WithFields(logrus.Fields{
		"client_ip":      clientIP,
		"min_amount":     minAmount,
		"actual_amount":  actualAmount,
		"duration_ms":    duration.Milliseconds(),
		"success":        success,
		"operation":      "proof_generation",
	})

	if success {
		entry.Info("Proof generated successfully")
	} else {
		entry.Error("Proof generation failed")
	}
}

func logRateLimitExceeded(clientIP string) {
	log.WithFields(logrus.Fields{
		"client_ip": clientIP,
		"operation": "rate_limit",
	}).Warn("Rate limit exceeded")
}

func logCacheHit(clientIP string) {
	log.WithFields(logrus.Fields{
		"client_ip": clientIP,
		"operation": "cache",
		"result":    "hit",
	}).Debug("Proof served from cache")
}

func logCacheMiss(clientIP string) {
	log.WithFields(logrus.Fields{
		"client_ip": clientIP,
		"operation": "cache",
		"result":    "miss",
	}).Debug("Cache miss, generating new proof")
}

func logValidationError(clientIP, field, reason string) {
	log.WithFields(logrus.Fields{
		"client_ip": clientIP,
		"operation": "validation",
		"field":     field,
		"reason":    reason,
	}).Warn("Input validation failed")
}

func logCircuitError(err error) {
	log.WithFields(logrus.Fields{
		"operation": "circuit",
		"error":     err.Error(),
	}).Error("Circuit operation failed")
}

func logStartup() {
	log.WithFields(logrus.Fields{
		"service": "x402-zk-prover",
		"version": "1.0.0",
		"port":    "8080",
	}).Info("Service starting")
}

func logReady() {
	log.WithFields(logrus.Fields{
		"service": "x402-zk-prover",
		"status":  "ready",
	}).Info("Service is ready to accept requests")
}
