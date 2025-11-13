package main

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/gin-gonic/gin"
)

var (
	// Proof generation metrics
	proofGenerationDuration = promauto.NewHistogram(prometheus.HistogramOpts{
		Name:    "proof_generation_duration_seconds",
		Help:    "Time taken to generate a proof",
		Buckets: []float64{0.05, 0.1, 0.15, 0.2, 0.3, 0.5, 1, 2},
	})

	proofGenerationTotal = promauto.NewCounter(prometheus.CounterOpts{
		Name: "proof_generation_total",
		Help: "Total number of proofs generated",
	})

	proofGenerationErrors = promauto.NewCounter(prometheus.CounterOpts{
		Name: "proof_generation_errors_total",
		Help: "Total number of proof generation errors",
	})

	proofVerificationDuration = promauto.NewHistogram(prometheus.HistogramOpts{
		Name:    "proof_verification_duration_seconds",
		Help:    "Time taken to verify a proof",
		Buckets: []float64{0.001, 0.005, 0.01, 0.02, 0.05, 0.1},
	})

	// Rate limiting metrics
	rateLimitExceeded = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "rate_limit_exceeded_total",
		Help: "Number of rate limit violations by IP",
	}, []string{"ip"})

	activeRequests = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "active_requests",
		Help: "Number of requests currently being processed",
	})

	// Circuit metrics
	circuitConstraints = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "circuit_constraints_total",
		Help: "Total number of constraints in the circuit",
	})

	// System metrics
	witnessGenerationDuration = promauto.NewHistogram(prometheus.HistogramOpts{
		Name:    "witness_generation_duration_seconds",
		Help:    "Time taken to generate witness",
		Buckets: []float64{0.01, 0.02, 0.05, 0.1, 0.2, 0.5},
	})
)

// metricsHandler returns a gin handler for Prometheus metrics
func metricsHandler() gin.HandlerFunc {
	h := promhttp.Handler()
	return func(c *gin.Context) {
		h.ServeHTTP(c.Writer, c.Request)
	}
}

// metricsMiddleware tracks active requests
func metricsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		activeRequests.Inc()
		defer activeRequests.Dec()
		c.Next()
	}
}
