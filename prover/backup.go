package main

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"
)

type BackupManager struct {
	backupPath      string
	backupInterval  time.Duration
	retentionPeriod time.Duration
}

func NewBackupManager(backupPath string, intervalHours int) *BackupManager {
	if backupPath == "" {
		backupPath = "./backups"
	}

	// Create backup directory if it doesn't exist
	if err := os.MkdirAll(backupPath, 0755); err != nil {
		log.WithFields(logrus.Fields{
			"error": err.Error(),
			"path":  backupPath,
		}).Error("Failed to create backup directory")
	}

	return &BackupManager{
		backupPath:      backupPath,
		backupInterval:  time.Duration(intervalHours) * time.Hour,
		retentionPeriod: 7 * 24 * time.Hour, // Keep backups for 7 days
	}
}

func (bm *BackupManager) StartBackupWorker(dbPath string) {
	ticker := time.NewTicker(bm.backupInterval)

	go func() {
		// Run backup immediately on start
		if err := bm.BackupDatabase(dbPath); err != nil {
			log.WithFields(logrus.Fields{
				"error": err.Error(),
			}).Error("Initial backup failed")
		}

		// Then run on schedule
		for range ticker.C {
			if err := bm.BackupDatabase(dbPath); err != nil {
				log.WithFields(logrus.Fields{
					"error": err.Error(),
				}).Error("Scheduled backup failed")
			}

			// Clean up old backups
			if err := bm.CleanupOldBackups(); err != nil {
				log.WithFields(logrus.Fields{
					"error": err.Error(),
				}).Error("Backup cleanup failed")
			}
		}
	}()

	log.WithFields(logrus.Fields{
		"interval_hours": bm.backupInterval.Hours(),
		"backup_path":    bm.backupPath,
	}).Info("Backup worker started")
}

func (bm *BackupManager) BackupDatabase(dbPath string) error {
	// Generate backup filename with timestamp
	timestamp := time.Now().Format("2006-01-02_15-04-05")
	backupFile := filepath.Join(bm.backupPath, fmt.Sprintf("proofs_backup_%s.db", timestamp))

	// Open source database
	source, err := os.Open(dbPath)
	if err != nil {
		return fmt.Errorf("failed to open source database: %w", err)
	}
	defer source.Close()

	// Create backup file
	destination, err := os.Create(backupFile)
	if err != nil {
		return fmt.Errorf("failed to create backup file: %w", err)
	}
	defer destination.Close()

	// Copy database
	bytesWritten, err := io.Copy(destination, source)
	if err != nil {
		return fmt.Errorf("failed to copy database: %w", err)
	}

	// Sync to disk
	if err := destination.Sync(); err != nil {
		return fmt.Errorf("failed to sync backup file: %w", err)
	}

	log.WithFields(logrus.Fields{
		"backup_file": backupFile,
		"size_bytes":  bytesWritten,
	}).Info("Database backup completed successfully")

	return nil
}

func (bm *BackupManager) CleanupOldBackups() error {
	cutoffTime := time.Now().Add(-bm.retentionPeriod)

	files, err := os.ReadDir(bm.backupPath)
	if err != nil {
		return fmt.Errorf("failed to read backup directory: %w", err)
	}

	deletedCount := 0

	for _, file := range files {
		if file.IsDir() {
			continue
		}

		// Check if file is a backup file
		if filepath.Ext(file.Name()) != ".db" {
			continue
		}

		// Get file info
		info, err := file.Info()
		if err != nil {
			log.WithFields(logrus.Fields{
				"file":  file.Name(),
				"error": err.Error(),
			}).Warn("Failed to get file info")
			continue
		}

		// Delete if older than retention period
		if info.ModTime().Before(cutoffTime) {
			filePath := filepath.Join(bm.backupPath, file.Name())
			if err := os.Remove(filePath); err != nil {
				log.WithFields(logrus.Fields{
					"file":  filePath,
					"error": err.Error(),
				}).Warn("Failed to delete old backup")
			} else {
				deletedCount++
				log.WithFields(logrus.Fields{
					"file": filePath,
					"age":  time.Since(info.ModTime()),
				}).Debug("Deleted old backup")
			}
		}
	}

	if deletedCount > 0 {
		log.WithFields(logrus.Fields{
			"deleted_count": deletedCount,
		}).Info("Cleanup of old backups completed")
	}

	return nil
}

func (bm *BackupManager) RestoreDatabase(backupFile, targetPath string) error {
	// Verify backup file exists
	if _, err := os.Stat(backupFile); os.IsNotExist(err) {
		return fmt.Errorf("backup file does not exist: %s", backupFile)
	}

	// Backup current database before restoring
	if _, err := os.Stat(targetPath); err == nil {
		backupCurrent := targetPath + ".before_restore"
		if err := os.Rename(targetPath, backupCurrent); err != nil {
			return fmt.Errorf("failed to backup current database: %w", err)
		}
		log.WithFields(logrus.Fields{
			"backup_file": backupCurrent,
		}).Info("Current database backed up before restore")
	}

	// Open backup file
	source, err := os.Open(backupFile)
	if err != nil {
		return fmt.Errorf("failed to open backup file: %w", err)
	}
	defer source.Close()

	// Create target file
	destination, err := os.Create(targetPath)
	if err != nil {
		return fmt.Errorf("failed to create target file: %w", err)
	}
	defer destination.Close()

	// Copy backup to target
	bytesWritten, err := io.Copy(destination, source)
	if err != nil {
		return fmt.Errorf("failed to restore database: %w", err)
	}

	// Sync to disk
	if err := destination.Sync(); err != nil {
		return fmt.Errorf("failed to sync restored database: %w", err)
	}

	log.WithFields(logrus.Fields{
		"backup_file": backupFile,
		"target_path": targetPath,
		"size_bytes":  bytesWritten,
	}).Info("Database restored successfully")

	return nil
}

func (bm *BackupManager) ListBackups() ([]BackupInfo, error) {
	files, err := os.ReadDir(bm.backupPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read backup directory: %w", err)
	}

	var backups []BackupInfo

	for _, file := range files {
		if file.IsDir() {
			continue
		}

		if filepath.Ext(file.Name()) != ".db" {
			continue
		}

		info, err := file.Info()
		if err != nil {
			continue
		}

		backups = append(backups, BackupInfo{
			Name:      file.Name(),
			Path:      filepath.Join(bm.backupPath, file.Name()),
			Size:      info.Size(),
			CreatedAt: info.ModTime(),
		})
	}

	return backups, nil
}

type BackupInfo struct {
	Name      string    `json:"name"`
	Path      string    `json:"path"`
	Size      int64     `json:"size"`
	CreatedAt time.Time `json:"created_at"`
}
