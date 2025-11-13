package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

type ProofDatabase struct {
	db *sql.DB
}

type ProofRecord struct {
	ID             int64
	RequestHash    string
	Proof          string
	PublicInputs   string
	ClientIP       string
	GenerationTime int64
	CreatedAt      time.Time
	ExpiresAt      time.Time
}

func NewProofDatabase() (*ProofDatabase, error) {
	dbPath := os.Getenv("DATABASE_PATH")
	if dbPath == "" {
		dbPath = "./proofs.db"
	}

	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	// Set connection pool settings
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)

	// Test connection
	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	proofDB := &ProofDatabase{db: db}

	// Initialize schema
	if err := proofDB.initSchema(); err != nil {
		return nil, fmt.Errorf("failed to initialize schema: %w", err)
	}

	log.WithFields(logrus.Fields{
		"database_path": dbPath,
	}).Info("Database initialized")

	return proofDB, nil
}

func (pdb *ProofDatabase) initSchema() error {
	schema := `
	CREATE TABLE IF NOT EXISTS proofs (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		request_hash TEXT NOT NULL UNIQUE,
		proof TEXT NOT NULL,
		public_inputs TEXT NOT NULL,
		client_ip TEXT NOT NULL,
		generation_time_ms INTEGER NOT NULL,
		created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
		expires_at TIMESTAMP NOT NULL,
		INDEX idx_request_hash (request_hash),
		INDEX idx_created_at (created_at),
		INDEX idx_expires_at (expires_at)
	);

	CREATE TABLE IF NOT EXISTS proof_verifications (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		proof_id INTEGER NOT NULL,
		client_ip TEXT NOT NULL,
		verified_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
		verification_result TEXT NOT NULL,
		FOREIGN KEY (proof_id) REFERENCES proofs(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS rate_limit_log (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		client_ip TEXT NOT NULL,
		endpoint TEXT NOT NULL,
		exceeded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
		INDEX idx_client_ip (client_ip),
		INDEX idx_exceeded_at (exceeded_at)
	);
	`

	_, err := pdb.db.Exec(schema)
	return err
}

func (pdb *ProofDatabase) StoreProof(req *ProofRequest, resp *ProofResponse, clientIP string, ttl time.Duration) error {
	requestHash := generateRequestHash(req)

	expiresAt := time.Now().Add(ttl)

	query := `
		INSERT OR REPLACE INTO proofs
		(request_hash, proof, public_inputs, client_ip, generation_time_ms, expires_at)
		VALUES (?, ?, ?, ?, ?, ?)
	`

	_, err := pdb.db.Exec(
		query,
		requestHash,
		resp.Proof,
		resp.PublicInputs,
		clientIP,
		resp.GenerationTime,
		expiresAt,
	)

	if err != nil {
		log.WithFields(logrus.Fields{
			"error":        err.Error(),
			"request_hash": requestHash,
		}).Error("Failed to store proof in database")
		return err
	}

	log.WithFields(logrus.Fields{
		"request_hash": requestHash,
		"client_ip":    clientIP,
		"expires_at":   expiresAt,
	}).Debug("Proof stored in database")

	return nil
}

func (pdb *ProofDatabase) GetProof(req *ProofRequest) (*ProofResponse, bool, error) {
	requestHash := generateRequestHash(req)

	query := `
		SELECT proof, public_inputs, generation_time_ms, expires_at
		FROM proofs
		WHERE request_hash = ? AND expires_at > datetime('now')
	`

	var proof, publicInputs string
	var generationTime int64
	var expiresAt time.Time

	err := pdb.db.QueryRow(query, requestHash).Scan(&proof, &publicInputs, &generationTime, &expiresAt)

	if err == sql.ErrNoRows {
		return nil, false, nil
	}

	if err != nil {
		log.WithFields(logrus.Fields{
			"error":        err.Error(),
			"request_hash": requestHash,
		}).Error("Failed to retrieve proof from database")
		return nil, false, err
	}

	response := &ProofResponse{
		Proof:          proof,
		PublicInputs:   publicInputs,
		GenerationTime: 0, // Cached, so 0ms
	}

	log.WithFields(logrus.Fields{
		"request_hash": requestHash,
	}).Debug("Proof retrieved from database")

	return response, true, nil
}

func (pdb *ProofDatabase) LogRateLimitExceeded(clientIP, endpoint string) error {
	query := `INSERT INTO rate_limit_log (client_ip, endpoint) VALUES (?, ?)`
	_, err := pdb.db.Exec(query, clientIP, endpoint)
	return err
}

func (pdb *ProofDatabase) CleanupExpiredProofs() error {
	query := `DELETE FROM proofs WHERE expires_at < datetime('now')`
	result, err := pdb.db.Exec(query)

	if err != nil {
		return err
	}

	rowsDeleted, _ := result.RowsAffected()

	if rowsDeleted > 0 {
		log.WithFields(logrus.Fields{
			"rows_deleted": rowsDeleted,
		}).Info("Cleaned up expired proofs")
	}

	return nil
}

func (pdb *ProofDatabase) GetStats() (map[string]interface{}, error) {
	stats := make(map[string]interface{})

	// Count total proofs
	var totalProofs int64
	err := pdb.db.QueryRow("SELECT COUNT(*) FROM proofs").Scan(&totalProofs)
	if err != nil {
		return nil, err
	}
	stats["total_proofs"] = totalProofs

	// Count active proofs (not expired)
	var activeProofs int64
	err = pdb.db.QueryRow("SELECT COUNT(*) FROM proofs WHERE expires_at > datetime('now')").Scan(&activeProofs)
	if err != nil {
		return nil, err
	}
	stats["active_proofs"] = activeProofs

	// Count expired proofs
	var expiredProofs int64
	err = pdb.db.QueryRow("SELECT COUNT(*) FROM proofs WHERE expires_at <= datetime('now')").Scan(&expiredProofs)
	if err != nil {
		return nil, err
	}
	stats["expired_proofs"] = expiredProofs

	// Count rate limit violations (last 24 hours)
	var rateLimitViolations int64
	err = pdb.db.QueryRow("SELECT COUNT(*) FROM rate_limit_log WHERE exceeded_at > datetime('now', '-1 day')").Scan(&rateLimitViolations)
	if err != nil {
		return nil, err
	}
	stats["rate_limit_violations_24h"] = rateLimitViolations

	return stats, nil
}

func (pdb *ProofDatabase) Close() error {
	return pdb.db.Close()
}

func generateRequestHash(req *ProofRequest) string {
	// Create deterministic hash from request
	data := fmt.Sprintf("%s:%s:%s:%d:%s:%s:%s:%d:%s",
		req.MinAmount,
		req.RecipientKey,
		req.MaxBlockAge,
		req.CurrentTime,
		req.ActualAmount,
		req.SenderKey,
		req.TxHash,
		req.PaymentTime,
		req.Signature,
	)

	// Simple hash (in production, use SHA256)
	hash := fmt.Sprintf("%x", []byte(data))
	return hash[:64] // Limit to 64 chars
}

// StartCleanupWorker runs a background job to clean up expired proofs
func (pdb *ProofDatabase) StartCleanupWorker() {
	ticker := time.NewTicker(1 * time.Hour)

	go func() {
		for range ticker.C {
			if err := pdb.CleanupExpiredProofs(); err != nil {
				log.WithFields(logrus.Fields{
					"error": err.Error(),
				}).Error("Failed to cleanup expired proofs")
			}
		}
	}()

	log.Info("Database cleanup worker started (runs every 1 hour)")
}
