package main

import (
	"encoding/json"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"time"

	"github.com/consensys/gnark-crypto/ecc"
	"github.com/consensys/gnark-crypto/ecc/bn254/twistededwards/eddsa"
	"github.com/consensys/gnark-crypto/hash"
	"github.com/consensys/gnark/backend/groth16"
	"github.com/consensys/gnark/frontend"
	"github.com/consensys/gnark/frontend/cs/r1cs"
	"github.com/consensys/gnark/std/algebra/native/twistededwards"
	"github.com/consensys/gnark/std/hash/mimc"
	"github.com/consensys/gnark/std/signature/eddsa"
	"github.com/gin-gonic/gin"
)

// PaymentCircuit defines the constraint system for payment proofs
type PaymentCircuit struct {
	// Public inputs
	MinAmount     frontend.Variable `gnark:",public"`
	RecipientKeyX frontend.Variable `gnark:",public"`
	RecipientKeyY frontend.Variable `gnark:",public"`
	MaxBlockAge   frontend.Variable `gnark:",public"`
	CurrentTime   frontend.Variable `gnark:",public"`

	// Private inputs
	ActualAmount  frontend.Variable
	SenderKeyX    frontend.Variable
	SenderKeyY    frontend.Variable
	PaymentTime   frontend.Variable

	// EdDSA signature components
	SignatureR8X  frontend.Variable
	SignatureR8Y  frontend.Variable
	SignatureS    frontend.Variable
}

// Define declares the circuit constraints
func (circuit *PaymentCircuit) Define(api frontend.API) error {
	// Amount check
	api.AssertIsLessOrEqual(circuit.MinAmount, circuit.ActualAmount)

	// Time check
	timeDiff := api.Sub(circuit.CurrentTime, circuit.PaymentTime)
	api.AssertIsLessOrEqual(timeDiff, circuit.MaxBlockAge)

	// Hash payment details
	mimc, err := mimc.NewMiMC(api)
	if err != nil {
		return fmt.Errorf("failed to initialize MiMC: %w", err)
	}
	mimc.Write(circuit.ActualAmount)
	mimc.Write(circuit.SenderKeyX)
	mimc.Write(circuit.SenderKeyY)
	mimc.Write(circuit.RecipientKeyX)
	mimc.Write(circuit.RecipientKeyY)
	mimc.Write(circuit.PaymentTime)
	messageHash := mimc.Sum()

	// EdDSA signature verification
	curve, err := twistededwards.NewEdCurve(api, twistededwards.BN254)
	if err != nil {
		return fmt.Errorf("failed to initialize edwards curve: %w", err)
	}
	publicKey := eddsa.PublicKey{
		A: eddsa.Point{
			X: circuit.SenderKeyX,
			Y: circuit.SenderKeyY,
		},
		Curve: curve,
	}

	signature := eddsa.Signature{
		R: eddsa.Point{
			X: circuit.SignatureR8X,
			Y: circuit.SignatureR8Y,
		},
		S: circuit.SignatureS,
	}

	err = eddsa.Verify(api, signature, messageHash, publicKey)
	if err != nil {
		return fmt.Errorf("EdDSA verification constraint failed: %w", err)
	}

	return nil
}

// ProofRequest represents incoming proof generation request
type ProofRequest struct {
	// Public inputs
	MinAmount     string `json:"minAmount"`
	RecipientKeyX string `json:"recipientKeyX"`
	RecipientKeyY string `json:"recipientKeyY"`
	MaxBlockAge   string `json:"maxBlockAge"`
	CurrentTime   int64  `json:"currentTime"`

	// Private inputs
	ActualAmount  string `json:"actualAmount"`
	SenderKeyX    string `json:"senderKeyX"`
	SenderKeyY    string `json:"senderKeyY"`
	PaymentTime   int64  `json:"paymentTime"`

	// EdDSA signature
	SignatureR8X  string `json:"signatureR8x"`
	SignatureR8Y  string `json:"signatureR8y"`
	SignatureS    string `json:"signatureS"`
}

// ProofResponse represents the generated proof
type ProofResponse struct {
	Proof          string   `json:"proof"`
	PublicInputs   []string `json:"publicInputs"`
	GenerationTime int64    `json:"generationTimeMs"`
}

var (
	provingKey   groth16.ProvingKey
	verifyingKey groth16.VerifyingKey
	rateLimiter  *RateLimiter
	proofCache   *ProofCache
)

func main() {
	log.Println("Starting Umbra Protocol prover service...")

	log.Println("Compiling circuit...")
	if err := initializeCircuit(); err != nil {
		log.Fatalf("Failed to initialize circuit: %v", err)
	}

	log.Println("Circuit compiled successfully")

	rateLimiter = NewRateLimiter(10, time.Minute)
	log.Println("Rate limiter initialized")

	proofCache = NewProofCache(1000, time.Hour)
	log.Println("Proof cache initialized")

	log.Println("Prover service ready on :8080")

	// Start HTTP server
	router := gin.Default()

	// Add middlewares
	router.Use(rateLimitMiddleware())
	router.Use(metricsMiddleware())

	// Endpoints
	router.POST("/generate-proof", generateProofHandler)
	router.GET("/health", healthHandler)
	router.GET("/metrics", metricsHandler())
	router.GET("/cache/stats", cacheStatsHandler)

	if err := router.Run(":8080"); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

func initializeCircuit() error {
	var circuit PaymentCircuit
	ccs, err := frontend.Compile(ecc.BN254.ScalarField(), r1cs.NewBuilder, &circuit)
	if err != nil {
		return fmt.Errorf("circuit compilation failed: %w", err)
	}

	log.Printf("Circuit constraints: %d", ccs.GetNbConstraints())

	pk, vk, err := groth16.Setup(ccs)
	if err != nil {
		return fmt.Errorf("setup failed: %w", err)
	}

	provingKey = pk
	verifyingKey = vk

	return nil
}

func rateLimitMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		clientIP := c.ClientIP()

		if !rateLimiter.Allow(clientIP) {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error":   "Rate limit exceeded",
				"message": "Maximum 10 requests per minute. Please try again later.",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

func generateProofHandler(c *gin.Context) {
	startTime := time.Now()

	var req ProofRequest
	if err := c.BindJSON(&req); err != nil {
		log.Printf("Invalid request from %s: %v", c.ClientIP(), err)
		proofGenerationErrors.Inc()
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request format"})
		return
	}

	// Input validation
	if err := validateProofRequest(&req); err != nil {
		log.Printf("Validation failed from %s: %v", c.ClientIP(), err)
		proofGenerationErrors.Inc()
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check cache first
	if cached, found := proofCache.Get(&req); found {
		log.Printf("✓ Proof served from cache for %s", c.ClientIP())
		c.JSON(http.StatusOK, cached)
		return
	}

	log.Printf("Generating proof for %s", c.ClientIP())

	if err := preVerifySignature(&req); err != nil {
		log.Printf("Signature verification failed: %v", err)
		proofGenerationErrors.Inc()
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Invalid signature: %v", err)})
		return
	}

	// Create witness (assignment)
	assignment := PaymentCircuit{
		MinAmount:     req.MinAmount,
		RecipientKeyX: req.RecipientKeyX,
		RecipientKeyY: req.RecipientKeyY,
		MaxBlockAge:   req.MaxBlockAge,
		CurrentTime:   req.CurrentTime,
		ActualAmount:  req.ActualAmount,
		SenderKeyX:    req.SenderKeyX,
		SenderKeyY:    req.SenderKeyY,
		PaymentTime:   req.PaymentTime,
		SignatureR8X:  req.SignatureR8X,
		SignatureR8Y:  req.SignatureR8Y,
		SignatureS:    req.SignatureS,
	}

	// Create witness
	witness, err := frontend.NewWitness(&assignment, ecc.BN254.ScalarField())
	if err != nil {
		log.Printf("Witness creation failed: %v", err)
		proofGenerationErrors.Inc()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "witness creation failed"})
		return
	}

	proofStart := time.Now()
	proof, err := groth16.Prove(ccs, provingKey, witness)
	if err != nil {
		log.Printf("Proof generation failed: %v", err)
		proofGenerationErrors.Inc()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "proof generation failed"})
		return
	}
	proofGenerationDuration.Observe(time.Since(proofStart).Seconds())

	// Extract public witness
	publicWitness, err := witness.Public()
	if err != nil {
		log.Printf("Public witness extraction failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "public witness extraction failed"})
		return
	}

	// Verify proof (sanity check)
	verifyStart := time.Now()
	err = groth16.Verify(proof, verifyingKey, publicWitness)
	if err != nil {
		log.Printf("Proof verification failed: %v", err)
		proofGenerationErrors.Inc()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "generated proof is invalid"})
		return
	}
	proofVerificationDuration.Observe(time.Since(verifyStart).Seconds())

	generationTime := time.Since(startTime).Milliseconds()
	log.Printf("Proof generated in %dms", generationTime)

	proofGenerationTotal.Inc()

	// Serialize proof
	proofBytes, err := json.Marshal(proof)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "proof serialization failed"})
		return
	}

	// Extract public inputs as strings
	publicInputs := []string{
		req.MinAmount,
		req.RecipientKeyX,
		req.RecipientKeyY,
		req.MaxBlockAge,
		fmt.Sprintf("%d", req.CurrentTime),
	}

	response := ProofResponse{
		Proof:          string(proofBytes),
		PublicInputs:   publicInputs,
		GenerationTime: generationTime,
	}

	// Store in cache
	proofCache.Set(&req, &response)

	c.JSON(http.StatusOK, response)
}

func preVerifySignature(req *ProofRequest) error {
	senderX := new(big.Int)
	senderY := new(big.Int)
	senderX.SetString(req.SenderKeyX, 10)
	senderY.SetString(req.SenderKeyY, 10)

	r8x := new(big.Int)
	r8y := new(big.Int)
	s := new(big.Int)
	r8x.SetString(req.SignatureR8X, 10)
	r8y.SetString(req.SignatureR8Y, 10)
	s.SetString(req.SignatureS, 10)

	hFunc := hash.MIMC_BN254.New()
	actualAmount := new(big.Int)
	actualAmount.SetString(req.ActualAmount, 10)
	recipientX := new(big.Int)
	recipientY := new(big.Int)
	recipientX.SetString(req.RecipientKeyX, 10)
	recipientY.SetString(req.RecipientKeyY, 10)
	paymentTime := big.NewInt(req.PaymentTime)

	hFunc.Write(actualAmount.Bytes())
	hFunc.Write(senderX.Bytes())
	hFunc.Write(senderY.Bytes())
	hFunc.Write(recipientX.Bytes())
	hFunc.Write(recipientY.Bytes())
	hFunc.Write(paymentTime.Bytes())

	messageHash := hFunc.Sum(nil)

	var pubKey eddsa.PublicKey
	pubKey.A.X.SetBigInt(senderX)
	pubKey.A.Y.SetBigInt(senderY)

	var sig eddsa.Signature
	sig.R.X.SetBigInt(r8x)
	sig.R.Y.SetBigInt(r8y)
	sig.S.SetBytes(s.Bytes())

	isValid, err := pubKey.Verify(sig.Bytes(), messageHash, hash.MIMC_BN254.New())
	if err != nil {
		return fmt.Errorf("signature verification error: %w", err)
	}
	if !isValid {
		return fmt.Errorf("invalid EdDSA signature")
	}

	return nil
}

func cacheStatsHandler(c *gin.Context) {
	stats := proofCache.Stats()
	c.JSON(http.StatusOK, stats)
}

func validateProofRequest(req *ProofRequest) error {
	// Validate all required fields are present
	if req.MinAmount == "" {
		return fmt.Errorf("minAmount is required")
	}
	if req.RecipientKeyX == "" {
		return fmt.Errorf("recipientKeyX is required")
	}
	if req.RecipientKeyY == "" {
		return fmt.Errorf("recipientKeyY is required")
	}
	if req.ActualAmount == "" {
		return fmt.Errorf("actualAmount is required")
	}
	if req.SenderKeyX == "" {
		return fmt.Errorf("senderKeyX is required")
	}
	if req.SenderKeyY == "" {
		return fmt.Errorf("senderKeyY is required")
	}
	if req.SignatureR8X == "" {
		return fmt.Errorf("signatureR8x is required")
	}
	if req.SignatureR8Y == "" {
		return fmt.Errorf("signatureR8y is required")
	}
	if req.SignatureS == "" {
		return fmt.Errorf("signatureS is required")
	}

	// Validate string lengths (prevent buffer overflow)
	if len(req.MinAmount) > 100 {
		return fmt.Errorf("minAmount too long (max 100 chars)")
	}
	if len(req.RecipientKeyX) > 100 {
		return fmt.Errorf("recipientKeyX too long (max 100 chars)")
	}
	if len(req.RecipientKeyY) > 100 {
		return fmt.Errorf("recipientKeyY too long (max 100 chars)")
	}

	// Validate numeric strings contain only valid characters
	if !isValidNumeric(req.MinAmount) {
		return fmt.Errorf("minAmount must be numeric")
	}
	if !isValidNumeric(req.ActualAmount) {
		return fmt.Errorf("actualAmount must be numeric")
	}
	if !isValidNumeric(req.MaxBlockAge) {
		return fmt.Errorf("maxBlockAge must be numeric")
	}

	// Validate amounts are positive
	if req.MinAmount == "0" || req.MinAmount[0] == '-' {
		return fmt.Errorf("minAmount must be positive")
	}
	if req.ActualAmount == "0" || req.ActualAmount[0] == '-' {
		return fmt.Errorf("actualAmount must be positive")
	}

	// Validate timestamp is reasonable (within last 5 minutes)
	currentTime := time.Now().Unix()
	if req.CurrentTime < currentTime-300 || req.CurrentTime > currentTime+60 {
		return fmt.Errorf("currentTime must be within last 5 minutes")
	}

	if req.PaymentTime < currentTime-300 || req.PaymentTime > currentTime+60 {
		return fmt.Errorf("paymentTime must be within last 5 minutes")
	}

	// Validate paymentTime is before currentTime
	if req.PaymentTime > req.CurrentTime {
		return fmt.Errorf("paymentTime cannot be in the future")
	}

	return nil
}

func isValidNumeric(s string) bool {
	if s == "" {
		return false
	}
	for _, c := range s {
		if c < '0' || c > '9' {
			return false
		}
	}
	return true
}

func healthHandler(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":  "healthy",
		"service": "umbra-prover",
		"version": "1.0.0",
	})
}
